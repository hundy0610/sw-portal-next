"use client";

import { useEffect, useState } from "react";
import type { MobileSession } from "@/app/admin/mobile/page";
import type { HwStats } from "@/lib/hw";

interface Props {
  session: MobileSession;
  onNavigate: (tab: string) => void;
}

// ── 도넛 차트 (모바일용 소형) ────────────────────────────────
interface DonutSeg { label: string; value: number; color: string }

function DonutChart({ data, title, size = 100 }: { data: DonutSeg[]; title: string; size?: number }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = size * 0.38, cx = size / 2, cy = size / 2;
  const C = 2 * Math.PI * r;
  let cumOffset = 0;
  const segs = data.filter(d => d.value > 0).map(d => {
    const len = total > 0 ? (d.value / total) * C : 0;
    const startOff = cumOffset;
    cumOffset += len;
    return { ...d, len, startOff };
  });
  const hoverSeg = hovered ? segs.find(s => s.label === hovered) : null;
  const sw = size * 0.135;

  return (
    <div className="flex items-center gap-4">
      <div className="shrink-0">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {total === 0
            ? <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E5E7EB" strokeWidth={sw} />
            : segs.map(s => (
                <circle key={s.label} cx={cx} cy={cy} r={r} fill="none"
                  stroke={s.color}
                  strokeWidth={hovered === s.label ? sw + 3 : sw}
                  strokeDasharray={`${Math.max(0, s.len - 1.5)} ${C}`}
                  strokeDashoffset={-s.startOff}
                  transform={`rotate(-90 ${cx} ${cy})`}
                  style={{ transition: "stroke-width 0.15s", cursor: "pointer" }}
                  onMouseEnter={() => setHovered(s.label)}
                  onMouseLeave={() => setHovered(null)}
                />
              ))
          }
          <text x={cx} y={cy - 5} textAnchor="middle" fontSize={size * 0.13} fontWeight="800" fill="#111827">
            {hoverSeg ? hoverSeg.value : total.toLocaleString()}
          </text>
          <text x={cx} y={cy + 9} textAnchor="middle" fontSize={size * 0.08} fill="#9CA3AF">
            {hoverSeg ? (hoverSeg.label.length > 5 ? hoverSeg.label.slice(0, 4) + "…" : hoverSeg.label) : title}
          </text>
        </svg>
      </div>
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        {segs.slice(0, 7).map(s => (
          <div key={s.label}
            className={`flex items-center gap-1.5 text-xs px-1.5 py-0.5 rounded cursor-pointer transition-colors ${hovered === s.label ? "bg-gray-100" : ""}`}
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
const PALETTE = ["#6366f1","#f59e0b","#10b981","#ef4444","#3b82f6","#8b5cf6","#ec4899","#14b8a6","#f97316"];
const HW_HIDDEN = new Set(["미확인", "미분류"]);

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{children}</div>;
}

export default function MobileDashboard({ session, onNavigate }: Props) {
  const isSuper = session.role === "super";
  const companyParam = !isSuper && session.company ? `?company=${encodeURIComponent(session.company)}` : "";

  const [hwStats,        setHwStats]        = useState<HwStats | null>(null);
  const [hwLoading,      setHwLoading]      = useState(true);
  const [swSegs,         setSwSegs]         = useState<DonutSeg[]>([]);
  const [swLoading,      setSwLoading]      = useState(true);
  const [exchangeActive, setExchangeActive] = useState(0);
  const [helpdeskOpen,   setHelpdeskOpen]   = useState(0);
  const [repairOpen,     setRepairOpen]     = useState(0);

  // HW 통계
  useEffect(() => {
    fetch(`/api/hw/stats${companyParam}`)
      .then(r => r.json())
      .then(d => { if (d.ok && d.stats) setHwStats(d.stats); })
      .catch(() => {})
      .finally(() => setHwLoading(false));
  }, [companyParam]);

  // SW + 진행업무 병렬 fetch
  useEffect(() => {
    const swUrl = isFiltered ? `/api/sw-records?company=${encodeURIComponent(session.company)}` : "/api/sw-records";
    Promise.all([
      fetch(swUrl).then(r => r.json()).catch(() => null),
      isSuper ? fetch("/api/exchange-return").then(r => r.json()).catch(() => null) : Promise.resolve(null),
      fetch(`/api/helpdesk${companyParam}`).then(r => r.json()).catch(() => null),
      fetch(`/api/repair-tickets${companyParam}`).then(r => r.json()).catch(() => null),
    ]).then(([swRes, erRes, hdRes, repRes]) => {
      // SW 도넛
      if (Array.isArray(swRes?.data)) {
        const counts: Record<string, number> = {};
        for (const r of swRes.data as { status?: string }[]) {
          const s = r.status || "미확인";
          counts[s] = (counts[s] || 0) + 1;
        }
        setSwSegs(
          Object.entries(counts).sort((a, b) => b[1] - a[1])
            .map(([label, value], i) => ({ label, value, color: SW_STATUS_COLORS[label] ?? PALETTE[i % PALETTE.length] }))
        );
      }
      setSwLoading(false);

      // 진행 업무 카운트
      if (Array.isArray(erRes?.data))
        setExchangeActive((erRes.data as { stage: string; isClosed: boolean }[]).filter(r => !r.isClosed && r.stage !== "반납완료").length);
      if (Array.isArray(hdRes?.data))
        setHelpdeskOpen((hdRes.data as { status: string }[]).filter(t => t.status !== "완료").length);
      if (Array.isArray(repRes?.data))
        setRepairOpen((repRes.data as { status: string }[]).filter(t => t.status !== "완료").length);
    });
  }, [companyParam, isSuper, session.company]); // eslint-disable-line react-hooks/exhaustive-deps

  const isFiltered = !isSuper && !!session.company;

  // HW 도넛 세그
  const hwSegs: DonutSeg[] = hwStats
    ? Object.entries(hwStats.byStatus)
        .filter(([l, v]) => v > 0 && !HW_HIDDEN.has(l))
        .sort((a, b) => b[1] - a[1])
        .map(([label, value], i) => ({ label, value, color: HW_STATUS_COLORS[label] ?? PALETTE[i % PALETTE.length] }))
    : [];

  return (
    <div className="p-4 space-y-4">

      {/* ── HW 자산현황 도넛 차트 ─────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold text-gray-800">HW 자산현황</span>
          <button onClick={() => onNavigate("hw")} className="text-xs text-blue-500">전체 보기 →</button>
        </div>
        {hwLoading
          ? <div className="h-24 flex items-center justify-center text-xs text-gray-400">로딩 중...</div>
          : <DonutChart data={hwSegs} title="상태" size={104} />
        }
      </div>

      {/* ── SW 라이선스 현황 도넛 차트 ───────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold text-gray-800">SW 라이선스 현황</span>
          <button onClick={() => onNavigate("helpdesk")} className="text-xs text-blue-500">전체 보기 →</button>
        </div>
        {swLoading
          ? <div className="h-24 flex items-center justify-center text-xs text-gray-400">로딩 중...</div>
          : <DonutChart data={swSegs} title="전체" size={104} />
        }
      </div>

      {/* ── 법인별 현황 ───────────────────────────────────────────── */}
      {hwStats && hwStats.companyTable.length > 0 && (
        <div>
          <SectionTitle>법인별 현황</SectionTitle>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {hwStats.companyTable.slice(0, 5).map((row, i) => (
              <div key={row.company} className={`flex items-center px-4 py-3 ${i > 0 ? "border-t border-gray-100" : ""}`}>
                <div className="flex-1 text-sm font-medium text-gray-900 truncate">{row.company}</div>
                <div className="flex gap-3 text-xs">
                  <span className="text-gray-400">전체 <strong className="text-gray-700">{row.total}</strong></span>
                  <span className="text-blue-500">사용 <strong>{row.active}</strong></span>
                  <span className="text-green-500">재고 <strong>{row.stock}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 진행 중인 업무 ────────────────────────────────────────── */}
      <div>
        <SectionTitle>진행 중인 업무</SectionTitle>
        <div className="space-y-2">
          {isSuper && (
            <button onClick={() => onNavigate("exchange-return")}
              className="w-full bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4 active:opacity-70 transition-opacity">
              <span className="text-2xl">📲</span>
              <div className="flex-1 text-left">
                <div className="font-semibold text-gray-900 text-sm">자산흐름 관리</div>
                <div className="text-xs text-gray-400 mt-0.5">교체·반납 진행 중</div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-lg font-extrabold text-orange-500">{exchangeActive}</span>
                <span className="text-xs text-gray-400">진행 중</span>
              </div>
            </button>
          )}
          <button onClick={() => onNavigate("helpdesk")}
            className="w-full bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4 active:opacity-70 transition-opacity">
            <span className="text-2xl">🎫</span>
            <div className="flex-1 text-left">
              <div className="font-semibold text-gray-900 text-sm">헬프데스크</div>
              <div className="text-xs text-gray-400 mt-0.5">미완료 문의</div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-lg font-extrabold text-blue-500">{helpdeskOpen}</span>
              <span className="text-xs text-gray-400">미완료</span>
            </div>
          </button>
          <button onClick={() => onNavigate("helpdesk")}
            className="w-full bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4 active:opacity-70 transition-opacity">
            <span className="text-2xl">🔧</span>
            <div className="flex-1 text-left">
              <div className="font-semibold text-gray-900 text-sm">수리 접수</div>
              <div className="text-xs text-gray-400 mt-0.5">처리 대기</div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-lg font-extrabold text-purple-500">{repairOpen}</span>
              <span className="text-xs text-gray-400">진행 중</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
