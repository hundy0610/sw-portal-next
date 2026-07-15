import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookieHeader, resolveCurrentRole } from "@/lib/session";
import { fetchOrgUnits, buildOrgTree, fetchSubmittedEmails, type OrgTreeNode } from "@/lib/org-chart";
import { fetchAllHwRecords } from "@/lib/hw";
import { fetchContracts } from "@/lib/contract-notion";
import { errorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export interface CompanyAchievement {
  company: string;
  contractQty: number;
  hwTotal: number;
  hwVerified: number;
}

export interface AssetAuditDashboardData {
  tree: OrgTreeNode[];
  contractQtyTotal: number;
  hwTotal: number;
  hwVerified: number;
  achievementRate: number; // hwVerified / contractQtyTotal * 100 (계약 수량 대비 달성률)
  byCompany: CompanyAchievement[];
}

// GET /api/asset-audit/dashboard — 슈퍼어드민 전용, 실사 진행률 + 계약 달성률 집계
export async function GET(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session || (await resolveCurrentRole(session)) !== "super") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [units, submittedEmails, hwRecords, contracts] = await Promise.all([
      fetchOrgUnits(), fetchSubmittedEmails(), fetchAllHwRecords(), fetchContracts(),
    ]);

    // 조직별 실사 진행률(트리)은 실제 소속 인원 명단 vs PC 실사 제출 기록으로 계산한다.
    // 계약 수량 대비 달성률(아래)은 이와 별개로 하드웨어 자산 대수 기준 지표라 그대로 둔다.
    const tree = buildOrgTree(units, submittedEmails);

    // 만료되지 않은(active + pending) 계약만 "현재 계약 수량"으로 집계
    const liveContracts = contracts.filter(c => c.status !== "expired");
    const contractQtyTotal = liveContracts.reduce((sum, c) => sum + c.quantity, 0);
    const hwTotal = hwRecords.length;
    const hwVerified = hwRecords.filter(r => r.verified).length;
    const achievementRate = contractQtyTotal > 0 ? Math.round((hwVerified / contractQtyTotal) * 100) : 0;

    const companies = Array.from(new Set([
      ...liveContracts.map(c => c.company),
      ...hwRecords.map(r => r.company),
    ].filter(Boolean)));

    const byCompany: CompanyAchievement[] = companies.map(company => {
      const contractQty = liveContracts.filter(c => c.company === company).reduce((sum, c) => sum + c.quantity, 0);
      const companyHw = hwRecords.filter(r => r.company === company);
      return { company, contractQty, hwTotal: companyHw.length, hwVerified: companyHw.filter(r => r.verified).length };
    }).sort((a, b) => b.hwTotal - a.hwTotal);

    const data: AssetAuditDashboardData = { tree, contractQtyTotal, hwTotal, hwVerified, achievementRate, byCompany };
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    console.error("[asset-audit dashboard GET]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
