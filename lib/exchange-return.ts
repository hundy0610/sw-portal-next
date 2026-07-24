/**
 * 교체/반납 트래커 (4.0verMACBOOK)
 * 메인 저장소: 맥북 Postgres public.entity_store('exchange-return').
 * 읽기는 미러 우선(미설정/실패 시 Notion 폴백), 쓰기는 미러 write-through + dirty → 5분 뒤 Notion 백업.
 * 환경변수: NOTION_DB_EXCHANGE_RETURN(백업/폴백/시드), NOTION_TOKEN
 */

import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import type { ExchangeReturnRecord } from "@/types";
import { readEntity, readEntityOne, upsertEntity, deleteEntity } from "@/lib/repo/mirror";

export const ER_ENTITY = "exchange-return";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

type Props = PageObjectResponse["properties"];

const txt = (p: Props, k: string): string => {
  const v = p[k];
  if (!v) return "";
  if (v.type === "title")     return v.title.map(t => t.plain_text).join("");
  if (v.type === "rich_text") return v.rich_text.map(t => t.plain_text).join("");
  return "";
};

const sel = (p: Props, k: string): string => {
  const v = p[k];
  if (!v) return "";
  if (v.type === "select") return v.select?.name || "";
  if (v.type === "status") return v.status?.name || "";
  return "";
};

const dt = (p: Props, k: string): string => {
  const v = p[k];
  if (!v || v.type !== "date") return "";
  return v.date?.start || "";
};

const chk = (p: Props, k: string): boolean => {
  const v = p[k];
  if (!v || v.type !== "checkbox") return false;
  return v.checkbox;
};

const ppl = (p: Props, k: string): string => {
  const v = p[k];
  if (!v || v.type !== "people") return "";
  return v.people
    .map(person => ("name" in person ? person.name || "" : ""))
    .filter(Boolean)
    .join(", ");
};

const pplFirstId = (p: Props, k: string): string => {
  const v = p[k];
  if (!v || v.type !== "people" || v.people.length === 0) return "";
  return v.people[0]?.id || "";
};

const email = (p: Props, k: string): string => {
  const v = p[k];
  if (!v) return "";
  if (v.type === "email") return v.email || "";
  if (v.type === "rich_text") return v.rich_text.map(t => t.plain_text).join("");
  return "";
};

function mapPage(page: PageObjectResponse): ExchangeReturnRecord {
  const p = page.properties;
  const stage      = sel(p, "현재단계");
  const completedAt = dt(p, "완료일");
  const useDate    = dt(p, "사용일자") || (stage !== "반납완료" ? completedAt : "");
  return {
    id:           page.id,
    type:         sel(p, "유형"),
    assetId:      txt(p, "자산번호"),
    newAssetId:   txt(p, "교체 자산번호"),
    company:      sel(p, "법인"),
    department:   txt(p, "부서"),
    user:         txt(p, "사용자"),
    stage,
    requestedAt:  dt(p,  "신청일"),
    useDate,
    returnDue:    dt(p,  "반납예정일"),
    completedAt,
    reason:       txt(p, "신청사유"),
    assignee:     ppl(p, "담당자"),
    assigneeId:   pplFirstId(p, "담당자"),
    note:         txt(p, "비고"),
    address:          sel(p, "배송지"),
    requesterEmail:   email(p, "기안자이메일"),
    autoSynced:      chk(p, "자동동기화"),
    isClosed:        chk(p, "케이스종료"),
    lastEditedAt:    page.last_edited_time,
    lastModifiedBy:  txt(p, "마지막수정자"),
    notionUrl:       page.url,
  };
}

function getDbId(): string {
  const id = process.env.NOTION_DB_EXCHANGE_RETURN;
  if (!id) throw new Error("NOTION_DB_EXCHANGE_RETURN 환경변수가 설정되지 않았습니다.");
  return id;
}

async function fetchAllFromNotion(): Promise<ExchangeReturnRecord[]> {
  const dbId = getDbId();
  const results: PageObjectResponse[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion.databases.query({
      database_id: dbId,
      start_cursor: cursor,
      page_size: 100,
      sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
    });
    results.push(...(res.results as PageObjectResponse[]));
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return results.map(mapPage);
}

async function fetchOneFromNotion(id: string): Promise<ExchangeReturnRecord | null> {
  try {
    const page = await notion.pages.retrieve({ page_id: id });
    if (page.object !== "page" || !("properties" in page)) return null;
    return mapPage(page as PageObjectResponse);
  } catch {
    return null;
  }
}

function sortByEditedDesc(rows: ExchangeReturnRecord[]): ExchangeReturnRecord[] {
  return [...rows].sort((a, b) => (b.lastEditedAt || "") < (a.lastEditedAt || "") ? -1 : 1);
}

/** 초기 이관(seed)용 — 현재 Notion 레코드 전체. */
export async function fetchExchangeReturnsFromNotion(): Promise<ExchangeReturnRecord[]> {
  return fetchAllFromNotion();
}

export async function fetchExchangeReturns(): Promise<ExchangeReturnRecord[]> {
  const mir = await readEntity<ExchangeReturnRecord>(ER_ENTITY);
  if (mir) return sortByEditedDesc(mir);
  return fetchAllFromNotion();
}

export interface CreateFields {
  type: string;
  assetId: string;
  newAssetId?: string;
  company?: string;
  department?: string;
  user?: string;
  stage?: string;
  requestedAt?: string;
  returnDue?: string;
  completedAt?: string;
  reason?: string;
  assigneeId?: string;
  note?: string;
  address?: string;
  requesterEmail?: string;
  autoSynced?: boolean;
  isClosed?: boolean;
  lastModifiedBy?: string;
}

export async function createExchangeReturn(fields: CreateFields): Promise<ExchangeReturnRecord> {
  if (fields.type !== "신규지급" && !fields.assetId?.trim()) throw new Error("자산번호 필수");
  const now = new Date().toISOString();
  const record: ExchangeReturnRecord = {
    id:             crypto.randomUUID(),
    type:           fields.type,
    assetId:        fields.assetId?.trim() || "",
    newAssetId:     fields.newAssetId || "",
    company:        fields.company || "",
    department:     fields.department || "",
    user:           fields.user || "",
    stage:          fields.stage || "",
    requestedAt:    fields.requestedAt || "",
    useDate:        "",
    returnDue:      fields.returnDue || "",
    completedAt:    fields.completedAt || "",
    reason:         fields.reason || "",
    assignee:       "",
    assigneeId:     fields.assigneeId || "",
    note:           fields.note || "",
    address:        fields.address || "",
    requesterEmail: fields.requesterEmail || "",
    autoSynced:     !!fields.autoSynced,
    isClosed:       !!fields.isClosed,
    lastEditedAt:   now,
    lastModifiedBy: fields.lastModifiedBy || "",
    notionUrl:      "",
  };
  const ok = await upsertEntity(ER_ENTITY, record.id, record);
  if (!ok) throw new Error("exchange-return 저장 실패(Postgres)");
  return record;
}

export interface UpdateFields {
  type?: string;
  newAssetId?: string;
  company?: string;
  department?: string;
  user?: string;
  stage?: string;
  requestedAt?: string;
  useDate?: string | null;
  returnDue?: string | null;
  completedAt?: string | null;
  reason?: string;
  assigneeId?: string;
  note?: string;
  address?: string;
  requesterEmail?: string;
  autoSynced?: boolean;
  isClosed?: boolean;
  lastModifiedBy?: string;
}

export async function updateExchangeReturn(id: string, fields: UpdateFields): Promise<void> {
  let base = await readEntityOne<ExchangeReturnRecord>(ER_ENTITY, id);
  if (!base) base = await fetchOneFromNotion(id);
  if (!base) throw new Error("대상 레코드를 찾을 수 없습니다.");

  const next: ExchangeReturnRecord = { ...base };
  if (fields.type        !== undefined) next.type = fields.type;
  if (fields.newAssetId  !== undefined) next.newAssetId = fields.newAssetId;
  if (fields.company     !== undefined) next.company = fields.company;
  if (fields.department  !== undefined) next.department = fields.department;
  if (fields.user        !== undefined) next.user = fields.user;
  if (fields.stage       !== undefined) next.stage = fields.stage;
  if (fields.requestedAt !== undefined) next.requestedAt = fields.requestedAt;
  if (fields.useDate     !== undefined) next.useDate = fields.useDate ?? "";
  if (fields.returnDue   !== undefined) next.returnDue = fields.returnDue ?? "";
  if (fields.completedAt !== undefined) next.completedAt = fields.completedAt ?? "";
  if (fields.reason      !== undefined) next.reason = fields.reason;
  if (fields.assigneeId  !== undefined) next.assigneeId = fields.assigneeId;
  if (fields.note        !== undefined) next.note = fields.note;
  if (fields.address     !== undefined) next.address = fields.address;
  if (fields.requesterEmail !== undefined) next.requesterEmail = fields.requesterEmail;
  if (fields.autoSynced     !== undefined) next.autoSynced = fields.autoSynced;
  if (fields.isClosed       !== undefined) next.isClosed = fields.isClosed;
  if (fields.lastModifiedBy !== undefined) next.lastModifiedBy = fields.lastModifiedBy;
  next.lastEditedAt = new Date().toISOString();

  const ok = await upsertEntity(ER_ENTITY, id, next);
  if (!ok) throw new Error("exchange-return 수정 실패(Postgres)");
}

export async function deleteExchangeReturn(id: string): Promise<void> {
  const ok = await deleteEntity(ER_ENTITY, id);
  if (!ok) throw new Error("exchange-return 삭제 실패(Postgres)");
}

// HW 상태가 "재고"로 변경될 때 호출 — 반납요청 단계인 레코드를 반납완료로 자동 처리
export async function autoCompleteReturnsByAssetId(assetId: string): Promise<number> {
  if (!assetId) return 0;
  const rows = (await readEntity<ExchangeReturnRecord>(ER_ENTITY)) ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const pending = rows.filter(r => r.assetId === assetId && r.stage === "반납요청");
  if (pending.length === 0) return 0;
  const now = new Date().toISOString();
  await Promise.all(pending.map(r =>
    upsertEntity(ER_ENTITY, r.id, { ...r, stage: "반납완료", completedAt: today, lastEditedAt: now }),
  ));
  return pending.length;
}

// HW 자산의 사용일자가 변경될 때 호출 — 진행 중(미종료) 자산 흐름 레코드의 사용일자 동기화
export async function autoSyncUseDateByAssetId(assetId: string, useDate: string): Promise<number> {
  if (!assetId) return 0;
  const rows = (await readEntity<ExchangeReturnRecord>(ER_ENTITY)) ?? [];
  const targets = rows.filter(r => !r.isClosed && (r.assetId === assetId || r.newAssetId === assetId));
  if (targets.length === 0) return 0;
  const now = new Date().toISOString();
  await Promise.all(targets.map(r =>
    upsertEntity(ER_ENTITY, r.id, { ...r, useDate, lastEditedAt: now }),
  ));
  return targets.length;
}
