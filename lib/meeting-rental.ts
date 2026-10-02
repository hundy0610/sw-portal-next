import { readEntity, readEntityOne, upsertEntity } from "@/lib/repo/mirror";
import type { MeetingRentalTicket } from "@/types";

const MR_ENTITY = "meeting-rental";


export async function fetchMeetingRentalTickets(): Promise<MeetingRentalTicket[]> {
  const mir = await readEntity<MeetingRentalTicket>(MR_ENTITY);
  if (!mir) throw new Error("미러(맥북 Postgres) 미설정 — SUPABASE_URL/SUPABASE_KEY 를 확인하세요.");
  return [...mir].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
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
