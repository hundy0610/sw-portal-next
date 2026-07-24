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
      headers: SWP_DB_SECRET ? { "x-swp-secret": SWP_DB_SECRET } : {},
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
