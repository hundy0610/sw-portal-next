export const CONTRACT_STAGES = [
  { id: "관리현황파악",   label: "관리현황 파악",      icon: "🔍", color: "#EFF3FF", border: "#4F6BED", tc: "#3B4DC8" },
  { id: "계약담당자소통", label: "계약 담당자와 소통", icon: "💬", color: "#E8F5E9", border: "#4CAF50", tc: "#2E7D32" },
  { id: "계약서작성",     label: "계약서 작성",        icon: "✏️", color: "#FFF8E1", border: "#FFB300", tc: "#F57F17" },
  { id: "내부기안상신",   label: "내부 기안 상신",     icon: "📤", color: "#F3E5F5", border: "#AB47BC", tc: "#7B1FA2" },
  { id: "계약서날인",     label: "계약서 날인",        icon: "🖊️", color: "#FBE9E7", border: "#EF6C00", tc: "#BF360C" },
  { id: "계약완료",       label: "계약 완료",          icon: "✅", color: "#E0F2F1", border: "#26A69A", tc: "#004D40" },
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
