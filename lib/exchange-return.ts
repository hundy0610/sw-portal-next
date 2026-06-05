/**
 * 교체/반납 트래커 — Notion DB 연동 모듈
 * 환경변수: NOTION_DB_EXCHANGE_RETURN, NOTION_TOKEN
 */

import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import type { ExchangeReturnRecord } from "@/types";

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
  // 기존 버그로 인해 사용일자가 완료일로 잘못 저장된 레코드의 fallback 처리
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
    autoSynced:   chk(p, "자동동기화"),
    isClosed:     chk(p, "케이스종료"),
    lastEditedAt: page.last_edited_time,
    notionUrl:    page.url,
  };
}

function getDbId(): string {
  const id = process.env.NOTION_DB_EXCHANGE_RETURN;
  if (!id) throw new Error("NOTION_DB_EXCHANGE_RETURN 환경변수가 설정되지 않았습니다.");
  return id;
}

export async function fetchExchangeReturns(): Promise<ExchangeReturnRecord[]> {
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
  autoSynced?: boolean;
  isClosed?: boolean;
}

export async function createExchangeReturn(fields: CreateFields): Promise<ExchangeReturnRecord> {
  const dbId = getDbId();
  if (fields.type !== "신규지급" && !fields.assetId?.trim()) throw new Error("자산번호 필수");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props: Record<string, any> = {
    "자산번호":   { title: [{ text: { content: fields.assetId?.trim() || "" } }] },
    "유형":       { select: { name: fields.type } },
    "케이스종료": { checkbox: false },
  };

  if (fields.newAssetId)  props["교체 자산번호"] = { rich_text: [{ text: { content: fields.newAssetId } }] };
  if (fields.company)     props["법인"]          = { select: { name: fields.company } };
  if (fields.department)  props["부서"]          = { rich_text: [{ text: { content: fields.department } }] };
  if (fields.user)        props["사용자"]        = { rich_text: [{ text: { content: fields.user } }] };
  if (fields.stage)       props["현재단계"]      = { select: { name: fields.stage } };
  if (fields.requestedAt) props["신청일"]        = { date: { start: fields.requestedAt } };
  if (fields.returnDue)   props["반납예정일"]    = { date: { start: fields.returnDue } };
  if (fields.completedAt) props["완료일"]        = { date: { start: fields.completedAt } };
  if (fields.reason)      props["신청사유"]      = { rich_text: [{ text: { content: fields.reason } }] };
  if (fields.assigneeId)  props["담당자"]        = { people: [{ object: "user", id: fields.assigneeId }] };
  if (fields.note)        props["비고"]          = { rich_text: [{ text: { content: fields.note } }] };
  if (fields.autoSynced)  props["자동동기화"]    = { checkbox: true };

  const page = await notion.pages.create({ parent: { database_id: dbId }, properties: props });
  return mapPage(page as PageObjectResponse);
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
}

export async function updateExchangeReturn(id: string, fields: UpdateFields): Promise<void> {
  const props: Record<string, unknown> = {};

  if (fields.type        !== undefined) props["유형"]         = { select: fields.type ? { name: fields.type } : null };
  if (fields.newAssetId  !== undefined) props["교체 자산번호"] = { rich_text: [{ text: { content: fields.newAssetId } }] };
  if (fields.company     !== undefined) props["법인"]         = { select: fields.company ? { name: fields.company } : null };
  if (fields.department  !== undefined) props["부서"]         = { rich_text: [{ text: { content: fields.department } }] };
  if (fields.user        !== undefined) props["사용자"]       = { rich_text: [{ text: { content: fields.user } }] };
  if (fields.stage       !== undefined) props["현재단계"]     = { select: fields.stage ? { name: fields.stage } : null };
  if (fields.requestedAt !== undefined) props["신청일"]       = { date: fields.requestedAt ? { start: fields.requestedAt } : null };
  if (fields.useDate     !== undefined) props["사용일자"]     = { date: fields.useDate ? { start: fields.useDate } : null };
  if (fields.returnDue   !== undefined) props["반납예정일"]   = { date: fields.returnDue ? { start: fields.returnDue } : null };
  if (fields.completedAt !== undefined) props["완료일"]       = { date: fields.completedAt ? { start: fields.completedAt } : null };
  if (fields.reason      !== undefined) props["신청사유"]     = { rich_text: [{ text: { content: fields.reason } }] };
  if (fields.assigneeId  !== undefined) props["담당자"]       = fields.assigneeId
    ? { people: [{ object: "user", id: fields.assigneeId }] }
    : { people: [] };
  if (fields.note        !== undefined) props["비고"]         = { rich_text: [{ text: { content: fields.note } }] };
  if (fields.address         !== undefined) props["배송지"]       = { select: fields.address ? { name: fields.address } : null };
  if (fields.requesterEmail  !== undefined) props["기안자이메일"] = { email: fields.requesterEmail || null };
  if (fields.autoSynced      !== undefined) props["자동동기화"]   = { checkbox: fields.autoSynced };
  if (fields.isClosed    !== undefined) props["케이스종료"]   = { checkbox: fields.isClosed };

  if (Object.keys(props).length === 0) return;

  await notion.pages.update({
    page_id: id,
    properties: props as Parameters<typeof notion.pages.update>[0]["properties"],
  });
}

export async function deleteExchangeReturn(id: string): Promise<void> {
  // Notion은 archived=true로 소프트 삭제. 휴지통에서 30일 후 영구 삭제됨.
  await notion.pages.update({ page_id: id, archived: true });
}

// HW 상태가 "재고"로 변경될 때 호출 — 반납요청 단계인 레코드를 반납완료로 자동 처리
export async function autoCompleteReturnsByAssetId(assetId: string): Promise<number> {
  if (!assetId) return 0;
  const dbId = getDbId();

  const res = await notion.databases.query({
    database_id: dbId,
    filter: { property: "자산번호", title: { equals: assetId } },
  });

  const today = new Date().toISOString().slice(0, 10);
  const pending = (res.results as PageObjectResponse[]).filter(
    p => sel(p.properties, "현재단계") === "반납요청"
  );
  if (pending.length === 0) return 0;

  await Promise.all(pending.map(p =>
    notion.pages.update({
      page_id: p.id,
      properties: {
        "현재단계": { select: { name: "반납완료" } },
        "완료일":   { date: { start: today } },
      } as Parameters<typeof notion.pages.update>[0]["properties"],
    })
  ));
  return pending.length;
}


