import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import type { MeetingEquipment } from "@/types";

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

async function queryAll(): Promise<MeetingEquipment[]> {
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

export async function fetchMeetingEquipment(): Promise<MeetingEquipment[]> {
  return queryAll();
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
  const props: Record<string, unknown> = {
    "장비명":     { title:     [{ text: { content: fields.name } }] },
    "부서":       { rich_text: [{ text: { content: fields.department } }] },
    "현재사용자": { rich_text: [{ text: { content: fields.currentUser } }] },
    "비고":       { rich_text: [{ text: { content: fields.note } }] },
    "대여중":     { checkbox: false },
  };
  if (fields.company)   props["법인"]       = { select: { name: fields.company } };
  if (fields.userEmail) props["사용자 이메일"] = { email: fields.userEmail };
  if (fields.startDate) props["대여시작일"]   = { date: { start: fields.startDate } };
  if (fields.returnDue) props["반납예정일"]   = { date: { start: fields.returnDue } };

  const page = await notion.pages.create({ parent: { database_id: DB_ID }, properties: props as any });
  return mapPage(page as PageObjectResponse);
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
  const props: Record<string, unknown> = {};
  if (fields.name        !== undefined) props["장비명"]       = { title: [{ text: { content: fields.name } }] };
  if (fields.company     !== undefined) props["법인"]         = fields.company ? { select: { name: fields.company } } : { select: null };
  if (fields.department  !== undefined) props["부서"]         = { rich_text: [{ text: { content: fields.department } }] };
  if (fields.inUse        !== undefined) props["대여중"]       = { checkbox: fields.inUse };
  if (fields.currentUser !== undefined) props["현재사용자"]   = { rich_text: [{ text: { content: fields.currentUser } }] };
  if (fields.userEmail   !== undefined) props["사용자 이메일"] = fields.userEmail ? { email: fields.userEmail } : { email: null };
  if (fields.startDate   !== undefined) props["대여시작일"]    = fields.startDate ? { date: { start: fields.startDate } } : { date: null };
  if (fields.returnDue   !== undefined) props["반납예정일"]    = fields.returnDue ? { date: { start: fields.returnDue } } : { date: null };
  if (fields.note        !== undefined) props["비고"]         = { rich_text: [{ text: { content: fields.note } }] };
  await notion.pages.update({ page_id: id, properties: props as any });
}
