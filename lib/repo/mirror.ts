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
 * 미설정/실패 시 null 을 반환해 호출부가 판단하도록 한다(폴백 없음 정책이지만, 방어적).
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
    console.warn(`[mirror] readEntity(${entity}) 실패`, e);
    return null;
  }
}

/** 엔티티의 단일 레코드를 id 로 조회. */
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
    console.warn(`[mirror] readEntityOne(${entity},${id}) 실패`, e);
    return null;
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
    const { error } = await client
      .from(TABLE)
      .upsert(
        { entity, id, data, deleted: false, dirty: true, updated_at: new Date().toISOString() },
        { onConflict: "entity,id" },
      );
    if (error) throw error;
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
    const { error } = await client
      .from(TABLE)
      .update({ deleted: true, dirty: true, updated_at: new Date().toISOString() })
      .eq("entity", entity)
      .eq("id", id);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn(`[mirror] deleteEntity(${entity},${id}) 실패`, e);
    return false;
  }
}
