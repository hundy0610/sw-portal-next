import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID  = process.env.NOTION_DB_RENTAL_HW!;

type Props = PageObjectResponse["properties"];

const txt = (p: Props, k: string) => {
  const v = p[k];
  if (!v) return "";
  if (v.type === "title")     return v.title.map(t => t.plain_text).join("");
  if (v.type === "rich_text") return v.rich_text.map(t => t.plain_text).join("");
  return "";
};
const sel  = (p: Props, k: string) => { const v = p[k]; return v?.type === "select" ? (v.select?.name ?? "") : ""; };
const chk  = (p: Props, k: string) => { const v = p[k]; return v?.type === "checkbox" ? v.checkbox : false; };
const dt   = (p: Props, k: string) => { const v = p[k]; return v?.type === "date" ? (v.date?.start ?? "") : ""; };
const fml  = (p: Props, k: string) => { const v = p[k]; return v?.type === "formula" && v.formula.type === "string" ? (v.formula.string ?? "") : ""; };

export interface RentalRecord {
  id:           string;
  notionUrl:    string;
  userAndReason: string;  // 실사용자 / 지급사유 (title)
  requester:    string;   // 요청인
  company:      string;   // 요청법인
  dept:         string;   // 부서
  assetNo:      string;   // 출고자산번호
  assetNoOld:   string;   // 출고자산번호 (기존)
  dlpAccount:   string;   // 인증 DLP 계정
  inStock:      boolean;  // 재고
  status:       string;   // 상태 (formula)
  startDate:    string;   // 사용시작일
  returnDue:    string;   // 반납예정일
}

function mapPage(page: PageObjectResponse): RentalRecord {
  const p = page.properties;
  return {
    id:            page.id,
    notionUrl:     page.url,
    userAndReason: txt(p, "실사용자 / 지급사유"),
    requester:     txt(p, "요청인"),
    company:       sel(p, "요청법인"),
    dept:          txt(p, "부서"),
    assetNo:       txt(p, "출고자산번호"),
    assetNoOld:    txt(p, "출고자산번호 (기존)"),
    dlpAccount:    txt(p, "인증 DLP 계정"),
    inStock:       chk(p, "재고"),
    status:        fml(p, "상태"),
    startDate:     dt(p,  "사용시작일"),
    returnDue:     dt(p,  "반납예정일"),
  };
}

async function queryAll(): Promise<RentalRecord[]> {
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

export async function fetchRentalRecords(): Promise<RentalRecord[]> {
  return queryAll();
}

export async function createRentalRecord(fields: {
  userAndReason: string;
  requester:     string;
  company:       string;
  dept:          string;
  assetNo:       string;
  assetNoOld:    string;
  dlpAccount:    string;
  startDate:     string;
  returnDue:     string;
}): Promise<RentalRecord> {
  const props: Record<string, unknown> = {
    "실사용자 / 지급사유": { title:     [{ text: { content: fields.userAndReason } }] },
    "요청인":              { rich_text: [{ text: { content: fields.requester } }] },
    "부서":                { rich_text: [{ text: { content: fields.dept } }] },
    "출고자산번호":        { rich_text: [{ text: { content: fields.assetNo } }] },
    "출고자산번호 (기존)": { rich_text: [{ text: { content: fields.assetNoOld } }] },
    "인증 DLP 계정":       { rich_text: [{ text: { content: fields.dlpAccount } }] },
    "재고":                { checkbox: false },
  };
  if (fields.company)   props["요청법인"]  = { select: { name: fields.company } };
  if (fields.startDate) props["사용시작일"] = { date:   { start: fields.startDate } };
  if (fields.returnDue) props["반납예정일"] = { date:   { start: fields.returnDue } };

  const page = await notion.pages.create({ parent: { database_id: DB_ID }, properties: props as any });
  return mapPage(page as PageObjectResponse);
}

export async function updateRentalRecord(id: string, fields: {
  returnDue?:    string | null;
  inStock?:      boolean;
  userAndReason?: string;
  requester?:    string;
  company?:      string;
  dept?:         string;
  dlpAccount?:   string;
}): Promise<void> {
  const props: Record<string, unknown> = {};
  if (fields.returnDue !== undefined)    props["반납예정일"]       = fields.returnDue ? { date: { start: fields.returnDue } } : { date: null };
  if (fields.inStock   !== undefined)    props["재고"]              = { checkbox: fields.inStock };
  if (fields.userAndReason !== undefined) props["실사용자 / 지급사유"] = { title: [{ text: { content: fields.userAndReason } }] };
  if (fields.requester !== undefined)    props["요청인"]            = { rich_text: [{ text: { content: fields.requester } }] };
  if (fields.company   !== undefined)    props["요청법인"]          = fields.company ? { select: { name: fields.company } } : { select: null };
  if (fields.dept      !== undefined)    props["부서"]              = { rich_text: [{ text: { content: fields.dept } }] };
  if (fields.dlpAccount !== undefined)   props["인증 DLP 계정"]     = { rich_text: [{ text: { content: fields.dlpAccount } }] };
  await notion.pages.update({ page_id: id, properties: props as any });
}
