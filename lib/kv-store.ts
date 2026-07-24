import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────────
// KV 저장소 백엔드 (4.0verMACBOOK)
//
// 기존 Upstash Redis 대신 맥북 중앙 Postgres(자체 Supabase, Tailscale Funnel 경유)의
// public.kv 테이블(scripts/sql/002_kv.sql)을 사용한다. 함수 시그니처는 이전과 동일해
// 호출부(~70개 파일)는 무수정이다. 모든 접근은 서버 전용 service_role 키로만 이뤄진다.
//
//   value      : jsonb — 저장한 객체/배열/원시값을 그대로 반환
//   expires_at : null=영구(kvSetPermanent), 값 있음=TTL 만료 시각(kvSet)
// 조회 시 만료분은 여기서 제외하고, 실제 행 삭제는 kv-cleanup 크론이 담당한다.
// ─────────────────────────────────────────────────────────────────────────────

// KV TTL: 24시간 — 명시적 ttl 미지정 시 기본값
export const KV_TTL = 86400;

const TABLE = "kv";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  if (_client) return _client;
  try {
    _client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return _client;
  } catch {
    return null;
  }
}

// 만료 제외 조건: expires_at 이 null(영구)이거나 아직 미래인 행만.
function notExpired(): string {
  return `expires_at.is.null,expires_at.gte.${new Date().toISOString()}`;
}

/**
 * KV에서 값 읽기. 미설정이거나 오류 시 null 반환.
 * Postgres 조회가 간헐적으로 실패할 수 있어(네트워크/터널) 한 번 더 재시도한 뒤에만 null 처리한다.
 */
export async function kvGet<T>(key: string): Promise<T | null> {
  const client = getClient();
  if (!client) return null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { data, error } = await client
        .from(TABLE)
        .select("value")
        .eq("key", key)
        .or(notExpired())
        .maybeSingle();
      if (error) throw error;
      return (data?.value ?? null) as T | null;
    } catch (e) {
      if (attempt === 1) {
        console.warn("[KV] get failed after retry:", key, e);
        return null;
      }
    }
  }
  return null;
}

/**
 * KV에 값 저장 (TTL 있음, 기본 24시간). 성공 여부를 boolean으로 반환한다 — 실패를 "성공"으로
 * 착각하면 안 되는 저장(중복발송 방지 키 등)은 이 값을 반드시 확인해야 한다.
 */
export async function kvSet<T>(key: string, value: T, ttl = KV_TTL): Promise<boolean> {
  const client = getClient();
  if (!client) return false;
  const nowIso = new Date().toISOString();
  const expires_at = new Date(Date.now() + ttl * 1000).toISOString();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { error } = await client
        .from(TABLE)
        .upsert({ key, value, expires_at, updated_at: nowIso }, { onConflict: "key" });
      if (error) throw error;
      return true;
    } catch (e) {
      if (attempt === 1) {
        console.warn("[KV] set failed after retry:", key, e);
        return false;
      }
    }
  }
  return false;
}

/**
 * KV에 값 영구 저장 (TTL 없음). 공지사항/강의/자료/매뉴얼/계정 등 관리 데이터에 사용.
 * 성공 여부를 boolean으로 반환한다(사용자가 결과를 기다리는 저장은 이 값을 확인).
 */
export async function kvSetPermanent<T>(key: string, value: T): Promise<boolean> {
  const client = getClient();
  if (!client) return false;
  const nowIso = new Date().toISOString();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { error } = await client
        .from(TABLE)
        .upsert({ key, value, expires_at: null, updated_at: nowIso }, { onConflict: "key" });
      if (error) throw error;
      return true;
    } catch (e) {
      if (attempt === 1) {
        console.warn("[KV] setPermanent failed after retry:", key, e);
        return false;
      }
    }
  }
  return false;
}

/**
 * KV 다중 키 한 번에 읽기 (요청 1회). 입력 keys 순서 그대로, 없는/만료된 키는 null 로 채워 반환한다.
 */
export async function kvMGet<T>(keys: string[]): Promise<(T | null)[]> {
  const client = getClient();
  if (!client || keys.length === 0) return keys.map(() => null);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { data, error } = await client
        .from(TABLE)
        .select("key,value")
        .in("key", keys)
        .or(notExpired());
      if (error) throw error;
      const map = new Map<string, T>();
      for (const row of (data ?? []) as { key: string; value: T }[]) map.set(row.key, row.value);
      return keys.map(k => (map.has(k) ? (map.get(k) as T) : null));
    } catch (e) {
      if (attempt === 1) {
        console.warn("[KV] mget failed after retry:", keys, e);
        return keys.map(() => null);
      }
    }
  }
  return keys.map(() => null);
}

/**
 * KV 캐시 삭제
 */
export async function kvDel(...keys: string[]): Promise<void> {
  const client = getClient();
  if (!client || keys.length === 0) return;
  try {
    const { error } = await client.from(TABLE).delete().in("key", keys);
    if (error) throw error;
  } catch (e) {
    console.warn("[KV] del failed:", keys, e);
  }
}

/**
 * 만료된(expires_at < now) 행을 물리 삭제한다. kv-cleanup 크론에서 호출.
 * 조회는 이미 만료분을 제외하므로 이 작업은 저장공간 청소 목적이다. 삭제 건수를 반환한다.
 */
export async function kvSweepExpired(): Promise<number> {
  const client = getClient();
  if (!client) return 0;
  try {
    const { data, error } = await client
      .from(TABLE)
      .delete()
      .not("expires_at", "is", null)
      .lt("expires_at", new Date().toISOString())
      .select("key");
    if (error) throw error;
    return data?.length ?? 0;
  } catch (e) {
    console.warn("[KV] sweep expired failed:", e);
    return 0;
  }
}
