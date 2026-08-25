import { NextRequest, NextResponse } from "next/server";
import { fetchSwDatabase } from "@/lib/notion";
import { mapCategory } from "@/lib/reportTypes";
import { errorMessage } from "@/lib/api-error";
import { getSessionFromCookieHeader, resolveCurrentRole } from "@/lib/session";
import { getUsdKrwRatesForDates } from "@/lib/exchange-rate";

export const dynamic = "force-dynamic";

const FALLBACK_RATE = 1380;

export interface VendorCompanyBreakdown {
  company: string;
  licenseCount: number;
  monthlyKrw: number;
}

export interface VendorRow {
  swName: string;
  category: string;
  companyCount: number;
  licenseCount: number;
  monthlyKrw: number;
  annualKrw: number;
  consolidationCandidate: boolean; // 2개 이상 법인이 각자 별도 계약 중
  byCompany: VendorCompanyBreakdown[];
}

// GET /api/vendor-consolidation — 같은 SW/벤더를 여러 계열사가 각자 결제 중인지 모아본다.
// "이 SW, 그룹 전체에서 총 얼마 쓰는지 + 몇 개 법인이 따로 계약 중인지"를 보여줘서
// 통합 협상(볼륨 디스카운트) 대상 후보를 찾기 위함. 별도 절감액 추정치는 계산하지
// 않는다 — 실제 협상 결과 없이 숫자를 지어내면 오히려 신뢰를 해친다.
export async function GET(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if ((await resolveCurrentRole(session)) !== "super") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const all = await fetchSwDatabase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const subs = all.filter(r => {
      const isSub = (r.licenseType ?? "").includes("구독");
      const alive = r.status !== "만료" && r.status !== "반납";
      const renewalOk = !r.renewalDate || new Date(r.renewalDate) >= today;
      return isSub && alive && renewalOk;
    });

    const todayStr = today.toISOString().slice(0, 10);
    const asOf = (r: typeof subs[number]) => r.paymentDate || r.renewalDate || todayStr;
    const rateMap = await getUsdKrwRatesForDates(subs.map(asOf));

    // SW명(대분류 우선, 없으면 소분류)으로 정규화해 그룹핑 — 표기 흔들림(대소문자/공백)
    // 흡수를 위해 trim + 대소문자 무시 키를 쓰되, 표시는 첫 등장 원문을 쓴다.
    const groups = new Map<string, {
      display: string; category: string;
      byCompany: Map<string, { licenseCount: number; monthlyKrw: number }>;
    }>();

    for (const r of subs) {
      const name = (r.swCategory || r.swDetail || "미입력").trim();
      const key = name.toLowerCase();
      if (!groups.has(key)) {
        groups.set(key, {
          display: name,
          category: r.workType || mapCategory(r.swCategory ?? "", r.swDetail ?? ""),
          byCompany: new Map(),
        });
      }
      const g = groups.get(key)!;
      const company = r.company ?? "";
      if (!g.byCompany.has(company)) g.byCompany.set(company, { licenseCount: 0, monthlyKrw: 0 });
      const c = g.byCompany.get(company)!;

      const annualUsd = (r.annualUsd ?? 0) > 0 ? (r.annualUsd ?? 0) : ((r.monthlyUsd ?? 0) * 12);
      const annualKrw = (r.annualKrw ?? 0) > 0 ? (r.annualKrw ?? 0) : ((r.monthlyKrw ?? 0) * 12);
      const rate = rateMap.get(asOf(r)) ?? FALLBACK_RATE;
      c.licenseCount += 1;
      c.monthlyKrw += Math.round((annualKrw + annualUsd * rate) / 12);
    }

    const rows: VendorRow[] = [...groups.values()].map(g => {
      const byCompany: VendorCompanyBreakdown[] = [...g.byCompany.entries()]
        .map(([company, v]) => ({ company, licenseCount: v.licenseCount, monthlyKrw: v.monthlyKrw }))
        .sort((a, b) => b.monthlyKrw - a.monthlyKrw);
      const monthlyKrw = byCompany.reduce((s, c) => s + c.monthlyKrw, 0);
      const licenseCount = byCompany.reduce((s, c) => s + c.licenseCount, 0);
      return {
        swName: g.display,
        category: g.category,
        companyCount: byCompany.length,
        licenseCount,
        monthlyKrw,
        annualKrw: monthlyKrw * 12,
        consolidationCandidate: byCompany.length >= 2,
        byCompany,
      };
    });

    rows.sort((a, b) =>
      Number(b.consolidationCandidate) - Number(a.consolidationCandidate) ||
      b.monthlyKrw - a.monthlyKrw
    );

    const candidates = rows.filter(r => r.consolidationCandidate);
    const summary = {
      candidateCount: candidates.length,
      candidateMonthlyKrw: candidates.reduce((s, r) => s + r.monthlyKrw, 0),
      totalMonthlyKrw: rows.reduce((s, r) => s + r.monthlyKrw, 0),
    };

    return NextResponse.json({ ok: true, rows, summary, generatedAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
