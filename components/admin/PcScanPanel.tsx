"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import type { PcScanRecord } from "@/lib/pc-scan";
import { safeJson } from "@/lib/fetch-json";

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── 상세 팝업 ──────────────────────────────────────────────────
function DetailModal({ record, onClose }: { record: PcScanRecord; onClose: () => void }) {
  const fields: [string, string][] = [
    ["자산번호",  record.assetNo],
    ["PC이름",   record.pcName],
    ["시리얼 넘버", record.serial],
    ["법인명",   record.corp],
    ["부서",     record.dept],
    ["사용자",   record.userName],
    ["제조사",   record.manufacturer],
    ["모델명",   record.model],
    ["CPU",      record.cpu],
    ["RAM",      record.ram],
    ["OS",       record.os],
    ["GPU",      record.gpu],
    ["저장장치", record.storage],
    ["MAC",      record.mac],
    ["수집일시", formatDate(record.collectedAt)],
    ["마스터존재", record.masterExists ? "✓ 일치" : "—"],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-base">PC 상세 정보</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="px-6 py-4 max-h-[65vh] overflow-y-auto">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            {fields.map(([label, value]) => (
              <div key={label}>
                <dt className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{label}</dt>
                <dd className="text-gray-800 break-all">{value || "—"}</dd>
              </div>
            ))}
          </dl>

          {record.programFileUrl && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">설치프로그램</p>
              <a
                href={record.programFileUrl}
                download={record.programFileName || undefined}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline font-medium"
              >
                📥 {record.programFileName || "파일 다운로드"}
              </a>
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
          <a
            href={record.notionUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-gray-400 hover:text-blue-500 hover:underline"
          >
            Notion에서 보기 →
          </a>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 필터 상태 ──────────────────────────────────────────────────
interface Filters {
  assetNo: string;
  corp: string;
  dept: string;
  userName: string;
  model: string;
  pcName: string;
  cpu: string;
  ram: string;
  gpu: string;
  os: string;
  hasFile: string;      // "" | "yes" | "no"
  masterExists: string; // "" | "true" | "false"
}
const EMPTY: Filters = {
  assetNo: "", corp: "", dept: "", userName: "", model: "",
  pcName: "", cpu: "", ram: "", gpu: "", os: "", hasFile: "", masterExists: "",
};

const INPUT_CLS = "w-full px-2 py-1 text-[11px] border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white";

// ── 패널 본체 ──────────────────────────────────────────────────
export default function PcScanPanel() {
  const [records, setRecords]   = useState<PcScanRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [filters, setFilters]   = useState<Filters>(EMPTY);
  const [detail, setDetail]     = useState<PcScanRecord | null>(null);
  const [zipping, setZipping]   = useState(false);

  useEffect(() => {
    fetch("/api/admin/pc-scan")
      .then(r => safeJson(r))
      .then(res => {
        if (res?.ok) setRecords(res.data ?? []);
        else setError(res?.error ?? "불러오기 실패");
      })
      .catch(() => setError("네트워크 오류"))
      .finally(() => setLoading(false));
  }, []);

  const corpOptions = useMemo(
    () => [...new Set(records.map(r => r.corp).filter(Boolean))].sort(),
    [records]
  );

  const filtered = useMemo(() => records.filter(r => {
    if (filters.assetNo    && !r.assetNo.toLowerCase().includes(filters.assetNo.toLowerCase()))     return false;
    if (filters.corp       && r.corp !== filters.corp)                                               return false;
    if (filters.dept       && !r.dept.toLowerCase().includes(filters.dept.toLowerCase()))           return false;
    if (filters.userName   && !r.userName.toLowerCase().includes(filters.userName.toLowerCase()))   return false;
    if (filters.model      && !r.model.toLowerCase().includes(filters.model.toLowerCase()))         return false;
    if (filters.pcName     && !r.pcName.toLowerCase().includes(filters.pcName.toLowerCase()))       return false;
    if (filters.cpu        && !r.cpu.toLowerCase().includes(filters.cpu.toLowerCase()))             return false;
    if (filters.ram        && !r.ram.toLowerCase().includes(filters.ram.toLowerCase()))             return false;
    if (filters.gpu        && !r.gpu.toLowerCase().includes(filters.gpu.toLowerCase()))             return false;
    if (filters.os         && !r.os.toLowerCase().includes(filters.os.toLowerCase()))               return false;
    if (filters.hasFile === "yes" && !r.programFileUrl)  return false;
    if (filters.hasFile === "no"  &&  r.programFileUrl)  return false;
    if (filters.masterExists === "true"  && !r.masterExists) return false;
    if (filters.masterExists === "false" &&  r.masterExists) return false;
    return true;
  }), [records, filters]);

  function sf(key: keyof Filters, val: string) {
    setFilters(f => ({ ...f, [key]: val }));
  }

  function downloadExcel() {
    const wb = XLSX.utils.book_new();
    const rows = filtered.map(r => ({
      자산번호:        r.assetNo,
      법인:            r.corp,
      부서:            r.dept,
      사용자:          r.userName,
      모델:            r.model,
      PC이름:          r.pcName,
      CPU:             r.cpu,
      RAM:             r.ram,
      GPU:             r.gpu,
      OS:              r.os,
      시리얼넘버:      r.serial,
      제조사:          r.manufacturer,
      저장장치:        r.storage,
      MAC:             r.mac,
      수집일시:        r.collectedAt ? formatDate(r.collectedAt) : "",
      마스터존재:      r.masterExists ? "✓" : "",
      설치프로그램파일: r.programFileName,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "자산실사현황");
    XLSX.writeFile(wb, `자산실사현황_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const downloadZip = useCallback(async () => {
    const ids = filtered.filter(r => r.programFileUrl).map(r => r.id);
    if (ids.length === 0) return;
    setZipping(true);
    try {
      const res = await fetch("/api/admin/pc-scan/zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "ZIP 생성 실패");
        return;
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `설치프로그램_${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("다운로드 중 오류가 발생했습니다.");
    } finally {
      setZipping(false);
    }
  }, [filtered]);

  const hasFilter = Object.values(filters).some(Boolean);

  return (
    <div className="fade-in">
      {detail && <DetailModal record={detail} onClose={() => setDetail(null)} />}

      {/* 헤더 */}
      <div className="mb-4 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-0.5">자산 실사 현황</h2>
          <p className="text-sm text-gray-500">
            전체 {records.length}대 · 필터 {filtered.length}대 표시
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasFilter && (
            <button
              onClick={() => setFilters(EMPTY)}
              className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg"
            >
              필터 초기화
            </button>
          )}
          <button
            onClick={downloadExcel}
            disabled={filtered.length === 0}
            className="px-4 py-1.5 text-xs font-medium bg-gray-700 hover:bg-gray-800 text-white rounded-lg disabled:opacity-40"
          >
            엑셀 다운로드 ({filtered.length}건)
          </button>
          <button
            onClick={downloadZip}
            disabled={filtered.filter(r => r.programFileUrl).length === 0 || zipping}
            className="px-4 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-40"
          >
            {zipping
              ? "ZIP 생성 중…"
              : `설치프로그램 ZIP (${filtered.filter(r => r.programFileUrl).length}건)`}
          </button>
        </div>
      </div>

      {/* 테이블 */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">불러오는 중…</div>
      ) : error ? (
        <div className="text-center py-12 text-red-400 text-sm">{error}</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-xs border-collapse min-w-[1300px]">
            <thead>
              {/* 컬럼 헤더 */}
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-500">
                {["자산번호","법인","부서","사용자","모델","PC이름","CPU","RAM","GPU","OS","설치프로그램","마스터"].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>

              {/* 필터 행 */}
              <tr className="border-b border-gray-200 bg-gray-50/60">
                <td className="px-2 py-1.5 min-w-[90px]">
                  <input className={INPUT_CLS} placeholder="검색" value={filters.assetNo} onChange={e => sf("assetNo", e.target.value)} />
                </td>
                <td className="px-2 py-1.5 min-w-[90px]">
                  <select className={INPUT_CLS} value={filters.corp} onChange={e => sf("corp", e.target.value)}>
                    <option value="">전체</option>
                    {corpOptions.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1.5 min-w-[80px]">
                  <input className={INPUT_CLS} placeholder="검색" value={filters.dept} onChange={e => sf("dept", e.target.value)} />
                </td>
                <td className="px-2 py-1.5 min-w-[80px]">
                  <input className={INPUT_CLS} placeholder="검색" value={filters.userName} onChange={e => sf("userName", e.target.value)} />
                </td>
                <td className="px-2 py-1.5 min-w-[100px]">
                  <input className={INPUT_CLS} placeholder="검색" value={filters.model} onChange={e => sf("model", e.target.value)} />
                </td>
                <td className="px-2 py-1.5 min-w-[100px]">
                  <input className={INPUT_CLS} placeholder="검색" value={filters.pcName} onChange={e => sf("pcName", e.target.value)} />
                </td>
                <td className="px-2 py-1.5 min-w-[80px]">
                  <input className={INPUT_CLS} placeholder="검색" value={filters.cpu} onChange={e => sf("cpu", e.target.value)} />
                </td>
                <td className="px-2 py-1.5 min-w-[70px]">
                  <input className={INPUT_CLS} placeholder="검색" value={filters.ram} onChange={e => sf("ram", e.target.value)} />
                </td>
                <td className="px-2 py-1.5 min-w-[80px]">
                  <input className={INPUT_CLS} placeholder="검색" value={filters.gpu} onChange={e => sf("gpu", e.target.value)} />
                </td>
                <td className="px-2 py-1.5 min-w-[80px]">
                  <input className={INPUT_CLS} placeholder="검색" value={filters.os} onChange={e => sf("os", e.target.value)} />
                </td>
                <td className="px-2 py-1.5 min-w-[90px]">
                  <select className={INPUT_CLS} value={filters.hasFile} onChange={e => sf("hasFile", e.target.value)}>
                    <option value="">전체</option>
                    <option value="yes">있음</option>
                    <option value="no">없음</option>
                  </select>
                </td>
                <td className="px-2 py-1.5 min-w-[80px]">
                  <select className={INPUT_CLS} value={filters.masterExists} onChange={e => sf("masterExists", e.target.value)}>
                    <option value="">전체</option>
                    <option value="true">일치</option>
                    <option value="false">불일치</option>
                  </select>
                </td>
              </tr>
            </thead>

            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-12 text-gray-400">
                    {hasFilter ? "필터에 맞는 결과가 없습니다." : "수집된 데이터가 없습니다."}
                  </td>
                </tr>
              ) : filtered.map(r => (
                <tr key={r.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                  {/* 자산번호 — 클릭 시 상세 팝업 */}
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => setDetail(r)}
                      className="font-semibold text-blue-600 hover:underline text-left"
                    >
                      {r.assetNo || <span className="text-gray-300 font-normal">—</span>}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {r.corp
                      ? <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">{r.corp}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{r.dept || <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{r.userName || <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2.5 text-gray-600 max-w-[140px] truncate" title={r.model}>{r.model || <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{r.pcName || <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2.5 text-gray-500 max-w-[160px] truncate" title={r.cpu}>{r.cpu || <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{r.ram || <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2.5 text-gray-500 max-w-[120px] truncate" title={r.gpu}>{r.gpu || <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2.5 text-gray-500 max-w-[140px] truncate" title={r.os}>{r.os || <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2.5">
                    {r.programFileUrl ? (
                      <a
                        href={r.programFileUrl}
                        download={r.programFileName || undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline whitespace-nowrap"
                        title={r.programFileName}
                      >
                        📥 {r.programFileName ? r.programFileName.replace(/\.[^.]+$/, "") : "다운로드"}
                      </a>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {r.masterExists
                      ? <span className="text-emerald-600 font-bold text-sm">✓</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
