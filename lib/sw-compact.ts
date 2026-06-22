import type { SwDbRecord } from "@/types";

// KV 저장 전 null/빈 값 제거 — 2,600건 기준 ~1.8MB → ~800KB
export function compactSwRecord(r: SwDbRecord): Partial<SwDbRecord> {
  const out: Partial<SwDbRecord> = {};
  for (const _key of Object.keys(r)) {
    const key = _key as keyof SwDbRecord;
    const v = r[key];
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    // 숫자 0은 월비용 필드만 유지 (다른 숫자는 제거)
    if (typeof v === "number" && v === 0 &&
        key !== "monthlyKrw" && key !== "monthlyUsd") continue;
    (out as Record<string, unknown>)[key] = v;
  }
  return out;
}

export function compactSwRecords(records: SwDbRecord[]): Partial<SwDbRecord>[] {
  return records.map(compactSwRecord);
}
