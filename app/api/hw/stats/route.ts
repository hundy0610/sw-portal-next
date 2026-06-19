import { NextRequest, NextResponse } from "next/server";
import { computeHwStats, type HwRecord } from "@/lib/hw";
import { kvGet, kvSetPermanent } from "@/lib/kv-store";
import type { HwStats } from "@/lib/hw";
import { triggerWarmHw } from "@/lib/trigger-warm-hw";
import { errorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const company = new URL(req.url).searchParams.get("company")?.trim() || "";

  try {
    // 법인 필터가 있으면 전체 캐시에서 레코드를 가져와 필터 후 통계 계산
    if (company) {
      const all = await kvGet<HwRecord[]>("hw:all");
      if (!all) {
        triggerWarmHw().catch(console.warn);
        return NextResponse.json({ ok: true, stats: null, warming: true });
      }
      const stats = computeHwStats(all.filter((r: HwRecord) => r.company === company));
      return NextResponse.json({ ok: true, stats });
    }

    // KV(stats) → KV(all) → warming
    const stats = await kvGet<HwStats>("hw:stats");
    if (stats) return NextResponse.json({ ok: true, stats, cached: "kv" });

    // hw:stats 미스 → hw:all에서 즉석 계산 (hw:all은 있을 수 있음)
    const all = await kvGet<HwRecord[]>("hw:all");
    if (all && all.length > 0) {
      const computed = computeHwStats(all);
      kvSetPermanent("hw:stats", computed).catch(console.warn);
      return NextResponse.json({ ok: true, stats: computed, cached: "computed" });
    }

    // hw:all도 없음 — GitHub Actions warm 트리거
    triggerWarmHw().catch(console.warn);
    return NextResponse.json({ ok: true, stats: null, warming: true });
  } catch (e) {
    console.error("[API /hw/stats]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
