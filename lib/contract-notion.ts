/**
 * PC/OA 유지보수 계약 — Notion DB 연동 모듈
 * 환경변수: NOTION_DB_CONTRACTS  (DB ID)
 *           NOTION_TOKEN         (통합 토큰 — 기존과 공유)
 *
 * KV 캐시: contracts:list (TTL 5분)
 *   - Notion File URL이 1시간 유효하므로 5분 캐시는 안전
 *   - 생성/수정/삭제 시 kvDel로 즉시 무효화
 */

import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { kvGet, kvSet, kvDel } from "@/lib/kv-store";
import type { Contract, ContractStage } from "@/types/contract";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const KV_KEY = "contracts:list";
const KV_TTL = 300; // 5분

// ── 날짜 기준 상태 자동 계산 ──────────────────────────────────
function calcStatus(startDate: string, endDate: string): Contract["status"] {
  if (!startDate || !endDate) return "active";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (today < new Date(startDate)) return "pending";
  if (today > new Date(endDate)) return "expired";
  return "active";
}

// ── Notion 페이지 → Contract 변환 ────────────────────────────
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

  // Notion 첨부 파일 URL & 이름 — 서명 URL은 호출마다 새로 발급됨 (1시간 유효)
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

  // 진행단계 — Notion select "진행단계" 컬럼, 없으면 기본값
  const stageRaw = select("진행단계");
  const VALID_STAGES = ["관리현황파악","계약담당자소통","계약서작성","내부기안상신","계약서날인","계약완료"];
  const stage = (VALID_STAGES.includes(stageRaw) ? stageRaw : "관리현황파악") as ContractStage;

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

// ── Notion File Uploads API (SDK v2.x 미지원 → raw fetch) ────
async function uploadPdfToNotion(buffer: Buffer, filename: string): Promise<string> {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error("NOTION_TOKEN이 설정되지 않았습니다.");

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Notion-Version": "2026-03-11",
  };

  // Step 1: 파일 업로드 세션 생성
  const createRes = await fetch("https://api.notion.com/v1/file_uploads", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "single_part",
      filename,
      content_type: "application/pdf",
    }),
  });
  if (!createRes.ok) {
    const msg = await createRes.text();
    throw new Error(`Notion 파일 업로드 세션 생성 실패: ${msg}`);
  }
  const { id: fileUploadId } = await createRes.json();

  // Step 2: 파일 바이너리 전송
  const formData = new FormData();
  formData.append("file", new Blob([buffer], { type: "application/pdf" }), filename);
  const sendRes = await fetch(
    `https://api.notion.com/v1/file_uploads/${fileUploadId}/send`,
    { method: "POST", headers, body: formData }
  );
  if (!sendRes.ok) {
    const msg = await sendRes.text();
    throw new Error(`Notion 파일 전송 실패: ${msg}`);
  }

  return fileUploadId;
}

// ── Notion DB 전체 페이지 조회 ───────────────────────────────
async function queryAll(dbId: string): Promise<PageObjectResponse[]> {
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
      if (p.object === "page" && "properties" in p) {
        pages.push(p as PageObjectResponse);
      }
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return pages;
}

// ══════════════════════════════════════════════════════════════
// Public API
// ══════════════════════════════════════════════════════════════

/** 계약 목록 조회 (KV 캐시 → Notion fallback) */
export async function fetchContracts(): Promise<Contract[]> {
  const cached = await kvGet<Contract[]>(KV_KEY);
  if (cached) {
    // 캐시 히트: 상태만 재계산 (날짜 의존)
    return cached.map((c) => ({ ...c, status: calcStatus(c.startDate, c.endDate) }));
  }

  const dbId = process.env.NOTION_DB_CONTRACTS;
  if (!dbId) return [];

  const pages  = await queryAll(dbId);
  const result = pages.map(toContract);
  await kvSet(KV_KEY, result, KV_TTL);
  return result;
}

/** 계약 생성 */
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
}): Promise<Contract> {
  const dbId = process.env.NOTION_DB_CONTRACTS;
  if (!dbId) throw new Error("NOTION_DB_CONTRACTS 환경변수가 설정되지 않았습니다.");

  let fileUploadId: string | undefined;
  if (data.pdfBuffer && data.pdfFileName) {
    fileUploadId = await uploadPdfToNotion(data.pdfBuffer, data.pdfFileName);
  }

  const props: Record<string, unknown> = {
    "법인명":     { title:     [{ text: { content: data.company } }] },
    "담당자":     { rich_text: [{ text: { content: data.contactName } }] },
    "이메일":     { email: data.contactEmail || null },
    "계약시작일": { date: { start: data.startDate } },
    "계약종료일": { date: { start: data.endDate } },
    "PC수량":     { number: data.quantity },
    "단가":       { number: data.unitPrice },
    "메모":       { rich_text: [{ text: { content: data.notes || "" } }] },
    "진행단계":   { select: { name: data.stage ?? "관리현황파악" } },
  };
  if (fileUploadId) {
    props["계약서"] = { files: [{ type: "file_upload", file_upload: { id: fileUploadId } }] };
  }

  const page = await notion.pages.create({
    parent: { database_id: dbId },
    properties: props as Parameters<typeof notion.pages.create>[0]["properties"],
  });

  await kvDel(KV_KEY);
  return toContract(page as PageObjectResponse);
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
  }
): Promise<Contract> {
  let fileUploadId: string | undefined;
  if (data.pdfBuffer && data.pdfFileName) {
    fileUploadId = await uploadPdfToNotion(data.pdfBuffer, data.pdfFileName);
  }

  const props: Record<string, unknown> = {};
  if (data.company      !== undefined) props["법인명"]     = { title:     [{ text: { content: data.company } }] };
  if (data.contactName  !== undefined) props["담당자"]     = { rich_text: [{ text: { content: data.contactName } }] };
  if (data.contactEmail !== undefined) props["이메일"]     = { email: data.contactEmail || null };
  if (data.startDate    !== undefined) props["계약시작일"] = { date: { start: data.startDate } };
  if (data.endDate      !== undefined) props["계약종료일"] = { date: { start: data.endDate } };
  if (data.quantity     !== undefined) props["PC수량"]     = { number: data.quantity };
  if (data.unitPrice    !== undefined) props["단가"]       = { number: data.unitPrice };
  if (data.notes        !== undefined) props["메모"]       = { rich_text: [{ text: { content: data.notes } }] };
  if (data.stage        !== undefined) props["진행단계"]   = { select: { name: data.stage } };
  if (fileUploadId) {
    props["계약서"] = { files: [{ type: "file_upload", file_upload: { id: fileUploadId } }] };
  }

  const page = await notion.pages.update({
    page_id: pageId,
    properties: props as Parameters<typeof notion.pages.update>[0]["properties"],
  });

  await kvDel(KV_KEY);
  return toContract(page as PageObjectResponse);
}

/** 진행 단계만 빠르게 업데이트 (칸반 드래그앤드롭용) */
export async function updateContractStage(pageId: string, stage: ContractStage): Promise<void> {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      "진행단계": { select: { name: stage } },
    } as Parameters<typeof notion.pages.update>[0]["properties"],
  });
  await kvDel(KV_KEY);
}

/** 계약 삭제 (Notion 페이지 아카이브) */
export async function deleteContract(pageId: string): Promise<void> {
  await notion.pages.update({ page_id: pageId, archived: true });
  await kvDel(KV_KEY);
}
