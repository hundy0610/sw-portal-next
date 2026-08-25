// ─────────────────────────────────────────────────────────────────────────────
// 구독 SW 지출 이상치 자동 감지 (F1)
//
// 원래 components/admin/ReportPanel.tsx에만 있던 로직을 공유 lib으로 옮겼다 —
// 거버넌스 스코어카드(app/api/governance-scorecard)가 서버에서 동일한 판정을
// 재사용해야 해서다. 임계값은 상수로 분리해 나중에 조정이 쉽게 했다.
// ─────────────────────────────────────────────────────────────────────────────

export const ANOMALY_PERHEAD_MULTIPLIER = 3; // 인당비용이 전체 평균의 몇 배 이상이면 이상치로 볼지

export type AnomalyFlag = "담당자미지정" | "인당비용이상치" | "비용확인필요";

export const ANOMALY_LABEL: Record<AnomalyFlag, string> = {
  "담당자미지정":   "담당자 미지정",
  "인당비용이상치": "인당비용 이상치",
  "비용확인필요":   "비용 데이터 확인 필요",
};

/**
 * 부서 하나의 (인원수, SW개수, 비용)을 보고 해당되는 이상치 플래그를 모두 반환한다.
 * 우선순위: 담당자미지정 > 인당비용이상치. 비용확인필요는 비용이 0일 때만 해당되므로
 * 위 두 조건과 함께 나타나지 않는다(둘 다 비용>0을 전제로 함).
 */
export function getAnomalyFlags(headcount: number, swCount: number, cost: number, avgPerHead: number): AnomalyFlag[] {
  const flags: AnomalyFlag[] = [];
  if (headcount === 0 && cost > 0) {
    flags.push("담당자미지정");
  } else if (headcount > 0 && avgPerHead > 0 && cost / headcount >= avgPerHead * ANOMALY_PERHEAD_MULTIPLIER) {
    flags.push("인당비용이상치");
  }
  if (swCount > 0 && cost === 0) {
    flags.push("비용확인필요");
  }
  return flags;
}

export interface DeptCostStat {
  company: string;
  department: string;
  headcount: number;
  swCount: number;
  cost: number;
}

/**
 * 부서별 통계 목록을 받아 전체 평균 인당비용을 구하고, 부서마다 이상치 플래그를 매긴다.
 * ReportPanel과 거버넌스 스코어카드가 동일한 함수를 써서 두 화면의 판정이 어긋나지 않게 한다.
 */
export function annotateAnomalies(stats: DeptCostStat[]): (DeptCostStat & { flags: AnomalyFlag[] })[] {
  let sumCost = 0, sumHead = 0;
  for (const s of stats) {
    if (s.headcount > 0) { sumHead += s.headcount; sumCost += s.cost; }
  }
  const avgPerHead = sumHead > 0 ? sumCost / sumHead : 0;
  return stats.map(s => ({ ...s, flags: getAnomalyFlags(s.headcount, s.swCount, s.cost, avgPerHead) }));
}
