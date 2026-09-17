import type { MeetingEquipment } from "@/types";
import { readEntity, readEntityOne, upsertEntity, isMirrorEnabled } from "@/lib/repo/mirror";

// ─────────────────────────────────────────────────────────────────────────────
// 회의실 장비 (4.0verMACBOOK) — 메인 저장소: 맥북 Postgres public.entity_store('meeting-equipment').
// 저장소는 미러 하나뿐이다.
// "상태"는 예전 Notion formula(대여중 여부 기반)를 앱에서 계산해 저장한다.
// ─────────────────────────────────────────────────────────────────────────────

export const ME_ENTITY = "meeting-equipment";

export function meStatus(inUse: boolean): string {
  return inUse ? "대여중" : "대여가능";
}

export async function fetchMeetingEquipment(): Promise<MeetingEquipment[]> {
  const mir = await readEntity<MeetingEquipment>(ME_ENTITY);
  if (!mir) throw new Error("미러(맥북 Postgres) 미설정 — SUPABASE_URL/SUPABASE_KEY 를 확인하세요.");
  return mir;
}

export async function createMeetingEquipment(fields: {
  name:        string;
  company:     string;
  department:  string;
  currentUser: string;
  userEmail:   string;
  startDate:   string;
  returnDue:   string;
  note:        string;
}): Promise<MeetingEquipment> {
  const record: MeetingEquipment = {
    id:          crypto.randomUUID(),
    notionUrl:   "",
    name:        fields.name,
    company:     fields.company,
    department:  fields.department,
    inUse:       false,
    status:      meStatus(false),
    currentUser: fields.currentUser,
    userEmail:   fields.userEmail,
    startDate:   fields.startDate,
    returnDue:   fields.returnDue,
    note:        fields.note,
  };
  const ok = await upsertEntity(ME_ENTITY, record.id, record);
  if (!ok) throw new Error("meeting-equipment 저장 실패(Postgres)");
  return record;
}

export async function updateMeetingEquipment(id: string, fields: {
  name?:        string;
  company?:     string;
  department?:  string;
  inUse?:       boolean;
  currentUser?: string;
  userEmail?:   string;
  startDate?:   string | null;
  returnDue?:   string | null;
  note?:        string;
}): Promise<void> {
  const base = await readEntityOne<MeetingEquipment>(ME_ENTITY, id);
  if (!base) throw new Error("대상 장비를 찾을 수 없습니다.");

  const next: MeetingEquipment = {
    ...base,
    ...(fields.name        !== undefined ? { name: fields.name } : {}),
    ...(fields.company     !== undefined ? { company: fields.company } : {}),
    ...(fields.department  !== undefined ? { department: fields.department } : {}),
    ...(fields.inUse       !== undefined ? { inUse: fields.inUse } : {}),
    ...(fields.currentUser !== undefined ? { currentUser: fields.currentUser } : {}),
    ...(fields.userEmail   !== undefined ? { userEmail: fields.userEmail } : {}),
    ...(fields.startDate   !== undefined ? { startDate: fields.startDate ?? "" } : {}),
    ...(fields.returnDue   !== undefined ? { returnDue: fields.returnDue ?? "" } : {}),
    ...(fields.note        !== undefined ? { note: fields.note } : {}),
  };
  next.status = meStatus(next.inUse);

  const ok = await upsertEntity(ME_ENTITY, id, next);
  if (!ok) throw new Error("meeting-equipment 수정 실패(Postgres)");
}

export { isMirrorEnabled };
