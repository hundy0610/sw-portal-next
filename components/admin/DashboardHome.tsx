"use client";

import { useEffect, useState } from "react";
import type { HwStats } from "@/lib/hw";
import type { HelpDeskTicket } from "@/lib/notion";
import type { RepairTicket } from "@/types";

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

const PALETTE = [
  "#6366f1","#f59e0b","#10b981","#ef4444","#3b82f6","#8b5cf6",
  "#ec4899","#14b8a6","#f97316","#84cc16","#06b6d4","#a855f7",
  "#64748b","#e11d48","#059669","#d97706",
];

const HELPDESK_STATUS: Record<string, { bg: string; text: string }> = {
  "시작 전": { bg: "#F8FAFC", text: "#64748B" },
  "진행 중": { bg: "#EFF6FF", text: "#1D4ED8" },
  "완료":    { bg: "#F0FDF4", text: "#059669" },
};

const REPAIR_STATUS: Record<string, { bg: string; text: string }> = {
  "시작 전": { bg: "#F8FAFC", text: "#64748B" },
  "진행 중": { bg: "#FFF7ED", text: "#C2410C" },
  "완료":    { bg: "#F0FDF4", text: "#059669" },
  "이관":    { bg: "#EFF6FF", text: "#1D4ED8" },
  "기타":    { bg: "#FAF5FF", text: "#7E22CE" },
};

function StatusBadge({ status, map }: { status: string; map: Record<string, { bg: string; text: string }> }) {
  const c = map[status] ?? { bg: "#F1F5F9", text: "#64748B" };
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap shrink-0"
      style={{ background: c.bg, color: c.text }}>
      {status || "—"}
    </span>
  );
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function LoadingBox() {
  return <div className="h-32 flex items-center justify-center text-xs text-gray-400">불러오는 중...</div>;
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export default function DashboardHome({ company, initialHwStats, onNavigate }: Props) {
  const isFiltered = !!company;

  const [swLoading,  setSwLoading]  = useState(true);
  const [swSegs,     setSwSegs]     = useState<DonutSeg[]>([]);

  const [hwStats,    setHwStats]    = useState<HwStats | null>(initialHwStats);
  const [hwLoading,  setHwLoading]  = useState(!initialHwStats);

  const [hdLoading,  setHdLoading]  = useState(true);
  const [hdTickets,  setHdTickets]  = useState<HelpDeskTicket[]>([]);

  const [rpLoading,  setRpLoading]  = useState(true);
  const [rpTickets,  setRpTickets]  = useState<RepairTicket[]>([]);

  // 로딩 시간 (ms)
  const [loadTimes, setLoadTimes] = useState<Record<string, number>>({});
  const setTime = (key: string, ms: number) =>
    setLoadTimes(prev => ({ ...prev, [key]: ms }));

  // SW 라이선스 현황 (상태별)
  useEffect(() => {
    const url = isFiltered
      ? `/api/sw-records?company=${encodeURIComponent(company)}`
      : "/api/sw-records";
    const t0 = performance.now();
    fetch(url)
      .then(r => r.json())
      .then(d => {
        setTime("SW 라이선스", Math.round(performance.now() - t0));
        const recs: { status?: string }[] = d.data ?? [];
        const counts: Record<string, number> = {};
        for (const r of recs) {
          const s = r.status || "미확인";
          counts[s] = (counts[s] || 0) + 1;
        }
        setSwSegs(
          Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([label, value], i) => ({
              label, value,
              color: SW_STATUS_COLORS[label] ?? PALETTE[i % PALETTE.length],
            }))
        );
      })
      .finally(() => setSwLoading(false));
  }, [company, isFiltered]);

  // HW 현황 (법인별)
  useEffect(() => {
    if (hwStats) { setHwLoading(false); setTime("HW 현황", 0); return; }
    const t0 = performance.now();
    fetch("/api/hw/stats")
      .then(r => r.json())
      .then(d => {
        setTime("HW 현황", Math.round(performance.now() - t0));
        if (d.ok && d.stats) setHwStats(d.stats);
      })
      .finally(() => setHwLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 최근 문의 접수
  useEffect(() => {
    const url = isFiltered
      ? `/api/helpdesk?company=${encodeURIComponent(company)}`
      : "/api/helpdesk";
    const t0 = performance.now();
    fetch(url)
      .then(r => r.json())
      .then(d => {
        setTime("문의 접수", Math.round(performance.now() - t0));
        const tickets: HelpDeskTicket[] = d.data ?? [];
        setHdTickets(
          [...tickets]
            .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
            .slice(0, 7)
        );
      })
      .finally(() => setHdLoading(false));
  }, [company, isFiltered]);

  // 최근 수리 접수
  useEffect(() => {
    const t0 = performance.now();
    fetch("/api/repair-tickets")
      .then(r => r.json())
      .then(d => {
        setTime("수리 접수", Math.round(performance.now() - t0));
        const tickets: RepairTicket[] = d.data ?? [];
        setRpTickets(
          [...tickets]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 7)
        );
      })
      .finally(() => setRpLoading(false));
  }, []);

  const hwSegs: DonutSeg[] = hwStats
    ? Object.entries(
        isFiltered
          ? { [company]: hwStats.byCompany[company] ?? 0 }
          : hwStats.byCompany
      )
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length] }))
    : [];

  return (
    <div className="flex flex-col gap-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-xl font-extrabold text-gray-900">대시보드</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {isFiltered ? `${company} 현황 요약` : "전사 현황 요약"}
        </p>
      </div>

      {/* 차트 행 */}
      <div className="grid grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-gray-700">SW 라이선스 현황</span>
            <button
              onClick={() => onNavigate("overview")}
              className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
            >
              전체 보기 →
            </button>
          </div>
          {swLoading ? <LoadingBox /> : <DonutChart data={swSegs} title="전체" />}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-gray-700">하드웨어 현황</span>
            <button
              onClick={() => onNavigate("hw")}
              className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
            >
              전체 보기 →
            </button>
          </div>
          {hwLoading ? <LoadingBox /> : <DonutChart data={hwSegs} title="법인별" />}
        </div>
      </div>

      {/* 리스트 행 */}
      <div className="grid grid-cols-2 gap-5">
        {/* 문의 접수 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-gray-700">최근 문의 접수</span>
            <button
              onClick={() => onNavigate("helpdesk")}
              className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
            >
              전체 보기 →
            </button>
          </div>
          {hdLoading ? (
            <LoadingBox />
          ) : hdTickets.length === 0 ? (
            <div className="text-xs text-gray-400 py-6 text-center">접수 내역 없음</div>
          ) : (
            <div className="flex flex-col">
              {hdTickets.map(t => (
                <div key={t.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <span className="text-[11px] text-gray-400 w-8 shrink-0">{fmtDate(t.submittedAt)}</span>
                  <StatusBadge status={t.status} map={HELPDESK_STATUS} />
                  <span className="text-xs text-gray-700 flex-1 truncate min-w-0">{t.content || t.title || "—"}</span>
                  <span className="text-[11px] text-gray-400 shrink-0 max-w-[56px] truncate">{t.company}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 수리 접수 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-gray-700">최근 수리 접수</span>
            <button
              onClick={() => onNavigate("repair")}
              className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
            >
              전체 보기 →
            </button>
          </div>
          {rpLoading ? (
            <LoadingBox />
          ) : rpTickets.length === 0 ? (
            <div className="text-xs text-gray-400 py-6 text-center">접수 내역 없음</div>
          ) : (
            <div className="flex flex-col">
              {rpTickets.map(t => (
                <div key={t.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <span className="text-[11px] text-gray-400 w-8 shrink-0">{fmtDate(t.createdAt)}</span>
                  <StatusBadge status={t.status} map={REPAIR_STATUS} />
                  <span className="text-xs text-gray-700 flex-1 truncate min-w-0">{t.title || "—"}</span>
                  <span className="text-[11px] text-gray-400 shrink-0 max-w-[56px] truncate">{t.company}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 로딩 시간 표시 */}
      {Object.keys(loadTimes).length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 px-1">
          <span className="text-xs text-gray-400 font-medium">초기 로딩 시간</span>
          {["SW 라이선스", "HW 현황", "문의 접수", "수리 접수"].map(key => {
            const ms = loadTimes[key];
            if (ms === undefined) return null;
            const color = ms === 0 ? "text-blue-500"
                        : ms < 500  ? "text-green-600"
                        : ms < 1500 ? "text-yellow-600"
                        : "text-red-500";
            return (
              <span key={key} className="flex items-center gap-1 text-xs">
                <span className="text-gray-400">{key}</span>
                <span className={`font-semibold ${color}`}>
                  {ms === 0 ? "캐시" : ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`}
                </span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
