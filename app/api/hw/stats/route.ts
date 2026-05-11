import { NextRequest, NextResponse } from "next/server";
import { computeHwStats, type HwRecord } from "@/lib/hw";
import { kvGet } from "@/lib/kv-store";
import { memGet, memSet } from "@/lib/mem-cache";
import type { HwStats } from "@/lib/hw";
import { triggerWarmHw } from "@/lib/trigger-warm-hw";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const company = new URL(req.url).searchParams.get("company")?.trim() || "";

  try {
    // 법인 필터가 있으면 전체 캐시에서 레코드를 가져와 필터 후 통계 계산
    if (company) {
      let all = memGet<HwRecord[]>("hw:all");
      if (!all) all = await kvGet<HwRecord[]>("hw:all");
      if (!all) {
        triggerWarmHw().catch(console.warn);
        return NextResponse.json({ ok: true, stats: null, warming: true });
      }
      const stats = computeHwStats(all.filter((r: HwRecord) => r.company === company));
      return NextResponse.json({ ok: true, stats });
    }

    // 전체 통계 (4단계 캐시)
    let stats = memGet<HwStats>("hw:stats");
    if (stats) return NextResponse.json({ ok: true, stats, cached: "mem" });

    stats = await kvGet<HwStats>("hw:stats");
    if (stats) {
      memSet("hw:stats", stats, 300);
      return NextResponse.json({ ok: true, stats, cached: "kv" });
    }

    // hw:stats TTL 만료 시 → 영구 캐시(stale) 즉시 반환 + 백그라운드 갱신
    const staleStats = await kvGet<HwStats>("hw:stats:permanent");
    if (staleStats) {
      memSet("hw:stats", staleStats, 60); // 짧은 TTL로 메모리 캐시
      triggerWarmHw().catch(console.warn); // await 없이 백그라운드 실행
      return NextResponse.json({ ok: true, stats: staleStats, stale: true });
    }

    // 완전 cold miss (최초 배포 후 warm 미실행)
    triggerWarmHw().catch(console.warn);
    return NextResponse.json({ ok: true, stats: null, warming: true });
  } catch (e) {
    console.error("[API /hw/stats]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
