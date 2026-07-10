"use client";

import { useEffect, useState, useMemo } from "react";
import type { HwStats } from "@/lib/hw";
import type { ExchangeReturnRecord } from "@/types";
import { scGet, scSet } from "@/lib/session-cache";
import { safeJson } from "@/lib/fetch-json";
import { useAdminDarkMode } from "@/lib/use-admin-dark-mode";

interface Props {
  company: string;
  initialHwStats: HwStats | null;
  onNavigate: (page: string) => void;
}

// ── Donut Chart (기존 그대로) ─────────────────────────────────
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
            ? <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--admin-table-row-border)" strokeWidth="18" />
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
              <text x="64" y="58" textAnchor="middle" fontSize="14" fontWeight="800" fill="var(--admin-text-primary)">{hoverSeg.value}</text>
              <text x="64" y="72" textAnchor="middle" fontSize="8.5" fill="var(--admin-text-secondary)">
                {hoverSeg.label.length > 6 ? hoverSeg.label.slice(0, 5) + "…" : hoverSeg.label}
              </text>
            </>
          ) : (
            <>
              <text x="64" y="58" textAnchor="middle" fontSize="16" fontWeight="800" fill="var(--admin-text-primary)">{total.toLocaleString()}</text>
              <text x="64" y="72" textAnchor="middle" fontSize="9" fill="var(--admin-text-secondary)">{title}</text>
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

// ── 색상 상수 ─────────────────────────────────────────────────
// 상태색 — 통합 토큰(--state-*) 참조: 긍정/진행/주의/위험/중립 5의미만 사용
const SW_STATUS_COLORS: Record<string, string> = {
  "사용중": "var(--state-positive)", "신규등록": "var(--state-positive)", "재고": "var(--state-neutral)",
  "출고준비중": "var(--state-progress)", "갱신필요": "var(--state-caution)", "반납예정": "var(--state-caution)",
  "만료": "var(--state-risk)", "미확인": "var(--state-neutral)",
};
const HW_STATUS_COLORS: Record<string, string> = {
  "사용중": "var(--state-positive)", "재고": "var(--state-neutral)", "출고준비중": "var(--state-progress)",
  "출고준비완료": "var(--state-progress)", "수리": "var(--state-risk)", "렌탈": "var(--state-progress)",
  "임시지급": "var(--state-caution)", "반납예정": "var(--state-caution)", "미분류": "var(--state-neutral)",
};
const HW_HIDDEN = new Set(["미확인", "미분류"]);
const PALETTE = [
  "#6366f1","#f59e0b","#10b981","#ef4444","#3b82f6","#8b5cf6",
  "#ec4899","#14b8a6","#f97316","#84cc16","#06b6d4","#a855f7",
  "#64748b","#e11d48","#059669","#d97706",
];

// 자산흐름 단계색 — 통합 토큰 참조 (교체요청=중립 → 요청·준비=진행중 → 완료=긍정, 대기성 단계=주의)
const STAGE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  "교체요청":     { bg: "var(--state-neutral-soft)",  text: "var(--state-neutral)",  dot: "var(--state-neutral)" },
  "요청기안":     { bg: "var(--state-progress-soft)", text: "var(--state-progress)", dot: "var(--state-progress)" },
  "기기준비":     { bg: "var(--state-progress-soft)", text: "var(--state-progress)", dot: "var(--state-progress)" },
  "기기준비완료": { bg: "var(--state-positive-soft)", text: "var(--state-positive)", dot: "var(--state-positive)" },
  "사용자수령":   { bg: "var(--state-caution-soft)",  text: "var(--state-caution)",  dot: "var(--state-caution)" },
  "반납요청":     { bg: "var(--state-caution-soft)",  text: "var(--state-caution)",  dot: "var(--state-caution)" },
  "반납완료":     { bg: "var(--state-positive-soft)", text: "var(--state-positive)", dot: "var(--state-positive)" },
};
const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  "교체":     { bg: "var(--state-progress-soft)", text: "var(--state-progress)" },
  "퇴사반납": { bg: "var(--state-risk-soft)",     text: "var(--state-risk)" },
  "신규지급": { bg: "var(--state-positive-soft)", text: "var(--state-positive)" },
};
const ALL_STAGES = ["교체요청","요청기안","기기준비","기기준비완료","사용자수령","반납요청"] as const;

function fmtDateTime(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function agingDays(requestedAt: string, completedAt: string, stage: string) {
  if (!requestedAt) return 0;
  const start = new Date(requestedAt);
  const end = stage === "반납완료" && completedAt ? new Date(completedAt) : new Date();
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000);
}

function LoadingBox() {
  return <div className="h-32 flex items-center justify-center text-xs text-gray-400">불러오는 중...</div>;
}

// ── sessionStorage 캐시 키 ────────────────────────────────────
const SC_SW = (co: string) => `sc:dash:sw${co ? `:${co}` : ""}`;
const TTL = 5 * 60 * 1000;

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export default function DashboardHome({ company, initialHwStats, onNavigate }: Props) {
  const dark = useAdminDarkMode();
  const isFiltered = !!company;

  // ── SW 현황
  const [swLoading, setSwLoading] = useState(true);
  const [swSegs,    setSwSegs]    = useState<DonutSeg[]>([]);

  // ── HW 현황
  const [hwStats,   setHwStats]   = useState<HwStats | null>(initialHwStats);
  const [hwLoading, setHwLoading] = useState(!initialHwStats);

  // ── 자산흐름
  const [erLoading, setErLoading] = useState(true);
  const [erRecords, setErRecords] = useState<ExchangeReturnRecord[]>([]);
  const [erStage,   setErStage]   = useState("기기준비");
  const [erSearch,  setErSearch]  = useState("");

  // ── 캐시 관리
  const [clearing, setClearing] = useState(false);
  const [clearMsg, setClearMsg] = useState<string | null>(null);

  // SW 데이터
  useEffect(() => {
    const url = isFiltered ? `/api/sw-records?company=${encodeURIComponent(company)}` : "/api/sw-records";
    const key = SC_SW(company);
    const cached = scGet<{ status?: string }[]>(key);
    if (cached) {
      setSwSegs(buildSwSegs(cached));
      setSwLoading(false);
      fetch(url).then(r => safeJson(r)).then(d => {
        const recs = d.data ?? [];
        setSwSegs(buildSwSegs(recs));
        scSet(key, recs, TTL);
      }).catch(() => {});
      return;
    }
    fetch(url).then(r => safeJson(r)).then(d => {
      const recs: { status?: string }[] = d.data ?? [];
      setSwSegs(buildSwSegs(recs));
      scSet(key, recs, TTL);
    }).finally(() => setSwLoading(false));
  }, [company, isFiltered]); // eslint-disable-line react-hooks/exhaustive-deps

  // HW 통계
  useEffect(() => {
    if (hwStats) { setHwLoading(false); return; }
    let retry: ReturnType<typeof setTimeout> | null = null;
    async function load(isRetry = false) {
      try {
        const d = await fetch("/api/hw/stats").then(r => safeJson(r));
        if (d.ok && d.stats) { setHwStats(d.stats); setHwLoading(false); }
        else if (d.warming && !isRetry) { retry = setTimeout(() => load(true), 45_000); }
        else { setHwLoading(false); }
      } catch { setHwLoading(false); }
    }
    load();
    return () => { if (retry) clearTimeout(retry); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 자산흐름 데이터
  useEffect(() => {
    fetch("/api/exchange-return")
      .then(r => safeJson(r))
      .then(d => setErRecords(Array.isArray(d.data) ? d.data : []))
      .catch(() => {})
      .finally(() => setErLoading(false));
  }, []);

  // HW 도넛 세그
  const hwSegs: DonutSeg[] = hwStats
    ? Object.entries(hwStats.byStatus)
        .filter(([l, v]) => v > 0 && !HW_HIDDEN.has(l))
        .sort((a, b) => b[1] - a[1])
        .map(([label, value], i) => ({ label, value, color: HW_STATUS_COLORS[label] ?? PALETTE[i % PALETTE.length] }))
    : [];

  // 단계별 카운트 (진행 중 기준)
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    erRecords
      .filter(r => !r.isClosed && r.stage !== "반납완료")
      .forEach(r => { counts[r.stage] = (counts[r.stage] ?? 0) + 1; });
    return counts;
  }, [erRecords]);

  // 필터링된 자산흐름 목록
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
      const calls: Promise<Response>[] = [];
      if (target !== "sw") calls.push(fetch("/api/hw/cache-clear", { method: "POST" }));
      if (target !== "hw") calls.push(fetch("/api/sw-records/cache-clear", { method: "POST" }));
      await Promise.all(calls);
      setClearMsg(`✅ ${target === "hw" ? "HW" : target === "sw" ? "SW" : "전체"} 캐시 초기화 완료`);
    } catch { setClearMsg("⚠️ 초기화 중 오류 발생"); }
    finally { setClearing(false); setTimeout(() => setClearMsg(null), 4000); }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 페이지 타이틀 */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">대시보드</h1>
        <p className="text-sm text-gray-400 mt-1">{isFiltered ? `${company} 현황 요약` : "전사 현황 요약"}</p>
      </div>

      {/* ── ① HW 자산현황 | SW 자산현황 ─────────────────────────── */}
      <div className="grid grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-gray-700">하드웨어 현황</span>
            <button onClick={() => onNavigate("hw")} className="text-xs font-medium hover:opacity-75 transition-opacity" style={{ color: "var(--brand)" }}>전체 보기 →</button>
          </div>
          {hwLoading ? <LoadingBox /> : <DonutChart data={hwSegs} title="상태" />}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-gray-700">SW 라이선스 현황</span>
            <button onClick={() => onNavigate("overview")} className="text-xs font-medium hover:opacity-75 transition-opacity" style={{ color: "var(--brand)" }}>전체 보기 →</button>
          </div>
          {swLoading ? <LoadingBox /> : <DonutChart data={swSegs} title="전체" />}
        </div>
      </div>

      {/* ── ② 자산 흐름 관리 ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-700">자산 흐름 관리</span>
            <span className="text-xs text-gray-400">
              진행 중 <strong className="text-gray-700">{Object.values(stageCounts).reduce((a, b) => a + b, 0)}</strong>건
            </span>
          </div>
          <button onClick={() => onNavigate("exchange-return")} className="text-xs font-medium hover:opacity-75 transition-opacity" style={{ color: "var(--brand)" }}>
            전체 보기 →
          </button>
        </div>

        {/* 단계 탭 */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          <button
            onClick={() => setErStage("전체")}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors
              ${erStage === "전체" ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            전체
          </button>
          {ALL_STAGES.map(stage => {
            const cnt = stageCounts[stage] ?? 0;
            if (cnt === 0) return null;
            const c = STAGE_COLORS[stage];
            const active = erStage === stage;
            return (
              <button key={stage} onClick={() => setErStage(stage)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all"
                style={{
                  background: active ? c.dot : dark ? "#1c1c1c" : c.bg,
                  color: active ? "#fff" : dark ? c.dot : c.text,
                  borderColor: `color-mix(in srgb, ${c.dot} 40%, transparent)`,
                }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: active ? "#ffffffaa" : c.dot }} />
                {stage} {cnt}
              </button>
            );
          })}
          <input
            type="text" value={erSearch} onChange={e => setErSearch(e.target.value)}
            placeholder="이름·자산번호·법인 검색..."
            className="ml-auto flex-shrink-0 w-52 border border-gray-200 rounded-full px-3 py-1.5 text-xs focus:outline-none focus:border-blue-400"
          />
        </div>

        {/* 테이블 */}
        {erLoading ? <LoadingBox /> : erFiltered.length === 0 ? (
          <div className="py-10 text-center text-xs text-gray-400">조건에 맞는 항목이 없습니다</div>
        ) : (
          <>
            {/* 컬럼 헤더 */}
            <div className="grid px-5 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100"
              style={{ gridTemplateColumns: "130px 64px 108px 108px 88px 80px 90px 1fr 100px 90px" }}>
              <span>진행 단계</span><span>유형</span>
              <span>자산번호(현)</span><span>자산번호(신)</span>
              <span>법인</span><span>부서</span><span>사용자</span>
              <span>메모</span><span>최종수정</span><span>사용일자</span>
            </div>
            {/* 행 목록 */}
            <div className="max-h-[480px] overflow-y-auto divide-y divide-gray-50">
              {erFiltered.map(r => {
                const aging = agingDays(r.requestedAt, r.completedAt, r.stage);
                const sc = STAGE_COLORS[r.stage] ?? { bg: "#F1F5F9", text: "#64748B", dot: "#94A3B8" };
                const tc = TYPE_COLORS[r.type]  ?? { bg: "#F1F5F9", text: "#64748B" };
                return (
                  <div key={r.id}
                    className="grid items-center px-5 py-2.5 hover:bg-gray-50 transition-colors"
                    style={{ gridTemplateColumns: "130px 64px 108px 108px 88px 80px 90px 1fr 100px 90px" }}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap shrink-0"
                        style={{ background: dark ? "#1c1c1c" : sc.bg, color: dark ? sc.dot : sc.text }}>{r.stage}</span>
                      <span className="text-[10px] font-semibold shrink-0"
                        style={{ color: aging >= 7 ? "var(--state-risk)" : aging >= 3 ? "var(--state-caution)" : "var(--state-neutral)" }}>
                        D+{aging}
                      </span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold w-fit whitespace-nowrap"
                      style={{ background: dark ? "#1c1c1c" : tc.bg, color: tc.text }}>{r.type || "—"}</span>
                    <span className="text-[11px] text-blue-600 font-medium truncate pr-2">{r.assetId || "—"}</span>
                    <span className="text-[11px] text-blue-600 font-medium truncate pr-2">{r.newAssetId || "—"}</span>
                    <span className="text-[11px] text-gray-600 truncate pr-1">{r.company || "—"}</span>
                    <span className="text-[11px] text-gray-600 truncate pr-1">{r.department || "—"}</span>
                    <span className="text-[11px] text-gray-800 font-medium truncate pr-1">{r.user || "—"}</span>
                    <span className="text-[11px] text-gray-400 truncate pr-2">{r.note || "—"}</span>
                    <div className="text-[10px] pr-1">
                      {r.lastModifiedBy ? (
                        <>
                          <div className="text-gray-700 font-medium truncate">{r.lastModifiedBy}</div>
                          <div className="text-gray-400">{fmtDateTime(r.lastEditedAt)}</div>
                        </>
                      ) : <span className="text-gray-300">—</span>}
                    </div>
                    <span className="text-[11px] text-gray-400">{r.useDate ? r.useDate.slice(0, 10) : "—"}</span>
                  </div>
                );
              })}
            </div>
            <div className="px-5 py-2 text-right text-xs text-gray-400 border-t border-gray-100">
              {erFiltered.length}건 표시 / 전체 {erRecords.length}건
            </div>
          </>
        )}
      </div>

      {/* ── 캐시 관리 ─────────────────────────────────────────────── */}
      <div className="border-t border-gray-100 pt-4">
        <p className="text-xs text-gray-400 font-medium mb-2">캐시 관리</p>
        <div className="flex flex-wrap gap-2">
          {(["hw","sw","all"] as const).map(t => (
            <button key={t} onClick={() => clearCache(t)} disabled={clearing}
              className="text-xs px-3 py-1.5 rounded-[10px] border border-gray-200 bg-white text-gray-500 hover:border-red-300 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors flex items-center gap-1.5">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
              </svg>
              {clearing ? "초기화 중…" : t === "hw" ? "HW DB 초기화" : t === "sw" ? "SW DB 초기화" : "전체 초기화"}
            </button>
          ))}
        </div>
        {clearMsg && <p className="mt-2 text-[11px] text-gray-500">{clearMsg}</p>}
      </div>
    </div>
  );
}

// ── 헬퍼 ─────────────────────────────────────────────────────
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
