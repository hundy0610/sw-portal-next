import { NextResponse } from "next/server";
import { fetchAllHwRecords, computeHwStats } from "@/lib/hw";
import { kvGet, kvSet } from "@/lib/kv-store";
import { memGet, memSet } from "@/lib/mem-cache";
import type { HwStats } from "@/lib/hw";

export const dynamic = "force-dynamic";

/**
 * GET /api/hw/stats
 *
 * 대시보드용 집계 통계만 반환. 3단계 캐시(mem → KV → Notion).
 * KV 미스 시 전체 레코드 fetch 후 hw:all / hw:stats 동시 저장하여
 * 이후 /api/hw 요청도 KV 캐시에서 즉시 응답되도록 선(先) 워밍.
 */
export async function GET() {
  try {
    // 1. 인메모리 캐시 (0ms)
    let stats = memGet<HwStats>("hw:stats");
    if (stats) return NextResponse.json({ ok: true, stats, cached: "mem" });

    // 2. KV 캐시 (1~5ms)
    stats = await kvGet<HwStats>("hw:stats");
    if (stats) {
      memSet("hw:stats", stats, 300);
      return NextResponse.json({ ok: true, stats, cached: "kv" });
    }

    // 3. Notion 직접 조회 — hw:all / hw:stats 동시 저장
    const records = await fetchAllHwRecords();
    stats = computeHwStats(records);

    // hw:all도 함께 저장 → /api/hw 요청 시 KV 캐시 즉시 히트
    await Promise.all([
      kvSet("hw:stats", stats),
      kvSet("hw:all",   records),
    ]);
    memSet("hw:stats", stats, 300);

    return NextResponse.json({ ok: true, stats }, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" },
    });
  } catch (e) {
    console.error("[API /hw/stats]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
