// ── Notion select 옵션명과 정확히 일치해야 합니다 ──
export const CONTRACT_STAGES = [
  {
    id:     "관리현황 파악",
    label:  "관리현황 파악",
    icon:   "🔍",
    color:  "#F1F3F4",
    border: "#9AA0A6",
    tc:     "#3C4043",
  },
  {
    id:     "각 사 계약담당자 소통 (계약 검토)",
    label:  "계약담당자 소통",
    icon:   "💬",
    color:  "#E8F0FE",
    border: "#4285F4",
    tc:     "#1A73E8",
  },
  {
    id:     "계약서 작성 (수정사항 있을시 반영)",
    label:  "계약서 작성",
    icon:   "✏️",
    color:  "#F3E8FD",
    border: "#AB47BC",
    tc:     "#7B1FA2",
  },
  {
    id:     "내부기안 상신",
    label:  "내부기안 상신",
    icon:   "📤",
    color:  "#FEF3C7",
    border: "#F59E0B",
    tc:     "#D97706",
  },
  {
    id:     "각 사 날인된 계약서 송부",
    label:  "계약서 날인·송부",
    icon:   "🖊️",
    color:  "#DBEAFE",
    border: "#3B82F6",
    tc:     "#1D4ED8",
  },
  {
    id:     "계약완료",
    label:  "계약완료",
    icon:   "✅",
    color:  "#D1FAE5",
    border: "#10B981",
    tc:     "#065F46",
  },
  {
    id:     "재경팀과 소통하여 월별 서비스 비용 청구",   // ← Notion 실제 텍스트로 교체 필요
    label:  "월별 청구",
    icon:   "💰",
    color:  "#FFE4E6",
    border: "#F43F5E",
    tc:     "#BE123C",
  },
] as const;

export type ContractStage = (typeof CONTRACT_STAGES)[number]["id"];

export interface Contract {
  id: string;            // Notion page ID
  company: string;       // 법인명
  contactName: string;   // 담당자명
  contactEmail: string;  // 이메일
  startDate: string;     // YYYY-MM-DD
  endDate: string;       // YYYY-MM-DD
  quantity: number;      // PC 수량
  unitPrice: number;     // 단가 (기본 6000원/대/월)
  pdfUrl: string;        // Notion 서명 URL
  pdfName: string;       // 파일명
  status: "active" | "expired" | "pending";  // 날짜 기반 자동 계산
  stage: ContractStage;  // 진행 단계 (수동 관리)
  notes: string;
  createdAt: string;
  updatedAt: string;
}
