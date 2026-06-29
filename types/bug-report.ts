// ────────────────────────────────────────────────────────────
// 버그리포트 칸반 단계 — 동적으로 추가/삭제 가능 (KV에 저장)
// stage.name이 Notion "상태" select 값으로 그대로 사용됨
// ────────────────────────────────────────────────────────────
export interface BugStage {
  name:   string;
  color:  string; // 컬럼/뱃지 배경색
  border: string; // 드래그 타겟/강조 테두리색
  tc:     string; // 텍스트색
}

export const DEFAULT_BUG_STAGES: BugStage[] = [
  { name: "접수됨",   color: "#FEF9C3", border: "#FACC15", tc: "#854D0E" },
  { name: "분석중",   color: "#F3E8FD", border: "#AB47BC", tc: "#7B1FA2" },
  { name: "개발중",   color: "#DBEAFE", border: "#3B82F6", tc: "#1E40AF" },
  { name: "테스트중", color: "#FFEDD5", border: "#FB923C", tc: "#C2410C" },
  { name: "배포대기", color: "#E0E7FF", border: "#818CF8", tc: "#4338CA" },
  { name: "완료",     color: "#DCFCE7", border: "#22C55E", tc: "#15803D" },
];

// 새 단계 추가 시 순환 사용할 색상 팔레트
export const BUG_STAGE_PALETTE: Omit<BugStage, "name">[] = [
  { color: "#FCE7F3", border: "#EC4899", tc: "#BE185D" },
  { color: "#CFFAFE", border: "#06B6D4", tc: "#0E7490" },
  { color: "#ECFCCB", border: "#84CC16", tc: "#4D7C0F" },
  { color: "#FFE4E6", border: "#F43F5E", tc: "#BE123C" },
  { color: "#E2E8F0", border: "#64748B", tc: "#334155" },
];

// 정의된 단계에 속하지 않는 기존 데이터를 위한 안전망 컬럼
export const UNASSIGNED_BUG_STAGE: BugStage = {
  name: "미분류", color: "#F1F5F9", border: "#94A3B8", tc: "#475569",
};
