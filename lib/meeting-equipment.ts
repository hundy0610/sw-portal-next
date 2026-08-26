import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import type { MeetingEquipment } from "@/types";
import { readEntity, readEntityOne, upsertEntity, isMirrorEnabled } from "@/lib/repo/mirror";

// ─────────────────────────────────────────────────────────────────────────────
// 회의실 장비 (4.0verMACBOOK) — 메인 저장소: 맥북 Postgres public.entity_store('meeting-equipment').
// 읽기는 미러 우선(미설정/실패 시 Notion 폴백), 쓰기는 미러에 write-through + dirty.
// "상태"는 Notion formula(대여중 여부 기반)라 미러에는 앱에서 계산해 저장한다.
// ─────────────────────────────────────────────────────────────────────────────

export const ME_ENTITY = "meeting-equipment";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID  = process.env.NOTION_DB_MEETING_EQUIPMENT!;

type Props = PageObjectResponse["properties"];

const txt = (p: Props, k: string) => {
  const v = p[k];
  if (!v) return "";
  if (v.type === "title")     return v.title.map(t => t.plain_text).join("");
  if (v.type === "rich_text") return v.rich_text.map(t => t.plain_text).join("");
  return "";
};
const sel = (p: Props, k: string) => { const v = p[k]; return v?.type === "select" ? (v.select?.name ?? "") : ""; };
const chk = (p: Props, k: string) => { const v = p[k]; return v?.type === "checkbox" ? v.checkbox : false; };
const dt  = (p: Props, k: string) => { const v = p[k]; return v?.type === "date" ? (v.date?.start ?? "") : ""; };
const fml = (p: Props, k: string) => { const v = p[k]; return v?.type === "formula" && v.formula.type === "string" ? (v.formula.string ?? "") : ""; };
const eml = (p: Props, k: string) => { const v = p[k]; return v?.type === "email" ? (v.email ?? "") : ""; };

// "대여중" 여부로 상태 문자열을 계산(Notion formula 대체). UI 배지는 "대여중" 포함 여부만 본다.
export function meStatus(inUse: boolean): string {
  return inUse ? "대여중" : "대여가능";
}

function mapPage(page: PageObjectResponse): MeetingEquipment {
  const p = page.properties;
  return {
    id:          page.id,
    notionUrl:   page.url,
    name:        txt(p, "장비명"),
    company:     sel(p, "법인"),
    department:  txt(p, "부서"),
    inUse:       chk(p, "대여중"),
    status:      fml(p, "상태"),
    currentUser: txt(p, "현재사용자"),
    userEmail:   eml(p, "사용자 이메일"),
    startDate:   dt(p,  "대여시작일"),
    returnDue:   dt(p,  "반납예정일"),
    note:        txt(p, "비고"),
  };
}

async function queryAllNotion(): Promise<MeetingEquipment[]> {
  const results: PageObjectResponse[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion.databases.query({
      database_id: DB_ID,
      start_cursor: cursor,
      page_size: 100,
      sorts: [{ timestamp: "created_time", direction: "descending" }],
    });
    results.push(...(res.results as PageObjectResponse[]));
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return results.map(mapPage);
}

// 미러 미적재 레코드(레거시)를 Notion 에서 읽어와 반환 — 지연 마이그레이션용.
async function fetchOneFromNotion(id: string): Promise<MeetingEquipment | null> {
  try {
    const page = await notion.pages.retrieve({ page_id: id });
    if (page.object !== "page" || !("properties" in page)) return null;
    return mapPage(page as PageObjectResponse);
  } catch {
    return null;
  }
}

/** 초기 이관(seed)용 — 현재 Notion 레코드 전체. */
export async function fetchMeetingEquipmentFromNotion(): Promise<MeetingEquipment[]> {
  return queryAllNotion();
}

export async function fetchMeetingEquipment(): Promise<MeetingEquipment[]> {
  const mir = await readEntity<MeetingEquipment>(ME_ENTITY);
  if (mir) return mir;
  // 미러 미설정/조회실패 → 기존 Notion 경로 폴백(완전 다운 방지)
  return queryAllNotion();
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
  // 기존 레코드 확보(미러 우선, 없으면 Notion 에서 지연 마이그레이션)
  let base = await readEntityOne<MeetingEquipment>(ME_ENTITY, id);
  if (!base) base = await fetchOneFromNotion(id);
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
