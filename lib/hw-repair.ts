import type { HwRepairRecord } from "@/types";
import { uploadToBlob } from "@/lib/blob-store";

// ─────────────────────────────────────────────────────────────────────────────
// HW 외부 수리 (4.0verMACBOOK) — 메인 저장소: 맥북 Postgres public.entity_store('hw-repair').
// 4개 파일 필드(수리영수증/진행동의서/세금계산서결재/내부결재내용)는 각각 다중 첨부이며
// Vercel Blob 공개 URL 배열로 저장한다. 5분 백업 러너가 Blob→Notion 으로 재업로드한다.
// ─────────────────────────────────────────────────────────────────────────────

export const HR_ENTITY = "hw-repair";

// Notion files 프로퍼티명 → 레코드 필드명(string[])
export const HR_FILE_FIELDS: Record<string, keyof HwRepairRecord> = {
  "수리영수증": "receiptUrl",
  "진행동의서": "consentUrl",
  "세금계산서결재": "taxInvoiceUrl",
  "내부결재내용": "approvalUrl",
};

/** 초기 이관(seed)용 — Notion 수리 레코드의 파일들을 Blob 으로 옮겨 미러 data 로 반환. */
export async function seedHwRepairsFromNotion(): Promise<{ id: string; notionId: string; data: Record<string, unknown> }[]> {
  const { fetchHwRepairsFromNotion } = await import("@/lib/notion");
  const rows = await fetchHwRepairsFromNotion();
  const out: { id: string; notionId: string; data: Record<string, unknown> }[] = [];

  for (const r of rows) {
    const data: Record<string, unknown> = { ...r };
    const synced: Record<string, string> = {};
    for (const [prop, field] of Object.entries(HR_FILE_FIELDS)) {
      const urls = (r[field] as string[]) || [];
      if (!Array.isArray(urls) || urls.length === 0) continue;
      const blobUrls: string[] = [];
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        if (!url || !/^https?:\/\//.test(url)) continue;
        try {
          const dl = await fetch(url);
          if (!dl.ok) continue;
          const buf = Buffer.from(await dl.arrayBuffer());
          const ct = dl.headers.get("content-type") || "application/octet-stream";
          const blobUrl = await uploadToBlob(buf, `${field}_${i + 1}`, ct, "hw-repair");
          blobUrls.push(blobUrl);
        } catch (e) {
          console.warn(`[hw-repair seed] 파일 이관 실패(${r.id}/${prop}):`, (e as Error).message);
        }
      }
      (data as Record<string, unknown>)[field as string] = blobUrls;
      if (blobUrls.length) synced[prop] = blobUrls.join("\n");
    }
    if (Object.keys(synced).length) data.__syncedFiles = synced;
    out.push({ id: r.id, notionId: r.id, data });
  }
  return out;
}
