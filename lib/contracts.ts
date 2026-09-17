/**
 * PC/OA 유지보수 계약
 * 저장소: 맥북 Postgres public.entity_store('contracts') 하나뿐이다.
 * 첨부 계약서(PDF)는 Vercel Blob(영구 공개 URL)에 저장하고, 레코드에는 그 URL 을 담는다.
 * 환경변수: BLOB_READ_WRITE_TOKEN(업로드)
 */

import type { Contract, ContractStage } from "@/types/contract";
import { readEntity, readEntityOne, upsertEntity, deleteEntity } from "@/lib/repo/mirror";
import { uploadToBlob } from "@/lib/blob-store";

export const CONTRACT_ENTITY = "contracts";

// ── 날짜 기준 상태 자동 계산 ──────────────────────────────────
function calcStatus(startDate: string, endDate: string): Contract["status"] {
  if (!startDate || !endDate) return "active";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (today < new Date(startDate)) return "pending";
  if (today > new Date(endDate)) return "expired";
  return "active";
}

const VALID_STAGES = [
  "관리현황 파악",
  "각 사 계약담당자 소통 (계약 검토)",
  "계약서 작성 (수정사항 있을시 반영)",
  "내부기안 상신",
  "각 사 날인된 계약서 송부",
  "계약완료",
  "재경팀과 소통하여 월별 서비스 비용 청구",
];

// ══════════════════════════════════════════════════════════════
// Public API (라우트 시그니처 유지)
// ══════════════════════════════════════════════════════════════

/** 계약 목록. status 는 항상 날짜 기준으로 재계산한다. */
export async function fetchContracts(): Promise<Contract[]> {
  const mir = await readEntity<Contract>(CONTRACT_ENTITY);
  if (!mir) throw new Error("미러(맥북 Postgres) 미설정 — SUPABASE_URL/SUPABASE_KEY 를 확인하세요.");
  return mir.map((c) => ({ ...c, status: calcStatus(c.startDate, c.endDate) }));
}

export async function createContract(data: {
  company: string;
  contactName: string;
  contactEmail?: string;
  startDate: string;
  endDate: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
  stage?: ContractStage;
  pdfBuffer?: Buffer;
  pdfFileName?: string;
  pdfLink?: string;
}): Promise<Contract> {
  let pdfUrl = "";
  let pdfName = "";
  if (data.pdfBuffer && data.pdfFileName) {
    pdfUrl = await uploadToBlob(data.pdfBuffer, data.pdfFileName, "application/pdf", "contracts");
    pdfName = data.pdfFileName;
  } else if (data.pdfLink) {
    pdfUrl = data.pdfLink;
    pdfName = data.pdfLink.split("/").pop()?.split("?")[0] || "계약서";
  }

  const now = new Date().toISOString();
  const record: Contract = {
    id:           crypto.randomUUID(),
    company:      data.company,
    contactName:  data.contactName,
    contactEmail: data.contactEmail || "",
    startDate:    data.startDate,
    endDate:      data.endDate,
    quantity:     data.quantity,
    unitPrice:    data.unitPrice,
    pdfUrl,
    pdfName,
    status:       calcStatus(data.startDate, data.endDate),
    stage:        data.stage ?? ("관리현황 파악" as ContractStage),
    notes:        data.notes || "",
    createdAt:    now,
    updatedAt:    now,
  };
  const ok = await upsertEntity(CONTRACT_ENTITY, record.id, record);
  if (!ok) throw new Error("contracts 저장 실패(Postgres)");
  return record;
}

/** 계약 수정 */
export async function updateContract(
  pageId: string,
  data: {
    company?: string;
    contactName?: string;
    contactEmail?: string;
    startDate?: string;
    endDate?: string;
    quantity?: number;
    unitPrice?: number;
    notes?: string;
    stage?: ContractStage;
    pdfBuffer?: Buffer;
    pdfFileName?: string;
    pdfLink?: string;
  }
): Promise<Contract> {
  const base = await readEntityOne<Contract>(CONTRACT_ENTITY, pageId);
  if (!base) throw new Error("대상 계약을 찾을 수 없습니다.");

  const next: Contract = { ...base };
  if (data.company      !== undefined) next.company = data.company;
  if (data.contactName  !== undefined) next.contactName = data.contactName;
  if (data.contactEmail !== undefined) next.contactEmail = data.contactEmail;
  if (data.startDate    !== undefined) next.startDate = data.startDate;
  if (data.endDate      !== undefined) next.endDate = data.endDate;
  if (data.quantity     !== undefined) next.quantity = data.quantity;
  if (data.unitPrice    !== undefined) next.unitPrice = data.unitPrice;
  if (data.notes        !== undefined) next.notes = data.notes;
  if (data.stage        !== undefined) next.stage = data.stage;

  if (data.pdfBuffer && data.pdfFileName) {
    next.pdfUrl = await uploadToBlob(data.pdfBuffer, data.pdfFileName, "application/pdf", "contracts");
    next.pdfName = data.pdfFileName;
  } else if (data.pdfLink) {
    next.pdfUrl = data.pdfLink;
    next.pdfName = data.pdfLink.split("/").pop()?.split("?")[0] || "계약서";
  }

  next.status = calcStatus(next.startDate, next.endDate);
  next.updatedAt = new Date().toISOString();

  const ok = await upsertEntity(CONTRACT_ENTITY, pageId, next);
  if (!ok) throw new Error("contracts 수정 실패(Postgres)");
  return next;
}

/** 진행 단계만 빠르게 업데이트 */
export async function updateContractStage(pageId: string, stage: ContractStage): Promise<void> {
  const base = await readEntityOne<Contract>(CONTRACT_ENTITY, pageId);
  if (!base) throw new Error("대상 계약을 찾을 수 없습니다.");
  const ok = await upsertEntity(CONTRACT_ENTITY, pageId, { ...base, stage, updatedAt: new Date().toISOString() });
  if (!ok) throw new Error("contracts 단계 수정 실패(Postgres)");
}

/** 계약 삭제(소프트 삭제 — 행은 남고 deleted=true 가 된다) */
export async function deleteContract(pageId: string): Promise<void> {
  const ok = await deleteEntity(CONTRACT_ENTITY, pageId);
  if (!ok) throw new Error("contracts 삭제 실패(Postgres)");
}
