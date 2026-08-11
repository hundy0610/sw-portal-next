import { NextRequest, NextResponse } from "next/server";
import { fetchSwDatabase } from "@/lib/notion";
import { errorMessage } from "@/lib/api-error";
import { getSessionFromCookieHeader, resolveCurrentRole } from "@/lib/session";
import { getBudgets, getDeadlines, buildAlerts, type RenewalTarget, type DeptSpend } from "@/lib/subscription-alerts";
import { annotateAnomalies, type DeptCostStat } from "@/lib/anomaly-detection";
import { listBatches } from "@/lib/card-import";
import { getUsdKrwRatesForDates } from "@/lib/exchange-rate";

export const dynamic = "force-dynamic";

const FALLBACK_RATE = 1380;

export type Severity = "red" | "yellow" | "green";

export interface CompanyScoreRow {
  company: string;
  severity: Severity;
  renewalUrgent: number;   // D-7 이내
  renewalWarn: number;     // D-30 이내
  anomalyCount: number;    // F1 이상치 부서 수
  budgetOverCount: number; // 예산 초과 부서 수
  submissionStatus: "완료" | "임박" | "미제출" | "미설정";
  swCount: number;         // 활성 구독 건수(참고용 규모 지표)
}

// GET /api/governance-scorecard — 계열사 전체를 한 화면에서 보는 거버넌스 요약.
// 전체 법인을 다뤄야 하므로 슈퍼어드민 전용(companyScope 우회가 곧 이 화면의 목적).
export async function GET(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if ((await resolveCurrentRole(session)) !== "super") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const [all, budgets, deadlines, batches] = await Promise.all([
      fetchSwDatabase(), getBudgets(), getDeadlines(), listBatches(),
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const subs = all.filter(r => {
      const isSub = (r.licenseType ?? "").includes("구독");
      const alive = r.status !== "만료" && r.status !== "반납";
      const renewalOk = !r.renewalDate || new Date(r.renewalDate) >= today;
      return isSub && alive && renewalOk;
    });

    // 결제일 기준 환율로 부서별 비용을 환산한다 — 구독 현황 화면과 동일 기준.
    const todayStr = today.toISOString().slice(0, 10);
    const asOf = (r: typeof subs[number]) => r.paymentDate || r.renewalDate || todayStr;
    const rateMap = await getUsdKrwRatesForDates(subs.map(asOf));

    // 회사 목록: 실제 구독 데이터가 있거나, 예산/제출기한이 설정된 법인만 (빈 법인으로 노이즈 방지)
    const companies = new Set<string>([
      ...subs.map(r => r.company ?? "").filter(Boolean),
      ...budgets.map(b => b.company),
      ...deadlines.map(d => d.company),
    ]);

    const ym = new Date().toISOString().slice(0, 7);
    const submittedCompanies = new Set(
      batches.filter(b => b.uploadedAt.slice(0, 7) === ym).map(b => b.company),
    );

    const rows: CompanyScoreRow[] = [];

    for (const company of companies) {
      const companySubs = subs.filter(r => (r.company ?? "") === company);

      // 부서별 비용/인원/SW개수 — 이상치 판정용
      const deptMap = new Map<string, { headcount: Set<string>; swSet: Set<string>; cost: number }>();
      for (const r of companySubs) {
        const dept = (r.department ?? "").trim();
        if (!deptMap.has(dept)) deptMap.set(dept, { headcount: new Set(), swSet: new Set(), cost: 0 });
        const d = deptMap.get(dept)!;
        if (r.user) d.headcount.add(r.user);
        d.swSet.add(r.swCategory || r.swDetail || "미입력");
        const annualUsd = (r.annualUsd ?? 0) > 0 ? (r.annualUsd ?? 0) : ((r.monthlyUsd ?? 0) * 12);
        const annualKrw = (r.annualKrw ?? 0) > 0 ? (r.annualKrw ?? 0) : ((r.monthlyKrw ?? 0) * 12);
        const rate = rateMap.get(asOf(r)) ?? FALLBACK_RATE;
        d.cost += Math.round((annualKrw + annualUsd * rate) / 12); // 월 환산
      }
      const deptStats: DeptCostStat[] = [...deptMap.entries()].map(([department, d]) => ({
        company, department, headcount: d.headcount.size, swCount: d.swSet.size, cost: d.cost,
      }));
      const anomalyCount = annotateAnomalies(deptStats).filter(d => d.flags.length > 0).length;

      // 갱신 대상
      const renewals: RenewalTarget[] = companySubs
        .filter(r => !!r.renewalDate)
        .map(r => ({
          id: r.id, company, department: (r.department ?? "").trim(),
          swName: r.swCategory || r.swDetail || "미입력", user: r.user ?? "", renewalDate: r.renewalDate ?? "",
        }));

      const spends: DeptSpend[] = deptStats.map(d => ({
        company, department: d.department, monthlyKrw: d.cost, source: "registered",
      }));

      const companyBudgets = budgets.filter(b => b.company === company);
      const companyDeadlines = deadlines.filter(d => d.company === company);

      const alerts = buildAlerts({
        renewals, spends, budgets: companyBudgets, deadlines: companyDeadlines,
        submittedCompanies, now: today,
      });

      const renewalUrgent = alerts.filter(a => a.type === "renewal" && a.severity === "urgent").length;
      const renewalWarn   = alerts.filter(a => a.type === "renewal" && a.severity === "warn").length;
      const budgetOverCount = alerts.filter(a => a.type === "budget").length;
      const submissionAlert = alerts.find(a => a.type === "submission");

      let submissionStatus: CompanyScoreRow["submissionStatus"] = "미설정";
      if (companyDeadlines.length > 0) {
        if (submittedCompanies.has(company)) submissionStatus = "완료";
        else if (submissionAlert?.severity === "urgent") submissionStatus = "미제출";
        else if (submissionAlert) submissionStatus = "임박";
        else submissionStatus = "완료"; // 기한 여유 있고 미제출 알림 없음 = 아직 정상 범위
      }

      const severity: Severity =
        renewalUrgent > 0 || budgetOverCount > 0 || submissionStatus === "미제출"
          ? "red"
          : renewalWarn > 0 || anomalyCount > 0 || submissionStatus === "임박"
          ? "yellow"
          : "green";

      rows.push({
        company, severity, renewalUrgent, renewalWarn, anomalyCount,
        budgetOverCount, submissionStatus, swCount: companySubs.length,
      });
    }

    const rank: Record<Severity, number> = { red: 0, yellow: 1, green: 2 };
    rows.sort((a, b) => rank[a.severity] - rank[b.severity] || b.swCount - a.swCount);

    return NextResponse.json({ ok: true, rows, generatedAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
