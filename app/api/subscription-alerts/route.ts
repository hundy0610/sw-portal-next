import { NextRequest, NextResponse } from "next/server";
import { fetchSwDatabase } from "@/lib/notion";
import { errorMessage } from "@/lib/api-error";
import { getSessionFromCookieHeader, companyScope } from "@/lib/session";
import { listBatches } from "@/lib/card-import";
import {
  buildAlerts, getBudgets, getDeadlines,
  type DeptSpend, type RenewalTarget,
} from "@/lib/subscription-alerts";

export const dynamic = "force-dynamic";

// GET /api/subscription-alerts — 갱신임박/예산초과/제출기한 알림 대상 판정 (발송 안 함)
export async function GET(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const scope = companyScope(session);

  try {
    const [all, budgets, deadlines, batches] = await Promise.all([
      fetchSwDatabase(), getBudgets(), getDeadlines(), listBatches(),
    ]);

    // 구독 + 미만료 건만
    const subs = all.filter(r => {
      const isSub = (r.licenseType ?? "").includes("구독");
      const alive = r.status !== "만료" && r.status !== "반납";
      const inScope = !scope || r.company === scope;
      return isSub && alive && inScope;
    });

    const renewals: RenewalTarget[] = subs
      .filter(r => !!r.renewalDate)
      .map(r => ({
        id: r.id,
        company: r.company ?? "",
        department: (r.department ?? "").trim(),
        swName: r.swCategory || r.swDetail || "미입력",
        user: r.user ?? "",
        renewalDate: r.renewalDate ?? "",
      }));

    // 부서별 월 지출 — 현재는 등록된 구독 금액 기준(lib/subscription-alerts.ts의
    // DeptSpend 주석 참고: 종량제는 향후 벤더 usage API로 교체 예정)
    const spendMap = new Map<string, DeptSpend>();
    for (const r of subs) {
      const company = r.company ?? "";
      const department = (r.department ?? "").trim();
      const key = `${company}__${department}`;
      const monthly = (r.monthlyKrw ?? 0) > 0
        ? (r.monthlyKrw ?? 0)
        : Math.round((r.annualKrw ?? 0) / 12);
      const cur = spendMap.get(key);
      if (cur) cur.monthlyKrw += monthly;
      else spendMap.set(key, { company, department, monthlyKrw: monthly, source: "registered" });
    }

    // 이번 달 카드명세가 업로드된 법인
    const ym = new Date().toISOString().slice(0, 7);
    const submittedCompanies = new Set(
      batches.filter(b => b.uploadedAt.slice(0, 7) === ym).map(b => b.company),
    );

    const alerts = buildAlerts({
      renewals,
      spends: [...spendMap.values()],
      budgets: scope ? budgets.filter(b => b.company === scope) : budgets,
      deadlines: scope ? deadlines.filter(d => d.company === scope) : deadlines,
      submittedCompanies,
    });

    return NextResponse.json({ ok: true, alerts });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
