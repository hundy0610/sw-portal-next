// ────────────────────────────────────────────────────────────
// 작업 트래커 칸반 단계 — 동적으로 추가/삭제 가능 (KV에 저장)
// stage.name이 Notion "상태" select 값으로 그대로 사용됨
// ────────────────────────────────────────────────────────────
export interface WorkStage {
  name:   string;
  color:  string; // 컬럼/뱃지 배경색
  border: string; // 드래그 타겟/강조 테두리색
  tc:     string; // 텍스트색
}

export const DEFAULT_WORK_STAGES: WorkStage[] = [
  { name: "할 일",     color: "#FEF9C3", border: "#FACC15", tc: "#854D0E" },
  { name: "계획중",    color: "#F3E8FD", border: "#AB47BC", tc: "#7B1FA2" },
  { name: "작업중",    color: "#DBEAFE", border: "#3B82F6", tc: "#1E40AF" },
  { name: "피드백 필요", color: "#FFEDD5", border: "#FB923C", tc: "#C2410C" },
  { name: "완료",      color: "#DCFCE7", border: "#22C55E", tc: "#15803D" },
];

// 정의된 단계에 속하지 않는 기존 데이터를 위한 안전망 컬럼
export const UNASSIGNED_WORK_STAGE: WorkStage = {
  name: "미분류", color: "#F1F5F9", border: "#94A3B8", tc: "#475569",
};
