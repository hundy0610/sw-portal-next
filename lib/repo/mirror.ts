import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────────
// 제네릭 엔티티 미러 접근 (4.0verMACBOOK)
//
// 맥북 Postgres public.entity_store 를 모든 Notion 연동 엔티티의 메인 저장소로 쓴다.
// 앱 lib 계층(fetchX/createX/updateX)이 Notion 대신 이 함수들을 호출하고, 변경분은
// dirty=true 로 표시된다. 5분마다 launchd 백업 잡이 dirty 행을 Notion 으로 반영한다.
//
// 모든 접근은 서버 전용 service_role(SUPABASE_URL/SUPABASE_KEY)로만 이뤄진다.
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  if (_client) return _client;
  try {
    _client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      // Funnel 경로 중간에 페이지네이션(Range 헤더) 응답을 캐싱하는 프록시가 있을 가능성이
      // 있어 명시적으로 캐시 금지를 요청한다 (lib/repo/hw.ts와 동일한 대응).
      global: {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Pragma": "no-cache",
        },
      },
    });
    return _client;
  } catch {
    return null;
  }
}

export function isMirrorEnabled(): boolean {
  return !!getClient();
}

const TABLE = "entity_store";
const PAGE = 1000; // PostgREST 기본 최대 반환 행수

/**
 * 엔티티의 전체 레코드(soft-deleted 제외)를 반환한다. data(jsonb)를 그대로 앱 레코드로 돌려준다.
 *
 * 반환/throw 규약:
 *  - 미러 미설정(SUPABASE_URL/KEY 없음) → null. 호출부는 Notion(시드/폴백)으로 넘어간다.
 *  - 미러 설정됨 + 조회 성공 → 레코드 배열(0건이면 []).
 *  - 미러 설정됨 + 조회 실패(Funnel 다운/키 오류/RLS/네트워크) → **throw**.
 *    이때 조용히 null 을 돌려주면 호출부가 5분 지연되는 Notion 백업으로 폴백해,
 *    방금 저장된 최신 레코드가 목록에서 누락된다("DB엔 저장됐고 Notion엔 넘어갔는데
 *    앱엔 안 보임" 증상). Postgres 가 메인 소스인 이상 읽기 실패는 숨기지 않고 드러낸다.
 */
export async function readEntity<T>(entity: string): Promise<T[] | null> {
  const client = getClient();
  if (!client) return null;
  try {
    const all: T[] = [];
    let from = 0;
    for (let page = 0; page < 1000; page++) {
      const { data, error } = await client
        .from(TABLE)
        .select("data")
        .eq("entity", entity)
        .eq("deleted", false)
        .range(from, from + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const row of data as { data: T }[]) all.push(row.data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    return all;
  } catch (e) {
    console.error(`[mirror] readEntity(${entity}) 실패 — Notion 폴백 대신 오류 전파`, e);
    throw e instanceof Error ? e : new Error(`mirror readEntity(${entity}) failed`);
  }
}

/**
 * 엔티티의 단일 레코드를 id 로 조회.
 * 규약은 readEntity 와 동일: 미설정→null, 없음/삭제됨→null, 설정됨+조회실패→throw.
 */
export async function readEntityOne<T>(entity: string, id: string): Promise<T | null> {
  const client = getClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from(TABLE)
      .select("data,deleted")
      .eq("entity", entity)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data || (data as { deleted: boolean }).deleted) return null;
    return (data as { data: T }).data;
  } catch (e) {
    console.error(`[mirror] readEntityOne(${entity},${id}) 실패 — Notion 폴백 대신 오류 전파`, e);
    throw e instanceof Error ? e : new Error(`mirror readEntityOne(${entity},${id}) failed`);
  }
}

/**
 * 레코드 생성/수정(upsert). dirty=true 로 표시해 다음 백업에서 Notion 에 반영되게 한다.
 * notion_id 는 페이로드에 넣지 않으므로 기존 값이 보존된다(백업 성공 시에만 기록).
 * 반환: 성공 여부.
 */
export async function upsertEntity(entity: string, id: string, data: unknown): Promise<boolean> {
  const client = getClient();
  if (!client) return false;
  try {
    // .select() 로 실제 반영된 행을 받아 확인한다 — RLS 등으로 0행 적용돼도
    // error 는 null 이라 .select() 없이는 "성공"으로 오판하는 무음 실패가 된다.
    const { data: rows, error } = await client
      .from(TABLE)
      .upsert(
        { entity, id, data, deleted: false, dirty: true, updated_at: new Date().toISOString() },
        { onConflict: "entity,id" },
      )
      .select("id");
    if (error) throw error;
    if (!rows || rows.length === 0) {
      console.warn(`[mirror] upsertEntity(${entity},${id}) 0행 반영(권한/RLS 의심)`);
      return false;
    }
    return true;
  } catch (e) {
    console.warn(`[mirror] upsertEntity(${entity},${id}) 실패`, e);
    return false;
  }
}

/** 소프트 삭제. 백업 잡이 Notion 페이지를 archive 한다. 반환: 성공 여부. */
export async function deleteEntity(entity: string, id: string): Promise<boolean> {
  const client = getClient();
  if (!client) return false;
  try {
    const { data, error } = await client
      .from(TABLE)
      .update({ deleted: true, dirty: true, updated_at: new Date().toISOString() })
      .eq("entity", entity)
      .eq("id", id)
      .select("id");
    if (error) throw error;
    if (!data || data.length === 0) {
      console.warn(`[mirror] deleteEntity(${entity},${id}) 0행 반영(권한/RLS 의심)`);
      return false;
    }
    return true;
  } catch (e) {
    console.warn(`[mirror] deleteEntity(${entity},${id}) 실패`, e);
    return false;
  }
}
