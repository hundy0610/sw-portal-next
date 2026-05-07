import { NextRequest, NextResponse } from "next/server";
import { fetchAllHwRecords, computeHwStats, type HwRecord } from "@/lib/hw";
import { kvGet, kvSet } from "@/lib/kv-store";
import { memGet, memSet } from "@/lib/mem-cache";
import type { HwStats } from "@/lib/hw";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const company = new URL(req.url).searchParams.get("company")?.trim() || "";

  try {
    // 법인 필터가 있으면 전체 캐시에서 레코드를 가져와 필터 후 통계 계산
    if (company) {
      let all = memGet<HwRecord[]>("hw:all");
      if (!all) all = await kvGet<HwRecord[]>("hw:all");
      if (!all) {
        all = await fetchAllHwRecords();
        const allStats = computeHwStats(all);
        await Promise.all([kvSet("hw:all", all), kvSet("hw:stats", allStats)]);
        memSet("hw:all", all, 300);
        memSet("hw:stats", allStats, 300);
      }
      const stats = computeHwStats(all.filter((r: HwRecord) => r.company === company));
      return NextResponse.json({ ok: true, stats });
    }

    // 전체 통계 (3단계 캐시)
    let stats = memGet<HwStats>("hw:stats");
    if (stats) return NextResponse.json({ ok: true, stats, cached: "mem" });

    stats = await kvGet<HwStats>("hw:stats");
    if (stats) {
      memSet("hw:stats", stats, 300);
      return NextResponse.json({ ok: true, stats, cached: "kv" });
    }

    const records = await fetchAllHwRecords();
    stats = computeHwStats(records);
    await Promise.all([kvSet("hw:stats", stats), kvSet("hw:all", records)]);
    memSet("hw:stats", stats, 300);

    return NextResponse.json({ ok: true, stats }, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" },
    });
  } catch (e) {
    console.error("[API /hw/stats]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
