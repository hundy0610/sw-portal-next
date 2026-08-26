"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 신규 HW 등록(엑셀 일괄 등록 / PC 신규 등록) 공용 — 등록 후속 처리 훅 + UI.
// lib/hw-register-flow.ts의 순수 로직을 상태와 함께 감싸, 여러 등록 경로가
// 동일한 지급이력 기록 · 자산흐름관리 연동 흐름을 그대로 재사용하게 한다.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import {
  recordDispatchHistory, findAssetFlowSyncMatches, confirmAssetFlowSync,
  type DispatchRow, type SyncMatch,
} from "@/lib/hw-register-flow";

export type { DispatchRow, SyncMatch };

export function useAssetFlowSync() {
  const [syncWarn, setSyncWarn] = useState("");
  const [syncMatches, setSyncMatches] = useState<SyncMatch[]>([]);
  const [syncChecked, setSyncChecked] = useState(false);
  const [expandedSyncIdx, setExpandedSyncIdx] = useState<number | null>(null);

  async function runPostRegistration(successRows: DispatchRow[]) {
    if (successRows.length === 0) return;
    await recordDispatchHistory(successRows);
    try {
      const { matches, warn } = await findAssetFlowSyncMatches(successRows);
      setSyncMatches(matches);
      setSyncWarn(warn);
    } finally {
      setSyncChecked(true);
    }
  }

  async function confirmSync(idx: number) {
    const m = syncMatches[idx];
    if (!m || m.confirmed || m.confirming) return;
    setSyncMatches(prev => prev.map((x, i) => i === idx ? { ...x, confirming: true, error: "" } : x));
    try {
      await confirmAssetFlowSync(m);
      setSyncMatches(prev => prev.map((x, i) => i === idx ? { ...x, confirmed: true, confirming: false } : x));
      setExpandedSyncIdx(null);
    } catch (e) {
      setSyncMatches(prev => prev.map((x, i) => i === idx ? { ...x, confirming: false, error: String(e) } : x));
    }
  }

  function resetSync() {
    setSyncWarn(""); setSyncMatches([]); setSyncChecked(false); setExpandedSyncIdx(null);
  }

  return { syncWarn, syncMatches, syncChecked, expandedSyncIdx, setExpandedSyncIdx, runPostRegistration, confirmSync, resetSync };
}

export function AssetFlowSyncSection({
  syncChecked, syncWarn, syncMatches, expandedSyncIdx, onToggle, onConfirm,
}: {
  syncChecked: boolean;
  syncWarn: string;
  syncMatches: SyncMatch[];
  expandedSyncIdx: number | null;
  onToggle: (idx: number) => void;
  onConfirm: (idx: number) => void;
}) {
  return (
    <>
      {syncWarn && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <div>
            <p className="text-sm font-semibold text-amber-800">자산흐름관리 연동 실패</p>
            <p className="text-xs text-amber-700 mt-0.5">{syncWarn}</p>
          </div>
        </div>
      )}
      {syncChecked && (
        <div className="bg-white rounded-xl border border-blue-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-blue-100 bg-blue-50 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-800">자산흐름관리 연동 필요 항목</p>
              <p className="text-xs text-blue-600 mt-0.5">신규 등록 자산과 법인·사용자가 일치하는 신규구매 대기 항목입니다.</p>
            </div>
            <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-full">{syncMatches.filter(m => !m.confirmed).length}건 대기</span>
          </div>
          {syncMatches.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-gray-400">연동 필요 항목 없음</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {syncMatches.map((m, i) => (
                <div key={i} className={`transition-colors ${m.confirmed ? "bg-green-50/50" : ""}`}>
                  <button type="button" onClick={() => onToggle(i)}
                    className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50 text-left">
                    <div className="flex items-center gap-3">
                      {m.confirmed
                        ? <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">완료</span>
                        : <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{m.erType}</span>
                      }
                      <span className="text-sm font-medium text-gray-800">{m.erUser}</span>
                      <span className="text-xs text-gray-400">{m.erCompany} · {m.erDept}</span>
                    </div>
                    <span className="text-gray-400 text-xs">{expandedSyncIdx === i ? "▲" : "▼"}</span>
                  </button>
                  {expandedSyncIdx === i && (
                    <div className="px-5 pb-4 space-y-3">
                      <div className="bg-gray-50 rounded-xl p-4 text-xs space-y-2">
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                          <div><span className="text-gray-400">유형</span><span className="ml-2 font-medium text-gray-800">{m.erType}</span></div>
                          <div><span className="text-gray-400">사용자</span><span className="ml-2 font-medium text-gray-800">{m.erUser}</span></div>
                          <div><span className="text-gray-400">법인</span><span className="ml-2 font-medium text-gray-800">{m.erCompany}</span></div>
                          <div><span className="text-gray-400">부서</span><span className="ml-2 font-medium text-gray-800">{m.erDept || "-"}</span></div>
                          {m.erAssetId && <div><span className="text-gray-400">기존 자산번호</span><span className="ml-2 font-mono font-medium text-gray-800">{m.erAssetId}</span></div>}
                          <div><span className="text-gray-400">신규 자산번호</span><span className="ml-2 font-mono font-medium text-blue-700">{m.newAssetNo || "-"}</span></div>
                        </div>
                        <div className="border-t border-gray-200 pt-2 mt-1">
                          <p className="text-gray-500 font-medium mb-1">확인 시 자동 처리:</p>
                          <ul className="space-y-0.5 text-gray-600">
                            <li>· 트래커 단계 → <strong>사용자수령</strong> · 교체 자산번호 → <strong>{m.newAssetNo}</strong></li>
                            <li>· 신규 자산 HW 상태 → <strong>사용중</strong></li>
                            {m.erType === "교체" && m.erAssetId && <li>· 기존 자산 <strong className="font-mono">{m.erAssetId}</strong> → <strong>반납예정</strong> (반납예정일 +7일)</li>}
                          </ul>
                        </div>
                      </div>
                      {m.error && <p className="text-xs text-red-600">{m.error}</p>}
                      {!m.confirmed && (
                        <button onClick={() => onConfirm(i)} disabled={m.confirming}
                          className="w-full py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40">
                          {m.confirming ? "처리 중…" : "확인 · 사용자수령 처리"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
