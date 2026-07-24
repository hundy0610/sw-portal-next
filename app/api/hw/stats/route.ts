import { NextRequest, NextResponse } from "next/server";
import { computeHwStats, type HwRecord } from "@/lib/hw";
import { kvGet, kvSetPermanent } from "@/lib/kv-store";
import type { HwStats } from "@/lib/hw";
import { getHwAllFromPostgres } from "@/lib/repo/hw";
import { triggerWarmHw } from "@/lib/trigger-warm-hw";
import { errorMessage } from "@/lib/api-error";
import { getSessionFromCookieHeader, companyScope } from "@/lib/session";
import { getMonthOverMonthTrend } from "@/lib/metrics-snapshot";

export const dynamic = "force-dynamic";

// HW 전체 조회 — /api/hw와 동일하게 맥북 Postgres를 1차 소스로 쓰고, 미설정/실패 시에만
// KV 캐시(hw:all — GitHub Actions 크론이 갱신)로 폴백한다. Postgres가 메인이 된 이후
// KV만 읽으면 방금 등록/수정한 자산이 통계에 반영되지 않는 문제가 있었다.
async function getHwAll(): Promise<HwRecord[] | null> {
  const pg = await getHwAllFromPostgres();
  if (pg) return pg;
  return kvGet<HwRecord[]>("hw:all");
}

export async function GET(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const scope = companyScope(session);
  const company = scope ?? (new URL(req.url).searchParams.get("company")?.trim() || "");

  try {
    const all = await getHwAll();

    if (!all) {
      // Postgres 미설정/실패 + hw:all KV도 없음 — 마지막 수단으로 이전 계산 스냅샷이라도 반환
      const cachedStats = await kvGet<HwStats>("hw:stats");
      if (cachedStats) {
        const trend = await getMonthOverMonthTrend("hwTotal").catch(() => null);
        return NextResponse.json({ ok: true, stats: cachedStats, trend, cached: "kv" });
      }
      triggerWarmHw().catch(console.warn);
      return NextResponse.json({ ok: true, stats: null, warming: true });
    }

    // 법인 필터가 있으면 필터 후 통계 계산
    if (company) {
      const stats = computeHwStats(all.filter((r: HwRecord) => r.company === company));
      return NextResponse.json({ ok: true, stats });
    }

    const computed = computeHwStats(all);
    kvSetPermanent("hw:stats", computed).catch(console.warn);
    const trend = await getMonthOverMonthTrend("hwTotal").catch(() => null);
    return NextResponse.json({ ok: true, stats: computed, trend, cached: "computed" });
  } catch (e) {
    console.error("[API /hw/stats]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
