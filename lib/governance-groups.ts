import { kvGet, kvSetPermanent } from "@/lib/kv-store";

// ─────────────────────────────────────────────────────────────────────────────
// 계열사 그룹핑 (거버넌스 스코어카드용)
//
// 26개 법인 중 자연스럽게 묶이는 곳들(예: 대웅 계열)을 그룹으로 관리해, 스코어카드를
// 그룹 단위로 접어보거나 그룹 롤업 요약을 볼 수 있게 한다. 그룹 정의는 하드코딩하지
// 않고 슈퍼어드민이 화면에서 직접 배정한다(실제 지주구조를 코드가 임의로 추정하면
// 틀릴 수 있어서).
// ─────────────────────────────────────────────────────────────────────────────

const KV_KEY = "governance:company-groups";

/** 그룹이 배정되지 않은 법인에 쓰는 표시값 */
export const UNGROUPED = "미분류";

/** 법인명 → 그룹명. 그룹에 안 넣은 법인은 "미분류"로 취급(별도 저장 안 함). */
export type CompanyGroupMap = Record<string, string>;

export async function getCompanyGroups(): Promise<CompanyGroupMap> {
  return (await kvGet<CompanyGroupMap>(KV_KEY)) ?? {};
}

/** 전체 교체 저장. 빈 문자열 그룹명은 "미분류"로 되돌리기 위해 매핑에서 제거한다. */
export async function saveCompanyGroups(map: CompanyGroupMap): Promise<boolean> {
  const cleaned: CompanyGroupMap = {};
  for (const [company, group] of Object.entries(map)) {
    const g = (group ?? "").trim();
    if (g) cleaned[company.trim()] = g;
  }
  return kvSetPermanent(KV_KEY, cleaned);
}
