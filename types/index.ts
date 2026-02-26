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
// 라이선스 트래커
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
