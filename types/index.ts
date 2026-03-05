// ────────────────────────────────────────────────────────────
// SW DB (화이트/블랙리스트)
// ────────────────────────────────────────────────────────────
export interface SwItem {
  id: string;
  name: string;
  vendor: string;
  category: string;
  status: "approved" | "banned" | "conditional";
  totalLicenses: number;    // 999 = 무제한
  usedLicenses: number;
  alternatives: string[];
  mandatory: boolean;
  description: string;
  notionUrl?: string;
}

// ────────────────────────────────────────────────────────────
// 구독 관리
// ────────────────────────────────────────────────────────────
export interface Subscription {
  id: string;
  name: string;
  logo: string;           // 이모지 또는 아이콘
  version: string;
  status: "구독 중" | "구독 해지";
  team: string;
  user: string;
  userCount: number;
  cycle: "월" | "연";
  krw?: number;
  usd?: number;
  paymentMethod: string;
  startDate: string;      // YYYY-MM-DD
  notionUrl?: string;
}

// ────────────────────────────────────────────────────────────
// 라이선스 트래커 (카테고리 요약용 - 기존 호환)
// ────────────────────────────────────────────────────────────
export interface LicenseItem {
  id: string;
  name: string;
  category: string;
  icon: string;
  usedCount?: number;
  totalCount?: number;
  expiryDate?: string;    // YYYY-MM-DD
  status?: string;
  notionUrl?: string;
}

// ────────────────────────────────────────────────────────────
// 라이선스 개별 레코드 (라이선스 트래커 DB의 각 row)
// ────────────────────────────────────────────────────────────
export interface LicenseRecord {
  id: string;
  userName: string;       // 사용자명 (title)
  software: string;       // 소프트웨어명 (DB 카테고리)
  softwareDetail: string; // 소프트웨어 (세부명칭)
  version: string;        // 버전
  usageStatus: "사용중" | "재고" | "지급대기" | "만료" | string; // 사용현황
  company: string;        // 법인명
  department: string;     // 부서
  email: string;          // 이메일
  licenseStartDate: string;  // 라이센스 시작일 YYYY-MM-DD
  licenseExpiryDate: string; // 라이센스 만료일 YYYY-MM-DD
  usageStartDate: string;    // 사용시작일 / 반납일자
  vendor: string;         // 구매처
  serialNumber: string;   // 시리얼넘버 (MS Office만)
  notionUrl: string;
}

// ────────────────────────────────────────────────────────────
// 티켓
// ────────────────────────────────────────────────────────────
export interface Ticket {
  id: string;
  title: string;
  category: string;
  priority: "높음" | "중간" | "낮음";
  status: "접수" | "처리중" | "완료";
  requester: string;
  assignee?: string;
  createdAt: string;      // YYYY-MM-DD
  description: string;
  notionUrl?: string;
}

// ────────────────────────────────────────────────────────────
// API 응답 래퍼
// ────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  data: T;
  lastSynced: string;     // ISO 날짜
  error?: string;
}
