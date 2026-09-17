// 미러(맥북 Postgres entity_store)에서 읽고 쓰는 티켓·SW 도메인.
//
// 예전 이름은 lib/notion.ts 였다. Notion 이 메인이던 시절의 파서·클라이언트가 여기 다
// 들어 있었고, 미러로 옮긴 뒤에도 "미설정이면 Notion 으로 폴백"하는 경로가 남아 있었다.
// Notion 을 걷어내면서 그 폴백을 전부 뺐다 — readEntity 가 null 을 주면 그것은 미러가
// 설정되지 않았다는 뜻이고, 조용히 옛 데이터를 보여주는 대신 오류로 드러낸다.
import type { SwDbRecord, RepairTicket, HwRepairRecord } from "@/types";
import { isMock, mockSwDatabase, mockHelpDeskTickets, mockRepairTickets, mockHwRepairs } from "./mock";
import { kvGet } from "@/lib/kv-store";
import { memCached } from "@/lib/mem-cache";
import { readEntity, upsertEntity } from "@/lib/repo/mirror";

const MIRROR_OFF = "미러(맥북 Postgres) 미설정 — SUPABASE_URL/SUPABASE_KEY 를 확인하세요.";

// ── SW 데이터베이스 ──────────────────────────────────────────────────────────

export async function fetchSwDatabase(): Promise<SwDbRecord[]> {
  if (isMock()) return mockSwDatabase as SwDbRecord[];
  const mir = await readEntity<SwDbRecord>("sw");
  if (!mir) throw new Error(MIRROR_OFF);
  return mir;
}

// ── 헬프데스크 문의 ──────────────────────────────────────────────────────────


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
  const mir = await readEntity<HelpDeskTicket>("helpdesk");
  if (!mir) throw new Error(MIRROR_OFF);
  return [...mir].sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
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


// ── 수리 접수 ────────────────────────────────────────────────────────────────

export async function fetchRepairTickets(): Promise<RepairTicket[]> {
  if (isMock()) return mockRepairTickets as RepairTicket[];
  const mir = await readEntity<RepairTicket>("repair");
  if (!mir) throw new Error(MIRROR_OFF);
  return [...mir].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
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

// ── HW 외부 수리 ─────────────────────────────────────────────────────────────

export async function fetchHwRepairs(): Promise<HwRepairRecord[]> {
  if (isMock()) return mockHwRepairs as HwRepairRecord[];
  const mir = await readEntity<HwRepairRecord>("hw-repair");
  if (!mir) throw new Error(MIRROR_OFF);
  return mir;
}

// ── 문의·SW 신청 접수 ────────────────────────────────────────────────────────

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

/**
 * SW 도입 신청 → 헬프데스크 문의로 접수한다.
 *
 * 예전에는 헬프데스크 Notion DB 에 카테고리 "SW 신청" 으로 페이지를 직접 만들었다.
 * 그 DB 의 내용은 이미 entity_store('helpdesk') 가 갖고 있으므로, 같은 미러에
 * 같은 모양으로 넣는다 — 관리자 화면의 문의 목록에 그대로 올라온다.
 */
export async function createSwRequest(data: {
  swName: string;
  requester: string;
  reason: string;
  urgency: string;
}): Promise<string> {
  if (isMock()) { console.log("[MOCK] createSwRequest", data); return "mock-sw-req-new"; }
  return createHelpDeskTicket({
    title: `[SW신청] ${data.swName}`,
    company: "",
    department: "",
    requester: data.requester,
    requesterEmail: "",
    inquiryType: "SW",
    urgency: data.urgency,
    content: data.reason,
  });
}
