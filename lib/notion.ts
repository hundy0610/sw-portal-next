import { Client } from "@notionhq/client";
import type {
  PageObjectResponse,
  QueryDatabaseParameters,
  BlockObjectResponse,
  PartialBlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import type { SwItem, SwDbRecord, RepairTicket, HwRepairRecord } from "@/types";
import type { SwCredential } from "@/components/admin/CredentialsPanel";
import {
  isMock,
  mockSwItems, mockSwDatabase, mockHelpDeskTickets, mockRepairTickets,
  mockHwRepairs, mockCredentials,
} from "./mock";
import { kvGet } from "@/lib/kv-store";
import { memCached } from "@/lib/mem-cache";
import { readEntity, upsertEntity } from "@/lib/repo/mirror";

// ────────────────────────────────────────────────────────────
// Notion 클라이언트 싱글톤
// ────────────────────────────────────────────────────────────
const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

// ────────────────────────────────────────────────────────────
// 유틸: Notion 프로퍼티 파서
// ────────────────────────────────────────────────────────────
type NotionProps = PageObjectResponse["properties"];

function getPropText(props: NotionProps, key: string): string {
  const p = props[key];
  if (!p) return "";
  if (p.type === "title")
    return p.title.map((t) => t.plain_text).join("") || "";
  if (p.type === "rich_text")
    return p.rich_text.map((t) => t.plain_text).join("") || "";
  if (p.type === "email") return p.email || "";
  if (p.type === "phone_number") return p.phone_number || "";
  if (p.type === "url") return p.url || "";
  return "";
}

function getPropSelect(props: NotionProps, key: string): string {
  const p = props[key];
  if (!p) return "";
  if (p.type === "select") return p.select?.name || "";
  if (p.type === "status") return p.status?.name || "";
  return "";
}

function getPropMultiSelect(props: NotionProps, key: string): string[] {
  const p = props[key];
  if (!p || p.type !== "multi_select") return [];
  return p.multi_select.map((s) => s.name);
}

function getPropNumber(props: NotionProps, key: string): number {
  const p = props[key];
  if (!p) return 0;
  if (p.type === "number")  return p.number ?? 0;
  if (p.type === "formula") {
    if (p.formula.type === "number") return p.formula.number ?? 0;
    return 0;
  }
  if (p.type === "rollup") {
    if (p.rollup.type === "number") return p.rollup.number ?? 0;
    return 0;
  }
  return 0;
}

function getPropCheckbox(props: NotionProps, key: string): boolean {
  const p = props[key];
  if (!p || p.type !== "checkbox") return false;
  return p.checkbox;
}

function getPropDate(props: NotionProps, key: string): string {
  const p = props[key];
  if (!p || p.type !== "date") return "";
  return p.date?.start || "";
}

function getPropPeople(props: NotionProps, key: string): string {
  const p = props[key];
  if (!p || p.type !== "people") return "";
  return p.people
    .map((person) => {
      if ("name" in person) return person.name || "";
      return "";
    })
    .filter(Boolean)
    .join(", ");
}

function getPropPeopleList(props: NotionProps, key: string): { id: string; name: string }[] {
  const p = props[key];
  if (!p || p.type !== "people") return [];
  return p.people
    .filter((person): person is typeof person & { id: string; name: string } => "name" in person && !!person.name)
    .map(person => ({ id: person.id, name: person.name as string }));
}

function getPropEmail(props: NotionProps, key: string): string {
  const p = props[key];
  if (!p) return "";
  if (p.type === "email") return p.email ?? "";
  return "";
}

function getPropFile(props: NotionProps, key: string): string {
  const p = props[key];
  if (!p || p.type !== "files") return "";
  if (p.files.length === 0) return "";
  const file = p.files[0];
  if (file.type === "external") return file.external.url;
  if (file.type === "file") return file.file.url;
  return "";
}

function getPropFiles(props: NotionProps, key: string): string[] {
  const p = props[key];
  if (!p || p.type !== "files") return [];
  return p.files.map(file => {
    if (file.type === "external") return file.external.url;
    if (file.type === "file") return file.file.url;
    return "";
  }).filter(Boolean);
}

function getPageUrl(pageId: string): string {
  return `https://www.notion.so/${pageId.replace(/-/g, "")}`;
}

/**
 * Notion DB ID를 8-4-4-4-12 UUID 형식으로 정규화.
 * 이미 올바른 UUID 형식이면 소문자로만 변환.
 * 형식이 잘못된 경우 명확한 에러를 throw.
 */
function toNotionId(raw: string): string {
  // 이미 올바른 UUID 형식
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
    return raw.toLowerCase();
  }
  // 대시/공백 제거 후 hex만 남김
  const h = raw.replace(/[-\s]/g, "").toLowerCase();
  if (!/^[0-9a-f]+$/.test(h)) {
    throw new Error(`Notion DB ID에 유효하지 않은 문자 포함: "${raw}"`);
  }
  if (h.length !== 32) {
    throw new Error(
      `Notion DB ID 길이 오류: 32자 hex 필요, 현재 ${h.length}자 (입력값: "${raw}")\n` +
      `→ Notion URL에서 DB ID를 다시 복사해 환경변수를 업데이트해 주세요.`
    );
  }
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

// ────────────────────────────────────────────────────────────
// 전체 데이터베이스 페이지 조회 (페이지네이션 처리)
// ────────────────────────────────────────────────────────────
async function queryAllPages(
  databaseId: string,
  filter?: QueryDatabaseParameters["filter"],
  sorts?: QueryDatabaseParameters["sorts"]
): Promise<PageObjectResponse[]> {
  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined;

  do {
    const response = await notion.databases.query({
      database_id: databaseId,
      filter,
      sorts,
      start_cursor: cursor,
      page_size: 100,
    });

    for (const page of response.results) {
      if (page.object === "page" && "properties" in page) {
        pages.push(page as PageObjectResponse);
      }
    }

    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return pages;
}

// ────────────────────────────────────────────────────────────
// SW DB 조회
// Notion 컬럼명 매핑 (실제 DB 컬럼명과 다를 경우 여기서 수정)
// ────────────────────────────────────────────────────────────
export async function fetchSwDb(): Promise<SwItem[]> {
  if (isMock()) return mockSwItems as unknown as SwItem[];
  const dbId = process.env.NOTION_DB_SWDB;
  if (!dbId) throw new Error("NOTION_DB_SWDB 환경변수가 설정되지 않았습니다.");

  const pages = await queryAllPages(dbId);

  return pages.map((page) => {
    const p = page.properties;
    const total = getPropNumber(p, "라이선스 수") || getPropNumber(p, "Total Licenses");
    return {
      id: page.id,
      name: getPropText(p, "Name") || getPropText(p, "소프트웨어명"),
      vendor: getPropText(p, "Vendor") || getPropSelect(p, "Vendor") || getPropText(p, "벤더"),
      category: getPropSelect(p, "Category") || getPropSelect(p, "카테고리"),
      status: (getPropSelect(p, "Status") || getPropSelect(p, "승인 상태") || "conditional") as SwItem["status"],
      totalLicenses: total || 999,
      usedLicenses: getPropNumber(p, "Used") || getPropNumber(p, "사용중"),
      alternatives: getPropMultiSelect(p, "Alternatives") || getPropMultiSelect(p, "대체재"),
      mandatory: getPropCheckbox(p, "Mandatory") || getPropCheckbox(p, "필수"),
      description: getPropText(p, "Description") || getPropText(p, "설명"),
      notionUrl: getPageUrl(page.id),
    };
  });
}

// ────────────────────────────────────────────────────────────
// SW 데이터베이스(수정중) 통합 조회
// 구독 + 영구 라이선스 모두 단일 DB에서 가져옴
// NOTION_DB_SW_UNIFIED 환경변수 사용
// ────────────────────────────────────────────────────────────
export async function fetchSwDatabase(): Promise<SwDbRecord[]> {
  if (isMock()) return mockSwDatabase as SwDbRecord[];
  // 메인 저장소(맥북 Postgres 미러) 우선, 미설정/미스 시 Notion 백업 폴백.
  const mir = await readEntity<SwDbRecord>("sw");
  if (mir) return mir;
  return fetchSwDatabaseFromNotion();
}

// Notion 직접 조회(초기 seed / 폴백 전용).
export async function fetchSwDatabaseFromNotion(): Promise<SwDbRecord[]> {
  const dbId = process.env.NOTION_DB_SW_UNIFIED;
  if (!dbId) throw new Error("NOTION_DB_SW_UNIFIED 환경변수가 설정되지 않았습니다.");

  const pages = await queryAllPages(dbId, undefined, [
    { timestamp: "created_time", direction: "descending" },
  ]);

  return pages.map((page): SwDbRecord => {
    const p = page.properties;
    return {
      id: page.id,
      user: getPropText(p, "사용자"),
      swCategory: getPropSelect(p, "SW대분류"),
      swDetail: getPropText(p, "SW소분류"),
      version: getPropMultiSelect(p, "version"),
      status: getPropSelect(p, "사용/재고/만료/갱신필요/신규등록"),
      company: getPropSelect(p, "법인명"),
      licenseType: getPropSelect(p, "영구 / 구독") as SwDbRecord["licenseType"],
      department: getPropText(p, "부서"),
      usageDate: getPropDate(p, "사용일자"),
      renewalDate: getPropDate(p, "갱신필요일"),
      purchaseDate: getPropDate(p, "구매일자"),
      returnDate: getPropDate(p, "회수일자"),
      shipStatus: getPropSelect(p, "출고진행상황"),
      accountType: getPropSelect(p, "계정유형"),
      renewalCycle: getPropSelect(p, "갱신주기"),
      licenseKey: getPropText(p, "인증키 / 인증계정"),
      vendor: getPropText(p, "구매처"),
      usageCount: getPropNumber(p, "사용횟수"),
      certificate: getPropFile(p, "증서"),
      draftDocument: getPropFile(p, "기안문서"),
      workType: getPropSelect(p, "SW사용직군"),
      billingType: getPropSelect(p, "결재방식"),
      lastModifiedBy: getPropText(p, "마지막수정자"),
      lastModifiedAt: getPropText(p, "마지막수정일시"),
      monthlyUsd: getPropNumber(p, "월 비용 (USD)") || 0,
      monthlyKrw: getPropNumber(p, "월 비용 (KRW)") || getPropNumber(p, "월 금액") || getPropNumber(p, "월간 금액") || getPropNumber(p, "월 비용") || 0,
      annualUsd:  getPropNumber(p, "연 비용 (USD)") || getPropNumber(p, "연비용(USD)") || 0,
      annualKrw:  getPropNumber(p, "연 비용 (KRW)") || getPropNumber(p, "연비용(KRW)") || 0,
      notionUrl: getPageUrl(page.id),
    };
  });
}

// ────────────────────────────────────────────────────────────
// 티켓 DB 조회
// ────────────────────────────────────────────────────────────
export interface HelpDeskTicket {
  id: string;
  title: string;
  status: string;
  inquiryType: string;
  company: string;
  department: string;
  requester: string;
  requesterEmail: string;
  assetNo: string;
  // 근무 위치(문의 접수 폼) — 연구소·센터 단위. Notion "위치"(select) 옵션과 같은 값이고,
  // 재택 등으로 고르지 않으면 빈 문자열.
  location?: string;
  content: string;
  urgency: string;
  team: string;
  assignee: string;
  assigneeId: string;
  submittedAt: string;
  lastEditedAt: string;
  // 상태 전이 실측 시각(데스크탑 앱 v1.43.0~). 그 이전 접수 건에는 없다.
  firstRespondedAt?: string;  // "시작 전"에서 처음 벗어난 순간. 한 번만 찍힌다.
  completedAt?: string;       // 완료·보류(처리 종료)로 바뀐 마지막 순간.
  notionUrl: string;
  actionNote: string;
  actionCategory: string[];
  actionMethod: string;
  feedbackEmailSent: boolean;
  satisfaction?: number;      // 문의자 만족도 평가(1~5). 미평가면 undefined.
  feedbackComment?: string;   // 만족도 코멘트.
}

export async function fetchHelpDeskTickets(): Promise<HelpDeskTicket[]> {
  if (isMock()) return mockHelpDeskTickets as HelpDeskTicket[];
  // 메인 저장소(맥북 Postgres 미러) 우선, 미설정/미스 시 Notion 백업 폴백.
  const mir = await readEntity<HelpDeskTicket>("helpdesk");
  if (mir) return [...mir].sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
  return fetchHelpDeskTicketsFromNotion();
}

// Notion 직접 조회(초기 seed / 폴백 전용).
export async function fetchHelpDeskTicketsFromNotion(): Promise<HelpDeskTicket[]> {
  const dbId = process.env.NOTION_DB_HELPDESK || process.env.NOTION_DB_TICKETS;
  if (!dbId) throw new Error("NOTION_DB_HELPDESK 환경변수가 설정되지 않았습니다.");

  const pages = await queryAllPages(dbId, undefined, [
    { timestamp: "created_time", direction: "descending" },
  ]);

  return pages.map((page) => {
    const p = page.properties;
    const submittedAt =
      getPropDate(p, "문의 제출 시간") ||
      getPropDate(p, "Created") ||
      page.created_time;
    return {
      id: page.id,
      title: getPropText(p, "문의내용") || getPropText(p, "제목") || getPropText(p, "Title") || getPropText(p, "No") || "",
      status: getPropSelect(p, "status") || getPropSelect(p, "상태") || getPropSelect(p, "Status") || "진행 중",
      inquiryType: getPropSelect(p, "문의유형") || getPropSelect(p, "Category") || "기타",
      company: getPropSelect(p, "법인") || getPropText(p, "법인") || "",
      department: getPropText(p, "부서") || getPropText(p, "Department") || "",
      requester: getPropText(p, "문의자") || getPropPeople(p, "문의자") || getPropText(p, "Requester") || "",
      requesterEmail: getPropEmail(p, "문의자 이메일") || getPropText(p, "문의자 이메일") || getPropEmail(p, "이메일") || getPropText(p, "이메일") || getPropEmail(p, "Email") || getPropText(p, "Email") || "",
      assetNo: getPropText(p, "자산번호") || "",
      content: getPropText(p, "문의내용") || getPropText(p, "Description") || "",
      urgency: getPropSelect(p, "긴급도") || "",
      team: getPropMultiSelect(p, "Team").join(", ") || getPropSelect(p, "Team") || "",
      assignee: getPropPeople(p, "담당자") || getPropPeople(p, "Assignee") || "",
      assigneeId: getPropPeopleList(p, "담당자")[0]?.id ?? "",
      submittedAt,
      lastEditedAt: page.last_edited_time,
      notionUrl: getPageUrl(page.id),
      actionNote: getPropText(p, "조치 내용") || "",
      actionCategory: getPropMultiSelect(p, "조치분류"),
      actionMethod: getPropSelect(p, "조치방법") || "",
      feedbackEmailSent: getPropCheckbox(p, "평가메일발송"),
    };
  });
}

const HELPDESK_TICKETS_CACHE_KEY = "helpdesk:tickets";

// 문의 목록/매뉴얼 이력 연결/알림 등 여러 라우트가 각자 이 Redis 캐시 키를 조회하고 있어,
// 서버 인스턴스가 살아있는 짧은 시간(20초) 동안은 재사용해 Redis 명령 수를 줄인다.
// 이 키 자체가 이미 5분 TTL로 갱신되는 캐시라, 20초를 더 얹어도 기존보다 신선도가 나빠지지 않는다.
export async function getCachedHelpdeskTicketsRaw(): Promise<{ data: HelpDeskTicket[]; lastSynced: string } | null> {
  const { data } = await memCached(
    HELPDESK_TICKETS_CACHE_KEY,
    () => kvGet<{ data: HelpDeskTicket[]; lastSynced: string }>(HELPDESK_TICKETS_CACHE_KEY),
    20
  );
  return data;
}

// ────────────────────────────────────────────────────────────
// 수리 접수 DB 조회
// ────────────────────────────────────────────────────────────
function getPropUniqueId(props: NotionProps, key: string): string {
  const p = props[key];
  if (!p || p.type !== "unique_id") return "";
  const prefix = p.unique_id.prefix ? `${p.unique_id.prefix}-` : "";
  return `${prefix}${p.unique_id.number ?? ""}`;
}

export async function fetchRepairTickets(): Promise<RepairTicket[]> {
  if (isMock()) return mockRepairTickets as RepairTicket[];
  // 메인 저장소(맥북 Postgres 미러) 우선, 미설정/미스 시 Notion 백업 폴백.
  const mir = await readEntity<RepairTicket>("repair");
  if (mir) return [...mir].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return fetchRepairTicketsFromNotion();
}

// Notion 직접 조회(초기 seed / 폴백 전용).
export async function fetchRepairTicketsFromNotion(): Promise<RepairTicket[]> {
  const dbId = process.env.NOTION_DB_REPAIR_TICKETS;
  if (!dbId) throw new Error("NOTION_DB_REPAIR_TICKETS 환경변수가 설정되지 않았습니다.");

  const pages = await queryAllPages(dbId, undefined, [
    { timestamp: "created_time", direction: "descending" },
  ]);

  return pages.map((page) => {
    const p = page.properties;
    return {
      id: page.id,
      ticketNumber: getPropUniqueId(p, "Ticket"),
      title: getPropText(p, "고장증상"),
      faultTypes: getPropMultiSelect(p, "고장 내역"),
      status: (getPropSelect(p, "상태") || "시작 전") as RepairTicket["status"],
      priority: getPropSelect(p, "긴급도"),
      company: getPropSelect(p, "법인"),
      department: getPropText(p, "부서"),
      location: getPropText(p, "실제 근무 위치"),
      building: getPropSelect(p, "건물명"),
      floor: getPropText(p, "층수"),
      assetId: getPropText(p, "자산번호"),
      detail: getPropText(p, "세부내역"),
      requester: getPropText(p, "문의자"),
      assignee: getPropPeople(p, "담당자"),
      assigneeId: getPropPeopleList(p, "담당자")[0]?.id ?? "",
      repairDate: getPropDate(p, "수리 일정"),
      actionNote: getPropText(p, "조치내용"),
      consentGiven: getPropCheckbox(p, "수리 진행 동의서"),
      createdAt: page.created_time.split("T")[0],
      notionUrl: getPageUrl(page.id),
    };
  });
}

export async function createRepairTicket(data: {
  title: string;
  faultTypes: string[];
  company?: string;
  department?: string;
  location?: string;
  assetId?: string;
  requester?: string;
  priority?: string;
}): Promise<string> {
  if (isMock()) { console.log("[MOCK] createRepairTicket", data); return "mock-repair-new"; }
  return createRepairTicketRecord({
    title: data.title,
    faultTypes: data.faultTypes,
    company: data.company,
    department: data.department,
    location: data.location,
    assetId: data.assetId,
    requester: data.requester,
    priority: data.priority,
  });
}

// 수리 접수 → 미러(메인) 레코드 생성. 공용(모니터 수리/공개 접수 폼) 진입점.
export async function createRepairTicketRecord(data: {
  title: string;
  faultTypes: string[];
  company?: string;
  department?: string;
  location?: string;
  building?: string;
  floor?: string;
  assetId?: string;
  detail?: string;
  requester?: string;
  priority?: string;
}): Promise<string> {
  const id = crypto.randomUUID();
  const record: RepairTicket = {
    id,
    ticketNumber: "",
    title: data.title,
    faultTypes: data.faultTypes ?? [],
    status: "시작 전",
    priority: data.priority || "",
    company: data.company || "",
    department: data.department || "",
    location: data.location || "",
    building: data.building || "",
    floor: data.floor || "",
    assetId: data.assetId || "",
    detail: data.detail || "",
    requester: data.requester || "",
    assignee: "",
    assigneeId: "",
    repairDate: "",
    actionNote: "",
    consentGiven: false,
    createdAt: new Date().toISOString().split("T")[0],
    notionUrl: "",
  };
  const ok = await upsertEntity("repair", id, record);
  if (!ok) throw new Error("수리 접수 저장 실패(Postgres)");
  return id;
}

// ────────────────────────────────────────────────────────────
// HW 외부 수리 추적
// ────────────────────────────────────────────────────────────
export async function fetchHwRepairs(): Promise<HwRepairRecord[]> {
  if (isMock()) return mockHwRepairs as HwRepairRecord[];
  // 메인 저장소(맥북 Postgres 미러) 우선, 미설정/미스 시 Notion 백업 폴백.
  const mir = await readEntity<HwRepairRecord>("hw-repair");
  if (mir) return mir;
  return fetchHwRepairsFromNotion();
}

// Notion 직접 조회(초기 seed / 폴백 전용).
export async function fetchHwRepairsFromNotion(): Promise<HwRepairRecord[]> {
  const dbId = process.env.NOTION_DB_HW_REPAIR;
  if (!dbId) throw new Error("NOTION_DB_HW_REPAIR 환경변수가 설정되지 않았습니다.");

  const pages = await queryAllPages(dbId, undefined, [
    { timestamp: "last_edited_time", direction: "descending" },
  ]);

  return pages.map((page) => {
    const p = page.properties;
    return {
      id: page.id,
      assetId: getPropText(p, "자산번호"),
      company: getPropSelect(p, "법인"),
      department: getPropText(p, "부서"),
      user: getPropText(p, "사용자"),
      vendor: getPropSelect(p, "수리업체"),
      stage: getPropSelect(p, "현재단계") || "수리접수",
      receivedAt: getPropDate(p, "접수일"),
      completedAt: getPropDate(p, "실제완료일"),
      faultType: getPropSelect(p, "과실여부"),
      receiptUrl: getPropFiles(p, "수리영수증"),
      consentUrl: getPropFiles(p, "진행동의서"),
      taxInvoiceUrl: getPropFiles(p, "세금계산서결재"),
      approvalUrl: getPropFiles(p, "내부결재내용"),
      assignee: getPropPeople(p, "담당자"),
      assigneeId: getPropPeopleList(p, "담당자")[0]?.id ?? "",
      note: getPropText(p, "수리내용"),
      repairCost: getPropNumber(p, "수리비용"),
      assetStatus: getPropSelect(p, "대분류"),
      address: getPropSelect(p, "배송지"),
      requesterEmail: getPropEmail(p, "기안자이메일"),
      isClosed: getPropCheckbox(p, "케이스종료"),
      lastEditedAt: page.last_edited_time,
      notionUrl: getPageUrl(page.id),
    };
  });
}

// ────────────────────────────────────────────────────────────
// Notion 일반 페이지 블록에서 table 파싱 → SwCredential[]
// 테이블 첫 행을 헤더로 인식. 컬럼명 예시:
//   SW명 | 사이트 | ID / 계정 | 비밀번호 | 비고
// 컬럼명은 대소문자·공백 무관하게 keyword 매칭합니다.
// ────────────────────────────────────────────────────────────
type NotionBlock = BlockObjectResponse | PartialBlockObjectResponse;

async function getAllBlocks(blockId: string): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    });
    blocks.push(...res.results);
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return blocks;
}

function getCellText(cell: { plain_text: string }[]): string {
  return cell.map(c => c.plain_text).join("").trim();
}

function matchCol(header: string, keywords: string[]): boolean {
  const lower = header.toLowerCase().replace(/\s+/g, "");
  return keywords.some(k => lower.includes(k));
}

export async function fetchCredentialsPage(): Promise<SwCredential[]> {
  if (isMock()) return mockCredentials;
  const pageId = process.env.NOTION_PAGE_CREDENTIALS;
  if (!pageId) throw new Error("NOTION_PAGE_CREDENTIALS 환경변수가 설정되지 않았습니다.");

  const blocks = await getAllBlocks(pageId);
  const credentials: SwCredential[] = [];

  for (const block of blocks) {
    if (!("type" in block) || block.type !== "table") continue;

    // 테이블 행 가져오기
    const rowBlocks = await getAllBlocks(block.id);
    if (rowBlocks.length < 2) continue;   // 헤더만 있으면 스킵

    // 첫 행 = 헤더
    const headerBlock = rowBlocks[0];
    if (!("type" in headerBlock) || headerBlock.type !== "table_row") continue;
    const headers: string[] = (headerBlock as any).table_row.cells.map((cell: any[]) =>
      cell.map((c: any) => c.plain_text).join("").trim()
    );

    // 컬럼 인덱스 매핑
    const idxSwName  = headers.findIndex(h => matchCol(h, ["sw명","sw명칭","소프트웨어","서비스","서비스명","이름","name"]));
    const idxSite    = headers.findIndex(h => matchCol(h, ["사이트","url","링크","site","접속","주소"]));
    const idxId      = headers.findIndex(h => matchCol(h, ["id","아이디","계정","account","이메일","email"]));
    const idxPw      = headers.findIndex(h => matchCol(h, ["pw","비밀번호","패스워드","password","pass"]));
    const idxMemo    = headers.findIndex(h => matchCol(h, ["비고","메모","note","memo","참고","remark"]));

    // 데이터 행 파싱
    for (let i = 1; i < rowBlocks.length; i++) {
      const rowBlock = rowBlocks[i];
      if (!("type" in rowBlock) || rowBlock.type !== "table_row") continue;
      const cells: string[] = (rowBlock as any).table_row.cells.map((cell: any[]) =>
        cell.map((c: any) => c.plain_text).join("").trim()
      );

      const swName = idxSwName >= 0 ? cells[idxSwName] ?? "" : cells[0] ?? "";
      if (!swName) continue;   // SW명 없는 행 스킵

      credentials.push({
        id:        rowBlock.id,
        swName,
        siteUrl:   idxSite >= 0 ? cells[idxSite]  ?? "" : "",
        accountId: idxId   >= 0 ? cells[idxId]    ?? "" : "",
        password:  idxPw   >= 0 ? cells[idxPw]    ?? "" : "",
        memo:      idxMemo >= 0 ? cells[idxMemo]  ?? "" : "",
      });
    }
  }

  return credentials;
}

// ────────────────────────────────────────────────────────────
// 헬프데스크 문의 생성 (문의 접수 페이지에서 제출)
// NOTION_DB_HELPDESK 데이터베이스에 생성
// ────────────────────────────────────────────────────────────
export async function createHelpDeskTicket(data: {
  title: string;
  company: string;
  department: string;
  requester: string;
  requesterEmail: string;
  inquiryType: string;
  urgency: string;
  content: string;
  assetNo?: string;
  location?: string;
}): Promise<string> {
  if (isMock()) { console.log("[MOCK] createHelpDeskTicket", data); return "mock-hd-new"; }

  // 메인 저장소(맥북 Postgres 미러)에 기록. 5분 백업 러너가 Notion 에 반영한다.
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const record: HelpDeskTicket = {
    id,
    title: data.title,
    status: "시작 전",
    inquiryType: data.inquiryType,
    company: data.company || "",
    department: data.department || "",
    requester: data.requester,
    requesterEmail: data.requesterEmail,
    assetNo: data.assetNo || "",
    location: data.location || "",
    content: data.content || "",
    urgency: data.urgency,
    team: "",
    assignee: "",
    assigneeId: "",
    submittedAt: now,
    lastEditedAt: now,
    notionUrl: "",
    actionNote: "",
    actionCategory: [],
    actionMethod: "",
    feedbackEmailSent: false,
  };
  const ok = await upsertEntity("helpdesk", id, record);
  if (!ok) throw new Error("문의 저장 실패(Postgres)");
  return id;
}

// ────────────────────────────────────────────────────────────
// SW 신청 생성 (직원 포털에서 신청)
// ────────────────────────────────────────────────────────────
export async function createSwRequest(data: {
  swName: string;
  requester: string;
  reason: string;
  urgency: string;
}): Promise<string> {
  if (isMock()) { console.log("[MOCK] createSwRequest", data); return "mock-sw-req-new"; }
  const dbId = process.env.NOTION_DB_TICKETS;
  if (!dbId) throw new Error("NOTION_DB_TICKETS 환경변수가 설정되지 않았습니다.");

  const response = await notion.pages.create({
    parent: { database_id: dbId },
    properties: {
      Title: {
        title: [{ text: { content: `[SW신청] ${data.swName}` } }],
      },
      카테고리: { select: { name: "SW 신청" } },
      우선순위: { select: { name: data.urgency } },
      상태: { select: { name: "접수" } },
      요청자: { rich_text: [{ text: { content: data.requester } }] },
      내용: { rich_text: [{ text: { content: data.reason } }] },
    },
  });

  return response.id;
}
