import { NextResponse } from "next/server";
import { fetchAllHwRecords, computeHwStats } from "@/lib/hw";
import { kvGet, kvSet } from "@/lib/kv-store";
import type { HwStats } from "@/lib/hw";

export const dynamic = "force-dynamic";

/**
 * GET /api/hw/stats
 *
 * 대시보드용 집계 통계만 반환. KV 캐시에서 즉시 읽음 (~5ms).
 * 전체 레코드 payload (~2MB) 대신 수 KB의 집계 데이터만 전송하므로
 * 대시보드 초기 로딩이 대폭 빨라짐.
 */
export async function GET() {
  try {
    let stats = await kvGet<HwStats>("hw:stats");

    if (!stats) {
      // KV 미스: 전체 레코드 fetch 후 통계 계산 및 저장
      const records = await fetchAllHwRecords();
      stats = computeHwStats(records);
      await kvSet("hw:stats", stats);
    }

    return NextResponse.json({ ok: true, stats }, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" },
    });
  } catch (e) {
    console.error("[API /hw/stats]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
