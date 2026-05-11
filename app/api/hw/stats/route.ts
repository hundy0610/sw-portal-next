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

    // 전체 통계 — 3단계 캐시: 인메모리 → KV → warming
    let stats = memGet<HwStats>("hw:stats");
    if (stats) return NextResponse.json({ ok: true, stats, cached: "mem" });

    stats = await kvGet<HwStats>("hw:stats");
    if (stats) {
      memSet("hw:stats", stats, 300);
      return NextResponse.json({ ok: true, stats, cached: "kv" });
    }

    // KV 미스 (최초 배포 후 warm 미실행) — GitHub Actions 트리거
    triggerWarmHw().catch(console.warn);
    return NextResponse.json({ ok: true, stats: null, warming: true });
  } catch (e) {
    console.error("[API /hw/stats]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
