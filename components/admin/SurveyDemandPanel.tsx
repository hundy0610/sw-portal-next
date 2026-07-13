"use client";

import { useEffect, useState, useCallback } from "react";
import { safeJson } from "@/lib/fetch-json";

interface SurveyResponse {
  id: string;
  name: string;
  company: string;
  department: string;
  email: string;
  purpose: string;
  frequency: string;
  note: string;
  submittedAt: string;
  notionUrl: string;
}

function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  } catch { return iso?.slice(0, 16) ?? "—"; }
}

export default function SurveyDemandPanel() {
  const [data,    setData]    = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [filterCompany, setFilterCompany] = useState("전체");
  const [search,        setSearch]        = useState("");
  const [selected,      setSelected]      = useState<SurveyResponse | null>(null);
  const [deleting,      setDeleting]      = useState<string | null>(null);
  const [copied,        setCopied]        = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const json = await fetch("/api/survey-demand").then(r => safeJson(r));
      if (!json.ok) throw new Error(json.error);
      setData(json.data ?? []);
    } catch (e: any) {
      setError(e?.message ?? "데이터 로드 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("이 응답을 삭제하시겠습니까?")) return;
    setDeleting(id);
    try {
      const json = await fetch("/api/survey-demand", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      }).then(r => safeJson(r));
      if (json.ok) {
        setData(prev => prev.filter(r => r.id !== id));
        if (selected?.id === id) setSelected(null);
      }
    } finally {
      setDeleting(null);
    }
  };

  const companies = ["전체", ...Array.from(new Set(data.map(r => r.company))).sort()];
  const filtered  = data.filter(r => {
    if (filterCompany !== "전체" && r.company !== filterCompany) return false;
    if (search) {
      const q = search.toLowerCase();
      return [r.name, r.department, r.email, r.purpose].some(v => v?.toLowerCase().includes(q));
    }
    return true;
  });

  const surveyUrl = typeof window !== "undefined" ? `${window.location.origin}/survey` : "/survey";
  const copyLink  = () => {
    navigator.clipboard.writeText(surveyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-gray-400">
      <div className="animate-spin rounded-full h-7 w-7 border-2 border-blue-400 border-t-transparent mr-3" />
      데이터 로드 중…
    </div>
  );

  if (error) return (
    <div className="p-6 bg-red-50 rounded-xl border border-red-200">
      <p className="text-red-600 font-semibold">오류: {error}</p>
      <button onClick={load} className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm">다시 시도</button>
    </div>
  );

  return (
    <div className="space-y-5">

      {/* 헤더 */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">업무 툴 수요조사</h2>
          <p className="text-sm text-gray-500 mt-0.5">실시간 번역 툴 수요 응답 — 총 <strong>{data.length}건</strong></p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={copyLink}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-sm font-semibold hover:bg-blue-100 transition-colors">
            {copied ? "복사됨!" : "설문 링크 복사"}
          </button>
          <a href="/survey" target="_blank" rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-gray-600 text-sm hover:bg-gray-50 transition-colors">
            ↗ 미리보기
          </a>
          <button onClick={load}
            className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:bg-gray-50 transition-colors" title="새로고침">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          </button>
        </div>
      </div>

      {/* 법인 필터 + 검색 */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4"
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input type="text" placeholder="이름, 부서, 이메일 검색…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          {companies.map(c => <option key={c} value={c}>{c === "전체" ? "전체 법인" : c}</option>)}
        </select>
        <span className="text-xs text-gray-400">{filtered.length}건</span>
      </div>

      {/* 응답 목록 */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p>{data.length === 0 ? "아직 접수된 응답이 없습니다." : "검색 결과가 없습니다."}</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["제출일시", "법인 / 부서", "성함 / 이메일", "사용 주기", ""].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}
                  className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors cursor-pointer"
                  onClick={() => setSelected(r)}>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(r.submittedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900 text-xs">{r.company}</div>
                    <div className="text-xs text-gray-400">{r.department}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 text-xs">{r.name}</div>
                    {r.email && <div className="text-[10px] text-gray-400 mt-0.5">{r.email}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-[160px] truncate">{r.frequency}</td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={e => handleDelete(r.id, e)}
                      disabled={deleting === r.id}
                      className="text-xs text-gray-400 hover:text-red-500 border border-gray-200 hover:border-red-300 px-2 py-1 rounded-lg transition-colors disabled:opacity-40"
                      title="삭제">
                      {deleting === r.id ? "…" : "🗑"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 상세 모달 */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 bg-blue-600 text-white flex items-center justify-between shrink-0">
              <div>
                <div className="font-bold text-base">{selected.name}</div>
                <div className="text-xs opacity-80">{selected.company} · {selected.department}</div>
              </div>
              <button onClick={() => setSelected(null)} className="text-white/70 hover:text-white text-2xl leading-none">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
              {[
                { label: "소속",      value: `${selected.company} / ${selected.department}` },
                { label: "성함",      value: selected.name },
                { label: "이메일",    value: selected.email || "—" },
                { label: "사용 목적", value: (selected as any).purpose || "—" },
                { label: "주요 언어", value: (selected as any).language || "—" },
                { label: "사용 주기", value: selected.frequency },
                { label: "특이 사항", value: selected.note || "—" },
                { label: "제출 일시", value: fmtDate(selected.submittedAt) },
              ].map(f => (
                <div key={f.label}>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{f.label}</p>
                  <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">{f.value}</p>
                </div>
              ))}
            </div>
            <div className="px-5 py-3.5 border-t flex gap-2 shrink-0">
              {selected.notionUrl && (
                <a href={selected.notionUrl} target="_blank" rel="noopener noreferrer"
                  className="px-3 py-2 rounded-xl text-xs font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                  Notion ↗
                </a>
              )}
              <button
                onClick={e => handleDelete(selected.id, e)}
                disabled={deleting === selected.id}
                className="px-3 py-2 rounded-xl text-xs font-medium border border-red-200 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50">
                삭제
              </button>
              <button onClick={() => setSelected(null)}
                className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
