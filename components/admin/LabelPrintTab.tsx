"use client";
import { useState, useEffect, useMemo } from "react";
import type { HwRecord } from "@/lib/hw";
import { safeJson } from "@/lib/fetch-json";

export interface PrintQueueItem {
  id: string;
  company: string;
  address: string;
  department: string;
  user: string;
  newAssetId: string;
  type: string;
  note: string;
  addedAt: string;
}

const SHIP_TYPES = ["신규지급", "반납", "교환", "수리", "대여"] as const;

function buildRecipientOrg(company: string, address: string, department: string): string {
  return [company, address, department].filter(Boolean).join(" ") || "-";
}

function generateLabelHtml(labels: LabelEntry[], senderInfo: string): string {
  const warnBar = `<div class="warning">♦파손주의♦&nbsp;&nbsp;&nbsp;♦상하주의♦&nbsp;&nbsp;&nbsp;♦취급주의♦</div>`;
  const labelHtml = labels.map((label, idx) => `
<div class="label">
  ${warnBar}
  <div class="body">
    <div class="from-to">
      <div>발신 : ${senderInfo}</div>
      <div>수신 : ${label.recipientOrg || "&nbsp;"}</div>
    </div>
    <div class="to-name">${label.recipientName || "&nbsp;"} 님 앞</div>
    <div class="ship-box">[ ${label.shipType} - 0 실사용자 : ${label.user || "&nbsp;"} 님 ]</div>
    <div class="contents">내용 : ${label.assetNo || "&nbsp;"}</div>
  </div>
  ${warnBar}
  <div class="page-num">${idx + 1} 페이지</div>
  ${warnBar}
</div>`).join("\n");
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4 portrait; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Malgun Gothic', '맑은 고딕', AppleGothic, sans-serif; width: 210mm; }
  .label { width: 210mm; height: 148.5mm; display: flex; flex-direction: column; overflow: hidden; border-bottom: 2px dashed #aaa; page-break-inside: avoid; }
  .label:last-child { border-bottom: none; }
  .warning { background: #cc0000; color: white; font-size: 19pt; font-weight: 900; text-align: center; padding: 5.5mm 0; letter-spacing: 5px; flex-shrink: 0; }
  .body { flex: 1; padding: 5mm 18mm; display: flex; flex-direction: column; justify-content: space-around; }
  .from-to { font-size: 13pt; line-height: 2; }
  .to-name { font-size: 26pt; font-weight: 900; text-align: center; }
  .ship-box { border: 2.5px solid #222; text-align: center; padding: 2.5mm 0; font-size: 12pt; font-weight: bold; }
  .contents { font-size: 16pt; font-weight: bold; }
  .page-num { text-align: center; font-size: 15pt; color: #999; font-weight: bold; padding: 1.5mm 0; flex-shrink: 0; }
</style>
</head>
<body>
${labelHtml}
<script>window.onload=function(){window.print();}<\/script>
</body>
</html>`;
}

export interface LabelEntry {
  id: string;
  recipientOrg: string;
  recipientName: string;
  user: string;
  assetNo: string;
  shipType: string;
}

export interface PrintHistoryRecord {
  id: string;
  printedAt: string;
  senderInfo: string;
  labels: LabelEntry[];
}

export function LabelPrintTab({
  records,
  recordsReady,
  onLoadRecords,
}: {
  records: HwRecord[];
  recordsReady: boolean;
  onLoadRecords: () => void;
}) {
  const [senderInfo, setSenderInfo] = useState("idsTrust 자산관리파트");
  const [labels, setLabels] = useState<LabelEntry[]>([
    { id: "1", recipientOrg: "", recipientName: "", user: "", assetNo: "", shipType: "신규지급" },
  ]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<string>("");
  const [pickerSearch, setPickerSearch] = useState("");

  // 출력 이력
  const [history, setHistory]               = useState<PrintHistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory]       = useState(false);
  const [historySearch, setHistorySearch]   = useState("");
  const [showCleanup, setShowCleanup]       = useState(false);
  const [cleanupBusy, setCleanupBusy]       = useState(false);

  useEffect(() => {
    if (!recordsReady) onLoadRecords();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 이력 로드
  useEffect(() => {
    setHistoryLoading(true);
    fetch("/api/label-history")
      .then(r => safeJson(r))
      .then(j => {
        if (j.ok) {
          const data: PrintHistoryRecord[] = j.history ?? [];
          setHistory(data);
          if (data.length >= 190) setShowCleanup(true);
        }
      })
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, []);

  const historyRows = useMemo(() => {
    const rows: {
      historyId: string; printedAt: string; senderInfo: string;
      labelIndex: number; recipientOrg: string; recipientName: string;
      user: string; assetNo: string; shipType: string;
    }[] = [];
    history.forEach(h => {
      h.labels.forEach((l, i) => {
        rows.push({
          historyId: h.id, printedAt: h.printedAt, senderInfo: h.senderInfo,
          labelIndex: i + 1,
          recipientOrg: l.recipientOrg, recipientName: l.recipientName,
          user: l.user, assetNo: l.assetNo, shipType: l.shipType,
        });
      });
    });
    return rows;
  }, [history]);

  const filteredRows = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return historyRows;
    return historyRows.filter(r =>
      r.printedAt.includes(q) ||
      r.senderInfo.toLowerCase().includes(q) ||
      r.recipientOrg.toLowerCase().includes(q) ||
      r.recipientName.toLowerCase().includes(q) ||
      r.user.toLowerCase().includes(q) ||
      r.assetNo.toLowerCase().includes(q) ||
      r.shipType.toLowerCase().includes(q)
    );
  }, [historyRows, historySearch]);

  const filteredRecords = useMemo(() => {
    if (!pickerSearch.trim()) return records.slice(0, 50);
    const q = pickerSearch.toLowerCase();
    return records
      .filter(r =>
        (r.user || "").toLowerCase().includes(q) ||
        (r.assetNo || "").toLowerCase().includes(q) ||
        (r.company || "").toLowerCase().includes(q) ||
        (r.dept || "").toLowerCase().includes(q)
      )
      .slice(0, 40);
  }, [records, pickerSearch]);

  function updateLabel(id: string, field: keyof LabelEntry, val: string) {
    setLabels(prev => prev.map(l => l.id === id ? { ...l, [field]: val } : l));
  }

  function addLabel() {
    setLabels(prev => [...prev, {
      id: Date.now().toString(),
      recipientOrg: "", recipientName: "", user: "", assetNo: "", shipType: "신규지급",
    }]);
  }

  function removeLabel(id: string) {
    if (labels.length <= 1) return;
    setLabels(prev => prev.filter(l => l.id !== id));
  }

  function pickRecord(r: HwRecord) {
    setLabels(prev => prev.map(l => l.id === pickerTarget ? {
      ...l,
      recipientOrg: r.company || "",
      recipientName: r.user || "",
      user: r.user || "",
      assetNo: r.assetNo || "",
    } : l));
    setShowPicker(false);
    setPickerTarget("");
    setPickerSearch("");
  }

  async function printLabels() {
    const html = generateLabelHtml(labels, senderInfo);
    const w = window.open("", "_blank", "width=900,height=750");
    if (w) { w.document.write(html); w.document.close(); }

    const record: PrintHistoryRecord = {
      id: Date.now().toString(),
      printedAt: new Date().toISOString(),
      senderInfo,
      labels: labels.map(l => ({ ...l })),
    };
    try {
      const res = await fetch("/api/label-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      });
      if (res.ok) setHistory(prev => [record, ...prev]);
    } catch {
      // 저장 실패해도 출력은 완료됨
    }
  }

  async function deleteHistory(id: string) {
    try {
      await fetch(`/api/label-history?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      setHistory(prev => prev.filter(h => h.id !== id));
    } catch { /* silent */ }
  }

  async function cleanupHistory(keepLast: number | "all") {
    setCleanupBusy(true);
    try {
      const url = keepLast === "all"
        ? "/api/label-history"
        : `/api/label-history?keepLast=${keepLast}`;
      await fetch(url, { method: "DELETE" });
      if (keepLast === "all") {
        setHistory([]);
      } else {
        setHistory(prev => prev.slice(0, keepLast));
      }
      setShowCleanup(false);
    } catch { /* silent */ }
    finally { setCleanupBusy(false); }
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}.${pad(d.getMonth()+1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  return (
    <div className="space-y-4">
      {/* 발신자 정보 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-bold text-gray-700 mb-3">📮 발신자 정보</h3>
        <div>
          <label className="text-xs text-gray-500 font-semibold block mb-1">발신 (회사/부서/이름)</label>
          <input
            value={senderInfo}
            onChange={e => setSenderInfo(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="예: idsTrust 자산관리파트 홍길동"
          />
        </div>
      </div>

      {/* 라벨 목록 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-700">🏷️ 발송 라벨 ({labels.length}장)</h3>
          <button
            onClick={addLabel}
            className="text-xs font-semibold text-amber-600 border border-amber-200 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors"
          >
            + 라벨 추가
          </button>
        </div>

        {labels.map((label, idx) => (
          <div key={label.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-400">{idx + 1}번 라벨</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setPickerTarget(label.id); setPickerSearch(""); setShowPicker(true); }}
                  className="text-xs text-amber-600 border border-blue-200 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg font-semibold transition-colors"
                >
                  📋 자산에서 불러오기
                </button>
                {labels.length > 1 && (
                  <button onClick={() => removeLabel(label.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 font-semibold block mb-1">수신 (회사/부서)</label>
                <input value={label.recipientOrg} onChange={e => updateLabel(label.id, "recipientOrg", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="예: 시지바이오 인체품질팀" />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-semibold block mb-1">수신자 이름</label>
                <input value={label.recipientName} onChange={e => updateLabel(label.id, "recipientName", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="예: 임진규" />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-semibold block mb-1">실사용자</label>
                <input value={label.user} onChange={e => updateLabel(label.id, "user", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="예: 임진규" />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-semibold block mb-1">내용 (자산번호)</label>
                <input value={label.assetNo} onChange={e => updateLabel(label.id, "assetNo", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="예: 04-N3439" />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-semibold block mb-1">지급 유형</label>
                <select value={label.shipType} onChange={e => updateLabel(label.id, "shipType", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                  <option>신규지급</option>
                  <option>반납</option>
                  <option>교환</option>
                  <option>수리</option>
                  <option>대여</option>
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 출력 버튼 */}
      <button
        onClick={printLabels}
        className="w-full py-3 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 transition-colors shadow-sm"
      >
        🖨️ 행낭 발송지 출력 ({labels.length}장) — A4 1매에 2장
      </button>

      {/* 190건 경고 팝업 */}
      {showCleanup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⚠️</span>
              <div>
                <div className="font-bold text-gray-800 text-base">출력 이력이 {history.length}건에 달했습니다</div>
                <div className="text-xs text-gray-500 mt-0.5">최대 200건까지 저장됩니다. 오래된 이력을 정리해 주세요.</div>
              </div>
            </div>
            <div className="space-y-2">
              <button disabled={cleanupBusy} onClick={() => cleanupHistory(100)}
                className="w-full py-2.5 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 transition-colors disabled:opacity-50">
                최근 100건만 남기기 ({Math.max(0, history.length - 100)}건 삭제)
              </button>
              <button disabled={cleanupBusy} onClick={() => cleanupHistory(50)}
                className="w-full py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition-colors disabled:opacity-50">
                최근 50건만 남기기 ({Math.max(0, history.length - 50)}건 삭제)
              </button>
              <button disabled={cleanupBusy} onClick={() => cleanupHistory("all")}
                className="w-full py-2.5 rounded-xl border border-red-300 text-red-500 text-sm font-bold hover:bg-red-50 transition-colors disabled:opacity-50">
                전체 삭제
              </button>
            </div>
            <button onClick={() => setShowCleanup(false)} className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors">
              나중에 정리하기
            </button>
          </div>
        </div>
      )}

      {/* 출력 이력 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button onClick={() => setShowHistory(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
          <span className="text-sm font-bold text-gray-700 flex items-center gap-2">
            📋 출력 이력
            {historyRows.length > 0 && (
              <span className="text-xs font-semibold bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">{historyRows.length}행</span>
            )}
            {history.length >= 190 && (
              <span onClick={e => { e.stopPropagation(); setShowCleanup(true); }}
                className="text-xs font-bold bg-red-100 text-red-500 px-2 py-0.5 rounded-full cursor-pointer hover:bg-red-200 transition-colors">
                ⚠️ 정리 필요
              </span>
            )}
          </span>
          <span className="text-gray-400 text-xs">{showHistory ? "▲ 접기" : "▼ 펼치기"}</span>
        </button>

        {showHistory && (
          <div className="border-t border-gray-100">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <span className="text-gray-400 text-sm">🔍</span>
              <input value={historySearch} onChange={e => setHistorySearch(e.target.value)}
                placeholder="날짜, 발신, 수신처, 수신자, 자산번호 등으로 검색..."
                className="flex-1 text-sm focus:outline-none text-gray-700 placeholder-gray-300" />
              {historySearch && (
                <button onClick={() => setHistorySearch("")} className="text-gray-300 hover:text-gray-500 text-xs">✕</button>
              )}
              <span className="text-xs text-gray-400 whitespace-nowrap">
                {filteredRows.length}건{historySearch && ` / ${historyRows.length}건`}
              </span>
            </div>

            {historyLoading ? (
              <div className="text-center py-8 text-sm text-gray-400 animate-pulse">이력 불러오는 중…</div>
            ) : historyRows.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-400">출력 이력이 없습니다</div>
            ) : filteredRows.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-400">
                <div className="text-2xl mb-2">😕</div>
                &apos;{historySearch}&apos; 에 해당하는 이력이 없습니다
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse min-w-[780px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {["출력일시", "발신", "수신(회사/부서)", "수신자 이름", "실사용자", "자산번호", "지급유형", ""].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row, idx) => {
                      const isFirstOfGroup = idx === 0 || filteredRows[idx - 1].historyId !== row.historyId;
                      const groupRowCount = filteredRows.filter(r => r.historyId === row.historyId).length;
                      return (
                        <tr key={`${row.historyId}-${row.labelIndex}`}
                          className={`border-b border-gray-50 hover:bg-amber-50/30 transition-colors ${isFirstOfGroup && idx !== 0 ? "border-t-2 border-t-gray-200" : ""}`}>
                          <td className="px-3 py-2.5 whitespace-nowrap align-top">
                            {isFirstOfGroup ? (
                              <div>
                                <span className="font-bold text-amber-600">{formatDate(row.printedAt)}</span>
                                {groupRowCount > 1 && <span className="ml-1 text-[10px] text-gray-400">({groupRowCount}장)</span>}
                              </div>
                            ) : <span className="text-gray-200">│</span>}
                          </td>
                          <td className="px-3 py-2.5 align-top max-w-[120px]">
                            {isFirstOfGroup ? <span className="text-gray-600 line-clamp-2">{row.senderInfo || "—"}</span> : null}
                          </td>
                          <td className="px-3 py-2.5 text-gray-700 font-medium">{row.recipientOrg || <span className="text-gray-300">—</span>}</td>
                          <td className="px-3 py-2.5 text-gray-700 font-medium">{row.recipientName || <span className="text-gray-300">—</span>}</td>
                          <td className="px-3 py-2.5 text-gray-700">{row.user || <span className="text-gray-300">—</span>}</td>
                          <td className="px-3 py-2.5 font-mono text-gray-700">{row.assetNo || <span className="text-gray-300">—</span>}</td>
                          <td className="px-3 py-2.5">
                            <span className="bg-amber-50 text-amber-600 px-2 py-0.5 rounded-md font-semibold whitespace-nowrap">{row.shipType}</span>
                          </td>
                          <td className="px-2 py-2.5 text-right align-top">
                            {isFirstOfGroup && (
                              <button onClick={() => deleteHistory(row.historyId)}
                                className="text-gray-300 hover:text-red-400 transition-colors px-1" title="이 출력건 삭제">✕</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 자산 검색 피커 모달 */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setShowPicker(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[70vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b flex items-center justify-between shrink-0">
              <div>
                <div className="font-bold text-gray-800 text-sm">HW 자산에서 불러오기</div>
                <div className="text-xs text-gray-400 mt-0.5">선택하면 수신자 정보가 자동 입력됩니다</div>
              </div>
              <button onClick={() => setShowPicker(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-4 border-b shrink-0">
              <input value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} autoFocus
                placeholder="사용자명, 자산번호, 법인명으로 검색..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              {!recordsReady && (
                <div className="text-xs text-gray-400 mt-2 text-center animate-pulse">자산 데이터 불러오는 중…</div>
              )}
            </div>
            <div className="overflow-y-auto flex-1">
              {filteredRecords.map(r => (
                <button key={r.id} onClick={() => pickRecord(r)}
                  className="w-full text-left px-5 py-3 hover:bg-amber-50 border-b border-gray-50 last:border-0 transition-colors">
                  <div className="text-sm font-semibold text-gray-800">{r.user || "사용자 없음"}</div>
                  <div className="text-xs text-gray-400 mt-0.5 flex gap-2">
                    {r.assetNo && <span className="font-mono">{r.assetNo}</span>}
                    {r.company && <span>{r.company}</span>}
                    {r.dept && <span>· {r.dept}</span>}
                    {r.model && <span className="text-gray-300">· {r.model}</span>}
                  </div>
                </button>
              ))}
              {recordsReady && filteredRecords.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  {pickerSearch ? "검색 결과 없음" : "자산 없음"}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 출력 대기 섹션 (자산흐름관리 연동)
// ─────────────────────────────────────────────────────────────────────────────
export function PrintQueueSection({
  senderInfo,
  onQueueChange,
}: {
  senderInfo: string;
  onQueueChange?: (ids: string[]) => void;
}) {
  const [items, setItems] = useState<PrintQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [recipientNames, setRecipientNames] = useState<Record<string, string>>({});
  const [shipTypes, setShipTypes] = useState<Record<string, string>>({});
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch("/api/print-queue")
      .then(r => safeJson(r))
      .then(j => { if (j.ok) setItems(j.items ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    onQueueChange?.(items.map(i => i.id));
  }, [items, onQueueChange]);

  function toggleSelect(id: string) {
    setSelected(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length < 2 ? [...prev, id] : prev
    );
  }

  async function removeFromQueue(id: string) {
    await fetch(`/api/print-queue?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setItems(prev => prev.filter(i => i.id !== id));
    setSelected(prev => prev.filter(x => x !== id));
  }

  async function handlePrint() {
    if (selected.length === 0) return;
    setPrinting(true);
    try {
      const selectedItems = items.filter(i => selected.includes(i.id));
      const labels: LabelEntry[] = selectedItems.map(item => ({
        id: item.id,
        recipientOrg: buildRecipientOrg(item.company, item.address, item.department),
        recipientName: recipientNames[item.id] ?? "",
        user: item.user || "-",
        assetNo: item.newAssetId || "-",
        shipType: shipTypes[item.id] ?? "신규지급",
      }));

      const html = generateLabelHtml(labels, senderInfo);
      const w = window.open("", "_blank", "width=900,height=750");
      if (w) { w.document.write(html); w.document.close(); }

      // 이력 저장
      const record: PrintHistoryRecord = {
        id: Date.now().toString(),
        printedAt: new Date().toISOString(),
        senderInfo,
        labels,
      };
      await fetch("/api/label-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      }).catch(() => {});

      // 큐 제거
      await Promise.all(selected.map(id =>
        fetch(`/api/print-queue?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {})
      ));
      setItems(prev => prev.filter(i => !selected.includes(i.id)));
      setSelected([]);
    } finally {
      setPrinting(false);
    }
  }

  if (loading) return (
    <div className="bg-white rounded-xl border border-amber-100 p-4 text-sm text-gray-400 text-center animate-pulse">
      출력 대기 목록 불러오는 중…
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-amber-200 overflow-hidden mb-4">
      <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
        <span className="text-sm font-bold text-amber-800 flex items-center gap-2">
          🚚 출력 대기
          {items.length > 0 && (
            <span className="text-xs font-semibold bg-amber-200 text-amber-700 px-2 py-0.5 rounded-full">{items.length}건</span>
          )}
        </span>
        {selected.length > 0 && (
          <button
            onClick={handlePrint}
            disabled={printing}
            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
          >
            {printing ? "출력 중…" : `🖨️ 선택 출력 (${selected.length}장)`}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-300">출력 대기 중인 항목이 없습니다</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {items.map(item => {
            const isSelected = selected.includes(item.id);
            const isDisabled = !isSelected && selected.length >= 2;
            return (
              <div key={item.id} className={`px-4 py-3 flex items-start gap-3 transition-colors ${isSelected ? "bg-amber-50/60" : ""}`}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={isDisabled}
                  onChange={() => toggleSelect(item.id)}
                  className="mt-1 accent-amber-600 w-4 h-4 cursor-pointer disabled:opacity-30"
                />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-gray-700">{item.user || "—"}</span>
                    <span className="text-xs text-gray-400">{[item.company, item.address, item.department].filter(Boolean).join(" · ")}</span>
                    {item.newAssetId && (
                      <span className="font-mono text-xs text-blue-600">{item.newAssetId}</span>
                    )}
                  </div>
                  {item.note && (
                    <p className="text-xs text-gray-400 truncate" title={item.note}>📝 {item.note}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={recipientNames[item.id] ?? ""}
                      onChange={e => setRecipientNames(prev => ({ ...prev, [item.id]: e.target.value }))}
                      placeholder="수신자 이름 입력"
                      className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 min-w-0"
                    />
                    <select
                      value={shipTypes[item.id] ?? "신규지급"}
                      onChange={e => setShipTypes(prev => ({ ...prev, [item.id]: e.target.value }))}
                      className="px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
                    >
                      {SHIP_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <button
                  onClick={() => removeFromQueue(item.id)}
                  className="text-gray-300 hover:text-red-400 transition-colors text-sm mt-0.5 shrink-0"
                  title="대기 취소"
                >✕</button>
              </div>
            );
          })}
        </div>
      )}
      {items.length > 0 && selected.length === 0 && (
        <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-50">
          최대 2개 선택 후 출력하세요
        </div>
      )}
    </div>
  );
}
