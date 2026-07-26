import { NextRequest, NextResponse } from "next/server";
import { computeHwStats, type HwRecord } from "@/lib/hw";
import { getHwAllFromPostgres } from "@/lib/repo/hw";
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
    // Postgres 미설정(로컬 dev 등) 시에만 null. 실패 시 getHwAllFromPostgres가 throw하고
    // 아래 catch가 처리한다(옛 hw:stats KV 스냅샷 폴백은 4.0에서 제거 — 갱신 주체가 없어
    // 영구히 얼어붙어 있었음).
    const all = await getHwAllFromPostgres();

    if (!all) {
      return NextResponse.json({ ok: false, stats: null, error: "데이터 저장소(Postgres)가 설정되지 않았습니다." }, { status: 503 });
    }

    // 법인 필터가 있으면 필터 후 통계 계산
    if (company) {
      const stats = computeHwStats(all.filter((r: HwRecord) => r.company === company));
      return NextResponse.json({ ok: true, stats });
    }

    const computed = computeHwStats(all);
    const trend = await getMonthOverMonthTrend("hwTotal").catch(() => null);
    return NextResponse.json({ ok: true, stats: computed, trend, cached: "computed" });
  } catch (e) {
    console.error("[API /hw/stats]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
