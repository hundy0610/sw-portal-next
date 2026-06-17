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
  returnDate: string;                     // 회수일자 YYYY-MM-DD
  shipStatus: string;                     // 출고진행상황 (status)
  accountType: string;                    // 계정유형 (공용/법인/개인)
  renewalCycle: string;                   // 갱신주기 (연/월)
  licenseKey: string;                     // 인증키 / 인증계정
  vendor: string;                         // 구매처
  usageCount: number;                     // 사용횟수
  certificate: string;                    // 증서 (file URL)
  workType: string;                       // SW사용직군
  billingType?: string;                   // 결제방식 (대웅 등)
  lastModifiedBy?: string;                // 마지막수정자 (이름 + 아이디)
  lastModifiedAt?: string;                // 마지막수정일시 (ISO)
  monthlyUsd: number;                     // 월 비용 (USD)
  monthlyKrw: number;                     // 월 비용 (KRW)
  annualUsd: number;                      // 연 비용 (USD) — formula 또는 monthlyUsd×12
  annualKrw: number;                      // 연 비용 (KRW) — formula 또는 monthlyKrw×12
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
  alternatives: string[];
  mandatory: boolean;
  description: string;
  officialUrl?: string;   // 공식 다운로드/제품 페이지
  resourceId?: string;    // 자료실 연동 (Resource.id)
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
// 수리 접수
// ────────────────────────────────────────────────────────────
export interface RepairTicket {
  id: string;
  ticketNumber: string;
  title: string;           // 고장증상 (title) — 모니터 번호 식별용 (구 티켓은 증상 텍스트)
  faultTypes: string[];    // 고장 내역 (multi_select)
  status: "시작 전" | "진행 중" | "완료" | "이관" | "기타";
  priority: string;        // [deprecated] 긴급도 (select) — 구 티켓에만 값 존재
  company: string;         // 법인 (select)
  department: string;      // 부서 (rich_text)
  location: string;        // [deprecated] 실제 근무 위치 (rich_text) — 구 티켓에만 값 존재
  building: string;        // 건물명 (select)
  floor: string;           // 층수 (rich_text)
  assetId: string;         // 자산번호 (rich_text) — 모니터 번호
  detail: string;          // 세부내역 (rich_text) — 고장 증상 상세
  requester: string;       // 문의자 (rich_text)
  assignee: string;        // 담당자 이름 (people)
  assigneeId: string;      // 담당자 Notion user ID
  repairDate: string;      // 수리 일정 (date)
  actionNote: string;      // 조치내용 (rich_text)
  consentGiven: boolean;   // [deprecated] 수리 진행 동의서 (checkbox) — 구 티켓에만 값 존재
  createdAt: string;       // 문의 제출 시간 (created_time)
  notionUrl: string;
}

// ────────────────────────────────────────────────────────────
// HW 외부 수리 추적
// ────────────────────────────────────────────────────────────
export interface HwRepairRecord {
  id: string;
  assetId: string;         // 자산번호 (title)
  company: string;         // 법인 (select)
  department: string;      // 부서 (rich_text)
  user: string;            // 사용자 (rich_text)
  vendor: string;          // 수리업체 (select)
  stage: string;           // 현재단계 (select)
  receivedAt: string;      // 접수일 (date) YYYY-MM-DD
  completedAt: string;     // 실제완료일 (date) YYYY-MM-DD
  faultType: string;       // 과실여부 (select)
  receiptUrl: string[];    // 수리영수증 (files)
  consentUrl: string[];    // 진행동의서 (files)
  taxInvoiceUrl: string[]; // 세금계산서결재 (files)
  approvalUrl: string[];   // 내부결재내용 (files)
  assignee: string;        // 담당자 이름 (people)
  assigneeId: string;      // 담당자 Notion user ID
  note: string;            // 수리내용 (rich_text)
  repairCost: number;      // 수리비용 (number)
  assetStatus: string;     // 대분류 (select): 재고 | 사용중
  address: string;         // 배송지 (select)
  requesterEmail: string;  // 이메일 (email)
  isClosed: boolean;       // 케이스 종료 여부 (checkbox)
  lastEditedAt: string;    // 최종 편집 일시 (last_edited_time)
  notionUrl: string;
}

// ────────────────────────────────────────────────────────────
// 교체/반납 트래커
// ────────────────────────────────────────────────────────────
// 유형: "교체" | "퇴사반납"
// 단계: "교체요청" | "요청기안" | "기기준비" | "사용자수령" | "반납요청" | "반납완료"
export interface ExchangeReturnRecord {
  id: string;
  type: string;
  assetId: string;
  newAssetId: string;
  company: string;
  department: string;
  user: string;
  stage: string;
  requestedAt: string;
  useDate: string;
  returnDue: string;       // 반납예정일 (사용자수령일 + 7일 자동 또는 HW DB 값)
  completedAt: string;
  reason: string;
  assignee: string;
  assigneeId: string;
  note: string;
  address: string;         // 배송지 (select)
  requesterEmail: string;  // 기안자이메일 (email)
  autoSynced: boolean;     // HW DB sync로 자동 진행됐는지 표시
  isClosed: boolean;       // 케이스 종료 여부 (마지막 단계 통과 시 true)
  lastEditedAt: string;
  notionUrl: string;
}

// ────────────────────────────────────────────────────────────
// API 응답 래퍼
// ────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  data: T;
  lastSynced: string;     // ISO 날짜
  error?: string;
}
