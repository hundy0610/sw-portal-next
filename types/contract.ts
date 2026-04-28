export interface Contract {
  id: string;            // Notion page ID
  company: string;       // 법인명
  contactName: string;   // 담당자명
  contactEmail: string;  // 이메일 (표시 + 복사)
  startDate: string;     // YYYY-MM-DD
  endDate: string;       // YYYY-MM-DD
  quantity: number;      // PC 수량
  unitPrice: number;     // 단가 (기본 6000원/대/월)
  pdfUrl: string;        // Notion 서명 URL (1시간 유효)
  pdfName: string;       // 파일명
  status: "active" | "expired" | "pending";  // 날짜 기반 자동 계산
  notes: string;         // 메모
  createdAt: string;
  updatedAt: string;
}
