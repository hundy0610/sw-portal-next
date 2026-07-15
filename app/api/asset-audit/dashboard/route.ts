import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookieHeader, resolveCurrentRole } from "@/lib/session";
import { fetchOrgUnits, buildOrgTree, submittedEmailsFromScans, type OrgTreeNode } from "@/lib/org-chart";
import { type HwRecord } from "@/lib/hw";
import { kvGet } from "@/lib/kv-store";
import { triggerWarmHw } from "@/lib/trigger-warm-hw";
import { fetchPcScans, matchPcScansWithHw } from "@/lib/pc-scan";
import { fetchContracts } from "@/lib/contract-notion";
import { COMPANIES, normalizeCompany, EXCLUDED_FROM_AUDIT_DASHBOARD } from "@/lib/companies";
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
  masterCacheWarming: boolean; // true면 HW 자산 캐시가 아직 준비 중 — 잠시 후 새로고침 안내
}

// GET /api/asset-audit/dashboard — 슈퍼어드민 전용, 실사 진행률 + 계약 달성률 집계
export async function GET(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session || (await resolveCurrentRole(session)) !== "super") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    // PC 실사 제출 기록(scans)은 이메일 집합 계산과 HW 매칭 양쪽에 필요하지만,
    // 같은 데이터를 두 번 조회하면 Notion 호출이 불필요하게 늘어나므로 한 번만 가져온다.
    // HW 자산은 전사 전체를 매번 Notion에서 라이브로 페이지네이션하면(수십 초 소요)
    // 응답이 지나치게 느려지므로, 30분마다 갱신되는 KV 캐시(hw:all — /api/hw,
    // /api/admin/pc-scan 등 다른 화면들도 동일하게 이 캐시를 사용한다)를 사용한다.
    const [units, hwAll, contracts, scans] = await Promise.all([
      fetchOrgUnits(), kvGet<HwRecord[]>("hw:all"), fetchContracts(), fetchPcScans(),
    ]);
    if (!hwAll) triggerWarmHw().catch(console.warn);
    const hwRecords = hwAll ?? [];
    const submittedEmails = submittedEmailsFromScans(scans);

    // 조직별 실사 진행률(트리)은 실제 소속 인원 명단 vs PC 실사 제출 기록으로 계산한다.
    // 대시보드에서 제외하기로 한 법인 소속 조직은 트리에서도 함께 제외한다.
    const visibleUnits = units.filter(u => {
      const normalized = normalizeCompany(u.company);
      return !normalized || !EXCLUDED_FROM_AUDIT_DASHBOARD.includes(normalized);
    });
    const tree = buildOrgTree(visibleUnits, submittedEmails);

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

    // 법인명은 HW 자산관리 화면의 표준 목록(COMPANIES)을 그대로 사용한다 — 원본
    // 레코드의 문자열을 그대로 라벨로 쓰면 표기 흔들림(영문/국문, 대소문자 등)으로
    // 같은 법인이 여러 줄로 나뉘어 보일 수 있어, 표준 표기로 정규화해 매칭한다.
    const byCompany: CompanyAchievement[] = COMPANIES
      .filter(company => !EXCLUDED_FROM_AUDIT_DASHBOARD.includes(company))
      .map(company => {
      const contractQty = liveContracts
        .filter(c => normalizeCompany(c.company) === company)
        .reduce((sum, c) => sum + c.quantity, 0);
      const companyHw = hwRecords.filter(r => normalizeCompany(r.company) === company);
      return { company, contractQty, hwTotal: companyHw.length, hwVerified: companyHw.filter(r => verifiedAssetIds.has(r.id)).length };
    })
      .filter(c => c.contractQty > 0 || c.hwTotal > 0)
      .sort((a, b) => b.hwTotal - a.hwTotal);

    const data: AssetAuditDashboardData = { tree, contractQtyTotal, hwTotal, hwVerified, achievementRate, byCompany, masterCacheWarming: !hwAll };
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    console.error("[asset-audit dashboard GET]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
