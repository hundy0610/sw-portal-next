"use client";

import { useEffect, useState, useMemo } from "react";
import type { EventSubmission } from "@/lib/notion";

const C = {
  brand:   "#16a34a",
  primary: "#22c55e",
  soft:    "#f0fdf4",
  border:  "#bbf7d0",
  text1:   "#14532d",
  text2:   "#166534",
  text3:   "#4b5563",
  text4:   "#9ca3af",
  bg:      "#f0fdf4",
  bgPage:  "#f9fafb",
} as const;

function formatDate(iso: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function EventAdminPage() {
  const [submissions, setSubmissions] = useState<EventSubmission[]>([]);
  const [eventOpen, setEventOpen]     = useState(true);
  const [loading, setLoading]         = useState(true);
  const [toggling, setToggling]       = useState(false);
  const [search, setSearch]           = useState("");
  const [corpFilter, setCorpFilter]   = useState("all");

  async function load() {
    setLoading(true);
    const [subRes, statusRes] = await Promise.all([
      fetch("/api/event/submissions").then(r => r.json()),
      fetch("/api/event/toggle").then(r => r.json()),
    ]);
    setSubmissions(subRes.data ?? []);
    setEventOpen(statusRes.open ?? true);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleToggle() {
    setToggling(true);
    await fetch("/api/event/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ open: !eventOpen }),
    });
    setEventOpen(prev => !prev);
    setToggling(false);
  }

  const corporations = useMemo(
    () => Array.from(new Set(submissions.map(s => s.corporation))).sort(),
    [submissions]
  );

  const filtered = useMemo(() => {
    return submissions.filter(s => {
      const matchCorp = corpFilter === "all" || s.corporation === corpFilter;
      const q = search.toLowerCase();
      const matchSearch = !q || s.name.toLowerCase().includes(q) || s.department.toLowerCase().includes(q);
      return matchCorp && matchSearch;
    });
  }, [submissions, corpFilter, search]);

  // 법인별 참여 수
  const corpCounts = useMemo(() => {
    const map: Record<string, number> = {};
    submissions.forEach(s => { map[s.corporation] = (map[s.corporation] ?? 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [submissions]);

  // 한국 점수 분포
  const koreaDistribution = useMemo(() => {
    const map: Record<number, number> = {};
    submissions.forEach(s => { map[s.koreaScore] = (map[s.koreaScore] ?? 0) + 1; });
    return Object.entries(map)
      .map(([score, count]) => ({ score: Number(score), count }))
      .sort((a, b) => a.score - b.score);
  }, [submissions]);

  // 브라질 점수 분포
  const brazilDistribution = useMemo(() => {
    const map: Record<number, number> = {};
    submissions.forEach(s => { map[s.brazilScore] = (map[s.brazilScore] ?? 0) + 1; });
    return Object.entries(map)
      .map(([score, count]) => ({ score: Number(score), count }))
      .sort((a, b) => a.score - b.score);
  }, [submissions]);

  const maxKorea  = Math.max(...koreaDistribution.map(d => d.count), 1);
  const maxBrazil = Math.max(...brazilDistribution.map(d => d.count), 1);

  return (
    <div className="min-h-screen" style={{ background: C.bgPage }}>
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-extrabold" style={{ color: C.text1 }}>
              ⚽ 토토 이벤트 관리자
            </h1>
            <p className="text-sm mt-1" style={{ color: C.text3 }}>
              한국 vs 브라질 점수 예측 참여 현황
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${eventOpen ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
              {eventOpen ? "이벤트 진행 중" : "이벤트 마감"}
            </span>
            <button
              onClick={handleToggle}
              disabled={toggling}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-50"
              style={{ background: eventOpen ? "#dc2626" : C.brand }}>
              {toggling ? "처리 중..." : eventOpen ? "이벤트 마감" : "이벤트 재개"}
            </button>
            <button
              onClick={load}
              className="px-4 py-2 rounded-xl text-sm font-bold"
              style={{ background: C.soft, color: C.brand, border: `1px solid ${C.border}` }}>
              새로고침
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20" style={{ color: C.text4 }}>불러오는 중...</div>
        ) : (
          <>
            {/* 요약 카드 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-2xl p-5" style={{ border: `1px solid ${C.border}` }}>
                <div className="text-3xl font-extrabold" style={{ color: C.brand }}>{submissions.length}</div>
                <div className="text-xs mt-1" style={{ color: C.text3 }}>총 참여자</div>
              </div>
              {corpCounts.slice(0, 3).map(([corp, count]) => (
                <div key={corp} className="bg-white rounded-2xl p-5" style={{ border: `1px solid ${C.border}` }}>
                  <div className="text-3xl font-extrabold" style={{ color: C.brand }}>{count}</div>
                  <div className="text-xs mt-1" style={{ color: C.text3 }}>{corp}</div>
                </div>
              ))}
            </div>

            {/* 점수 분포 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
              {/* 한국 점수 분포 */}
              <div className="bg-white rounded-2xl p-6" style={{ border: `1px solid ${C.border}` }}>
                <div className="flex items-center gap-2 mb-5">
                  <span className="text-lg">🇰🇷</span>
                  <span className="font-bold text-sm" style={{ color: C.text1 }}>한국 점수 분포</span>
                </div>
                {koreaDistribution.length === 0 ? (
                  <div className="text-sm text-center py-4" style={{ color: C.text4 }}>데이터 없음</div>
                ) : (
                  <div className="space-y-2">
                    {koreaDistribution.map(({ score, count }) => (
                      <div key={score} className="flex items-center gap-3">
                        <span className="w-6 text-right text-xs font-bold" style={{ color: "#1e40af" }}>{score}</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                          <div
                            className="h-full rounded-full flex items-center justify-end pr-2 transition-all"
                            style={{
                              width: `${Math.max((count / maxKorea) * 100, 8)}%`,
                              background: "#3b82f6",
                            }}>
                            <span className="text-white text-[10px] font-bold">{count}</span>
                          </div>
                        </div>
                        <span className="text-xs w-5 text-right" style={{ color: C.text4 }}>{count}명</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 브라질 점수 분포 */}
              <div className="bg-white rounded-2xl p-6" style={{ border: `1px solid ${C.border}` }}>
                <div className="flex items-center gap-2 mb-5">
                  <span className="text-lg">🇧🇷</span>
                  <span className="font-bold text-sm" style={{ color: C.text1 }}>브라질 점수 분포</span>
                </div>
                {brazilDistribution.length === 0 ? (
                  <div className="text-sm text-center py-4" style={{ color: C.text4 }}>데이터 없음</div>
                ) : (
                  <div className="space-y-2">
                    {brazilDistribution.map(({ score, count }) => (
                      <div key={score} className="flex items-center gap-3">
                        <span className="w-6 text-right text-xs font-bold" style={{ color: "#78350f" }}>{score}</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                          <div
                            className="h-full rounded-full flex items-center justify-end pr-2 transition-all"
                            style={{
                              width: `${Math.max((count / maxBrazil) * 100, 8)}%`,
                              background: "#eab308",
                            }}>
                            <span className="text-white text-[10px] font-bold">{count}</span>
                          </div>
                        </div>
                        <span className="text-xs w-5 text-right" style={{ color: C.text4 }}>{count}명</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 테이블 필터 */}
            <div className="bg-white rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
              <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3"
                style={{ borderBottom: `1px solid ${C.border}` }}>
                <span className="font-bold text-sm" style={{ color: C.text1 }}>
                  참여자 목록 ({filtered.length}명)
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={corpFilter}
                    onChange={e => setCorpFilter(e.target.value)}
                    className="h-8 px-3 rounded-lg text-xs focus:outline-none"
                    style={{ border: `1px solid ${C.border}`, color: C.text3 }}>
                    <option value="all">전체 법인</option>
                    {corporations.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input
                    type="text"
                    placeholder="이름·부서 검색"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="h-8 px-3 rounded-lg text-xs focus:outline-none"
                    style={{ border: `1px solid ${C.border}`, width: 140, color: C.text3 }}
                  />
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="py-12 text-center text-sm" style={{ color: C.text4 }}>
                  참여 데이터가 없습니다.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.soft }}>
                        {["이름", "법인", "부서", "🇰🇷 한국", "🇧🇷 브라질", "참여시각"].map(h => (
                          <th key={h} className="px-5 py-3 text-left text-xs font-bold"
                            style={{ color: C.text2 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((s, i) => (
                        <tr key={s.id}
                          style={{ borderBottom: `1px solid #f1f5f9`, background: i % 2 === 1 ? "#fafafa" : "#fff" }}>
                          <td className="px-5 py-3 font-semibold" style={{ color: C.text1 }}>{s.name}</td>
                          <td className="px-5 py-3" style={{ color: C.text3 }}>{s.corporation}</td>
                          <td className="px-5 py-3" style={{ color: C.text3 }}>{s.department}</td>
                          <td className="px-5 py-3 font-extrabold text-center" style={{ color: "#1e40af" }}>
                            {s.koreaScore}
                          </td>
                          <td className="px-5 py-3 font-extrabold text-center" style={{ color: "#78350f" }}>
                            {s.brazilScore}
                          </td>
                          <td className="px-5 py-3 text-xs" style={{ color: C.text4 }}>
                            {formatDate(s.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        <div className="mt-6 text-center">
          <a href="/" className="text-xs" style={{ color: C.text4 }}>← 포털로 돌아가기</a>
        </div>
      </div>
    </div>
  );
}
