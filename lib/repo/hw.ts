import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { HwRecord } from "@/lib/hw";

// ─────────────────────────────────────────────────────────────────────────────
// HW 데이터 접근 스위치 (4.0verMACBOOK)
//
// DATA_SOURCE=postgres 이고 SUPABASE_URL/SUPABASE_KEY 가 있으면 맥북 Postgres(자체
// 호스팅 Supabase, Tailscale Funnel 경유)를 1차 소스로 사용한다. 미설정이거나 조회가
// 실패/지연되면 null 을 반환해, 호출부가 기존 KV/Notion 경로로 자동 폴백하도록 한다.
// (UI·기존 로직 무수정 목표 — route.ts 한 곳에서만 이 함수를 먼저 호출)
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL;
// KV 와 동일한 서버 전용 service_role 키(브라우저 노출 금지). RLS 우회로 읽기 수행.
const SUPABASE_KEY = process.env.SUPABASE_KEY;
// 공개 Funnel 경로에 대한 커스텀 공유 시크릿(보완책, 선택). 값이 있을 때만 헤더로 전송한다.
const SWP_DB_SECRET = process.env.SWP_DB_SECRET;

const postgresEnabled =
  process.env.DATA_SOURCE === "postgres" && !!SUPABASE_URL && !!SUPABASE_KEY;

let sb: SupabaseClient | null = null;
if (postgresEnabled) {
  sb = createClient(SUPABASE_URL as string, SUPABASE_KEY as string, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      // Funnel 경로 중간에 페이지네이션(Range 헤더) 응답을 캐싱하는 프록시가 있을 가능성이
      // 있어 명시적으로 캐시 금지를 요청한다 (getHwAllFromPostgres 전체목록 조회가 옛날
      // 값을 돌려주는 문제 대응).
      headers: {
        ...(SWP_DB_SECRET ? { "x-swp-secret": SWP_DB_SECRET } : {}),
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
      },
    },
  });
}

export function isPostgresEnabled(): boolean {
  return postgresEnabled;
}

// PostgREST 기본 최대 반환 행수(PGRST_DB_MAX_ROWS). 초과분은 range 로 페이지네이션.
const PAGE = 1000;

/**
 * 전체 HW 레코드를 맥북 Postgres 에서 조회한다.
 * - postgres 미사용/미설정: null (호출부가 기존 경로 사용)
 * - 조회 실패(맥북/터널 다운 등): null (자동 폴백)
 * 컬럼명이 HwRecord 키와 동일하므로 별도 매핑 없이 그대로 반환한다.
 */
export async function getHwAllFromPostgres(): Promise<HwRecord[] | null> {
  if (!sb) return null;
  try {
    const all: HwRecord[] = [];
    let from = 0;
    // 안전장치: 무한루프 방지를 위해 최대 100페이지(10만행)까지만
    for (let page = 0; page < 100; page++) {
      const { data, error } = await sb
        .from("hw")
        .select("*")
        .eq("deleted", false)
        .order("purchaseDate", { ascending: false })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      all.push(...(data as unknown as HwRecord[]));
      if (data.length < PAGE) break;
      from += PAGE;
    }
    return all;
  } catch (e) {
    console.warn("[hw-repo] Postgres 조회 실패 → 기존 KV/Notion 경로로 폴백", e);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 쓰기(write-through) — 4.0verMACBOOK: HW 의 메인 저장소는 맥북 Postgres.
// 앱은 여기(hw 테이블)에 직접 쓰고 dirty=true 로 표시한다. 5분 뒤 launchd 백업 잡이
// dirty 행을 Notion 으로 단방향 반영한다. Notion 직접 쓰기는 하지 않는다(속도/드리프트 해결).
// 모든 쓰기는 service_role 키로 수행(RLS 우회). 실패 시 false 를 반환한다.
// ─────────────────────────────────────────────────────────────────────────────

/** 단일 HW 레코드의 일부 필드 수정 + dirty 표시. 존재하는 컬럼만 넘겨야 한다. */
export async function updateHwFields(
  id: string,
  fields: Record<string, unknown>,
): Promise<boolean> {
  if (!sb) return false;
  try {
    const { error } = await sb
      .from("hw")
      .update({ ...fields, dirty: true, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn("[hw-repo] updateHwFields 실패", id, e);
    return false;
  }
}

/** 동일 fields 를 여러 id 에 일괄 적용 + dirty 표시. */
export async function bulkUpdateHwFields(
  ids: string[],
  fields: Record<string, unknown>,
): Promise<boolean> {
  if (!sb || ids.length === 0) return false;
  try {
    const { error } = await sb
      .from("hw")
      .update({ ...fields, dirty: true, updated_at: new Date().toISOString() })
      .in("id", ids);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn("[hw-repo] bulkUpdateHwFields 실패", e);
    return false;
  }
}

/** 신규 HW 레코드 생성 + dirty 표시(notion_id 는 백업 성공 후 러너가 채운다). */
export async function insertHwRecord(record: Record<string, unknown>): Promise<boolean> {
  return insertHwRecords([record]);
}

/** 신규 HW 레코드 여러 건 생성 + dirty 표시. */
export async function insertHwRecords(records: Record<string, unknown>[]): Promise<boolean> {
  if (!sb || records.length === 0) return false;
  try {
    const now = new Date().toISOString();
    const rows = records.map(r => ({ ...r, dirty: true, deleted: false, updated_at: now }));
    const { error } = await sb.from("hw").insert(rows);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn("[hw-repo] insertHwRecords 실패", e);
    return false;
  }
}

/** 소프트 삭제 + dirty 표시. 백업 잡이 Notion 페이지를 archive 한다. */
export async function softDeleteHw(ids: string[]): Promise<boolean> {
  if (!sb || ids.length === 0) return false;
  try {
    const { error } = await sb
      .from("hw")
      .update({ deleted: true, dirty: true, updated_at: new Date().toISOString() })
      .in("id", ids);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn("[hw-repo] softDeleteHw 실패", e);
    return false;
  }
}

/** 여러 id 의 법인명 조회(범위 검증용). Map<id, company> 반환. */
export async function getHwCompaniesByIds(ids: string[]): Promise<Map<string, string> | null> {
  if (!sb || ids.length === 0) return null;
  try {
    const { data, error } = await sb
      .from("hw")
      .select("id,company")
      .in("id", ids);
    if (error) throw error;
    const map = new Map<string, string>();
    for (const r of (data ?? []) as { id: string; company: string }[]) map.set(r.id, r.company ?? "");
    return map;
  } catch (e) {
    console.warn("[hw-repo] getHwCompaniesByIds 실패", e);
    return null;
  }
}

/** 자산번호로 단건 조회(삭제분 제외) — 공개 자산 자가조회(QR)용. 최근 구매일 우선. */
export async function getHwByAssetNoFromPostgres(assetNo: string): Promise<HwRecord | null> {
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from("hw")
      .select("*")
      .eq("assetNo", assetNo)
      .eq("deleted", false)
      .order("purchaseDate", { ascending: false })
      .limit(1);
    if (error) throw error;
    const row = (data ?? [])[0];
    return (row as unknown as HwRecord) ?? null;
  } catch (e) {
    console.warn("[hw-repo] getHwByAssetNoFromPostgres 실패", assetNo, e);
    return null;
  }
}

/** 단일 HW 레코드 조회(삭제분 제외) — 법인 범위 검증 등에 사용. */
export async function getHwByIdFromPostgres(id: string): Promise<HwRecord | null> {
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from("hw")
      .select("*")
      .eq("id", id)
      .eq("deleted", false)
      .maybeSingle();
    if (error) throw error;
    return (data as unknown as HwRecord) ?? null;
  } catch (e) {
    console.warn("[hw-repo] getHwByIdFromPostgres 실패", id, e);
    return null;
  }
}

/**
 * 단건 조회 — 실패를 숨기지 않고 그대로 throw (findHwById/findHwByAssetNo 전용).
 * HW 는 Postgres 가 메인 소스이므로, 조회 실패 시 오래된 Notion 백업으로 조용히
 * 폴백하지 않고 호출부가 에러를 그대로 사용자에게 노출하도록 한다.
 */
export async function getHwByIdFromPostgresOrThrow(id: string): Promise<HwRecord | null> {
  if (!sb) throw new Error("데이터 저장소(Postgres)가 설정되지 않았습니다.");
  const { data, error } = await sb
    .from("hw")
    .select("*")
    .eq("id", id)
    .eq("deleted", false)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as HwRecord) ?? null;
}

/** 자산번호 버전 — 규약은 getHwByIdFromPostgresOrThrow 와 동일. */
export async function getHwByAssetNoFromPostgresOrThrow(assetNo: string): Promise<HwRecord | null> {
  if (!sb) throw new Error("데이터 저장소(Postgres)가 설정되지 않았습니다.");
  const { data, error } = await sb
    .from("hw")
    .select("*")
    .eq("assetNo", assetNo)
    .eq("deleted", false)
    .order("purchaseDate", { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = (data ?? [])[0];
  return (row as unknown as HwRecord) ?? null;
}
