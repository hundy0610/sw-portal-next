"use client";

import { useEffect, useState, useMemo } from "react";
import type { AuditLog } from "@/lib/portal-store";
import { safeJson } from "@/lib/fetch-json";
import { exportRowsToExcel } from "@/lib/xlsx-export";

const ACTION_STYLE: Record<AuditLog["action"], { label: string; bg: string; text: string }> = {
  create: { label: "등록", bg: "bg-emerald-100", text: "text-emerald-700" },
  update: { label: "수정", bg: "bg-amber-100",   text: "text-amber-700" },
  delete: { label: "삭제", bg: "bg-red-100",     text: "text-red-700" },
  "bulk-update": { label: "일괄수정", bg: "bg-blue-100", text: "text-blue-700" },
};

const TARGET_LABEL: Record<AuditLog["target"], string> = {
  notices: "공지사항", courses: "교육과정", swdb: "SW 검색", swresources: "SW 자료실", manuals: "매뉴얼",
  exchangeReturn: "자산 흐름", hw: "노트북/데스크탑", hwRepair: "수리/과실청구",
  rentalHw: "임대노트북", credentials: "계정 관리", repairTicket: "모니터 수리",
  meetingRental: "회의실 대여", meetingEquipment: "회의실 장비", contract: "계약",
  account: "계정 권한",
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

const ALL = "전체";

export default function AuditLogPanel() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [search,       setSearch]       = useState("");
  const [actionFilter, setActionFilter] = useState<string>(ALL);
  const [targetFilter, setTargetFilter] = useState<string>(ALL);
  const [fromDate,     setFromDate]     = useState("");
  const [toDate,       setToDate]       = useState("");

  useEffect(() => {
    fetch("/api/admin/audit-log?limit=500")
      .then(r => safeJson(r))
      .then(res => setLogs(res?.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  const targetOptions = useMemo(
    () => [ALL, ...Array.from(new Set(logs.map(l => l.target)))],
    [logs]
  );

  const filtered = useMemo(() => logs.filter(log => {
    if (actionFilter !== ALL && log.action !== actionFilter) return false;
    if (targetFilter !== ALL && log.target !== targetFilter) return false;
    if (fromDate && log.timestamp.slice(0, 10) < fromDate) return false;
    if (toDate   && log.timestamp.slice(0, 10) > toDate)   return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [log.adminName, log.adminId, log.itemTitle, log.detail ?? ""].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [logs, search, actionFilter, targetFilter, fromDate, toDate]);

  function resetFilters() {
    setSearch(""); setActionFilter(ALL); setTargetFilter(ALL); setFromDate(""); setToDate("");
  }

  async function handleExport() {
    const rows = filtered.map(log => ({
      "일시":   formatTime(log.timestamp),
      "관리자": `${log.adminName} (${log.adminId})`,
      "액션":   ACTION_STYLE[log.action]?.label ?? log.action,
      "대상":   TARGET_LABEL[log.target] ?? log.target,
      "항목":   log.itemTitle,
      "상세":   log.detail ?? "",
    }));
    const today = new Date().toISOString().slice(0, 10);
    await exportRowsToExcel(rows, `감사로그_${today}.xlsx`, "감사로그");
  }

  return (
    <div className="fade-in">
      <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-0.5">감사 로그</h2>
          <p className="text-sm text-gray-500">관리자의 admin 페이지 변경 이력 · {filtered.length} / {logs.length}건</p>
        </div>
        <button
          onClick={handleExport}
          disabled={filtered.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          엑셀 다운로드
        </button>
      </div>

      {/* ── 필터 ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold text-gray-500 mb-1">검색</label>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="관리자, 항목, 상세 검색..."
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">액션</label>
          <select value={actionFilter} onChange={e => setActionFilter(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value={ALL}>전체</option>
            {(Object.keys(ACTION_STYLE) as AuditLog["action"][]).map(a => (
              <option key={a} value={a}>{ACTION_STYLE[a].label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">대상</label>
          <select value={targetFilter} onChange={e => setTargetFilter(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            {targetOptions.map(t => <option key={t} value={t}>{t === ALL ? "전체" : (TARGET_LABEL[t as AuditLog["target"]] ?? t)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">시작일</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">종료일</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
        <button onClick={resetFilters} className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-3 py-2">
          초기화
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-xl text-gray-400 text-sm">
          {logs.length === 0 ? "아직 기록된 활동이 없습니다." : "조건에 맞는 기록이 없습니다."}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {["일시", "관리자", "액션", "대상", "항목", "상세"].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(log => {
                const as = ACTION_STYLE[log.action];
                return (
                  <tr key={log.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatTime(log.timestamp)}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-gray-900">{log.adminName}</span>
                      <span className="text-gray-400 ml-1">({log.adminId})</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full font-semibold ${as.bg} ${as.text}`}>{as.label}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{TARGET_LABEL[log.target]}</td>
                    <td className="px-4 py-3 text-gray-700 max-w-[220px] truncate">{log.itemTitle}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-[280px] truncate">{log.detail ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
