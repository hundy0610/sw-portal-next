export interface Contract {
  id: string;
  company: string;         // 법인명
  contactName: string;     // 담당자명
  contactEmail?: string;   // 담당자 이메일
  contactPhone?: string;   // 담당자 연락처
  startDate: string;       // YYYY-MM-DD
  endDate: string;         // YYYY-MM-DD
  quantity: number;        // PC 수량
  unitPrice: number;       // 단가 (기본 6000원/대/월)
  pdfUrl?: string;         // 계약서 PDF 외부 링크 (Google Drive 등)
  pdfName?: string;        // PDF 파일명 표시용
  status: "active" | "expired" | "pending";
  notes?: string;          // 메모
  createdAt: string;
  updatedAt: string;
}
