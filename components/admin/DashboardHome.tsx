"use client";

import { useEffect, useState, useMemo } from "react";
import type { HwStats } from "@/lib/hw";
import type { ExchangeReturnRecord } from "@/types";
import { scGet, scSet } from "@/lib/session-cache";

interface Props {
  company: string;
  initialHwStats: HwStats | null;
  onNavigate: (page: string) => void;
}

// ── Donut Chart ──────────────────────────────────────────────
interface DonutSeg { label: string; value: number; color: string }

function DonutChart({ data, title }: { data: DonutSeg[]; title: string }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = 52, cx = 64, cy = 64;
  const C = 2 * Math.PI * r;
  let cumOffset = 0;
  const segs = data.filter(d => d.value > 0).map(d => {
    const len = total > 0 ? (d.value / total) * C : 0;
    const startOff = cumOffset;
    cumOffset += len;
    return { ...d, len, startOff };
  });
  const hoverSeg = hovered ? segs.find(s => s.label === hovered) : null;

  return (
    <div className="flex items-center gap-5 flex-wrap">
      <div className="relative shrink-0">
        <svg width="128" height="128" viewBox="0 0 128 128">
          {total === 0
            ? <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E5E7EB" strokeWidth="18" />
            : segs.map(s => (
                <circle
                  key={s.label} cx={cx} cy={cy} r={r} fill="none"
                  stroke={s.color}
                  strokeWidth={hovered === s.label ? 22 : 18}
                  strokeDasharray={`${Math.max(0, s.len - 2)} ${C}`}
                  strokeDashoffset={-s.startOff}
                  transform={`rotate(-90 ${cx} ${cy})`}
                  style={{ transition: "stroke-width 0.15s ease", cursor: "pointer" }}
                  onMouseEnter={() => setHovered(s.label)}
                  onMouseLeave={() => setHovered(null)}
                />
              ))
          }
          {hoverSeg ? (
            <>
              <text x="64" y="58" textAnchor="middle" fontSize="14" fontWeight="800" fill="#111827">{hoverSeg.value}</text>
              <text x="64" y="72" textAnchor="middle" fontSize="8.5" fill="#6B7280">
                {hoverSeg.label.length > 6 ? hoverSeg.label.slice(0, 5) + "…" : hoverSeg.label}
              </text>
            </>
          ) : (
            <>
              <text x="64" y="58" textAnchor="middle" fontSize="16" fontWeight="800" fill="#111827">{total.toLocaleString()}</text>
              <text x="64" y="72" textAnchor="middle" fontSize="9" fill="#9CA3AF">{title}</text>
            </>
          )}
        </svg>
      </div>
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        {segs.slice(0, 9).map(s => (
          <div
            key={s.label}
            className={`flex items-center gap-2 text-xs rounded px-2 py-0.5 cursor-pointer transition-colors ${hovered === s.label ? "bg-gray-100" : "hover:bg-gray-50"}`}
            onMouseEnter={() => setHovered(s.label)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
            <span className="text-gray-600 flex-1 truncate">{s.label}</span>
            <span className="font-bold text-gray-900 shrink-0">{s.value}</span>
            <span className="text-gray-400 w-8 text-right shrink-0">
              {total > 0 ? `${Math.round(s.value / total * 100)}%` : "0%"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 상수 ─────────────────────────────────────────────────────
const SW_STATUS_COLORS: Record<string, string> = {
  "사용중": "#3B82F6", "신규등록": "#8B5CF6", "재고": "#10B981",
  "출고준비중": "#06B6D4", "갱신필요": "#F97316", "반납예정": "#EAB308",
  "만료": "#9CA3AF", "미확인": "#D1D5DB",
};

const HW_STATUS_COLORS: Record<string, string> = {
  "사용중": "#3B82F6", "재고": "#10B981",
  "출고준비중": "#06B6D4", "출고준비완료": "#0EA5E9",
  "수리": "#F97316", "렌탈": "#8B5CF6",
  "임시지급": "#EAB308", "반납예정": "#EC4899", "미분류": "#D1D5DB",
};

const HW_HIDDEN_STATUSES = new Set(["미확인", "미분류"]);

const PALETTE = [
  "#6366f1","#f59e0b","#10b981","#ef4444","#3b82f6","#8b5cf6",
  "#ec4899","#14b8a6","#f97316","#84cc16","#06b6d4","#a855f7",
  "#64748b","#e11d48","#059669","#d97706",
];

const STAGE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  "교체요청":     { bg: "#F8FAFC", text: "#64748B", dot: "#94A3B8" },
  "요청기안":     { bg: "#EFF6FF", text: "#1D4ED8", dot: "#3B82F6" },
  "기기준비":     { bg: "#F5F3FF", text: "#6D28D9", dot: "#8B5CF6" },
  "기기준비완료": { bg: "#ECFDF5", text: "#065F46", dot: "#10B981" },
  "사용자수령":   { bg: "#FFF7ED", text: "#C2410C", dot: "#F97316" },
  "반납요청":     { bg: "#FEFCE8", text: "#A16207", dot: "#EAB308" },
  "반납완료":     { bg: "#F0FDF4", text: "#15803D", dot: "#22C55E" },
};

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  "교체":     { bg: "#EFF6FF", text: "#1D4ED8" },
  "퇴사반납": { bg: "#FEF2F2", text: "#B91C1C" },
  "신규지급": { bg: "#F0FDF4", text: "#15803D" },
};

const ER_STAGES = ["교체요청","요청기안","기기준비","기기준비완료","사용자수령","반납요청","반납완료"] as const;

function agingDays(requestedAt: string, completedAt: string, stage: string) {
  if (!requestedAt) return 0;
  const start = new Date(requestedAt);
  const end = stage === "반납완료" && completedAt ? new Date(completedAt) : new Date();
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000);
}

function daysLeft(iso?: string): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function LoadingBox() {
  return <div className="h-32 flex items-center justify-center text-xs text-gray-400">불러오는 중...</div>;
}

// ── sessionStorage 키 ─────────────────────────────────────────
const SC_SW = (co: string) => `sc:dash:sw${co ? `:${co}` : ""}`;
const TTL_DATA = 5 * 60 * 1000;
const TTL_ER   = 2 * 60 * 1000;

function buildSwSegs(recs: { status?: string }[]): DonutSeg[] {
  const counts: Record<string, number> = {};
  for (const r of recs) {
    const s = r.status || "미확인";
    counts[s] = (counts[s] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], i) => ({
      label, value,
      color: SW_STATUS_COLORS[label] ?? PALETTE[i % PALETTE.length],
    }));
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export default function DashboardHome({ company, initialHwStats, onNavigate }: Props) {
  const isFiltered = !!company;

  const [swLoading, setSwLoading] = useState(true);
  const [swSegs,    setSwSegs]    = useState<DonutSeg[]>([]);

  const [hwStats,   setHwStats]   = useState<HwStats | null>(initialHwStats);
  const [hwLoading, setHwLoading] = useState(!initialHwStats);

  const [erLoading,  setErLoading]  = useState(true);
  const [erRecords,  setErRecords]  = useState<ExchangeReturnRecord[]>([]);
  const [erStage,    setErStage]    = useState("기기준비");
  const [erSearch,   setErSearch]   = useState("");

  const [loadTimes, setLoadTimes] = useState<Record<string, number>>({});
  const setTime = (key: string, ms: number) =>
    setLoadTimes(prev => ({ ...prev, [key]: ms }));

  const [clearing, setClearing] = useState(false);
  const [clearMsg, setClearMsg] = useState<string | null>(null);

  // ── SW 현황 ──────────────────────────────────────────────────
  useEffect(() => {
    const url = isFiltered ? `/api/sw-records?company=${encodeURIComponent(company)}` : "/api/sw-records";
    const cacheKey = SC_SW(company);
    const cached = scGet<{ status?: string }[]>(cacheKey);
    if (cached) {
      setSwSegs(buildSwSegs(cached));
      setSwLoading(false);
      setTime("SW 라이선스", 0);
      fetch(url).then(r => r.json()).then(d => {
        const recs = d.data ?? [];
        setSwSegs(buildSwSegs(recs));
        scSet(cacheKey, recs, TTL_DATA);
      }).catch(() => {});
      return;
    }
    const t0 = performance.now();
    fetch(url).then(r => r.json()).then(d => {
      setTime("SW 라이선스", Math.round(performance.now() - t0));
      const recs: { status?: string }[] = d.data ?? [];
      setSwSegs(buildSwSegs(recs));
      scSet(cacheKey, recs, TTL_DATA);
    }).finally(() => setSwLoading(false));
  }, [company, isFiltered]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── HW 현황 ──────────────────────────────────────────────────
  useEffect(() => {
    if (hwStats) { setHwLoading(false); setTime("HW 현황", 0); return; }
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    async function fetchStats(isRetry = false) {
      const t0 = performance.now();
      try {
        const d = await fetch("/api/hw/stats").then(r => r.json());
        if (!isRetry) setTime("HW 현황", Math.round(performance.now() - t0));
        if (d.ok && d.stats) { setHwStats(d.stats); setHwLoading(false); }
        else if (d.warming && !isRetry) { retryTimer = setTimeout(() => fetchStats(true), 45_000); }
        else { setHwLoading(false); }
      } catch { setHwLoading(false); }
    }
    fetchStats();
    return () => { if (retryTimer) clearTimeout(retryTimer); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 자산흐름 현황 ─────────────────────────────────────────────
  useEffect(() => {
    const t0 = performance.now();
    fetch("/api/exchange-return")
      .then(r => r.json())
      .then(d => {
        setTime("자산흐름", Math.round(performance.now() - t0));
        setErRecords(Array.isArray(d.data) ? d.data : []);
      })
      .finally(() => setErLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── HW 도넛 세그 ─────────────────────────────────────────────
  const hwSegs: DonutSeg[] = hwStats
    ? Object.entries(hwStats.byStatus)
        .filter(([label, v]) => v > 0 && !HW_HIDDEN_STATUSES.has(label))
        .sort((a, b) => b[1] - a[1])
        .map(([label, value], i) => ({ label, value, color: HW_STATUS_COLORS[label] ?? PALETTE[i % PALETTE.length] }))
    : [];

  // ── 자산흐름 단계별 카운트 (진행 중만) ───────────────────────
  const stageCounts = useMemo(() => {
    const active = erRecords.filter(r => !r.isClosed && r.stage !== "반납완료");
    const counts: Record<string, number> = {};
    active.forEach(r => { counts[r.stage] = (counts[r.stage] ?? 0) + 1; });
    return counts;
  }, [erRecords]);

  // ── 자산흐름 필터링 ───────────────────────────────────────────
  const erFiltered = useMemo(() => {
    return erRecords.filter(r => {
      if (erStage !== "전체" && r.stage !== erStage) return false;
      if (erSearch) {
        const q = erSearch.toLowerCase();
        return [r.user, r.assetId, r.newAssetId, r.company, r.department, r.assignee]
          .some(v => v?.toLowerCase().includes(q));
      }
      return true;
    });
  }, [erRecords, erStage, erSearch]);

  async function clearCache(target: "hw" | "sw" | "all") {
    setClearing(true); setClearMsg(null);
    try {
      const calls = [];
      if (target === "hw" || target === "all") calls.push(fetch("/api/hw/cache-clear", { method: "POST" }));
      if (target === "sw" || target === "all") calls.push(fetch("/api/sw-records/cache-clear", { method: "POST" }));
      await Promise.all(calls);
      const label = target === "hw" ? "HW DB" : target === "sw" ? "SW DB" : "전체";
      setClearMsg(`✅ ${label} 캐시 초기화 완료. 다음 조회 시 Notion에서 새로 불러옵니다.`);
    } catch { setClearMsg("⚠️ 초기화 중 오류가 발생했습니다."); }
    finally {
      setClearing(false);
      setTimeout(() => setClearMsg(null), 5000);
    }
  }

  const openCount   = erRecords.filter(r => !r.isClosed && r.stage !== "반납완료").length;
  const overdueCount = erRecords.filter(r => r.stage === "반납요청" && (() => { const d = daysLeft(r.returnDue); return d !== null && d < 0; })()).length;

  return (
    <div className="flex flex-col gap-6">
      {/* 헤더 */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">대시보드</h1>
          <p className="text-sm text-gray-400 mt-0.5">{isFiltered ? `${company} 현황 요약` : "전사 현황 요약"}</p>
        </div>
        {/* 로딩 시간 인디케이터 */}
        {Object.keys(loadTimes).length > 0 && (
          <div className="flex items-center gap-3">
            {["HW 현황", "SW 라이선스", "자산흐름"].map(key => {
              const ms = loadTimes[key];
              if (ms === undefined) return null;
              const color = ms === 0 ? "text-blue-500" : ms < 500 ? "text-green-600" : ms < 1500 ? "text-yellow-600" : "text-red-500";
              return (
                <span key={key} className="flex items-center gap-1 text-xs">
                  <span className="text-gray-400">{key}</span>
                  <span className={`font-semibold ${color}`}>{ms === 0 ? "캐시" : ms < 1000 ? `${ms}ms` : `${(ms/1000).toFixed(1)}s`}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 차트 행: HW 먼저 → SW ───────────────────────────────── */}
      <div className="grid grid-cols-2 gap-5">
        {/* 하드웨어 현황 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-sm font-bold text-gray-700">하드웨어 현황</span>
              {hwStats && (
                <span className="ml-2 text-xs text-gray-400">전체 {hwStats.total.toLocaleString()}대</span>
              )}
            </div>
            <button onClick={() => onNavigate("hw")} className="text-xs text-blue-500 hover:text-blue-700 transition-colors">
              전체 보기 →
            </button>
          </div>
          {hwLoading ? <LoadingBox /> : <DonutChart data={hwSegs} title="상태" />}
        </div>

        {/* SW 라이선스 현황 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-gray-700">SW 라이선스 현황</span>
            <button onClick={() => onNavigate("overview")} className="text-xs text-blue-500 hover:text-blue-700 transition-colors">
              전체 보기 →
            </button>
          </div>
          {swLoading ? <LoadingBox /> : <DonutChart data={swSegs} title="전체" />}
        </div>
      </div>

      {/* ── 자산흐름 관리 ────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200">
        {/* 섹션 헤더 */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-gray-700">자산 흐름 관리</span>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>Open <strong className="text-gray-700">{openCount}</strong></span>
              {overdueCount > 0 && (
                <span className="bg-red-50 text-red-600 font-bold px-1.5 py-0.5 rounded-full">
                  미반납 {overdueCount}
                </span>
              )}
            </div>
          </div>
          <button onClick={() => onNavigate("exchange-return")} className="text-xs text-blue-500 hover:text-blue-700 transition-colors">
            전체 보기 →
          </button>
        </div>

        {/* 단계 탭 */}
        <div className="flex items-center gap-1.5 px-5 py-3 border-b border-gray-100 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          <button
            onClick={() => setErStage("전체")}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${erStage === "전체" ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            전체 {erRecords.filter(r => !r.isClosed && r.stage !== "반납완료").length}
          </button>
          {ER_STAGES.filter(s => s !== "반납완료").map(stage => {
            const cnt = stageCounts[stage] ?? 0;
            if (cnt === 0) return null;
            const c = STAGE_COLORS[stage];
            const active = erStage === stage;
            return (
              <button
                key={stage}
                onClick={() => setErStage(stage)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors"
                style={{
                  background: active ? c.dot : c.bg,
                  color: active ? "#fff" : c.text,
                  borderColor: active ? c.dot : c.dot + "44",
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: active ? "#fff" : c.dot }} />
                {stage} {cnt}
              </button>
            );
          })}
          {/* 검색 */}
          <input
            type="text" value={erSearch} onChange={e => setErSearch(e.target.value)}
            placeholder="이름·자산번호·법인 검색..."
            className="ml-auto flex-shrink-0 w-48 border border-gray-200 rounded-full px-3 py-1.5 text-xs focus:outline-none focus:border-blue-400"
          />
        </div>

        {/* 테이블 */}
        {erLoading ? (
          <LoadingBox />
        ) : erFiltered.length === 0 ? (
          <div className="text-xs text-gray-400 py-8 text-center">조건에 맞는 레코드가 없습니다</div>
        ) : (
          <div>
            {/* 헤더 */}
            <div className="grid text-[10px] text-gray-400 font-semibold uppercase tracking-wide px-5 py-2 border-b border-gray-100"
              style={{ gridTemplateColumns: "140px 60px 110px 110px 90px 80px 90px 80px 1fr 90px" }}>
              <span>진행 단계</span>
              <span>유형</span>
              <span>자산번호 (현)</span>
              <span>자산번호 (신)</span>
              <span>법인</span>
              <span>부서</span>
              <span>사용자</span>
              <span>배송지</span>
              <span>메모</span>
              <span>사용일자</span>
            </div>
            {/* 행 */}
            <div className="max-h-[520px] overflow-y-auto">
              {erFiltered.map(r => {
                const aging = agingDays(r.requestedAt, r.completedAt, r.stage);
                const dl = daysLeft(r.returnDue);
                const overdue = r.stage === "반납요청" && dl !== null && dl < 0;
                const sc = STAGE_COLORS[r.stage] ?? { bg: "#F1F5F9", text: "#64748B", dot: "#94A3B8" };
                const tc = TYPE_COLORS[r.type] ?? { bg: "#F1F5F9", text: "#64748B" };
                return (
                  <div key={r.id}
                    className={`grid items-center px-5 py-2.5 border-b border-gray-50 hover:bg-gray-50 transition-colors ${overdue ? "bg-red-50/40" : ""}`}
                    style={{ gridTemplateColumns: "140px 60px 110px 110px 90px 80px 90px 80px 1fr 90px" }}
                  >
                    {/* 진행 단계 */}
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
                        style={{ background: sc.bg, color: sc.text }}>
                        {r.stage || "—"}
                      </span>
                      <span className="text-[10px] font-semibold" style={{ color: aging >= 7 ? "#DC2626" : aging >= 3 ? "#D97706" : "#9CA3AF" }}>
                        D+{aging}
                      </span>
                    </div>
                    {/* 유형 */}
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap w-fit"
                      style={{ background: tc.bg, color: tc.text }}>
                      {r.type || "—"}
                    </span>
                    {/* 자산번호 */}
                    <span className="text-[11px] text-blue-600 font-medium truncate pr-2">{r.assetId || "—"}</span>
                    <span className="text-[11px] text-blue-600 font-medium truncate pr-2">{r.newAssetId || "—"}</span>
                    {/* 법인·부서·사용자 */}
                    <span className="text-[11px] text-gray-600 truncate pr-1">{r.company || "—"}</span>
                    <span className="text-[11px] text-gray-600 truncate pr-1">{r.department || "—"}</span>
                    <span className="text-[11px] text-gray-800 font-medium truncate pr-1">{r.user || "—"}</span>
                    {/* 배송지 */}
                    <span className="text-[11px] text-gray-500 truncate pr-1">{r.address || "—"}</span>
                    {/* 메모 */}
                    <span className="text-[11px] text-gray-400 truncate pr-2">{r.note || "—"}</span>
                    {/* 사용일자 */}
                    <span className="text-[11px] text-gray-400">{r.useDate ? r.useDate.slice(0, 10) : "—"}</span>
                  </div>
                );
              })}
            </div>
            <div className="px-5 py-2 text-xs text-gray-400 text-right border-t border-gray-100">
              {erFiltered.length}건 표시 / 전체 {erRecords.length}건
            </div>
          </div>
        )}
      </div>

      {/* ── 캐시 관리 ────────────────────────────────────────────── */}
      <div className="pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-400 font-medium mb-2">캐시 관리</p>
        <div className="flex flex-wrap items-center gap-2">
          {([
            { label: "HW DB 초기화", target: "hw" as const },
            { label: "SW DB 초기화", target: "sw" as const },
            { label: "전체 초기화",  target: "all" as const },
          ]).map(({ label, target }) => (
            <button key={target} onClick={() => clearCache(target)} disabled={clearing}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-red-300 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors flex items-center gap-1.5">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
              </svg>
              {clearing ? "초기화 중…" : label}
            </button>
          ))}
        </div>
        {clearMsg && <p className="mt-2 text-[11px] text-gray-500">{clearMsg}</p>}
      </div>
    </div>
  );
}
