import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { readEntity, readEntityOne, upsertEntity } from "@/lib/repo/mirror";

// ─────────────────────────────────────────────────────────────────────────────
// 렌탈 HW (4.0verMACBOOK) — 메인 저장소: 맥북 Postgres public.entity_store('rental-hw').
// 읽기 미러 우선(폴백 Notion), 쓰기 미러 write-through + dirty → 5분 뒤 Notion 백업.
// "상태"는 Notion formula 이므로 미러에는 앱에서 계산해 저장한다(UI 배지는 "재고"/"미반납" 포함 여부만 사용).
// ─────────────────────────────────────────────────────────────────────────────

export const RENTAL_ENTITY = "rental-hw";

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
  userAndReason: string;
  requester:    string;
  company:      string;
  dept:         string;
  assetNo:      string;
  assetNoOld:   string;
  dlpAccount:   string;
  inStock:      boolean;
  status:       string;
  startDate:    string;
  returnDue:    string;
}

// 재고 여부로 상태 계산(Notion formula 대체). UI 배지는 "재고"/"미반납" 포함 여부만 본다.
export function rentalStatus(inStock: boolean): string {
  return inStock ? "재고" : "미반납";
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

async function queryAllNotion(): Promise<RentalRecord[]> {
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

async function fetchOneFromNotion(id: string): Promise<RentalRecord | null> {
  try {
    const page = await notion.pages.retrieve({ page_id: id });
    if (page.object !== "page" || !("properties" in page)) return null;
    return mapPage(page as PageObjectResponse);
  } catch {
    return null;
  }
}

/** 초기 이관(seed)용 — 현재 Notion 레코드 전체. */
export async function fetchRentalRecordsFromNotion(): Promise<RentalRecord[]> {
  return queryAllNotion();
}

export async function fetchRentalRecords(): Promise<RentalRecord[]> {
  const mir = await readEntity<RentalRecord>(RENTAL_ENTITY);
  if (mir) return mir;
  return queryAllNotion();
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
  const record: RentalRecord = {
    id:            crypto.randomUUID(),
    notionUrl:     "",
    userAndReason: fields.userAndReason,
    requester:     fields.requester,
    company:       fields.company,
    dept:          fields.dept,
    assetNo:       fields.assetNo,
    assetNoOld:    fields.assetNoOld,
    dlpAccount:    fields.dlpAccount,
    inStock:       false,
    status:        rentalStatus(false),
    startDate:     fields.startDate,
    returnDue:     fields.returnDue,
  };
  const ok = await upsertEntity(RENTAL_ENTITY, record.id, record);
  if (!ok) throw new Error("rental-hw 저장 실패(Postgres)");
  return record;
}

export async function updateRentalRecord(id: string, fields: {
  returnDue?:    string | null;
  startDate?:    string | null;
  inStock?:      boolean;
  userAndReason?: string;
  requester?:    string;
  company?:      string;
  dept?:         string;
  dlpAccount?:   string;
}): Promise<void> {
  let base = await readEntityOne<RentalRecord>(RENTAL_ENTITY, id);
  if (!base) base = await fetchOneFromNotion(id);
  if (!base) throw new Error("대상 렌탈 레코드를 찾을 수 없습니다.");

  const next: RentalRecord = { ...base };
  if (fields.returnDue     !== undefined) next.returnDue = fields.returnDue ?? "";
  if (fields.startDate     !== undefined) next.startDate = fields.startDate ?? "";
  if (fields.inStock       !== undefined) next.inStock = fields.inStock;
  if (fields.userAndReason !== undefined) next.userAndReason = fields.userAndReason;
  if (fields.requester     !== undefined) next.requester = fields.requester;
  if (fields.company       !== undefined) next.company = fields.company;
  if (fields.dept          !== undefined) next.dept = fields.dept;
  if (fields.dlpAccount    !== undefined) next.dlpAccount = fields.dlpAccount;
  next.status = rentalStatus(next.inStock);

  const ok = await upsertEntity(RENTAL_ENTITY, id, next);
  if (!ok) throw new Error("rental-hw 수정 실패(Postgres)");
}
