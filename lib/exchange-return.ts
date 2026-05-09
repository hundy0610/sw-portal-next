/**
 * 교체/반납 트래커 — Notion DB 연동 모듈
 * 환경변수: NOTION_DB_EXCHANGE_RETURN, NOTION_TOKEN
 */

import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import type { ExchangeReturnRecord } from "@/types";
import { fetchAllHwRecords } from "@/lib/hw";

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

function mapPage(page: PageObjectResponse): ExchangeReturnRecord {
  const p = page.properties;
  return {
    id:           page.id,
    type:         sel(p, "유형"),
    assetId:      txt(p, "자산번호"),
    newAssetId:   txt(p, "교체 자산번호"),
    company:      sel(p, "법인"),
    department:   txt(p, "부서"),
    user:         txt(p, "사용자"),
    stage:        sel(p, "현재단계"),
    requestedAt:  dt(p,  "신청일"),
    returnDue:    dt(p,  "반납예정일"),
    completedAt:  dt(p,  "완료일"),
    reason:       txt(p, "신청사유"),
    assignee:     ppl(p, "담당자"),
    assigneeId:   pplFirstId(p, "담당자"),
    note:         txt(p, "비고"),
    autoSynced:   chk(p, "자동동기화"),
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
  reason?: string;
  assigneeId?: string;
  note?: string;
  autoSynced?: boolean;
}

export async function createExchangeReturn(fields: CreateFields): Promise<ExchangeReturnRecord> {
  const dbId = getDbId();
  if (!fields.assetId?.trim()) throw new Error("자산번호 필수");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props: Record<string, any> = {
    "자산번호": { title: [{ text: { content: fields.assetId.trim() } }] },
    "유형":     { select: { name: fields.type } },
  };

  if (fields.newAssetId)  props["교체 자산번호"] = { rich_text: [{ text: { content: fields.newAssetId } }] };
  if (fields.company)     props["법인"]          = { select: { name: fields.company } };
  if (fields.department)  props["부서"]          = { rich_text: [{ text: { content: fields.department } }] };
  if (fields.user)        props["사용자"]        = { rich_text: [{ text: { content: fields.user } }] };
  if (fields.stage)       props["현재단계"]      = { select: { name: fields.stage } };
  if (fields.requestedAt) props["신청일"]        = { date: { start: fields.requestedAt } };
  if (fields.returnDue)   props["반납예정일"]    = { date: { start: fields.returnDue } };
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
  returnDue?: string | null;
  completedAt?: string | null;
  reason?: string;
  assigneeId?: string;
  note?: string;
  autoSynced?: boolean;
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
  if (fields.returnDue   !== undefined) props["반납예정일"]   = { date: fields.returnDue ? { start: fields.returnDue } : null };
  if (fields.completedAt !== undefined) props["완료일"]       = { date: fields.completedAt ? { start: fields.completedAt } : null };
  if (fields.reason      !== undefined) props["신청사유"]     = { rich_text: [{ text: { content: fields.reason } }] };
  if (fields.assigneeId  !== undefined) props["담당자"]       = fields.assigneeId
    ? { people: [{ object: "user", id: fields.assigneeId }] }
    : { people: [] };
  if (fields.note        !== undefined) props["비고"]         = { rich_text: [{ text: { content: fields.note } }] };
  if (fields.autoSynced  !== undefined) props["자동동기화"]   = { checkbox: fields.autoSynced };

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

// ────────────────────────────────────────────────────────────
// HW DB 동기화 — 자동 단계 진행 / 퇴사반납 자동 등록
// ────────────────────────────────────────────────────────────
export interface SyncResult {
  matchedNewAssets: number;     // 교체 신규 자산 매칭 → 반납요청 진입
  ambiguousMatches: number;     // 매칭 후보 여러 건 (수동 확인 필요)
  returnedCompleted: number;    // 반납요청 → 반납완료 자동 전환
  newRetirementRecords: number; // HW DB → 퇴사반납 신규 등록
  newExchangeRecords: number;   // HW DB 교체요청 상태 → 교체 신규 등록
  errors: string[];
}

const ACTIVE_STATUS = "사용중";
const STOCK_STATUS  = "재고";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function syncWithHwDb(): Promise<SyncResult> {
  const result: SyncResult = {
    matchedNewAssets: 0,
    ambiguousMatches: 0,
    returnedCompleted: 0,
    newRetirementRecords: 0,
    newExchangeRecords: 0,
    errors: [],
  };

  const [trackers, hwRecords] = await Promise.all([
    fetchExchangeReturns(),
    fetchAllHwRecords(),
  ]);

  // 1) 교체 — 신규 자산 매칭 → 반납요청 진입
  // 대상: type="교체", stage="기기준비" 또는 "사용자수령"
  // 매칭: HW DB에서 (부서+사용자) 일치 + status=사용중, 본인 기존 자산 제외
  const exchangeWaiting = trackers.filter(t =>
    t.type === "교체" &&
    (t.stage === "기기준비" || t.stage === "사용자수령")
  );

  for (const t of exchangeWaiting) {
    if (!t.department || !t.user) continue;
    const candidates = hwRecords.filter(hw =>
      hw.dept === t.department &&
      hw.user === t.user &&
      hw.status === ACTIVE_STATUS &&
      hw.assetNo &&
      hw.assetNo !== t.assetId
    );

    if (candidates.length === 1) {
      const newAsset = candidates[0];
      try {
        await updateExchangeReturn(t.id, {
          newAssetId: newAsset.assetNo,
          stage: "반납요청",
          returnDue: addDays(todayStr(), 7),
          autoSynced: true,
        });
        result.matchedNewAssets++;
      } catch (e) {
        result.errors.push(`매칭 업데이트 실패 (${t.id}): ${String(e)}`);
      }
    } else if (candidates.length > 1) {
      // 동명이인 — 수동 확인 필요
      const tag = "[자동매칭실패]";
      if (t.note?.includes(tag)) continue; // 중복 누적 방지
      const note = `${t.note ? t.note + "\n" : ""}${tag} 후보 여러 건: ${candidates.map(c => c.assetNo).filter(Boolean).join(", ")}`;
      try {
        await updateExchangeReturn(t.id, { note });
        result.ambiguousMatches++;
      } catch (e) {
        result.errors.push(`수동확인 표시 실패 (${t.id}): ${String(e)}`);
      }
    }
  }

  // 2) 반납요청 → 반납완료 (assetId가 재고로 변경됨 감지)
  const returnRequests = trackers.filter(t => t.stage === "반납요청" && t.assetId);
  for (const t of returnRequests) {
    const hwRec = hwRecords.find(hw => hw.assetNo === t.assetId);
    if (hwRec && hwRec.status === STOCK_STATUS) {
      try {
        await updateExchangeReturn(t.id, {
          stage: "반납완료",
          completedAt: todayStr(),
          autoSynced: true,
        });
        result.returnedCompleted++;
      } catch (e) {
        result.errors.push(`반납완료 처리 실패 (${t.id}): ${String(e)}`);
      }
    }
  }

  // 3) HW DB → 퇴사반납 자동 등록
  // 대상: HW DB에서 반납예정일 입력 + status=사용중, 트래커에 미등록
  const trackedAssetIds = new Set(
    trackers
      .filter(t => t.type === "퇴사반납" && t.stage !== "반납완료" && t.assetId)
      .map(t => t.assetId)
  );

  const retirementCandidates = hwRecords.filter(hw =>
    hw.returnDue &&
    hw.status === ACTIVE_STATUS &&
    hw.assetNo &&
    !trackedAssetIds.has(hw.assetNo)
  );

  for (const hw of retirementCandidates) {
    try {
      await createExchangeReturn({
        type: "퇴사반납",
        assetId: hw.assetNo,
        company: hw.company,
        department: hw.dept,
        user: hw.user,
        stage: "반납요청",
        requestedAt: todayStr(),
        returnDue: hw.returnDue,
        autoSynced: true,
      });
      result.newRetirementRecords++;
    } catch (e) {
      result.errors.push(`퇴사반납 등록 실패 (${hw.assetNo}): ${String(e)}`);
    }
  }

  // 4) HW DB 교체요청 상태 → 교체 트래커 자동 등록
  const trackedExchangeAssetIds = new Set(
    trackers
      .filter(t => t.type === "교체" && t.stage !== "반납완료" && t.assetId)
      .map(t => t.assetId)
  );

  const exchangeCandidates = hwRecords.filter(hw =>
    hw.status === "교체요청" &&
    hw.assetNo &&
    !trackedExchangeAssetIds.has(hw.assetNo)
  );

  for (const hw of exchangeCandidates) {
    try {
      await createExchangeReturn({
        type: "교체",
        assetId: hw.assetNo,
        company: hw.company,
        department: hw.dept,
        user: hw.user,
        stage: "교체요청",
        requestedAt: todayStr(),
        autoSynced: true,
      });
      result.newExchangeRecords++;
    } catch (e) {
      result.errors.push(`교체 등록 실패 (${hw.assetNo}): ${String(e)}`);
    }
  }

  return result;
}

