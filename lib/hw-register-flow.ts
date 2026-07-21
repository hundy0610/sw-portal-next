// ─────────────────────────────────────────────────────────────────────────────
// 신규 HW(PC) 자산 등록 후속 처리 공용 로직.
// 엑셀 일괄 등록(HwPanel ExcelUploadTab)과 PC 신규 등록(자산 실사 방식, PcRegisterPanel)이
// /api/hw/upload로 마스터를 생성한 뒤 동일하게 거치는 후속 체인:
//   1) 신규 지급 이력 기록 (/api/hw/dispatch-history)
//   2) 자산흐름관리 연동 대상 매칭 (/api/exchange-return)
//   3) 사용자 확인 시 트래커 단계 · HW 상태 일괄 갱신
// ─────────────────────────────────────────────────────────────────────────────
import { safeJson } from "@/lib/fetch-json";

export interface DispatchRow {
  assetNo: string; model: string; serial: string;
  user: string; company: string; dept: string; useDate: string;
}

export interface SyncMatch {
  erId: string; erType: string; erCompany: string; erUser: string; erDept: string;
  erAssetId: string; newAssetNo: string; confirmed: boolean; confirming: boolean; error: string;
}

/** 신규 등록 성공 건에 대해 지급 이력을 기록한다. */
export async function recordDispatchHistory(successRows: DispatchRow[]): Promise<void> {
  if (successRows.length === 0) return;
  const now = new Date().toISOString();
  const events = successRows.map(r => ({
    id: crypto.randomUUID(), dispatchedAt: now, type: "신규" as const,
    assetNo: r.assetNo || "", model: r.model || "", serial: r.serial || "",
    user: r.user || "", company: r.company || "", dept: r.dept || "", useDate: r.useDate || "",
  }));
  await fetch("/api/hw/dispatch-history", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(events),
  }).catch(console.error);
}

/** 신규 등록 성공 건과 법인·사용자가 일치하는 자산흐름관리(신규구매 대기) 후보를 찾는다. */
export async function findAssetFlowSyncMatches(
  successRows: DispatchRow[]
): Promise<{ matches: SyncMatch[]; warn: string }> {
  try {
    const erJson = await fetch("/api/exchange-return").then(r => safeJson(r));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const candidates = (erJson.data ?? []).filter((r: any) =>
      (r.type === "신규지급" || r.type === "교체") &&
      (r.newAssetId ?? "").trim() === "신규구매로안내됨" &&
      !r.isClosed &&
      r.stage !== "사용자수령" && r.stage !== "반납요청" && r.stage !== "반납완료"
    );
    const matches: SyncMatch[] = [];
    for (const row of successRows) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const matched = candidates.filter((r: any) =>
        (r.company ?? "").trim() === (row.company ?? "").trim() && (r.user ?? "").trim() === (row.user ?? "").trim()
      );
      for (const rec of matched) {
        matches.push({
          erId: rec.id, erType: rec.type, erCompany: rec.company, erUser: rec.user,
          erDept: rec.department ?? rec.dept ?? "", erAssetId: rec.assetId ?? "",
          newAssetNo: row.assetNo, confirmed: false, confirming: false, error: "",
        });
      }
    }
    return { matches, warn: "" };
  } catch (e) {
    console.warn("[hw-register-flow] 자산흐름관리 연동 대상 조회 실패:", e);
    return { matches: [], warn: "자산흐름관리 연동 대상 조회 중 오류가 발생했습니다. 수동으로 확인해주세요." };
  }
}

/** 매칭 확인 → 트래커 단계/신규 자산 상태/기존 자산 반납예정까지 일괄 반영. */
export async function confirmAssetFlowSync(m: SyncMatch): Promise<void> {
  const defaultDue = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const updates: Promise<unknown>[] = [
    fetch("/api/exchange-return/update", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: m.erId, fields: { stage: "사용자수령", newAssetId: m.newAssetNo, ...(m.erType === "교체" ? { returnDue: defaultDue } : {}) } }),
    }).then(async res => { const j = await safeJson(res); if (!j.ok) throw new Error(j.error || `HTTP ${res.status}`); }),
  ];
  if (m.newAssetNo) {
    updates.push(fetch(`/api/hw?search=${encodeURIComponent(m.newAssetNo)}`).then(r => safeJson(r)).then(d => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const found = (d.records ?? []).find((r: any) => r.assetNo === m.newAssetNo) ?? (d.records?.length === 1 ? d.records[0] : null);
      if (found) return fetch("/api/hw/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: found.id, fields: { status: "사용중" } }) });
    }));
  }
  if (m.erType === "교체" && m.erAssetId) {
    updates.push(fetch(`/api/hw?search=${encodeURIComponent(m.erAssetId)}`).then(r => safeJson(r)).then(d => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const found = (d.records ?? []).find((r: any) => r.assetNo === m.erAssetId) ?? (d.records?.length === 1 ? d.records[0] : null);
      if (found) return fetch("/api/hw/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: found.id, fields: { status: "반납예정", returnDue: defaultDue } }) });
    }));
  }
  await Promise.all(updates);
}
