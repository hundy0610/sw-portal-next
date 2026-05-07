import { Client } from "@notionhq/client";
import type {
  PageObjectResponse,
  QueryDatabaseParameters,
  BlockObjectResponse,
  PartialBlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import type { SwItem, SwDbRecord, Subscription, LicenseItem, LicenseRecord, Ticket, RepairTicket, HwRepairRecord } from "@/types";
import type { SwCredential } from "@/components/admin/CredentialsPanel";

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
  const dbId = process.env.NOTION_DB_SWDB;
  if (!dbId) throw new Error("NOTION_DB_SWDB 환경변수가 설정되지 않았습니다.");

  const pages = await queryAllPages(dbId, undefined, [
    { property: "Name", direction: "ascending" },
  ]);

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
      workType: getPropSelect(p, "SW사용직군"),
      billingType: getPropSelect(p, "결재방식"),
      monthlyUsd: getPropNumber(p, "월 비용 (USD)") || 0,
      monthlyKrw: getPropNumber(p, "월 비용 (KRW)") || getPropNumber(p, "월 금액") || getPropNumber(p, "월간 금액") || getPropNumber(p, "월 비용") || 0,
      annualUsd:  getPropNumber(p, "연 비용 (USD)") || getPropNumber(p, "연비용(USD)") || 0,
      annualKrw:  getPropNumber(p, "연 비용 (KRW)") || getPropNumber(p, "연비용(KRW)") || 0,
      notionUrl: getPageUrl(page.id),
    };
  });
}

// ────────────────────────────────────────────────────────────
// 구독 관리 DB 조회 (레거시 - SW 데이터베이스로 통합 예정)
// ────────────────────────────────────────────────────────────
export async function fetchSubscriptions(): Promise<Subscription[]> {
  const dbId = process.env.NOTION_DB_SUBSCRIPTIONS;
  if (!dbId) throw new Error("NOTION_DB_SUBSCRIPTIONS 환경변수가 설정되지 않았습니다.");

  const pages = await queryAllPages(dbId);

  return pages.map((page) => {
    const p = page.properties;
    // 실제 Notion DB 컬럼명(한국어) 우선 매핑
    const logoFile = getPropFile(p, "로고") || getPropFile(p, "Logo");
    const krwVal = getPropNumber(p, "결제 금액(KRW)") || getPropNumber(p, "KRW") || getPropNumber(p, "금액(원)");
    const usdVal = getPropNumber(p, "결제 금액(USD)") || getPropNumber(p, "USD");
    return {
      id: page.id,
      name: getPropText(p, "이름") || getPropText(p, "Name") || getPropText(p, "서비스명"),
      logo: logoFile || getPropText(p, "Logo") || getPropText(p, "로고") || "📦",
      version: getPropText(p, "버전") || getPropText(p, "Version"),
      status: (getPropSelect(p, "상태") || getPropSelect(p, "Status") || "구독 중") as Subscription["status"],
      team: getPropText(p, "팀명") || getPropSelect(p, "팀명") || getPropText(p, "Team") || getPropSelect(p, "Team"),
      user: getPropPeople(p, "사용자") || getPropText(p, "사용자") || getPropText(p, "User") || getPropPeople(p, "User") || getPropText(p, "담당자"),
      userCount: getPropNumber(p, "개수") || getPropNumber(p, "Count") || getPropNumber(p, "인원수") || 1,
      cycle: (getPropSelect(p, "결제 주기") || getPropSelect(p, "Cycle") || "월") as Subscription["cycle"],
      krw: krwVal || undefined,
      usd: usdVal || undefined,
      paymentMethod: getPropSelect(p, "결재 방식") || getPropSelect(p, "결제 방식") || getPropSelect(p, "Payment") || "법인카드",
      startDate: getPropDate(p, "결제 시작일") || getPropDate(p, "Start Date") || getPropDate(p, "시작일") || "",
      notionUrl: getPageUrl(page.id),
    };
  });
}

// ────────────────────────────────────────────────────────────
// 라이선스 트래커 DB 조회
// ────────────────────────────────────────────────────────────
export async function fetchLicenses(): Promise<LicenseItem[]> {
  const dbId = process.env.NOTION_DB_LICENSES;
  if (!dbId) throw new Error("NOTION_DB_LICENSES 환경변수가 설정되지 않았습니다.");

  const pages = await queryAllPages(dbId, undefined, [
    { property: "Category", direction: "ascending" },
  ]);

  return pages.map((page) => {
    const p = page.properties;
    return {
      id: page.id,
      name: getPropText(p, "Name") || getPropText(p, "소프트웨어"),
      category: getPropSelect(p, "Category") || getPropSelect(p, "카테고리") || "기타",
      icon: getPropText(p, "Icon") || getPropText(p, "아이콘") || "📄",
      usedCount: getPropNumber(p, "Used") || getPropNumber(p, "사용") || undefined,
      totalCount: getPropNumber(p, "Total") || getPropNumber(p, "수량") || undefined,
      expiryDate: getPropDate(p, "Expiry") || getPropDate(p, "만료일") || undefined,
      status: getPropSelect(p, "Status") || getPropSelect(p, "상태") || undefined,
      notionUrl: getPageUrl(page.id),
    };
  });
}

// ────────────────────────────────────────────────────────────
// 라이선스 트래커 - 전체 개별 레코드 조회 (13개 DB 병렬 쿼리)
// ────────────────────────────────────────────────────────────
const LICENSE_TRACKER_DBS = [
  { id: "29867f4bfdac8155977efa02c6f299dc", name: "MS Office",           icon: "📄" },
  { id: "29867f4bfdac81a5a684df2f8205b5f6", name: "MS Office 365",       icon: "🪟" },
  { id: "29867f4bfdac8128b8c4fd623a02ec0c", name: "한컴",                icon: "🇰🇷" },
  { id: "29867f4bfdac8165a19fe66af94f3d6e", name: "ezPDF",               icon: "📑" },
  { id: "29867f4bfdac81e3ab03d278047ebf20", name: "Adobe PDF",           icon: "🔖" },
  { id: "29867f4bfdac81f2bea1fd7fd1ba58f0", name: "Adobe Creative Cloud",icon: "🎨" },
  { id: "29867f4bfdac8188ba1fea4b14df4454", name: "Adobe Photoshop",     icon: "🎨" },
  { id: "29867f4bfdac818f8d16f36ffb6c9fe7", name: "Adobe Illustrator",   icon: "🎨" },
  { id: "29867f4bfdac818b8981e981128ec333", name: "Adobe Premiere Pro",  icon: "🎬" },
  { id: "29867f4bfdac81779122ccd2196c9908", name: "AUTO CAD",            icon: "🔳" },
  { id: "29867f4bfdac81dcb9ffc637c217f1ab", name: "MAC Office",          icon: "🍎" },
  { id: "29867f4bfdac8168872bce19f14d9c75", name: "MAC 한컴",            icon: "🍎" },
  { id: "29867f4bfdac816ab66dd11a967042cd", name: "기타",                icon: "✨" },
];

export async function fetchLicenseRecords(): Promise<LicenseRecord[]> {
  const results = await Promise.allSettled(
    LICENSE_TRACKER_DBS.map(async (db) => {
      const pages = await queryAllPages(db.id);
      return pages.map((page): LicenseRecord => {
        const p = page.properties;
        return {
          id: page.id,
          userName: getPropText(p, "사용자명"),
          software: db.name,
          softwareDetail: getPropText(p, "소프트웨어"),
          version: getPropSelect(p, "버전"),
          usageStatus: getPropSelect(p, "사용현황") || "재고",
          company: getPropSelect(p, "법인명"),
          department: getPropText(p, "부서"),
          email: getPropText(p, "이메일"),
          licenseStartDate: getPropDate(p, "라이센스 시작일"),
          licenseExpiryDate: getPropDate(p, "라이센스 만료일"),
          usageStartDate: getPropDate(p, "사용시작일 / 반납일자"),
          vendor: getPropSelect(p, "구매처"),
          serialNumber: getPropText(p, "시리얼넘버"),
          notionUrl: getPageUrl(page.id),
        };
      });
    })
  );

  const all: LicenseRecord[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value);
  }
  return all;
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
  content: string;
  urgency: string;
  team: string;
  assignee: string;
  assigneeId: string;
  submittedAt: string;
  lastEditedAt: string;
  notionUrl: string;
  actionNote: string;
  actionCategory: string[];
  actionMethod: string;
}

export async function fetchHelpDeskTickets(): Promise<HelpDeskTicket[]> {
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
      title: getPropText(p, "제목") || getPropText(p, "Title") || getPropText(p, "No") || "",
      status: getPropSelect(p, "상태") || getPropSelect(p, "Status") || "진행 중",
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
    };
  });
}

export async function fetchTickets(): Promise<Ticket[]> {
  const dbId = process.env.NOTION_DB_TICKETS;
  if (!dbId) throw new Error("NOTION_DB_TICKETS 환경변수가 설정되지 않았습니다.");

  const pages = await queryAllPages(dbId, undefined, [
    { timestamp: "created_time", direction: "descending" },
  ]);

  return pages.map((page) => {
    const p = page.properties;
    return {
      id: page.id,
      title: getPropText(p, "Title") || getPropText(p, "제목"),
      category: getPropSelect(p, "Category") || getPropSelect(p, "카테고리") || "기타",
      priority: (getPropSelect(p, "Priority") || getPropSelect(p, "우선순위") || "중간") as Ticket["priority"],
      status: (getPropSelect(p, "Status") || getPropSelect(p, "상태") || "접수") as Ticket["status"],
      requester: getPropText(p, "Requester") || getPropPeople(p, "요청자") || getPropText(p, "요청자"),
      assignee: getPropText(p, "Assignee") || getPropPeople(p, "담당자") || undefined,
      createdAt: getPropDate(p, "Created") || page.created_time.split("T")[0],
      description: getPropText(p, "Description") || getPropText(p, "내용"),
      notionUrl: getPageUrl(page.id),
    };
  });
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
      assetId: getPropText(p, "자산번호"),
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

// ────────────────────────────────────────────────────────────
// HW 외부 수리 추적
// ────────────────────────────────────────────────────────────
export async function fetchHwRepairs(): Promise<HwRepairRecord[]> {
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
}): Promise<string> {
  const dbId = process.env.NOTION_DB_HELPDESK;
  if (!dbId) throw new Error("NOTION_DB_HELPDESK 환경변수가 설정되지 않았습니다.");

  const props: Record<string, unknown> = {
    "제목":     { title: [{ text: { content: data.title } }] },
    "상태":     { select: { name: "진행 중" } },
    "문의유형": { select: { name: data.inquiryType } },
    "부서":     { rich_text: [{ text: { content: data.department } }] },
    "문의자":   { rich_text: [{ text: { content: data.requester } }] },
    "문의자 이메일": { email: data.requesterEmail },
    "문의내용": { rich_text: [{ text: { content: data.content } }] },
    "긴급도":   { select: { name: data.urgency } },
  };
  // 법인은 select 또는 rich_text 모두 허용 (DB 설정에 따라)
  if (data.company) props["법인"] = { select: { name: data.company } };
  if (data.assetNo) props["자산번호"] = { rich_text: [{ text: { content: data.assetNo } }] };

  const response = await notion.pages.create({
    parent: { database_id: dbId },
    properties: props as Parameters<typeof notion.pages.create>[0]["properties"],
  });

  return response.id;
}

// ────────────────────────────────────────────────────────────
// 티켓 생성 (직원 포털에서 접수)
// ────────────────────────────────────────────────────────────
export async function createTicket(data: {
  title: string;
  category: string;
  priority: string;
  description: string;
  requester: string;
}): Promise<string> {
  const dbId = process.env.NOTION_DB_TICKETS;
  if (!dbId) throw new Error("NOTION_DB_TICKETS 환경변수가 설정되지 않았습니다.");

  const response = await notion.pages.create({
    parent: { database_id: dbId },
    properties: {
      Title: { title: [{ text: { content: data.title } }] },
      카테고리: { select: { name: data.category } },
      우선순위: { select: { name: data.priority } },
      상태: { select: { name: "접수" } },
      요청자: { rich_text: [{ text: { content: data.requester } }] },
      내용: { rich_text: [{ text: { content: data.description } }] },
    },
  });

  return response.id;
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

// ────────────────────────────────────────────────────────────
// 도면 편집기 데이터 저장/로드 (NOTION_DB_FLOOR_MAPS)
// ────────────────────────────────────────────────────────────
function chunkString(str: string, size = 1900): string[] {
  const out: string[] = [];
  for (let i = 0; i < str.length; i += size) out.push(str.slice(i, i + size));
  return out;
}

// Notion 파일 업로드 API (SDK v2.x 미지원 → raw fetch)
// 반환값: file_upload ID (Notion 페이지 저장 시 참조)
async function uploadImageToNotion(base64DataUrl: string): Promise<string> {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error("NOTION_TOKEN이 설정되지 않았습니다.");

  const matches = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) throw new Error("유효하지 않은 base64 이미지 형식입니다.");
  const contentType = matches[1];
  const buffer = Buffer.from(matches[2], "base64");
  const filename = `floor-map-${Date.now()}.jpg`;
  const headers = {
    Authorization: `Bearer ${token}`,
    "Notion-Version": "2026-03-11",
  };

  // Step 1: 파일 업로드 객체 생성
  const createRes = await fetch("https://api.notion.com/v1/file_uploads", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "single_part", filename, content_type: contentType }),
  });
  if (!createRes.ok) {
    throw new Error(`Notion 파일 업로드 생성 실패: ${await createRes.text()}`);
  }
  const { id: fileUploadId } = await createRes.json();

  // Step 2: 파일 바이너리 전송
  const formData = new FormData();
  formData.append("file", new Blob([buffer], { type: contentType }), filename);
  const sendRes = await fetch(`https://api.notion.com/v1/file_uploads/${fileUploadId}/send`, {
    method: "POST",
    headers,
    body: formData,
  });
  if (!sendRes.ok) {
    throw new Error(`Notion 파일 전송 실패: ${await sendRes.text()}`);
  }

  return fileUploadId;
}

export async function fetchFloorMap(building: string, floor: string): Promise<object | null> {
  const dbId = process.env.NOTION_DB_FLOOR_MAPS;
  if (!dbId) return null;

  const key = `${building}-${floor}`;
  const res = await notion.databases.query({
    database_id: dbId,
    filter: { property: "Title", title: { equals: key } },
    page_size: 1,
  });
  if (!res.results.length) return null;

  const page = res.results[0] as PageObjectResponse;

  // bgImageFile (Files & media) → 매 API 호출마다 새로운 1시간 서명 URL 발급
  let imageUrl: string | null = null;
  const bgImageFileProp = (page.properties?.bgImageFile as any);
  if (bgImageFileProp?.files?.length > 0) {
    const f = bgImageFileProp.files[0];
    imageUrl = f.type === "file" ? (f.file?.url ?? null) : (f.external?.url ?? null);
  } else {
    // 레거시: base64가 rich_text에 저장된 기존 데이터 하위 호환
    const legacy = ((page.properties?.bgImage as any)?.rich_text ?? [])
      .map((r: any) => r.plain_text as string).join("") || null;
    imageUrl = legacy;
  }

  // elements: items/zones/facilities/groups/renderOrder JSON
  const elementsJson = ((page.properties?.elements as any)?.rich_text ?? [])
    .map((r: any) => r.plain_text as string).join("");

  try {
    const elements = elementsJson ? JSON.parse(elementsJson) : {};
    return { imageUrl, ...elements };
  } catch { return null; }
}

// Notion rich_text 배열 최대 항목 수
const NOTION_RT_LIMIT = 100;

export async function saveFloorMap(
  building: string,
  floor: string,
  data: any,
): Promise<{ ok: boolean }> {
  const dbId = process.env.NOTION_DB_FLOOR_MAPS;
  if (!dbId) throw new Error("NOTION_DB_FLOOR_MAPS 환경변수가 설정되지 않았습니다.");

  const key = `${building}-${floor}`;
  const { imageUrl, ...elements } = data as any;

  const elRaw = chunkString(JSON.stringify(elements));
  const elementsChunks = elRaw.slice(0, NOTION_RT_LIMIT)
    .map((c: string) => ({ text: { content: c } }));

  const props: Record<string, any> = {
    Title:    { title: [{ text: { content: key } }] },
    elements: { rich_text: elementsChunks },
  };

  if (!imageUrl) {
    // 이미지 없음 → 첨부파일 초기화 + 레거시 필드 초기화
    props.bgImageFile = { files: [] };
    props.bgImage     = { rich_text: [] };
  } else if (imageUrl.startsWith("data:")) {
    // 새로 선택한 이미지(base64) → Notion에 업로드
    const fileUploadId = await uploadImageToNotion(imageUrl);
    props.bgImageFile = { files: [{ type: "file_upload", file_upload: { id: fileUploadId } }] };
    props.bgImage     = { rich_text: [] }; // 레거시 필드 초기화
  }
  // imageUrl이 https:// 인 경우(Notion 서명 URL): bgImageFile을 건드리지 않아 기존 첨부 유지

  const existing = await notion.databases.query({
    database_id: dbId,
    filter: { property: "Title", title: { equals: key } },
    page_size: 1,
  });

  if (existing.results.length > 0) {
    await notion.pages.update({ page_id: existing.results[0].id, properties: props });
  } else {
    await notion.pages.create({ parent: { database_id: dbId }, properties: props });
  }

  return { ok: true };
}

// ────────────────────────────────────────────────────────────
// 모니터 이력 (NOTION_DB_MONITOR_HISTORY)
// ────────────────────────────────────────────────────────────

export interface MonitorHistoryEntry {
  id: string;
  title: string;
  itemId: string;
  label: string;
  building: string;
  floor: string;
  eventType: "zone_move" | "repair_request" | "repair_done" | "note";
  from: string;
  to: string;
  description: string;
  status: "pending" | "수리중" | "in_progress" | "done";
  createdAt: string;
  createdBy: string;
}

export async function fetchMonitorHistory(opts: {
  itemId?: string;
  building?: string;
  floor?: string;
  limit?: number;
}): Promise<MonitorHistoryEntry[]> {
  const dbId = process.env.NOTION_DB_MONITOR_HISTORY;
  if (!dbId) return [];
  let normalizedDbId: string;
  try { normalizedDbId = toNotionId(dbId); }
  catch (e: any) { console.error("[notion] fetchMonitorHistory DB ID error:", e.message); return []; }

  const filters: any[] = [];
  if (opts.itemId)   filters.push({ property: "ItemId",   rich_text: { equals: opts.itemId } });
  if (opts.building) filters.push({ property: "Building", select:    { equals: opts.building } });
  if (opts.floor)    filters.push({ property: "Floor",    select:    { equals: opts.floor } });

  const filter =
    filters.length === 0 ? undefined :
    filters.length === 1 ? filters[0] :
    { and: filters };

  const pages = await queryAllPages(normalizedDbId, filter, [
    { property: "CreatedAt", direction: "descending" },
  ]);

  return pages.slice(0, opts.limit ?? 30).map(page => {
    const p = page.properties;
    return {
      id:          page.id,
      title:       getPropText(p, "Title"),
      itemId:      getPropText(p, "ItemId"),
      label:       getPropText(p, "Label"),
      building:    getPropSelect(p, "Building"),
      floor:       getPropSelect(p, "Floor"),
      eventType:   getPropSelect(p, "EventType") as MonitorHistoryEntry["eventType"],
      from:        getPropText(p, "From"),
      to:          getPropText(p, "To"),
      description: getPropText(p, "Description"),
      status:      getPropSelect(p, "Status") as MonitorHistoryEntry["status"],
      createdAt:   getPropDate(p, "CreatedAt"),
      createdBy:   getPropText(p, "CreatedBy"),
    };
  });
}

export async function createMonitorHistory(data: {
  itemId: string;
  label: string;
  building: string;
  floor: string;
  eventType: "zone_move" | "repair_request" | "repair_done" | "note";
  from?: string;
  to?: string;
  description?: string;
  createdBy?: string;
}): Promise<string> {
  const rawDbId = process.env.NOTION_DB_MONITOR_HISTORY;
  if (!rawDbId) throw new Error("NOTION_DB_MONITOR_HISTORY 환경변수가 설정되지 않았습니다.");

  // 디버그: 실제 env 값과 길이 확인
  const cleanHex = rawDbId.replace(/[-\s]/g, "");
  console.log(`[notion] MONITOR_HISTORY DB raw="${rawDbId}" hex_len=${cleanHex.length}`);

  const dbId = toNotionId(rawDbId);
  console.log(`[notion] MONITOR_HISTORY DB uuid="${dbId}"`);

  const now   = new Date().toISOString();
  const title = `${data.itemId}-${Date.now()}`;
  // 수리 요청은 초기 상태를 "수리중"으로 설정
  const initialStatus = data.eventType === "repair_request" ? "수리중" : "pending";

  const response = await notion.pages.create({
    parent: { database_id: toNotionId(dbId) },
    properties: {
      Title:       { title:     [{ text: { content: title } }] },
      ItemId:      { rich_text: [{ text: { content: data.itemId } }] },
      Label:       { rich_text: [{ text: { content: data.label || "" } }] },
      Building:    { select:    { name: data.building } },
      Floor:       { select:    { name: data.floor } },
      EventType:   { select:    { name: data.eventType } },
      From:        { rich_text: [{ text: { content: data.from || "" } }] },
      To:          { rich_text: [{ text: { content: data.to || "" } }] },
      Description: { rich_text: [{ text: { content: data.description || "" } }] },
      Status:      { select:    { name: initialStatus } },
      CreatedAt:   { date:      { start: now } },
      CreatedBy:   { rich_text: [{ text: { content: data.createdBy || "" } }] },
    },
  });

  return response.id;
}

export async function updateMonitorHistoryStatus(
  pageId: string,
  status: "pending" | "수리중" | "in_progress" | "done",
): Promise<void> {
  await notion.pages.update({
    page_id: pageId,
    properties: { Status: { select: { name: status } } },
  });
}
