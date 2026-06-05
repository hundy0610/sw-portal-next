"use client";

import { useState, useEffect, useCallback } from "react";
import type { HelpDeskTicket } from "@/lib/notion";

const URGENCY_COLOR: Record<string, string> = {
  "매우 급합니다":  "bg-red-100 text-red-700",
  "조금 급합니다": "bg-amber-100 text-amber-700",
  "여유 있습니다": "bg-green-100 text-green-700",
};

const STATUS_COLOR: Record<string, string> = {
  "진행 중":  "bg-blue-100 text-blue-700",
  "검토 중":  "bg-purple-100 text-purple-700",
  "완료":     "bg-green-100 text-green-700",
  "보류":     "bg-gray-100 text-gray-500",
};

const DEPT_COLOR: Record<string, string> = {
  "재무":    "bg-sky-100 text-sky-700",
  "인사":    "bg-violet-100 text-violet-700",
  "계약관리": "bg-orange-100 text-orange-700",
};

export default function AutomationPanel() {
  const [tickets, setTickets] = useState<HelpDeskTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterDept, setFilterDept] = useState("");
  const [filterUrgency, setFilterUrgency] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res  = await fetch("/api/helpdesk");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      const automation = (json.tickets as HelpDeskTicket[])
        .filter(t => t.inquiryType === "자동화 과제");
      setTickets(automation);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = tickets.filter(t => {
    if (filterDept    && t.department !== filterDept)    return false;
    if (filterUrgency && t.urgency    !== filterUrgency) return false;
    return true;
  });

  const depts    = [...new Set(tickets.map(t => t.department).filter(Boolean))];
  const urgencies = ["매우 급합니다", "조금 급합니다", "여유 있습니다"];

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
            <span className="text-white text-lg">⚙️</span>
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-sm">자동화 과제 현황</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              경영관리실 업무 자동화 접수 관리
              {!loading && <span className="ml-1 text-indigo-500 font-semibold">· 총 {tickets.length}건</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href="/automation" target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-semibold hover:bg-indigo-100 transition-colors border border-indigo-200">
            🔗 접수 페이지
          </a>
          <button onClick={load} disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-gray-200 disabled:opacity-50 transition-colors">
            {loading ? "로딩…" : "🔄 새로고침"}
          </button>
        </div>
      </div>

      {error && <div className="px-4 py-3 bg-red-50 rounded-xl text-sm text-red-600">⚠️ {error}</div>}

      {/* 요약 카드 */}
      {!loading && tickets.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {["인사", "재무", "계약관리"].map(dept => {
            const cnt = tickets.filter(t => t.department === dept).length;
            return (
              <div key={dept} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold mb-2 ${DEPT_COLOR[dept] ?? "bg-gray-100 text-gray-500"}`}>{dept}</span>
                <p className="text-2xl font-bold text-gray-900">{cnt}</p>
                <p className="text-xs text-gray-400 mt-0.5">건</p>
              </div>
            );
          })}
        </div>
      )}

      {/* 필터 */}
      {tickets.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="w-36">
              <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option value="">부서 전체</option>
                {depts.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="w-40">
              <select value={filterUrgency} onChange={e => setFilterUrgency(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option value="">긴급도 전체</option>
                {urgencies.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            {(filterDept || filterUrgency) && (
              <button onClick={() => { setFilterDept(""); setFilterUrgency(""); }}
                className="text-xs text-gray-400 hover:text-gray-600 underline">초기화</button>
            )}
            <span className="ml-auto text-xs text-gray-400">{filtered.length}건 표시</span>
          </div>
        </div>
      )}

      {/* 목록 */}
      {loading ? (
        <div className="py-16 text-center text-gray-400 text-sm">
          <svg className="animate-spin w-6 h-6 mx-auto mb-3 text-indigo-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          데이터 불러오는 중…
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-gray-300 text-sm">
          <p className="text-4xl mb-3">⚙️</p>
          <p>{tickets.length === 0 ? "접수된 자동화 과제가 없습니다" : "조건에 맞는 과제가 없습니다"}</p>
          {tickets.length === 0 && (
            <a href="/automation" target="_blank" rel="noreferrer"
              className="mt-3 inline-block text-indigo-500 text-xs underline hover:text-indigo-700">
              접수 페이지 공유하기 →
            </a>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t, i) => (
            <div key={t.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              {/* 카드 헤더 */}
              <button
                className="w-full text-left px-5 py-4"
                onClick={() => setExpanded(expanded === t.id ? null : t.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center font-bold mt-0.5">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{t.title}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${DEPT_COLOR[t.department] ?? "bg-gray-100 text-gray-500"}`}>
                          {t.department || "부서 미입력"}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${URGENCY_COLOR[t.urgency] ?? "bg-gray-100 text-gray-500"}`}>
                          {t.urgency || "-"}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_COLOR[t.status] ?? "bg-gray-100 text-gray-500"}`}>
                          {t.status}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {t.requester} · {t.submittedAt ? t.submittedAt.slice(0, 10) : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className={`shrink-0 text-gray-400 transition-transform duration-200 ${expanded === t.id ? "rotate-180" : ""}`}>▾</span>
                </div>
              </button>

              {/* 상세 내용 */}
              {expanded === t.id && (
                <div className="px-5 pb-5 border-t border-gray-100">
                  <div className="pt-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div><span className="font-semibold text-gray-500">신청자</span><p className="mt-0.5 text-gray-800">{t.requester}</p></div>
                      <div><span className="font-semibold text-gray-500">이메일</span><p className="mt-0.5 text-gray-800">{t.requesterEmail || "-"}</p></div>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-500">접수 내용</span>
                      <pre className="mt-1.5 p-3 bg-gray-50 rounded-xl text-xs text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">
                        {t.content}
                      </pre>
                    </div>
                    {t.notionUrl && (
                      <a href={t.notionUrl} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 underline underline-offset-2">
                        Notion에서 보기 ↗
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
