import { Client } from "@notionhq/client";
import type {
  PageObjectResponse,
  QueryDatabaseParameters,
} from "@notionhq/client/build/src/api-endpoints";
import type { SwItem, SwDbRecord, Subscription, LicenseItem, LicenseRecord, Ticket } from "@/types";

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
  if (!p || p.type !== "select") return "";
  return p.select?.name || "";
}

function getPropMultiSelect(props: NotionProps, key: string): string[] {
  const p = props[key];
  if (!p || p.type !== "multi_select") return [];
  return p.multi_select.map((s) => s.name);
}

function getPropNumber(props: NotionProps, key: string): number {
  const p = props[key];
  if (!p || p.type !== "number") return 0;
  return p.number ?? 0;
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

function getPropFile(props: NotionProps, key: string): string {
  const p = props[key];
  if (!p || p.type !== "files") return "";
  if (p.files.length === 0) return "";
  const file = p.files[0];
  if (file.type === "external") return file.external.url;
  if (file.type === "file") return file.file.url;
  return "";
}

function getPageUrl(pageId: string): string {
  return `https://www.notion.so/${pageId.replace(/-/g, "")}`;
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
      returnDate: getPropDate(p, "반납일자"),
      returnScheduledDate: getPropDate(p, "반납예정일"),
      returnReason: getPropSelect(p, "반납사유"),
      licenseKey: getPropText(p, "인증키 / 인증계정"),
      vendor: getPropText(p, "구매처"),
      usageCount: getPropNumber(p, "사용횟수"),
      certificate: getPropFile(p, "증서"),
      workType: getPropSelect(p, "SW사용직군"),
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
