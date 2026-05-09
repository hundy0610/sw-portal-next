"use client";

import { useEffect, useState } from "react";

export interface HwRecord {
  id: string; notionUrl: string;
  user: string; assetNo: string; model: string; serial: string;
  maker: string; cpu: string; ram: string;
  company: string; dept: string; location: string;
  status: string;
  returnDue: string; returnDate: string;
  purchaseDate: string; useDate: string;
  price: number; residualValue: number; note: string;
  verified: boolean;
}

export const HW_STATUSES = [
  "사용중", "재고", "교체요청", "반납예정", "출고준비중", "출고준비완료",
  "수리", "렌탈", "임시지급", "폐기", "폐기확정(리스트화)", "폐기완료",
  "3층문서고/매각", "3층문서고/폐기", "지하창고/폐기", "지하창고/매각",
];

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs text-gray-400 w-20 shrink-0 pt-0.5">{label}</span>
      <span className={`text-sm text-gray-800 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

export function AssetModalInner({ assetId, onClose }: { assetId: string; onClose: () => void }) {
  const [state, setState] = useState<"loading" | "found" | "notfound" | "error">("loading");
  const [record, setRecord] = useState<HwRecord | null>(null);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<"idle" | "done" | "error">("idle");
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const slowTimer = setTimeout(() => setSlow(true), 8000);
    fetch(`/api/hw?search=${encodeURIComponent(assetId)}`)
      .then(r => r.json())
      .then(json => {
        const match = (json.records as HwRecord[])?.find(
          r => r.assetNo.toLowerCase() === assetId.toLowerCase()
        );
        if (match) { setRecord(match); setSelectedStatus(match.status); setState("found"); }
        else setState("notfound");
      })
      .catch(() => setState("error"))
      .finally(() => clearTimeout(slowTimer));
    return () => clearTimeout(slowTimer);
  }, [assetId]);

  const saveStatus = async () => {
    if (!record || selectedStatus === record.status) return;
    setSaving(true); setSaveResult("idle");
    try {
      const res = await fetch("/api/hw/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: record.id, fields: { status: selectedStatus } }),
      });
      const json = await res.json();
      if (json.ok) {
        setRecord(prev => prev ? { ...prev, status: selectedStatus } : prev);
        setSaveResult("done");
        if (selectedStatus === "교체요청" && record) {
          fetch("/api/exchange-return/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "교체", assetId: record.assetNo,
              company: record.company, department: record.dept, user: record.user,
              stage: "교체요청", requestedAt: new Date().toISOString().slice(0, 10),
            }),
          }).catch(console.error);
        }
      } else setSaveResult("error");
    } catch { setSaveResult("error"); }
    finally { setSaving(false); }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        style={{ maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900 text-base">자산 상세 정보</h2>
            <p className="text-xs text-gray-400 mt-0.5 font-mono">{assetId}</p>
          </div>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100">
            ×
          </button>
        </div>
        <div className="px-6 py-5">
          {state === "loading" && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <svg className="animate-spin h-7 w-7 text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <p className="text-sm text-gray-400">노션에서 불러오는 중...</p>
              {slow && (
                <p className="text-xs text-amber-500 text-center max-w-xs">
                  응답이 오래 걸리고 있어요.<br />
                  Notion API가 느리거나 연결이 불안정할 수 있습니다.
                </p>
              )}
            </div>
          )}
          {state === "notfound" && (
            <p className="text-center text-gray-400 py-8">
              트래커 DB에서 <span className="font-mono text-gray-600">{assetId}</span>를 찾을 수 없습니다.
            </p>
          )}
          {state === "error" && (
            <p className="text-center text-red-400 py-8">조회 중 오류가 발생했습니다.</p>
          )}
          {state === "found" && record && (
            <div className="space-y-3">
              <Row label="사용자"   value={record.user} />
              <Row label="자산번호" value={record.assetNo} mono />
              <Row label="모델명"   value={record.model} />
              <Row label="시리얼"   value={record.serial} mono />
              <Row label="제조사"   value={record.maker} />
              <Row label="CPU"      value={record.cpu} />
              <Row label="RAM"      value={record.ram} />
              <Row label="법인"     value={record.company} />
              <Row label="부서"     value={record.dept} />
              <Row label="위치"     value={record.location} />
              <div className="flex items-center gap-3 pt-1">
                <span className="text-xs text-gray-400 w-20 shrink-0">상태</span>
                <div className="flex items-center gap-2 flex-1">
                  <select
                    value={selectedStatus}
                    onChange={e => { setSelectedStatus(e.target.value); setSaveResult("idle"); }}
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    {HW_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button
                    onClick={saveStatus}
                    disabled={saving || selectedStatus === record.status}
                    className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-white font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {saving ? "저장 중…" : "저장"}
                  </button>
                </div>
              </div>
              {saveResult === "done"  && <p className="text-xs text-green-600 pl-24">✓ 상태가 변경되었습니다.</p>}
              {saveResult === "error" && <p className="text-xs text-red-500 pl-24">저장에 실패했습니다. 다시 시도해주세요.</p>}
              <Row label="구매일자"  value={record.purchaseDate} />
              <Row label="사용일자"  value={record.useDate} />
              {record.returnDue  && <Row label="반납예정일" value={record.returnDue} />}
              {record.returnDate && <Row label="반납일자"   value={record.returnDate} />}
              {record.price > 0          && <Row label="단가"    value={record.price.toLocaleString() + "원"} />}
              {record.residualValue > 0  && <Row label="잔존가치" value={record.residualValue.toLocaleString() + "원"} />}
              {record.note               && <Row label="기타"    value={record.note} />}
              {record.notionUrl && (
                <div className="pt-2">
                  <a href={record.notionUrl} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                      <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                    노션에서 보기
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
