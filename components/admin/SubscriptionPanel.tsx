"use client";

import { useEffect, useState, useMemo } from "react";
import type { SwDbRecord } from "@/types";
import { SyncBanner } from "@/components/ui/SyncBanner";

const PREVIEW_COUNT = 5; // 목록에서 기본 표시 건수

// ── 상태 스타일 ─────────────────────────────────────────────────────────
const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string; color: string }> = {
  "사용중":   { bg: "bg-blue-50",   text: "text-blue-700",   dot: "bg-blue-500",   color: "#3B82F6" },
  "갱신필요": { bg: "bg-red-50",    text: "text-red-600",    dot: "bg-red-500",    color: "#EF4444" },
  "만료":     { bg: "bg-gray-100",  text: "text-gray-500",   dot: "bg-gray-400",   color: "#9CA3AF" },
  "재고":     { bg: "bg-green-50",  text: "text-green-700",  dot: "bg-green-500",  color: "#10B981" },
  "신규등록": { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500", color: "#8B5CF6" },
  "반납예정": { bg: "bg-orange-50", text: "text-orange-600", dot: "bg-orange-400", color: "#F97316" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { bg: "bg-gray-100", text: "text-gray-500", dot: "bg-gray-400", color: "#9CA3AF" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status || "—"}
    </span>
  );
}

function daysUntil(d?: string): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

function fmtDate(d?: string) { return d ? d.slice(0, 10) : "—"; }

// ── SVG 도넛 차트 ───────────────────────────────────────────────────────
interface DonutSeg { label: string; value: number; color: string; }

function DonutChart({ data }: { data: DonutSeg[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = 50, cx = 60, cy = 60;
  const C = 2 * Math.PI * r;
  let cum = 0;
  const segs = data.filter(d => d.value > 0).map(d => {
    const len   = total > 0 ? (d.value / total) * C : 0;
    const start = cum;
    cum += len;
    return { ...d, len, start };
  });
  return (
    <div className="flex items-center gap-5 flex-wrap justify-center">
      <svg width="120" height="120" viewBox="0 0 120 120" className="shrink-0">
        {total === 0
          ? <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E5E7EB" strokeWidth="16" />
          : segs.map(s => (
              <circle
                key={s.label} cx={cx} cy={cy} r={r} fill="none" stroke={s.color}
                strokeWidth="16"
                strokeDasharray={`${Math.max(0, s.len - 2)} ${C}`}
                strokeDashoffset={-s.start}
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            ))
        }
        <text x="60" y="55" textAnchor="middle" fontSize="15" fontWeight="700" fill="#111827">{total.toLocaleString()}</text>
        <text x="60" y="70" textAnchor="middle" fontSize="9" fill="#9CA3AF">전체</text>
      </svg>
      <div className="flex flex-col gap-2 min-w-0">
        {segs.map(s => (
          <div key={s.label} className="flex items-center gap-2 text-xs">
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: s.color }} />
            <span className="text-gray-700 flex-1">{s.label}</span>
            <span className="font-bold text-gray-900 ml-2 shrink-0">{s.value}</span>
            <span className="text-gray-400 w-8 text-right shrink-0">
              {total > 0 ? `${Math.round(s.value / total * 100)}%` : "0%"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 수평 막대 차트 ──────────────────────────────────────────────────────
function HorizBarChart({ data, maxCount = 10 }: {
  data: { label: string; value: number; color: string }[];
  maxCount?: number;
}) {
  const items = data.slice(0, maxCount);
  const max   = Math.max(...items.map(d => d.value), 1);
  return (
    <div className="flex flex-col gap-2.5">
      {items.map(d => (
        <div key={d.label} className="flex items-center gap-2 text-xs">
          <span className="text-gray-600 w-28 shrink-0 truncate">{d.label}</span>
          <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-2.5 rounded-full"
              style={{ width: `${(d.value / max) * 100}%`, background: d.color, transition: "width 0.5s ease" }}
            />
          </div>
          <span className="font-semibold text-gray-800 w-5 text-right shrink-0">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── 메인 컴포넌트 ───────────────────────────────────────────────────────
export default function SubscriptionPanel() {
  const [records,    setRecords]    = useState<SwDbRecord[]>([]);
  const [lastSynced, setLastSynced] = useState("");
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");

  // 글로벌 필터 (법인 / SW명)
  const [filterCompany, setFilterCompany] = useState("전체");
  const [filterSwName,  setFilterSwName]  = useState("전체");

  // 상세 검색 필터
  const [search,       setSearch]       = useState("");
  const [typeFilter,   setTypeFilter]   = useState("전체");
  const [statusFilter, setStatusFilter] = useState("전체");

  // 뷰 상태
  const [viewMode,           setViewMode]           = useState<"grouped" | "table">("grouped");
  const [expandedSw,         setExpandedSw]         = useState<string | null>(null);
  const [showRenewingDetail, setShowRenewingDetail] = useState(false);
  const [showAllGroups,      setShowAllGroups]      = useState(false);
  const [showAllTable,       setShowAllTable]       = useState(false);

  useEffect(() => {
    fetch("/api/sw-records")
      .then(r => r.json())
      .then(res => {
        setRecords(res.data ?? []);
        setLastSynced(res.lastSynced ?? "");
        if (res.error) setError(res.error);
      })
      .catch(() => setError("데이터를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  // 구독 레코드만
  const subRecords = useMemo(
    () => records.filter(r => r.licenseType === "구독(업체)" || r.licenseType === "구독(웹)"),
    [records]
  );

  // ── 필터 옵션 ─────────────────────────────────────────────────
  const companyOptions = useMemo(() => {
    const set = new Set(subRecords.map(r => r.company).filter(Boolean));
    return ["전체", ...Array.from(set).sort()];
  }, [subRecords]);

  const swNameOptions = useMemo(() => {
    const set = new Set(subRecords.map(r => r.swCategory).filter(Boolean));
    return ["전체", ...Array.from(set).sort()];
  }, [subRecords]);

  // ── 글로벌 필터 적용 (법인 + SW명) → 차트 기반 ───────────────
  const baseFiltered = useMemo(() => {
    return subRecords.filter(r => {
      if (filterCompany !== "전체" && r.company    !== filterCompany) return false;
      if (filterSwName  !== "전체" && r.swCategory !== filterSwName)  return false;
      return true;
    });
  }, [subRecords, filterCompany, filterSwName]);

  // ── 세부 필터 추가 (검색 + 유형 + 상태) → 목록 기반 ─────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return baseFiltered.filter(r => {
      if (typeFilter   !== "전체" && r.licenseType !== typeFilter)   return false;
      if (statusFilter !== "전체" && r.status      !== statusFilter) return false;
      if (q) {
        return [r.swCategory, r.swDetail, r.user, r.department, r.company]
          .filter(Boolean).some(v => v!.toLowerCase().includes(q));
      }
      return true;
    });
  }, [baseFiltered, typeFilter, statusFilter, search]);

  // 필터 변경 시 더보기 상태 초기화
  useMemo(() => {
    setShowAllGroups(false);
    setShowAllTable(false);
    setExpandedSw(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCompany, filterSwName, typeFilter, statusFilter, search]);

  // ── 통계 (baseFiltered 기준) ──────────────────────────────────
  const stats = useMemo(() => ({
    total:    baseFiltered.length,
    active:   baseFiltered.filter(r => r.status === "사용중" || r.status === "신규등록").length,
    expiring: baseFiltered.filter(r => { const d = daysUntil(r.renewalDate); return d !== null && d >= 0 && d <= 30; }).length,
    vendor:   baseFiltered.filter(r => r.licenseType === "구독(업체)").length,
    web:      baseFiltered.filter(r => r.licenseType === "구독(웹)").length,
  }), [baseFiltered]);

  // ── 차트 데이터 (baseFiltered 기준) ──────────────────────────
  const typeChartData = useMemo<DonutSeg[]>(() => [
    { label: "구독(업체)", value: stats.vendor, color: "#8B5CF6" },
    { label: "구독(웹)",   value: stats.web,    color: "#06B6D4" },
  ], [stats]);

  const statusChartData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of baseFiltered) { map[r.status] = (map[r.status] ?? 0) + 1; }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({
      label, value, color: STATUS_STYLE[label]?.color ?? "#9CA3AF",
    }));
  }, [baseFiltered]);

  const swBarData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of baseFiltered) {
      const key = r.swCategory || "미분류";
      map[key] = (map[key] ?? 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({
      label, value, color: "#6366F1",
    }));
  }, [baseFiltered]);

  // 갱신 임박 (baseFiltered 기준, D-day 순 정렬)
  const renewingSoon = useMemo(() =>
    baseFiltered
      .filter(r => { const d = daysUntil(r.renewalDate); return d !== null && d >= 0 && d <= 30; })
      .sort((a, b) => (daysUntil(a.renewalDate) ?? 9999) - (daysUntil(b.renewalDate) ?? 9999)),
    [baseFiltered]
  );

  // SW별 그룹 (filtered 기준)
  const groupedBySw = useMemo(() => {
    const map: Record<string, SwDbRecord[]> = {};
    for (const r of filtered) {
      const key = r.swCategory || "미분류";
      if (!map[key]) map[key] = [];
      map[key].push(r);
    }
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  const statusOptions = useMemo(() =>
    ["전체", ...Array.from(new Set(subRecords.map(r => r.status).filter(Boolean)))],
    [subRecords]
  );

  const isGlobalFiltered  = filterCompany !== "전체" || filterSwName !== "전체";
  const isDetailFiltered  = typeFilter !== "전체" || statusFilter !== "전체" || !!search;

  // 표시할 그룹/행 수 결정
  const visibleGroups = showAllGroups ? groupedBySw : groupedBySw.slice(0, PREVIEW_COUNT);
  const visibleRows   = showAllTable  ? filtered    : filtered.slice(0, PREVIEW_COUNT);

  if (loading) return <div className="text-center py-20 text-gray-400">노션에서 불러오는 중...</div>;
  if (error)   return <div className="text-center py-20 text-red-500">오류: {error}</div>;

  return (
    <div className="fade-in">
      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-0.5">구독 관리</h2>
          <p className="text-sm text-gray-500">전사 구독형 SW 현황 (Notion 실시간 연동)</p>
        </div>
      </div>

      <SyncBanner lastSynced={lastSynced} notionUrl={process.env.NEXT_PUBLIC_NOTION_SW_UNIFIED_URL} />

      {/* ── 글로벌 필터 (법인 / SW명) ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-gray-500">🔍 데이터 필터</span>

        {/* 법인 선택 */}
        <div className="relative">
          <select
            value={filterCompany}
            onChange={e => setFilterCompany(e.target.value)}
            className={`appearance-none pl-3 pr-7 py-2 border rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-colors ${
              filterCompany !== "전체"
                ? "bg-blue-50 border-blue-300 text-blue-700"
                : "bg-white border-gray-300 text-gray-600"
            }`}
          >
            {companyOptions.map(c => <option key={c} value={c}>{c === "전체" ? "🏭 전체 법인" : c}</option>)}
          </select>
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▾</span>
        </div>

        {/* SW명 선택 */}
        <div className="relative">
          <select
            value={filterSwName}
            onChange={e => setFilterSwName(e.target.value)}
            className={`appearance-none pl-3 pr-7 py-2 border rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-colors ${
              filterSwName !== "전체"
                ? "bg-purple-50 border-purple-300 text-purple-700"
                : "bg-white border-gray-300 text-gray-600"
            }`}
          >
            {swNameOptions.map(n => <option key={n} value={n}>{n === "전체" ? "💾 전체 SW명" : n}</option>)}
          </select>
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▾</span>
        </div>

        {isGlobalFiltered && (
          <button
            onClick={() => { setFilterCompany("전체"); setFilterSwName("전체"); }}
            className="text-xs text-gray-500 border border-gray-200 px-3 py-2 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
          >
            × 초기화
          </button>
        )}
        <span className={`text-xs font-semibold ml-auto ${isGlobalFiltered ? "text-blue-600" : "text-gray-400"}`}>
          {isGlobalFiltered ? `필터 적용 · ${baseFiltered.length}건` : `전체 ${baseFiltered.length}건`}
        </span>
      </div>

      {/* ── KPI 카드 ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        {[
          { label: "전체 구독",  value: stats.total,    accent: "border-l-gray-400",   txt: "text-gray-900" },
          { label: "활성 구독",  value: stats.active,   accent: "border-l-blue-500",   txt: "text-blue-700" },
          { label: "갱신 임박",  value: stats.expiring, accent: "border-l-red-500",    txt: stats.expiring > 0 ? "text-red-600" : "text-gray-400" },
          { label: "구독(업체)", value: stats.vendor,   accent: "border-l-violet-500", txt: "text-violet-700" },
          { label: "구독(웹)",   value: stats.web,      accent: "border-l-cyan-500",   txt: "text-cyan-700" },
        ].map(k => (
          <div key={k.label} className={`bg-white border border-gray-200 rounded-xl p-4 border-l-4 ${k.accent}`}>
            <div className="text-xs text-gray-500 mb-1">{k.label}</div>
            <div className={`text-2xl font-bold ${k.txt}`}>{k.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* ── 차트 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="text-sm font-bold text-gray-800 mb-4">🍩 구독 유형 분포</div>
          <DonutChart data={typeChartData} />
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="text-sm font-bold text-gray-800 mb-4">📊 상태별 현황</div>
          <DonutChart data={statusChartData.map(d => ({ label: d.label, value: d.value, color: d.color }))} />
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="text-sm font-bold text-gray-800 mb-4">📈 SW별 구독 현황</div>
          <HorizBarChart data={swBarData} maxCount={8} />
        </div>
      </div>

      {/* ── 갱신 임박 알림 (요약 + 상세보기 토글) ── */}
      {renewingSoon.length > 0 && (
        <div className="mb-5 bg-red-50 border border-red-200 rounded-xl overflow-hidden">
          {/* 요약 헤더 */}
          <div className="flex items-center justify-between px-4 py-3.5">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-red-700">⚠️ 갱신 임박</span>
              <span className="bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                {renewingSoon.length}건
              </span>
              <span className="text-xs text-red-500">30일 이내 만료 예정</span>
            </div>
            <button
              onClick={() => setShowRenewingDetail(v => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-white border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors"
            >
              {showRenewingDetail ? "접기 ▲" : "상세보기 ▼"}
            </button>
          </div>

          {/* 상세 목록 (토글) */}
          {showRenewingDetail && (
            <div className="border-t border-red-200 px-4 py-3 flex flex-col gap-2">
              {renewingSoon.map(r => {
                const d = daysUntil(r.renewalDate);
                return (
                  <div key={r.id}
                    className="flex items-center gap-3 text-xs bg-white rounded-lg px-3 py-2.5 border border-red-100">
                    <span className={`font-bold shrink-0 px-2 py-0.5 rounded-full text-white text-xs ${
                      d !== null && d <= 7 ? "bg-red-600" : "bg-orange-500"
                    }`}>
                      D-{d}
                    </span>
                    <span className="font-semibold text-gray-900 flex-1 truncate min-w-0">
                      {r.swCategory}{r.swDetail ? ` · ${r.swDetail}` : ""}
                    </span>
                    <span className="text-gray-500 shrink-0 hidden sm:block">
                      {r.user || "—"} · {r.department || "—"}
                    </span>
                    <span className={`font-semibold shrink-0 ${d !== null && d <= 7 ? "text-red-700" : "text-orange-600"}`}>
                      {fmtDate(r.renewalDate)}
                    </span>
                    {r.notionUrl && (
                      <a href={r.notionUrl} target="_blank" rel="noopener noreferrer"
                        className="text-blue-500 hover:underline shrink-0">보기</a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 상세 검색 & 필터 ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="SW명, 사용자, 부서, 법인명 검색…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {search && (
              <button onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-base leading-none">×</button>
            )}
          </div>
          {/* 유형 필터 */}
          {(["전체", "구독(업체)", "구독(웹)"] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`text-xs font-semibold px-3 py-2 rounded-lg border transition-colors ${
                typeFilter === t
                  ? "bg-gray-800 text-white border-gray-800"
                  : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"
              }`}>
              {t}
            </button>
          ))}
          {/* 상태 필터 */}
          <div className="relative">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className={`appearance-none pl-3 pr-7 py-2 border rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer ${
                statusFilter !== "전체"
                  ? "bg-blue-50 border-blue-300 text-blue-700"
                  : "bg-white border-gray-300 text-gray-600"
              }`}>
              {statusOptions.map(s => <option key={s}>{s}</option>)}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▾</span>
          </div>
          {isDetailFiltered && (
            <button
              onClick={() => { setSearch(""); setTypeFilter("전체"); setStatusFilter("전체"); }}
              className="text-xs text-gray-500 border border-gray-200 px-3 py-2 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors">
              × 초기화
            </button>
          )}
          <span className="text-xs text-gray-400 font-medium ml-auto">{filtered.length}건</span>
        </div>
      </div>

      {/* ── 뷰 토글 ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1.5">
          {([["grouped", "📂 SW별 그룹"], ["table", "📋 전체 목록"]] as const).map(([v, label]) => (
            <button key={v} onClick={() => setViewMode(v)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all border ${
                viewMode === v
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════
          SW별 그룹 뷰
      ══════════════════════════════ */}
      {viewMode === "grouped" && (
        <div className="flex flex-col gap-3">
          {groupedBySw.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-3xl mb-2">🔍</div>
              <div>검색 결과가 없습니다.</div>
            </div>
          ) : (
            <>
              {visibleGroups.map(([swName, recs]) => {
                const isExpanded  = expandedSw === swName;
                const activeCount = recs.filter(r => r.status === "사용중" || r.status === "신규등록").length;
                const urgentCount = recs.filter(r => { const d = daysUntil(r.renewalDate); return d !== null && d >= 0 && d <= 30; }).length;
                const vendorCount = recs.filter(r => r.licenseType === "구독(업체)").length;
                const webCount    = recs.filter(r => r.licenseType === "구독(웹)").length;

                return (
                  <div key={swName} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    {/* 그룹 헤더 */}
                    <div
                      className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => setExpandedSw(isExpanded ? null : swName)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm text-gray-900 truncate">{swName}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {vendorCount > 0 && (
                            <span className="text-xs text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full font-medium">
                              업체 {vendorCount}
                            </span>
                          )}
                          {webCount > 0 && (
                            <span className="text-xs text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-full font-medium">
                              웹 {webCount}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {activeCount > 0 && (
                          <span className="text-xs text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full font-semibold">
                            활성 {activeCount}
                          </span>
                        )}
                        {urgentCount > 0 && (
                          <span className="text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full font-bold">
                            ⚠ D-day {urgentCount}
                          </span>
                        )}
                        <span className="text-xs text-gray-400 font-medium">{recs.length}건</span>
                        <svg
                          className={`text-gray-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </div>
                    </div>

                    {/* 세부 행 */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                        <div className="flex flex-col gap-1.5">
                          {recs.map(r => {
                            const days    = daysUntil(r.renewalDate);
                            const isUrgent = days !== null && days >= 0 && days <= 30;
                            return (
                              <div key={r.id}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs flex-wrap ${
                                  isUrgent ? "bg-red-50 border border-red-100" : "bg-white border border-gray-100"
                                }`}>
                                <StatusBadge status={r.status} />
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                                  r.licenseType === "구독(업체)" ? "bg-violet-50 text-violet-700" : "bg-cyan-50 text-cyan-700"
                                }`}>
                                  {r.licenseType}
                                </span>
                                <span className="font-semibold text-gray-800 shrink-0">{r.user || "—"}</span>
                                <span className="text-gray-400 shrink-0">{r.department || "—"}</span>
                                <span className="text-gray-400 shrink-0">{r.company || "—"}</span>
                                {r.swDetail && <span className="text-gray-400 shrink-0">{r.swDetail}</span>}
                                <div className="ml-auto flex items-center gap-2 shrink-0">
                                  {r.renewalDate && (
                                    <span className={isUrgent ? "text-red-600 font-semibold" : "text-gray-400"}>
                                      {isUrgent && days !== null ? `D-${days} · ` : ""}{fmtDate(r.renewalDate)}
                                    </span>
                                  )}
                                  {r.notionUrl && (
                                    <a href={r.notionUrl} target="_blank" rel="noopener noreferrer"
                                      className="text-blue-500 hover:text-blue-700 underline"
                                      onClick={e => e.stopPropagation()}>보기</a>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 더보기 / 접기 버튼 */}
              {groupedBySw.length > PREVIEW_COUNT && (
                <button
                  onClick={() => setShowAllGroups(v => !v)}
                  className="w-full py-3 border border-dashed border-gray-300 rounded-xl text-xs font-semibold text-gray-500 hover:bg-gray-50 hover:border-gray-400 hover:text-gray-700 transition-all"
                >
                  {showAllGroups
                    ? `▲ 접기 (${groupedBySw.length - PREVIEW_COUNT}개 숨기기)`
                    : `▼ 상세보기 — ${groupedBySw.length - PREVIEW_COUNT}개 SW 더 보기`}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════
          전체 목록 (테이블) 뷰
      ══════════════════════════════ */}
      {viewMode === "table" && (
        <div className="flex flex-col gap-3">
          <div className="bg-white border border-gray-200 rounded-xl overflow-auto shadow-sm">
            <table className="w-full text-sm" style={{ minWidth: 860 }}>
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {["SW명", "구독 유형", "상태", "사용자 / 부서", "법인", "갱신 필요일", "버전", "노션"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-400">데이터 없음</td>
                  </tr>
                ) : visibleRows.map(r => {
                  const days     = daysUntil(r.renewalDate);
                  const isUrgent = days !== null && days >= 0 && days <= 30;
                  return (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900 text-xs">{r.swCategory}</div>
                        {r.swDetail && <div className="text-xs text-gray-400">{r.swDetail}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          r.licenseType === "구독(업체)" ? "bg-purple-50 text-purple-700" : "bg-cyan-50 text-cyan-700"
                        }`}>
                          {r.licenseType}
                        </span>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 text-xs">{r.user || "—"}</div>
                        <div className="text-xs text-gray-400">{r.department || "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">{r.company || "—"}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {r.renewalDate ? (
                          <span className={isUrgent ? "text-red-600 font-semibold" : "text-gray-600"}>
                            {fmtDate(r.renewalDate)}
                            {isUrgent && days !== null && (
                              <span className="ml-1 bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">D-{days}</span>
                            )}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {(r.version ?? []).length > 0 ? r.version!.join(", ") : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {r.notionUrl && (
                          <a href={r.notionUrl} target="_blank" rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-700 text-xs underline">보기</a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 전체보기 / 접기 버튼 */}
          {filtered.length > PREVIEW_COUNT && (
            <button
              onClick={() => setShowAllTable(v => !v)}
              className="w-full py-3 border border-dashed border-gray-300 rounded-xl text-xs font-semibold text-gray-500 hover:bg-gray-50 hover:border-gray-400 hover:text-gray-700 transition-all"
            >
              {showAllTable
                ? `▲ 접기 (${filtered.length - PREVIEW_COUNT}건 숨기기)`
                : `▼ 상세보기 — 전체 ${filtered.length}건 보기 (${filtered.length - PREVIEW_COUNT}건 더)`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
