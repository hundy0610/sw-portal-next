import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookieHeader, resolveCurrentRole } from "@/lib/session";
import { fetchOrgUnits, buildOrgTree, fetchSubmittedEmails, type OrgTreeNode } from "@/lib/org-chart";
import { fetchAllHwRecords } from "@/lib/hw";
import { fetchPcScans, matchPcScansWithHw } from "@/lib/pc-scan";
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
    const [units, submittedEmails, hwRecords, contracts, scans] = await Promise.all([
      fetchOrgUnits(), fetchSubmittedEmails(), fetchAllHwRecords(), fetchContracts(), fetchPcScans(),
    ]);

    // 조직별 실사 진행률(트리)은 실제 소속 인원 명단 vs PC 실사 제출 기록으로 계산한다.
    const tree = buildOrgTree(units, submittedEmails);

    // 계약 수량 대비 달성률의 "확인됨" 기준 — HW 마스터의 실사확인 체크박스는 구매 등록
    // 시 일괄 체크되거나 관리자가 수동으로 토글할 수 있어 실제 실사 여부와 무관하게 켜져
    // 있는 경우가 많다. "자산 실사 현황"(PC 실사 제출 기록)에 실제로 넘어온 데이터만
    // 반영되도록, 자산번호+시리얼로 매칭된 스캔이 있는 자산만 확인된 것으로 집계한다.
    const matches = matchPcScansWithHw(scans, hwRecords);
    const verifiedAssetIds = new Set(matches.filter(m => m.masterExists && m.masterId).map(m => m.masterId as string));

    // 만료되지 않은(active + pending) 계약만 "현재 계약 수량"으로 집계
    const liveContracts = contracts.filter(c => c.status !== "expired");
    const contractQtyTotal = liveContracts.reduce((sum, c) => sum + c.quantity, 0);
    const hwTotal = hwRecords.length;
    const hwVerified = verifiedAssetIds.size;
    const achievementRate = contractQtyTotal > 0 ? Math.round((hwVerified / contractQtyTotal) * 100) : 0;

    const companies = Array.from(new Set([
      ...liveContracts.map(c => c.company),
      ...hwRecords.map(r => r.company),
    ].filter(Boolean)));

    const byCompany: CompanyAchievement[] = companies.map(company => {
      const contractQty = liveContracts.filter(c => c.company === company).reduce((sum, c) => sum + c.quantity, 0);
      const companyHw = hwRecords.filter(r => r.company === company);
      return { company, contractQty, hwTotal: companyHw.length, hwVerified: companyHw.filter(r => verifiedAssetIds.has(r.id)).length };
    }).sort((a, b) => b.hwTotal - a.hwTotal);

    const data: AssetAuditDashboardData = { tree, contractQtyTotal, hwTotal, hwVerified, achievementRate, byCompany };
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    console.error("[asset-audit dashboard GET]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
