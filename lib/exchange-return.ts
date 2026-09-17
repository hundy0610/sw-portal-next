/**
 * 교체/반납 트래커
 * 저장소: 맥북 Postgres public.entity_store('exchange-return') 하나뿐이다.
 * 레코드의 notionUrl 은 과거 Notion 백업 시절의 잔재라 신규 건은 빈 문자열이다.
 */

import type { ExchangeReturnRecord } from "@/types";
import { readEntity, readEntityOne, upsertEntity, deleteEntity } from "@/lib/repo/mirror";

export const ER_ENTITY = "exchange-return";

function sortByEditedDesc(rows: ExchangeReturnRecord[]): ExchangeReturnRecord[] {
  return [...rows].sort((a, b) => (b.lastEditedAt || "") < (a.lastEditedAt || "") ? -1 : 1);
}

export async function fetchExchangeReturns(): Promise<ExchangeReturnRecord[]> {
  const mir = await readEntity<ExchangeReturnRecord>(ER_ENTITY);
  if (!mir) throw new Error("미러(맥북 Postgres) 미설정 — SUPABASE_URL/SUPABASE_KEY 를 확인하세요.");
  return sortByEditedDesc(mir);
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
  const base = await readEntityOne<ExchangeReturnRecord>(ER_ENTITY, id);
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
