"use client";

import { useEffect, useState, useMemo } from "react";
import type { MobileSession } from "@/app/admin/mobile/page";
import type { HwStats } from "@/lib/hw";
import type { ExchangeReturnRecord } from "@/types";

interface Props {
  session: MobileSession;
  onNavigate: (tab: string) => void;
}

// ── 도넛 차트 ─────────────────────────────────────────────────
interface DonutSeg { label: string; value: number; color: string }

function DonutChart({ data, title }: { data: DonutSeg[]; title: string }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const size = 108, r = 40, cx = 54, cy = 54;
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
    <div className="flex items-center gap-4">
      <div className="shrink-0">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {total === 0
            ? <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E5E7EB" strokeWidth="15" />
            : segs.map(s => (
                <circle key={s.label} cx={cx} cy={cy} r={r} fill="none"
                  stroke={s.color}
                  strokeWidth={hovered === s.label ? 18 : 15}
                  strokeDasharray={`${Math.max(0, s.len - 1.5)} ${C}`}
                  strokeDashoffset={-s.startOff}
                  transform={`rotate(-90 ${cx} ${cy})`}
                  style={{ transition: "stroke-width 0.15s", cursor: "pointer" }}
                  onMouseEnter={() => setHovered(s.label)}
                  onMouseLeave={() => setHovered(null)}
                />
              ))
          }
          <text x={cx} y={cy - 4} textAnchor="middle" fontSize="13" fontWeight="800" fill="#111827">
            {hoverSeg ? hoverSeg.value : total.toLocaleString()}
          </text>
          <text x={cx} y={cy + 10} textAnchor="middle" fontSize="8" fill="#9CA3AF">
            {hoverSeg ? (hoverSeg.label.length > 5 ? hoverSeg.label.slice(0, 4) + "…" : hoverSeg.label) : title}
          </text>
        </svg>
      </div>
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        {segs.slice(0, 8).map(s => (
          <div key={s.label}
            className={`flex items-center gap-1.5 px-1 py-0.5 rounded cursor-pointer ${hovered === s.label ? "bg-gray-100" : ""}`}
            onMouseEnter={() => setHovered(s.label)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: s.color }} />
            <span className="text-gray-500 flex-1 truncate text-[11px]">{s.label}</span>
            <span className="font-bold text-gray-800 shrink-0 text-[11px]">{s.value}</span>
            <span className="text-gray-400 text-[10px] w-7 text-right shrink-0">
              {total > 0 ? `${Math.round(s.value / total * 100)}%` : "0%"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 색상 상수 ─────────────────────────────────────────────────
const HW_STATUS_COLORS: Record<string, string> = {
  "사용중": "#3B82F6", "재고": "#10B981", "출고준비중": "#06B6D4",
  "출고준비완료": "#0EA5E9", "수리": "#F97316", "렌탈": "#8B5CF6",
  "임시지급": "#EAB308", "반납예정": "#EC4899",
};
const SW_STATUS_COLORS: Record<string, string> = {
  "사용중": "#3B82F6", "신규등록": "#8B5CF6", "재고": "#10B981",
  "출고준비중": "#06B6D4", "갱신필요": "#F97316", "반납예정": "#EAB308",
  "만료": "#9CA3AF",
};
const STAGE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  "교체요청":     { bg: "#F8FAFC", text: "#64748B", dot: "#94A3B8" },
  "요청기안":     { bg: "#EFF6FF", text: "#1D4ED8", dot: "#3B82F6" },
  "기기준비":     { bg: "#F5F3FF", text: "#6D28D9", dot: "#8B5CF6" },
  "기기준비완료": { bg: "#ECFDF5", text: "#065F46", dot: "#10B981" },
  "사용자수령":   { bg: "#FFF7ED", text: "#C2410C", dot: "#F97316" },
  "반납요청":     { bg: "#FEFCE8", text: "#A16207", dot: "#EAB308" },
};
const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  "교체":     { bg: "#EFF6FF", text: "#1D4ED8" },
  "퇴사반납": { bg: "#FEF2F2", text: "#B91C1C" },
  "신규지급": { bg: "#F0FDF4", text: "#15803D" },
};
const PALETTE = ["#6366f1","#f59e0b","#10b981","#ef4444","#3b82f6","#8b5cf6","#ec4899","#14b8a6","#f97316"];
const HW_HIDDEN = new Set(["미확인", "미분류"]);
const ALL_STAGES = ["교체요청","요청기안","기기준비","기기준비완료","사용자수령","반납요청"] as const;

function agingDays(requestedAt: string, completedAt: string, stage: string) {
  if (!requestedAt) return 0;
  const end = stage === "반납완료" && completedAt ? new Date(completedAt) : new Date();
  return Math.floor((end.getTime() - new Date(requestedAt).getTime()) / 86_400_000);
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export default function MobileDashboard({ session, onNavigate }: Props) {
  const isSuper = session.role === "super";
  const isFiltered = !isSuper && !!session.company;
  const companyParam = isFiltered ? `?company=${encodeURIComponent(session.company)}` : "";

  const [hwStats,   setHwStats]   = useState<HwStats | null>(null);
  const [hwLoading, setHwLoading] = useState(true);
  const [swSegs,    setSwSegs]    = useState<DonutSeg[]>([]);
  const [swLoading, setSwLoading] = useState(true);
  const [erRecords, setErRecords] = useState<ExchangeReturnRecord[]>([]);
  const [erLoading, setErLoading] = useState(true);
  const [erStage,   setErStage]   = useState("기기준비");

  // HW 통계
  useEffect(() => {
    fetch(`/api/hw/stats${companyParam}`)
      .then(r => r.json())
      .then(d => { if (d.ok && d.stats) setHwStats(d.stats); })
      .catch(() => {})
      .finally(() => setHwLoading(false));
  }, [companyParam]);

  // SW 데이터
  useEffect(() => {
    const url = isFiltered ? `/api/sw-records?company=${encodeURIComponent(session.company)}` : "/api/sw-records";
    fetch(url).then(r => r.json()).then(d => {
      if (Array.isArray(d.data)) {
        const counts: Record<string, number> = {};
        for (const r of d.data as { status?: string }[]) {
          const s = r.status || "미확인";
          counts[s] = (counts[s] || 0) + 1;
        }
        setSwSegs(
          Object.entries(counts).sort((a, b) => b[1] - a[1])
            .map(([label, value], i) => ({ label, value, color: SW_STATUS_COLORS[label] ?? PALETTE[i % PALETTE.length] }))
        );
      }
    }).catch(() => {}).finally(() => setSwLoading(false));
  }, [isFiltered, session.company]); // eslint-disable-line react-hooks/exhaustive-deps

  // 자산흐름 데이터 (슈퍼어드민만)
  useEffect(() => {
    if (!isSuper) { setErLoading(false); return; }
    fetch("/api/exchange-return")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.data)) setErRecords(d.data); })
      .catch(() => {})
      .finally(() => setErLoading(false));
  }, [isSuper]);

  // HW 도넛 세그
  const hwSegs: DonutSeg[] = hwStats
    ? Object.entries(hwStats.byStatus)
        .filter(([l, v]) => v > 0 && !HW_HIDDEN.has(l))
        .sort((a, b) => b[1] - a[1])
        .map(([label, value], i) => ({ label, value, color: HW_STATUS_COLORS[label] ?? PALETTE[i % PALETTE.length] }))
    : [];

  // 단계별 카운트
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    erRecords.filter(r => !r.isClosed && r.stage !== "반납완료")
      .forEach(r => { counts[r.stage] = (counts[r.stage] ?? 0) + 1; });
    return counts;
  }, [erRecords]);

  // 필터링된 자산흐름
  const erFiltered = useMemo(() => {
    return erRecords.filter(r => erStage === "전체" || r.stage === erStage);
  }, [erRecords, erStage]);

  return (
    <div className="p-4 space-y-4">

      {/* ── HW / SW 차트: 폰=1열, 태블릿·데스크탑=2열 ──────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-gray-800">HW 자산현황</span>
            <button onClick={() => onNavigate("hw")} className="text-xs text-blue-500">전체 보기 →</button>
          </div>
          {hwLoading
            ? <div className="h-24 flex items-center justify-center text-xs text-gray-400">로딩 중...</div>
            : <DonutChart data={hwSegs} title="상태" />
          }
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-gray-800">SW 라이선스 현황</span>
            <button onClick={() => onNavigate("helpdesk")} className="text-xs text-blue-500">전체 보기 →</button>
          </div>
          {swLoading
            ? <div className="h-24 flex items-center justify-center text-xs text-gray-400">로딩 중...</div>
            : <DonutChart data={swSegs} title="전체" />
          }
        </div>
      </div>

      {/* ── 자산흐름 관리 (슈퍼어드민) ───────────────────────── */}
      {isSuper && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <span className="text-sm font-bold text-gray-800">자산 흐름 관리</span>
            <button onClick={() => onNavigate("exchange-return")} className="text-xs text-blue-500">
              전체 보기 →
            </button>
          </div>

          {/* 단계 탭 */}
          <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            <button
              onClick={() => setErStage("전체")}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors
                ${erStage === "전체" ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600"}`}>
              전체
            </button>
            {ALL_STAGES.map(stage => {
              const cnt = stageCounts[stage] ?? 0;
              if (cnt === 0) return null;
              const c = STAGE_COLORS[stage];
              const active = erStage === stage;
              return (
                <button key={stage} onClick={() => setErStage(stage)}
                  className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border transition-all"
                  style={{
                    background: active ? c.dot : c.bg,
                    color: active ? "#fff" : c.text,
                    borderColor: c.dot + "55",
                  }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: active ? "#ffffffaa" : c.dot }} />
                  {stage} {cnt}
                </button>
              );
            })}
          </div>

          {/* 카드 목록 */}
          <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
            {erLoading ? (
              <div className="py-8 text-center text-xs text-gray-400">로딩 중...</div>
            ) : erFiltered.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">항목이 없습니다</div>
            ) : (
              erFiltered.map(r => {
                const aging = agingDays(r.requestedAt, r.completedAt, r.stage);
                const sc = STAGE_COLORS[r.stage] ?? { bg: "#F1F5F9", text: "#64748B", dot: "#94A3B8" };
                const tc = TYPE_COLORS[r.type]  ?? { bg: "#F1F5F9", text: "#64748B" };
                return (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ background: tc.bg, color: tc.text }}>{r.type}</span>
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ background: sc.bg, color: sc.text }}>{r.stage}</span>
                      </div>
                      <div className="font-semibold text-gray-900 text-sm mt-1">
                        {r.company || "—"} · {r.assetId || r.newAssetId || "—"}
                      </div>
                      <div className="text-xs text-gray-400 truncate">
                        {r.user || "—"}{r.note ? ` · ${r.note}` : ""}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold"
                        style={{ color: aging >= 7 ? "#DC2626" : aging >= 3 ? "#D97706" : "#9CA3AF" }}>
                        D+{aging}
                      </div>
                      {r.assignee && <div className="text-[10px] text-gray-400 mt-0.5">{r.assignee}</div>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="px-4 py-2 border-t border-gray-50 text-right text-xs text-gray-400">
            {erFiltered.length}건
          </div>
        </div>
      )}
    </div>
  );
}
