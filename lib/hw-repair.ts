import type { HwRepairRecord } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// HW 외부 수리 (4.0verMACBOOK) — 메인 저장소: 맥북 Postgres public.entity_store('hw-repair').
// 4개 파일 필드(수리영수증/진행동의서/세금계산서결재/내부결재내용)는 각각 다중 첨부이며
// Vercel Blob 공개 URL 배열로 저장한다.
// ─────────────────────────────────────────────────────────────────────────────

export const HR_ENTITY = "hw-repair";

// 파일 필드명 → 레코드 필드명(string[]). 키는 과거 Notion 프로퍼티명에서 왔고,
// 미러 레코드의 __syncedFiles 키와 맞춰야 해서 그대로 둔다.
export const HR_FILE_FIELDS: Record<string, keyof HwRepairRecord> = {
  "수리영수증": "receiptUrl",
  "진행동의서": "consentUrl",
  "세금계산서결재": "taxInvoiceUrl",
  "내부결재내용": "approvalUrl",
};
