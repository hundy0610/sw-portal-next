import { NextResponse } from "next/server";
import { fetchHelpDeskTickets } from "@/lib/notion";
import { kvSet } from "@/lib/kv-store";
import { memDel } from "@/lib/mem-cache";

/**
 * GET /api/cron/warm-helpdesk
 *
 * GitHub Actions에서 5분마다 호출.
 *
 * 문의 접수 현황(HelpDeskPanel)은 SW/HW와 달리 미리 데워두는 크론이 없어,
 * "helpdesk:tickets" 캐시(TTL 5분)가 만료된 뒤 첫 방문자가 그대로 라이브 Notion
 * 페이지네이션(838건 기준 9회 이상 순차 호출)을 떠안는 구조였음 — 이게 다른 관리자
 * 패널보다 문의 접수 현황이 유독 로딩이 긴 이유였음. SW/HW와 동일하게 백그라운드에서
 * 미리 채워둬 방문자가 캐시 미스를 겪지 않도록 한다.
 */
export const dynamic = "force-dynamic";

const CACHE_KEY = "helpdesk:tickets";
const CACHE_TTL = 300; // 5분 — /api/helpdesk의 캐시 TTL과 동일

export async function GET() {
  const start = Date.now();
  try {
    const data = await fetchHelpDeskTickets();
    const lastSynced = new Date().toISOString();
    await kvSet(CACHE_KEY, { data, lastSynced }, CACHE_TTL);
    // 이 인스턴스의 20초 인메모리 캐시가 방금 갱신 전 값을 들고 있을 수 있어 비워둔다
    memDel(CACHE_KEY);

    return NextResponse.json({
      ok: true,
      count: data.length,
      elapsed: `${Date.now() - start}ms`,
      warmedAt: lastSynced,
    });
  } catch (e) {
    console.warn("[warm-helpdesk] failed:", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
