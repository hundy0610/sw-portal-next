/**
 * PC/OA 유지보수 계약 (4.0verMACBOOK)
 * 메인 저장소: 맥북 Postgres public.entity_store('contracts').
 * 첨부 계약서(PDF)는 Vercel Blob(영구 공개 URL)에 저장하고, 미러 레코드에는 그 URL 을 담는다.
 * 5분 백업 러너가 Blob 파일을 Notion file_uploads 로 재업로드한다(lib/backup/notion-map.ts files 설정).
 * 환경변수: NOTION_DB_CONTRACTS(백업/폴백/시드), NOTION_TOKEN, BLOB_READ_WRITE_TOKEN(업로드)
 */

import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import type { Contract, ContractStage } from "@/types/contract";
import { readEntity, readEntityOne, upsertEntity, deleteEntity } from "@/lib/repo/mirror";
import { uploadToBlob } from "@/lib/blob-store";

export const CONTRACT_ENTITY = "contracts";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

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

// ── Notion 페이지 → Contract (폴백/시드용) ────────────────────
function toContract(page: PageObjectResponse): Contract {
  const p = page.properties;
  const text = (key: string): string => {
    const prop = p[key];
    if (!prop) return "";
    if (prop.type === "title")     return prop.title.map((t) => t.plain_text).join("");
    if (prop.type === "rich_text") return prop.rich_text.map((t) => t.plain_text).join("");
    if (prop.type === "email")     return prop.email ?? "";
    return "";
  };
  const num = (key: string): number => {
    const prop = p[key];
    if (!prop || prop.type !== "number") return 0;
    return prop.number ?? 0;
  };
  const date = (key: string): string => {
    const prop = p[key];
    if (!prop || prop.type !== "date") return "";
    return prop.date?.start ?? "";
  };
  const fileUrl = (key: string): string => {
    const prop = p[key];
    if (!prop || prop.type !== "files" || !prop.files.length) return "";
    const f = prop.files[0];
    if (f.type === "file")     return f.file.url;
    if (f.type === "external") return f.external.url;
    return "";
  };
  const fileName = (key: string): string => {
    const prop = p[key];
    if (!prop || prop.type !== "files" || !prop.files.length) return "";
    return prop.files[0].name ?? "";
  };
  const select = (key: string): string => {
    const prop = p[key];
    if (!prop || prop.type !== "select") return "";
    return prop.select?.name ?? "";
  };

  const startDate = date("계약시작일");
  const endDate   = date("계약종료일");
  const stageRaw = select("진행단계");
  const stage = (VALID_STAGES.includes(stageRaw) ? stageRaw : "관리현황 파악") as ContractStage;

  return {
    id:           page.id,
    company:      text("법인명"),
    contactName:  text("담당자"),
    contactEmail: text("이메일"),
    startDate,
    endDate,
    quantity:     num("PC수량"),
    unitPrice:    num("단가") || 6000,
    pdfUrl:       fileUrl("계약서"),
    pdfName:      fileName("계약서"),
    status:       calcStatus(startDate, endDate),
    stage,
    notes:        text("메모"),
    createdAt:    page.created_time,
    updatedAt:    page.last_edited_time,
  };
}

async function queryAllNotion(dbId: string): Promise<PageObjectResponse[]> {
  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion.databases.query({
      database_id: dbId,
      sorts: [{ timestamp: "created_time", direction: "descending" }],
      start_cursor: cursor,
      page_size: 100,
    });
    for (const p of res.results) {
      if (p.object === "page" && "properties" in p) pages.push(p as PageObjectResponse);
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return pages;
}

async function fetchOneFromNotion(id: string): Promise<Contract | null> {
  try {
    const page = await notion.pages.retrieve({ page_id: id });
    if (page.object !== "page" || !("properties" in page)) return null;
    return toContract(page as PageObjectResponse);
  } catch {
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
// Public API (라우트 시그니처 유지)
// ══════════════════════════════════════════════════════════════

/** 계약 목록 — 미러(Postgres) 우선, 미설정/실패 시 Notion 폴백. status 는 항상 날짜 기준 재계산. */
export async function fetchContracts(): Promise<Contract[]> {
  const mir = await readEntity<Contract>(CONTRACT_ENTITY);
  if (mir) return mir.map((c) => ({ ...c, status: calcStatus(c.startDate, c.endDate) }));

  const dbId = process.env.NOTION_DB_CONTRACTS;
  if (!dbId) return [];
  const pages = await queryAllNotion(dbId);
  return pages.map(toContract);
}

/** 초기 이관(seed)용 — Notion 계약을 읽고 첨부파일을 Blob 으로 옮겨 미러 data 형태로 반환. */
export async function seedContractsFromNotion(): Promise<{ id: string; notionId: string; data: Record<string, unknown> }[]> {
  const dbId = process.env.NOTION_DB_CONTRACTS;
  if (!dbId) return [];
  const pages = await queryAllNotion(dbId);
  const out: { id: string; notionId: string; data: Record<string, unknown> }[] = [];
  for (const page of pages) {
    const c = toContract(page);
    const data: Record<string, unknown> = { ...c };
    // Notion 서명 URL(1시간 만료)을 영구 Blob URL 로 이관 → 앱이 안정적으로 서빙.
    if (c.pdfUrl && /^https?:\/\//.test(c.pdfUrl)) {
      try {
        const dl = await fetch(c.pdfUrl);
        if (dl.ok) {
          const buf = Buffer.from(await dl.arrayBuffer());
          const ct = dl.headers.get("content-type") || "application/pdf";
          const blobUrl = await uploadToBlob(buf, c.pdfName || "계약서.pdf", ct, "contracts");
          data.pdfUrl = blobUrl;
          // Notion 에는 이미 파일이 있으므로 재업로드 방지 표시.
          data.__syncedFiles = { "계약서": blobUrl };
        }
      } catch (e) {
        console.warn(`[contracts seed] 파일 이관 실패(${c.id}):`, (e as Error).message);
      }
    }
    out.push({ id: c.id, notionId: c.id, data });
  }
  return out;
}

/** 계약 생성 — 첨부는 Blob 업로드, 미러 write-through + dirty → 5분 뒤 Notion 백업. */
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
  let base = await readEntityOne<Contract>(CONTRACT_ENTITY, pageId);
  if (!base) base = await fetchOneFromNotion(pageId);
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
  let base = await readEntityOne<Contract>(CONTRACT_ENTITY, pageId);
  if (!base) base = await fetchOneFromNotion(pageId);
  if (!base) throw new Error("대상 계약을 찾을 수 없습니다.");
  const ok = await upsertEntity(CONTRACT_ENTITY, pageId, { ...base, stage, updatedAt: new Date().toISOString() });
  if (!ok) throw new Error("contracts 단계 수정 실패(Postgres)");
}

/** 계약 삭제 (소프트 삭제 → 백업 시 Notion 아카이브) */
export async function deleteContract(pageId: string): Promise<void> {
  const ok = await deleteEntity(CONTRACT_ENTITY, pageId);
  if (!ok) throw new Error("contracts 삭제 실패(Postgres)");
}
