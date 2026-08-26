import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────────
// assetify-for-desktop이 직접 붙는 맥북 중앙 Postgres(자체 Supabase, Tailscale Funnel
// 경유)의 public.kv 테이블에 대한 읽기/쓰기 — SaaS 도메인 정책(portal:saasdb) 조회와
// SaaS 사용 현황(portal:saas_usage) 기록 전용이다.
//
// 이 저장소(sw-portal-next)의 나머지 데이터는 Notion + Upstash Redis 캐시(lib/kv-store.ts)를
// 쓰고 있고, 이건 별개의 DB다 — 혼동하지 말 것. service_role 키는 RLS를 우회하는 전체
// 접근 권한이라, 이 파일은 서버 전용 코드(Next.js route handler)에서만 import해야 한다.
// 절대 "use client" 파일이나 NEXT_PUBLIC_* 값으로 노출하지 말 것.
// ─────────────────────────────────────────────────────────────────────────────

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
      global: {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Pragma": "no-cache",
        },
      },
    });
    return _client;
  } catch (e) {
    // 원인을 삼키면 "환경변수 미설정"으로 오진되니 경고만 남기고 null 반환.
    console.warn("[pg-kv] Supabase 클라이언트 생성 실패:", e);
    return null;
  }
}

function notExpired(): string {
  return `expires_at.is.null,expires_at.gte.${new Date().toISOString()}`;
}

/**
 * 읽기 실패(DB 연결 불가, 미설정 등) 시 null을 반환한다 — 호출부는 이걸
 * "카탈로그를 알 수 없음"으로 취급해 fail-closed(아무 도메인도 통과시키지 않음)해야 한다.
 */
export async function pgKvGet<T>(key: string): Promise<T | null> {
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
        console.warn("[pg-kv] get failed after retry:", key, e);
        return null;
      }
    }
  }
  return null;
}

/** 영구 저장(TTL 없음) — assetify-for-desktop과 같은 방식(kvSetPermanent)으로 맞춘다. */
export async function pgKvSetPermanent<T>(key: string, value: T): Promise<boolean> {
  const client = getClient();
  if (!client) return false;
  const nowIso = new Date().toISOString();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { data: rows, error } = await client
        .from(TABLE)
        .upsert({ key, value, expires_at: null, updated_at: nowIso }, { onConflict: "key" })
        .select("key");
      if (error) throw error;
      if (!rows || rows.length === 0) {
        console.warn("[pg-kv] setPermanent 0행 반영(권한/RLS 의심):", key);
        return false;
      }
      return true;
    } catch (e) {
      if (attempt === 1) {
        console.warn("[pg-kv] setPermanent failed after retry:", key, e);
        return false;
      }
    }
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// 같은 키에 대한 읽기-수정-쓰기 직렬화 (assetify-for-desktop core/kv-store.ts의
// kvUpdate와 동일한 이유 — PC별 SaaS 사용 현황 병합처럼 "현재 값을 읽고 고쳐서 다시
// 쓰는" 갱신이 동시에 여러 PC 스캔 요청으로 들어오면, 나중 응답이 앞선 응답을 통째로
// 덮어써 먼저 들어온 PC의 기록이 사라질 수 있다(lost update). Vercel 서버리스는
// 인스턴스가 여러 개 뜰 수 있어 이 in-process 락이 경합을 완전히 막지는 못하지만,
// 같은 인스턴스가 연속 처리하는 흔한 경우는 방지한다.
// ─────────────────────────────────────────────────────────────────────────────
const kvLocks = new Map<string, Promise<unknown>>();

export async function pgKvUpdate<T>(
  key: string,
  update: (current: T | null) => T | Promise<T>,
): Promise<{ ok: boolean; value: T | null }> {
  const prev = kvLocks.get(key) ?? Promise.resolve();
  const run = prev.then(async () => {
    const current = await pgKvGet<T>(key);
    const next = await update(current);
    const ok = await pgKvSetPermanent(key, next);
    return { ok, value: ok ? next : current };
  });

  const guarded = run.catch(() => undefined);
  kvLocks.set(key, guarded);
  void guarded.then(() => { if (kvLocks.get(key) === guarded) kvLocks.delete(key); });

  return run;
}
