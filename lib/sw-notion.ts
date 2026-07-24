import { Client } from "@notionhq/client";
import type { SwDbRecord } from "@/types";
import { readEntityOne } from "@/lib/repo/mirror";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

export const SW_ENTITY = "sw";

function fileNameFromUrl(url: string, fallback: string): string {
  try {
    const path = new URL(url).pathname;
    const base = decodeURIComponent(path.split("/").pop() || "");
    return base || fallback;
  } catch {
    return fallback;
  }
}

/**
 * 초기 이관(seed)용 — Notion SW 레코드를 읽어 증서/기안문서(1시간 만료 서명 URL)를
 * Vercel Blob(영구)으로 옮기고, 미러 data(certificate/draftDocument = Blob URL)로 반환한다.
 */
export async function seedSwFromNotion(): Promise<{ id: string; notionId: string; data: Record<string, unknown> }[]> {
  const [{ fetchSwDatabaseFromNotion }, { uploadToBlob }] = await Promise.all([
    import("@/lib/notion"),
    import("@/lib/blob-store"),
  ]);
  const rows = await fetchSwDatabaseFromNotion();
  const out: { id: string; notionId: string; data: Record<string, unknown> }[] = [];
  const fileFields: [keyof SwDbRecord, string][] = [["certificate", "증서"], ["draftDocument", "기안문서"]];
  for (const r of rows) {
    const data: Record<string, unknown> = { ...r };
    const synced: Record<string, string> = {};
    for (const [field, prop] of fileFields) {
      const url = (r[field] as string) || "";
      if (url && /^https?:\/\//.test(url)) {
        try {
          const dl = await fetch(url);
          if (dl.ok) {
            const buf = Buffer.from(await dl.arrayBuffer());
            const ct = dl.headers.get("content-type") || "application/octet-stream";
            const blobUrl = await uploadToBlob(buf, fileNameFromUrl(url, prop), ct, "sw");
            data[field as string] = blobUrl;
            synced[prop] = blobUrl;
          }
        } catch (e) {
          console.warn(`[sw seed] 파일 이관 실패(${r.id}/${prop}):`, (e as Error).message);
        }
      }
    }
    if (Object.keys(synced).length) data.__syncedFiles = synced;
    out.push({ id: r.id, notionId: r.id, data });
  }
  return out;
}

// 법인 범위 검증용 — 미러(메인) 우선, 미스 시 Notion 직접 조회(전환 과도기 방어).
export async function getRecordCompany(id: string): Promise<string | null> {
  const rec = await readEntityOne<SwDbRecord>(SW_ENTITY, id);
  if (rec) return rec.company ?? "";
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page: any = await notion.pages.retrieve({ page_id: id });
    return page.properties?.["법인명"]?.select?.name ?? "";
  } catch {
    return null;
  }
}

export type FieldMap = Record<string, unknown>;

/**
 * 편집 필드(FieldMap)를 기존 SW 레코드에 병합해 새 레코드를 만든다(Postgres 메인 write-through 용).
 * 파일 필드(certificateFileUploadId/draftDocFileUploadId)는 Vercel Blob 공개 URL 을 담는다.
 * 반환: { next, changed } — changed 는 실제로 바뀐 필드가 있었는지.
 */
export function applyFields(base: SwDbRecord, fields: FieldMap): { next: SwDbRecord; changed: boolean } {
  const next: SwDbRecord = { ...base };
  let changed = false;
  const setStr = (key: keyof SwDbRecord, val: unknown) => {
    (next as Record<string, unknown>)[key as string] = String(val ?? "");
    changed = true;
  };

  if (fields.swCategory   !== undefined) setStr("swCategory", fields.swCategory);
  if (fields.status       !== undefined) setStr("status", fields.status);
  if (fields.company      !== undefined) setStr("company", fields.company);
  if (fields.licenseType  !== undefined) setStr("licenseType", fields.licenseType);
  if (fields.workType     !== undefined) setStr("workType", fields.workType);
  if (fields.accountType  !== undefined) setStr("accountType", fields.accountType);
  if (fields.renewalCycle !== undefined) setStr("renewalCycle", fields.renewalCycle);
  if (fields.shipStatus   !== undefined) setStr("shipStatus", fields.shipStatus);
  if (fields.user         !== undefined) setStr("user", fields.user);
  if (fields.department   !== undefined) setStr("department", fields.department);
  if (fields.licenseKey   !== undefined) setStr("licenseKey", fields.licenseKey);
  if (fields.vendor       !== undefined) setStr("vendor", fields.vendor);
  if (fields.swDetail     !== undefined) setStr("swDetail", fields.swDetail);
  if (fields.billingType  !== undefined) setStr("billingType", fields.billingType);
  if (fields.renewalDate  !== undefined) setStr("renewalDate", fields.renewalDate);
  if (fields.usageDate    !== undefined) setStr("usageDate", fields.usageDate);
  if (fields.returnDate   !== undefined) setStr("returnDate", fields.returnDate);
  if (fields.lastModifiedBy !== undefined) setStr("lastModifiedBy", fields.lastModifiedBy);
  if (fields.lastModifiedAt !== undefined) setStr("lastModifiedAt", fields.lastModifiedAt);

  if (fields.version !== undefined) {
    const arr = Array.isArray(fields.version)
      ? (fields.version as string[])
      : String(fields.version).split(",").map(v => v.trim()).filter(Boolean);
    next.version = arr;
    changed = true;
  }

  if (fields.monthlyKrw !== undefined) {
    next.monthlyKrw = Number(fields.monthlyKrw ?? 0) || 0;
    next.annualKrw = next.monthlyKrw * 12;
    changed = true;
  }
  if (fields.monthlyUsd !== undefined) {
    next.monthlyUsd = Number(fields.monthlyUsd ?? 0) || 0;
    next.annualUsd = next.monthlyUsd * 12;
    changed = true;
  }

  // 파일: Blob 공개 URL(신규 업로드 시에만 전달됨). 빈 값이면 기존 유지.
  if (fields.certificateFileUploadId !== undefined && fields.certificateFileUploadId) {
    next.certificate = String(fields.certificateFileUploadId);
    changed = true;
  }
  if (fields.draftDocFileUploadId !== undefined && fields.draftDocFileUploadId) {
    next.draftDocument = String(fields.draftDocFileUploadId);
    changed = true;
  }

  return { next, changed };
}
