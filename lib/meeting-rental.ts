import { notionRequest } from "@/shared/lib/notion";
import { readEntity, readEntityOne, upsertEntity } from "@/lib/repo/mirror";
import type { MeetingRentalTicket } from "@/types";

const MR_ENTITY = "meeting-rental";

function mapPage(page: any): MeetingRentalTicket {
  const p = page.properties;
  return {
    id: page.id,
    requester: p.신청자?.title?.[0]?.plain_text ?? "",
    company: p.법인명?.select?.name ?? "",
    department: p.부서?.rich_text?.[0]?.plain_text ?? "",
    email: p["신청자 이메일"]?.email ?? "",
    startAt: p.신청기간?.date?.start ?? "",
    endAt: p.신청기간?.date?.end ?? "",
    status: (p.상태?.status?.name ?? "시작 전") as MeetingRentalTicket["status"],
    assignee: p.담당자?.people?.[0]?.name ?? "",
    assigneeId: p.담당자?.people?.[0]?.id ?? "",
    createdAt: page.created_time,
    notionUrl: page.url,
  };
}

// 4.0verMACBOOK: 메인 저장소(맥북 Postgres 미러) 우선, 미설정/미스 시 Notion 백업 폴백.
export async function fetchMeetingRentalTickets(): Promise<MeetingRentalTicket[]> {
  const mir = await readEntity<MeetingRentalTicket>(MR_ENTITY);
  if (mir) return [...mir].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return fetchMeetingRentalTicketsFromNotion();
}

// Notion 직접 조회(초기 seed / 폴백 전용).
export async function fetchMeetingRentalTicketsFromNotion(): Promise<MeetingRentalTicket[]> {
  const dataSourceId = process.env.MEETING_RENTAL_DATA_SOURCE_ID;
  if (!dataSourceId) throw new Error("MEETING_RENTAL_DATA_SOURCE_ID 환경변수가 설정되지 않았습니다.");

  const results: any[] = [];
  let cursor: string | undefined;
  do {
    const res = await notionRequest<any>(`/data_sources/${dataSourceId}/query`, {
      method: "POST",
      body: {
        start_cursor: cursor,
        sorts: [{ timestamp: "created_time", direction: "descending" }],
      },
    });
    results.push(...res.results);
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);

  return results.map(mapPage);
}

// 신규 대여신청 접수 → 맥북 Postgres 미러에 직접 기록.
export async function createMeetingRentalTicketRecord(data: {
  requester: string;
  company?: string;
  department?: string;
  email?: string;
  startAt?: string;
  endAt?: string;
}): Promise<string> {
  const id = crypto.randomUUID();
  const record: MeetingRentalTicket = {
    id,
    requester: data.requester || "",
    company: data.company || "",
    department: data.department || "",
    email: data.email || "",
    startAt: data.startAt || "",
    endAt: data.endAt || "",
    status: "시작 전",
    assignee: "",
    assigneeId: "",
    createdAt: new Date().toISOString(),
    notionUrl: "",
  };
  const ok = await upsertEntity(MR_ENTITY, id, record);
  if (!ok) throw new Error("대여신청 저장 실패(Postgres)");
  return id;
}

export async function updateMeetingRentalTicket(id: string, fields: {
  status?: MeetingRentalTicket["status"];
  assigneeId?: string;
  assignee?: string;
}): Promise<void> {
  const base = await readEntityOne<MeetingRentalTicket>(MR_ENTITY, id);
  if (!base) throw new Error("대상 티켓을 찾을 수 없습니다.");

  const next: MeetingRentalTicket = { ...base };
  if (fields.status     !== undefined) next.status = fields.status;
  if (fields.assigneeId !== undefined) next.assigneeId = fields.assigneeId;
  if (fields.assignee   !== undefined) next.assignee = fields.assignee;

  const ok = await upsertEntity(MR_ENTITY, id, next);
  if (!ok) throw new Error("저장 실패(Postgres)");
}
