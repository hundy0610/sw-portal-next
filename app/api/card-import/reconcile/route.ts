import { NextRequest, NextResponse } from "next/server";
import { fetchSwDatabase } from "@/lib/notion";
import { errorMessage } from "@/lib/api-error";
import { getSessionFromCookieHeader, resolveCurrentRole } from "@/lib/session";
import { getBatchRows, listBatches } from "@/lib/card-import";
import { reconcile, type ReconcileSub } from "@/lib/card-reconcile";
import { getUsdKrwRatesForDates } from "@/lib/exchange-rate";

export const dynamic = "force-dynamic";

const FALLBACK_RATE = 1380;

// GET /api/card-import/reconcile?batchId=xxx — 해당 업로드 건과 등록 구독을 대사
export async function GET(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if ((await resolveCurrentRole(session)) !== "super") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const batchId = new URL(req.url).searchParams.get("batchId");
    if (!batchId) return NextResponse.json({ ok: false, error: "batchId 필수" }, { status: 400 });

    const [cards, batches, all] = await Promise.all([
      getBatchRows(batchId), listBatches(), fetchSwDatabase(),
    ]);
    if (!cards) return NextResponse.json({ ok: false, error: "해당 업로드 건을 찾을 수 없습니다." }, { status: 404 });

    const meta = batches.find(b => b.id === batchId);
    const targetCompany = meta?.company ?? "";

    // 대사 대상: 해당 법인의 살아있는 구독
    const subRecords = all.filter(r => {
      const isSub = (r.licenseType ?? "").includes("구독");
      const alive = r.status !== "만료" && r.status !== "반납";
      const sameCo = !targetCompany || (r.company ?? "") === targetCompany;
      return isSub && alive && sameCo;
    });

    // 월 환산 금액은 구독 현황 화면과 동일하게 "결제일 기준 환율"로 계산한다.
    const todayStr = new Date().toISOString().slice(0, 10);
    const asOf = (r: typeof subRecords[number]) => r.paymentDate || r.renewalDate || todayStr;
    const rateMap = await getUsdKrwRatesForDates(subRecords.map(asOf));

    const subs: ReconcileSub[] = subRecords.map(r => {
      const annualUsd = (r.annualUsd ?? 0) > 0 ? (r.annualUsd ?? 0) : ((r.monthlyUsd ?? 0) * 12);
      const annualKrw = (r.annualKrw ?? 0) > 0 ? (r.annualKrw ?? 0) : ((r.monthlyKrw ?? 0) * 12);
      const rate = rateMap.get(asOf(r)) ?? FALLBACK_RATE;
      return {
        id: r.id,
        company: r.company ?? "",
        department: (r.department ?? "").trim(),
        swName: r.swCategory || r.swDetail || "미입력",
        user: r.user ?? "",
        monthlyKrw: Math.round((annualKrw + annualUsd * rate) / 12),
      };
    });

    const { items, summary } = reconcile(cards, subs);
    return NextResponse.json({ ok: true, items, summary, batch: meta ?? null });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
