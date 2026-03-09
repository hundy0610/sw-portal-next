// ────────────────────────────────────────────────────────────
// SW 데이터베이스(수정중) 통합 레코드
// 구독 + 라이선스 모두 이 타입으로 통합
// ────────────────────────────────────────────────────────────
export interface SwDbRecord {
  id: string;
  user: string;                           // 사용자 (title)
  swCategory: string;                     // SW대분류
  swDetail: string;                       // SW소분류
  version: string[];                      // version (multi_select)
  status: string;                         // 사용/재고/만료/갱신필요/신규등록
  company: string;                        // 법인명
  licenseType: "영구" | "구독(업체)" | "구독(웹)" | string; // 영구 / 구독
  department: string;                     // 부서
  usageDate: string;                      // 사용일자 YYYY-MM-DD
  renewalDate: string;                    // 갱신필요일 YYYY-MM-DD
  purchaseDate: string;                   // 구매일자 YYYY-MM-DD
  returnDate: string;                     // 반납일자 YYYY-MM-DD
  returnScheduledDate: string;            // 반납예정일 YYYY-MM-DD
  returnReason: string;                   // 반납사유
  licenseKey: string;                     // 인증키 / 인증계정
  vendor: string;                         // 구매처
  usageCount: number;                     // 사용횟수
  certificate: string;                    // 증서 (file URL)
  workType: string;                       // SW사용직군
  notionUrl: string;
}

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
