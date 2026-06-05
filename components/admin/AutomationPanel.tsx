"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { AutomationTask } from "@/app/api/automation-tasks/route";

const STATUS_OPTIONS = ["접수", "검토 중", "개발 중", "완료", "보류"];

const STATUS_COLOR: Record<string, string> = {
  "접수":    "bg-gray-100 text-gray-600",
  "검토 중": "bg-blue-100 text-blue-700",
  "개발 중": "bg-amber-100 text-amber-700",
  "완료":    "bg-green-100 text-green-700",
  "보류":    "bg-red-100 text-red-600",
};

const DEPT_COLOR: Record<string, string> = {
  "인사":    "bg-violet-100 text-violet-700",
  "재무":    "bg-sky-100 text-sky-700",
  "계약관리": "bg-orange-100 text-orange-700",
};

export default function AutomationPanel() {
  const [tasks,    setTasks]    = useState<AutomationTask[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [missingEnv, setMissingEnv] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [filterDept,   setFilterDept]   = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/automation-tasks");
      const json = await res.json();
      if (json.missingEnv) { setMissingEnv(true); setTasks([]); }
      else { setMissingEnv(false); setTasks(json.tasks ?? []); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => tasks.filter(t => {
    if (filterDept   && t.department !== filterDept)   return false;
    if (filterStatus && t.status     !== filterStatus) return false;
    return true;
  }), [tasks, filterDept, filterStatus]);

  // 요약 통계
  const byStatus = useMemo(() => {
    const m: Record<string, number> = {};
    tasks.forEach(t => { m[t.status] = (m[t.status] ?? 0) + 1; });
    return m;
  }, [tasks]);

  const byDept = useMemo(() => {
    const m: Record<string, number> = {};
    tasks.forEach(t => { m[t.department] = (m[t.department] ?? 0) + 1; });
    return m;
  }, [tasks]);

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
              {!loading && !missingEnv && (
                <span className="ml-1 text-indigo-500 font-semibold">· 총 {tasks.length}건</span>
              )}
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

      {/* DB 미연동 안내 */}
      {missingEnv && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-sm text-amber-800">
          <p className="font-semibold mb-1">⚠️ Notion DB 연동 필요</p>
          <p className="text-xs text-amber-700">
            환경변수 <code className="bg-amber-100 px-1 rounded">NOTION_DB_AUTOMATION</code> 을 설정하면 접수 내역이 여기에 표시됩니다.
          </p>
        </div>
      )}

      {/* 요약 카드 */}
      {!loading && !missingEnv && tasks.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {/* 진행 상태별 */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-bold text-gray-500 mb-3">진행 상태</p>
            <div className="space-y-1.5">
              {STATUS_OPTIONS.filter(s => byStatus[s]).map(s => (
                <div key={s} className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_COLOR[s]}`}>{s}</span>
                  <span className="text-xs font-bold text-gray-700">{byStatus[s]}건</span>
                </div>
              ))}
            </div>
          </div>
          {/* 주 업무별 */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-bold text-gray-500 mb-3">주 업무별</p>
            <div className="space-y-1.5">
              {Object.entries(byDept).map(([dept, cnt]) => (
                <div key={dept} className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${DEPT_COLOR[dept] ?? "bg-gray-100 text-gray-500"}`}>{dept}</span>
                  <span className="text-xs font-bold text-gray-700">{cnt}건</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 필터 */}
      {!missingEnv && tasks.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex flex-wrap gap-3 items-center">
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300">
            <option value="">주 업무 전체</option>
            {["인사","재무","계약관리"].map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300">
            <option value="">상태 전체</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {(filterDept || filterStatus) && (
            <button onClick={() => { setFilterDept(""); setFilterStatus(""); }}
              className="text-xs text-gray-400 hover:text-gray-600 underline">초기화</button>
          )}
          <span className="ml-auto text-xs text-gray-400">{filtered.length}건</span>
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
      ) : !missingEnv && filtered.length === 0 ? (
        <div className="py-16 text-center text-gray-300 text-sm">
          <p className="text-4xl mb-3">⚙️</p>
          <p>{tasks.length === 0 ? "접수된 자동화 과제가 없습니다" : "조건에 맞는 과제가 없습니다"}</p>
        </div>
      ) : !missingEnv ? (
        <div className="space-y-2">
          {filtered.map((task, i) => (
            <div key={task.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* 헤더 행 */}
              <button
                className="w-full text-left px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                onClick={() => setExpanded(expanded === task.id ? null : task.id)}
              >
                <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-[11px] flex items-center justify-center font-bold">{i+1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{task.taskName}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${DEPT_COLOR[task.department] ?? "bg-gray-100 text-gray-500"}`}>{task.department}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_COLOR[task.status] ?? "bg-gray-100 text-gray-500"}`}>{task.status}</span>
                    <span className="text-[11px] text-gray-400">{task.requester} · {task.submittedAt?.slice(0,10)}</span>
                    {task.assignee && <span className="text-[11px] text-indigo-500 font-medium">담당: {task.assignee}</span>}
                  </div>
                </div>
                <span className={`text-gray-400 text-xs transition-transform duration-200 ${expanded === task.id ? "rotate-180" : ""}`}>▾</span>
              </button>

              {/* 상세 */}
              {expanded === task.id && (
                <div className="border-t border-gray-100 px-5 py-4 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div><p className="font-semibold text-gray-400 mb-0.5">신청자</p><p className="text-gray-800">{task.requester}</p></div>
                    <div><p className="font-semibold text-gray-400 mb-0.5">이메일</p><p className="text-gray-800">{task.email || "-"}</p></div>
                    <div><p className="font-semibold text-gray-400 mb-0.5">반복 주기</p><p className="text-gray-800">{task.cycle || "-"}</p></div>
                    <div><p className="font-semibold text-gray-400 mb-0.5">주간 소요 시간</p><p className="text-gray-800">{task.weeklyHours || "-"}</p></div>
                  </div>
                  {task.tools && (
                    <div className="text-xs"><p className="font-semibold text-gray-400 mb-0.5">사용 도구</p><p className="text-gray-700">{task.tools}</p></div>
                  )}
                  <div className="text-xs"><p className="font-semibold text-gray-400 mb-1">현재 처리 방식</p>
                    <p className="bg-gray-50 rounded-lg p-3 text-gray-700 leading-relaxed whitespace-pre-wrap">{task.currentFlow || "-"}</p>
                  </div>
                  <div className="text-xs"><p className="font-semibold text-gray-400 mb-1">자동화 목표</p>
                    <p className="bg-indigo-50 rounded-lg p-3 text-indigo-800 leading-relaxed whitespace-pre-wrap">{task.desiredFlow || "-"}</p>
                  </div>
                  {task.notionUrl && (
                    <a href={task.notionUrl} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 underline underline-offset-2">
                      Notion에서 보기 ↗
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
