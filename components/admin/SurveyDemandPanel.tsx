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
  status: "접수" | "확인" | "완료";
  submittedAt: string;
  notionUrl: string;
}

const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  "접수": { bg: "bg-blue-50",   text: "text-blue-700",  dot: "bg-blue-500"  },
  "확인": { bg: "bg-amber-50",  text: "text-amber-700", dot: "bg-amber-500" },
  "완료": { bg: "bg-green-50",  text: "text-green-700", dot: "bg-green-500" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE["접수"];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
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

  // 필터
  const [filterCompany, setFilterCompany] = useState("전체");
  const [filterStatus,  setFilterStatus]  = useState("전체");
  const [search,        setSearch]        = useState("");

  // 상세 보기
  const [selected, setSelected] = useState<SurveyResponse | null>(null);

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

  const updateStatus = async (id: string, status: string) => {
    await fetch("/api/survey-demand", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setData(prev => prev.map(r => r.id === id ? { ...r, status: status as any } : r));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status: status as any } : prev);
  };

  // 집계
  const companies = ["전체", ...Array.from(new Set(data.map(r => r.company))).sort()];
  const filtered  = data.filter(r => {
    if (filterCompany !== "전체" && r.company !== filterCompany) return false;
    if (filterStatus  !== "전체" && r.status  !== filterStatus)  return false;
    if (search) {
      const q = search.toLowerCase();
      return [r.name, r.company, r.department, r.purpose].some(v => v?.toLowerCase().includes(q));
    }
    return true;
  });

  const stats = {
    total:  data.length,
    접수:   data.filter(r => r.status === "접수").length,
    확인:   data.filter(r => r.status === "확인").length,
    완료:   data.filter(r => r.status === "완료").length,
  };

  // ── 링크 복사 ──
  const surveyUrl = typeof window !== "undefined" ? `${window.location.origin}/survey` : "/survey";
  const [copied, setCopied] = useState(false);
  const copyLink = () => {
    navigator.clipboard.writeText(surveyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-gray-400">
      <div className="animate-spin rounded-full h-7 w-7 border-2 border-blue-400 border-t-transparent mr-3" />
      응답 데이터 로드 중…
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

      {/* ── 헤더 ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">업무 툴 수요조사</h2>
          <p className="text-sm text-gray-500 mt-0.5">실시간 번역 툴 사용 수요 조사 응답 관리</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={copyLink}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-sm font-semibold hover:bg-blue-100 transition-colors">
            🔗 {copied ? "링크 복사됨!" : "설문 링크 복사"}
          </button>
          <a href="/survey" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors">
            ↗ 설문 미리보기
          </a>
          <button onClick={load}
            className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:bg-gray-50 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── KPI 카드 ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "전체 응답", value: stats.total,  color: "text-gray-900", bg: "bg-white" },
          { label: "접수",     value: stats.접수,    color: "text-blue-700", bg: "bg-blue-50" },
          { label: "확인 중",  value: stats.확인,    color: "text-amber-700",bg: "bg-amber-50" },
          { label: "완료",     value: stats.완료,    color: "text-green-700",bg: "bg-green-50" },
        ].map(k => (
          <div key={k.label} className={`${k.bg} rounded-xl border border-gray-100 p-4`}>
            <p className="text-xs font-medium text-gray-500">{k.label}</p>
            <p className={`text-2xl font-bold mt-1 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* ── 필터·검색 ── */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4"
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input type="text" placeholder="이름, 법인, 부서, 목적 검색…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          {companies.map(c => <option key={c}>{c === "전체" ? "전체 법인" : c}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          {["전체", "접수", "확인", "완료"].map(s => <option key={s} value={s}>{s === "전체" ? "전체 상태" : s}</option>)}
        </select>
        <span className="text-xs text-gray-400">{filtered.length}건</span>
      </div>

      {/* ── 응답 목록 ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-3xl mb-2">📋</div>
          <p>{data.length === 0 ? "아직 접수된 응답이 없습니다." : "검색 결과가 없습니다."}</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["제출일시", "법인 / 부서", "성함", "사용 주기", "상태", ""].map(h => (
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
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-[140px] truncate">{r.frequency}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3">
                    <select value={r.status}
                      onClick={e => e.stopPropagation()}
                      onChange={e => { e.stopPropagation(); updateStatus(r.id, e.target.value); }}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                      {["접수","확인","완료"].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── 상세 모달 ── */}
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
              <button onClick={() => setSelected(null)} className="text-white/70 hover:text-white text-2xl">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
              {[
                { label: "소속 정보",  value: `${selected.company} / ${selected.department} / ${selected.name}` },
                { label: "이메일",    value: selected.email || "—" },
                { label: "사용 목적",  value: selected.purpose },
                { label: "사용 주기",  value: selected.frequency },
                { label: "특이 사항",  value: selected.note || "—" },
                { label: "제출 일시",  value: fmtDate(selected.submittedAt) },
              ].map(f => (
                <div key={f.label}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{f.label}</p>
                  <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">{f.value}</p>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t flex items-center gap-2 shrink-0">
              <span className="text-xs text-gray-400 mr-auto">상태 변경</span>
              {["접수","확인","완료"].map(s => (
                <button key={s} onClick={() => updateStatus(selected.id, s)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                    selected.status === s
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                  }`}>{s}</button>
              ))}
              {selected.notionUrl && (
                <a href={selected.notionUrl} target="_blank" rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                  Notion ↗
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
