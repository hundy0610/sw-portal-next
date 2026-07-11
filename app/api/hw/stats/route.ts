import { NextRequest, NextResponse } from "next/server";
import { computeHwStats, type HwRecord } from "@/lib/hw";
import { kvGet, kvSetPermanent } from "@/lib/kv-store";
import type { HwStats } from "@/lib/hw";
import { triggerWarmHw } from "@/lib/trigger-warm-hw";
import { errorMessage } from "@/lib/api-error";
import { getSessionFromCookieHeader, companyScope } from "@/lib/session";
import { getMonthOverMonthTrend } from "@/lib/metrics-snapshot";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const scope = companyScope(session);
  const company = scope ?? (new URL(req.url).searchParams.get("company")?.trim() || "");

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
    if (stats) {
      // 전사 총량 대비 전월 스냅샷 증감 — 스냅샷이 없으면(신규 인프라) 조용히 null
      const trend = await getMonthOverMonthTrend("hwTotal").catch(() => null);
      return NextResponse.json({ ok: true, stats, trend, cached: "kv" });
    }

    // hw:stats 미스 → hw:all에서 즉석 계산 (hw:all은 있을 수 있음)
    const all = await kvGet<HwRecord[]>("hw:all");
    if (all && all.length > 0) {
      const computed = computeHwStats(all);
      kvSetPermanent("hw:stats", computed).catch(console.warn);
      const trend = await getMonthOverMonthTrend("hwTotal").catch(() => null);
      return NextResponse.json({ ok: true, stats: computed, trend, cached: "computed" });
    }

    // hw:all도 없음 — GitHub Actions warm 트리거
    triggerWarmHw().catch(console.warn);
    return NextResponse.json({ ok: true, stats: null, warming: true });
  } catch (e) {
    console.error("[API /hw/stats]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
