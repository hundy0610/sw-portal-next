"use client";

import { useEffect, useState, useMemo } from "react";
import type { SwDbRecord } from "@/types";

const PAGE_SIZE = 50;

// ── 상태별 뱃지 색상 ──────────────────────────────────────────
const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  "사용중":     { bg: "bg-blue-50",   text: "text-blue-700",   dot: "bg-blue-500"   },
  "재고":       { bg: "bg-green-50",  text: "text-green-700",  dot: "bg-green-500"  },
  "출고준비중": { bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-400" },
  "만료":       { bg: "bg-gray-100",  text: "text-gray-500",   dot: "bg-gray-400"   },
  "갱신필요":   { bg: "bg-red-50",    text: "text-red-600",    dot: "bg-red-500"    },
  "반납예정":   { bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-400" },
  "신규등록":   { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500" },
  "임시지급":   { bg: "bg-sky-50",    text: "text-sky-700",    dot: "bg-sky-400"    },
  "미확인":     { bg: "bg-gray-50",   text: "text-gray-400",   dot: "bg-gray-300"   },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { bg: "bg-gray-100", text: "text-gray-500", dot: "bg-gray-400" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status || "—"}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    "영구":       "bg-blue-50 text-blue-700",
    "구독(업체)": "bg-purple-50 text-purple-700",
    "구독(웹)":   "bg-cyan-50 text-cyan-700",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[type] ?? "bg-gray-100 text-gray-500"}`}>
      {type || "—"}
    </span>
  );
}

function fmtDate(d?: string) {
  if (!d) return "—";
  return d.slice(0, 10);
}

function daysLeft(d?: string): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

function SummaryCard({ label, value, sub, color }: { label: string; value: number; sub?: string; color: string }) {
  return (
    <div className={`bg-white border rounded-xl p-4 flex flex-col gap-1 shadow-sm border-l-4 ${color}`}>
      <div className="text-xs text-gray-500 font-medium">{label}</div>
      <div className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

function SwStatusCard({ name, total, using, stock, expired, renewing }: {
  name: string; total: number; using: number; stock: number; expired: number; renewing: number;
}) {
  const usePct = total > 0 ? Math.round((using / total) * 100) : 0;
  const barColor = usePct >= 90 ? "bg-red-500" : usePct >= 70 ? "bg-orange-400" : "bg-blue-500";
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-3">
        <span className="font-bold text-sm text-gray-900 truncate flex-1">{name}</span>
        <span className="text-xs text-gray-400 font-medium shrink-0">{total}개</span>
      </div>
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>사용중 {using}</span>
          <span>{usePct}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${usePct}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1 text-center">
        <div className="bg-green-50 rounded-lg py-1.5">
          <div className="text-sm font-bold text-green-700">{stock}</div>
          <div className="text-xs text-green-600">재고</div>
        </div>
        <div className="bg-red-50 rounded-lg py-1.5">
          <div className="text-sm font-bold text-red-600">{renewing}</div>
          <div className="text-xs text-red-500">갱신필요</div>
        </div>
        <div className="bg-gray-50 rounded-lg py-1.5">
          <div className="text-sm font-bold text-gray-500">{expired}</div>
          <div className="text-xs text-gray-400">만료</div>
        </div>
      </div>
    </div>
  );
}

// ── 정렬 헤더 ──────────────────────────────────────────────────
type SortKey = "swCategory" | "licenseType" | "department" | "user" | "company" | "status" | "renewalDate" | "usageDate";

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: "asc" | "desc" }) {
  if (sortKey !== col) return <span className="ml-0.5 text-gray-300">↕</span>;
  return <span className="ml-0.5 text-blue-600">{sortDir === "asc" ? "↑" : "↓"}</span>;
}

// ── 페이지네이션 ──────────────────────────────────────────────
function Pagination({
  total, page, size, onChange,
}: {
  total: number; page: number; size: number; onChange: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / size));
  if (totalPages <= 1) return null;

  const start = (page - 1) * size + 1;
  const end   = Math.min(page * size, total);

  // 보여줄 페이지 번호 (현재 주변 ±2)
  const pages: (number | "…")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 2 && i <= page + 2)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "…") {
      pages.push("…");
    }
  }

  return (
    <div className="flex items-center justify-between mt-4 px-1">
      <div className="text-xs text-gray-400">{start}–{end} / 총 {total}건</div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ‹ 이전
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="px-2 text-gray-400 text-xs">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p as number)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                p === page
                  ? "bg-blue-600 text-white border-blue-600"
                  : "text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          다음 ›
        </button>
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export default function LicensePanel() {
  const [records, setRecords]     = useState<SwDbRecord[]>([]);
  const [loading, setLoading]     = useState(true);
  const [lastSynced, setLastSynced] = useState("");
  const [error, setError]         = useState<string | null>(null);

  // 탭
  const [tab, setTab] = useState<"dashboard" | "detail">("dashboard");

  // 필터 상태
  const [search, setSearch]               = useState("");
  const [filterType, setFilterType]       = useState("전체");
  const [filterSw, setFilterSw]           = useState("전체");
  const [filterStatus, setFilterStatus]   = useState("전체");
  const [filterCompany, setFilterCompany] = useState("전체");
  const [filterDept, setFilterDept]       = useState("전체");
  const [showExpiringSoon, setShowExpiringSoon] = useState(false);

  // 정렬 상태
  const [sortKey, setSortKey]   = useState<SortKey>("swCategory");
  const [sortDir, setSortDir]   = useState<"asc" | "desc">("asc");

  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetch("/api/sw-records")
      .then((r) => r.json())
      .then((res) => {
        setRecords(res.data ?? []);
        setLastSynced(res.lastSynced ?? "");
        if (res.error) setError(res.error);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // 필터 변경 시 페이지 리셋
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterType, filterSw, filterStatus, filterCompany, filterDept, showExpiringSoon]);

  // 집계
  const summary = useMemo(() => {
    const total    = records.length;
    const using    = records.filter((r) => r.status === "사용중").length;
    const stock    = records.filter((r) => r.status === "재고").length;
    const expired  = records.filter((r) => r.status === "만료").length;
    const renewing = records.filter((r) => r.status === "갱신필요").length;
    const expiring = records.filter((r) => {
      const d = daysLeft(r.renewalDate);
      return d !== null && d >= 0 && d <= 30 && r.status !== "갱신필요";
    }).length;
    return { total, using, stock, expired, renewing, expiring };
  }, [records]);

  // SW별 대시보드 집계
  const swList = useMemo(() => {
    const names = [...new Set(records.map((r) => r.swCategory).filter(Boolean))].sort();
    return names.map((name) => {
      const recs = records.filter((r) => r.swCategory === name);
      return {
        name,
        total:    recs.length,
        using:    recs.filter((r) => r.status === "사용중").length,
        stock:    recs.filter((r) => r.status === "재고").length,
        expired:  recs.filter((r) => r.status === "만료").length,
        renewing: recs.filter((r) => r.status === "갱신필요").length,
      };
    });
  }, [records]);

  // 필터 옵션
  const typeOptions    = useMemo(() => ["전체", "영구", "구독(업체)", "구독(웹)"], []);
  const swOptions      = useMemo(() => ["전체", ...new Set(records.map((r) => r.swCategory).filter(Boolean))].sort(), [records]);
  const companyOptions = useMemo(() => ["전체", ...new Set(records.map((r) => r.company).filter(Boolean))].sort(), [records]);
  const statusOptions  = useMemo(() => ["전체", ...new Set(records.map((r) => r.status).filter(Boolean))], [records]);
  const deptOptions    = useMemo(() => ["전체", ...new Set(records.map((r) => r.department).filter(Boolean))].sort(), [records]);

  // 필터된 레코드
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return records.filter((r) => {
      if (filterType !== "전체" && r.licenseType !== filterType) return false;
      if (filterSw !== "전체" && r.swCategory !== filterSw) return false;
      if (filterStatus !== "전체" && r.status !== filterStatus) return false;
      if (filterCompany !== "전체" && r.company !== filterCompany) return false;
      if (filterDept !== "전체" && r.department !== filterDept) return false;
      if (showExpiringSoon) {
        const d = daysLeft(r.renewalDate);
        if (d === null || d < 0 || d > 30) return false;
      }
      if (q) {
        return (
          r.user.toLowerCase().includes(q) ||
          r.swCategory.toLowerCase().includes(q) ||
          r.swDetail.toLowerCase().includes(q) ||
          r.department.toLowerCase().includes(q) ||
          r.company.toLowerCase().includes(q) ||
          r.licenseKey.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [records, search, filterType, filterSw, filterStatus, filterCompany, filterDept, showExpiringSoon]);

  // 정렬
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av = (a[sortKey] ?? "") as string;
      let bv = (b[sortKey] ?? "") as string;
      // 배열 타입(version 등)은 첫번째만 사용
      if (Array.isArray(av)) av = (av as string[])[0] ?? "";
      if (Array.isArray(bv)) bv = (bv as string[])[0] ?? "";
      const cmp = av.localeCompare(bv, "ko");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  // 페이지네이션
  const paginated = useMemo(() => {
    return sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  }, [sorted, currentPage]);

  function toggleSort(col: SortKey) {
    if (sortKey === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(col);
      setSortDir("asc");
    }
  }

  // 활성 필터 태그
  const activeFilters: { label: string; clear: () => void }[] = [];
  if (filterType !== "전체")    activeFilters.push({ label: `유형: ${filterType}`, clear: () => setFilterType("전체") });
  if (filterSw !== "전체")      activeFilters.push({ label: `SW: ${filterSw}`, clear: () => setFilterSw("전체") });
  if (filterStatus !== "전체")  activeFilters.push({ label: `상태: ${filterStatus}`, clear: () => setFilterStatus("전체") });
  if (filterCompany !== "전체") activeFilters.push({ label: `법인: ${filterCompany}`, clear: () => setFilterCompany("전체") });
  if (filterDept !== "전체")    activeFilters.push({ label: `부서: ${filterDept}`, clear: () => setFilterDept("전체") });
  if (showExpiringSoon)         activeFilters.push({ label: "갱신 임박 30일", clear: () => setShowExpiringSoon(false) });
  if (search)                   activeFilters.push({ label: `검색: "${search}"`, clear: () => setSearch("") });

  function resetAllFilters() {
    setSearch("");
    setFilterType("전체");
    setFilterSw("전체");
    setFilterStatus("전체");
    setFilterCompany("전체");
    setFilterDept("전체");
    setShowExpiringSoon(false);
  }

  const thClass = "px-3 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap select-none cursor-pointer hover:text-gray-800 hover:bg-gray-100 transition-colors";
  const thStaticClass = "px-3 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap";

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <div className="text-gray-400 text-sm">노션에서 SW 데이터를 불러오는 중…</div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-0.5">라이선스 현황</h2>
          <p className="text-sm text-gray-500">전사 SW 라이선스 현황 — SW 데이터베이스 기준</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          마지막 동기화: {lastSynced ? new Date(lastSynced).toLocaleString("ko-KR") : "—"}
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          ⚠ {error}
        </div>
      )}

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <SummaryCard label="전체 레코드"     value={summary.total}    color="border-l-gray-300" />
        <SummaryCard label="사용중"           value={summary.using}    color="border-l-blue-500"
          sub={`${summary.total > 0 ? Math.round((summary.using / summary.total) * 100) : 0}% 사용`} />
        <SummaryCard label="재고"             value={summary.stock}    color="border-l-green-500" />
        <SummaryCard label="갱신 필요"        value={summary.renewing} color="border-l-red-500"   sub="갱신 처리 필요" />
        <SummaryCard label="만료"             value={summary.expired}  color="border-l-gray-400" />
        <SummaryCard label="갱신 임박 (30일)" value={summary.expiring} color="border-l-orange-400" sub="주의 필요" />
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {([["dashboard", "📊 SW별 현황"], ["detail", "🔍 상세 검색"]] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === id
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 탭: SW별 현황 */}
      {tab === "dashboard" && (
        <div>
          {swList.length === 0 ? (
            <div className="text-center py-20 text-gray-400">데이터가 없습니다</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {swList.map((sw) => <SwStatusCard key={sw.name} {...sw} />)}
            </div>
          )}
        </div>
      )}

      {/* 탭: 상세 검색 */}
      {tab === "detail" && (
        <div>
          {/* ── 필터 영역 ── */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
            {/* 검색 + 갱신임박 토글 */}
            <div className="flex flex-wrap gap-2 mb-3">
              <div className="relative flex-1 min-w-[200px]">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  type="text"
                  placeholder="이름, 부서, SW명, 인증키 검색…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">✕</button>
                )}
              </div>
              <button
                onClick={() => setShowExpiringSoon((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                  showExpiringSoon
                    ? "bg-red-600 text-white border-red-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-red-400 hover:text-red-600"
                }`}
              >
                ⏰ 갱신 임박 30일
              </button>
            </div>

            {/* 드롭다운 필터 5개 */}
            <div className="flex flex-wrap gap-2">
              {[
                { label: "유형", value: filterType,    options: typeOptions,    setter: setFilterType    },
                { label: "SW명", value: filterSw,      options: swOptions,      setter: setFilterSw      },
                { label: "상태", value: filterStatus,  options: statusOptions,  setter: setFilterStatus  },
                { label: "법인", value: filterCompany, options: companyOptions, setter: setFilterCompany },
                { label: "부서", value: filterDept,    options: deptOptions,    setter: setFilterDept    },
              ].map(({ label, value, options, setter }) => (
                <div key={label} className="relative">
                  <select
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    className={`appearance-none pl-3 pr-7 py-2 border rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-colors ${
                      value !== "전체"
                        ? "bg-blue-50 border-blue-300 text-blue-700"
                        : "bg-white border-gray-300 text-gray-600"
                    }`}
                  >
                    <option value="전체">{label}: 전체</option>
                    {options.filter((o) => o !== "전체").map((o) => <option key={o}>{o}</option>)}
                  </select>
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▾</span>
                </div>
              ))}

              {activeFilters.length > 0 && (
                <button
                  onClick={resetAllFilters}
                  className="px-3 py-2 rounded-lg text-xs font-medium text-gray-500 border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                >
                  ✕ 필터 초기화
                </button>
              )}
            </div>

            {/* 활성 필터 태그 + 결과 수 */}
            {activeFilters.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-400 mr-1">적용된 필터:</span>
                {activeFilters.map((f) => (
                  <span
                    key={f.label}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium"
                  >
                    {f.label}
                    <button onClick={f.clear} className="hover:text-blue-900 font-bold text-blue-500">✕</button>
                  </span>
                ))}
                <span className="ml-auto text-xs text-gray-400 font-medium">{filtered.length}건</span>
              </div>
            )}

            {activeFilters.length === 0 && (
              <div className="mt-2 text-right text-xs text-gray-400">{records.length}건 전체</div>
            )}
          </div>

          {/* ── 테이블 ── */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-auto shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className={thClass} onClick={() => toggleSort("swCategory")}>
                    SW <SortIcon col="swCategory" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th className={thClass} onClick={() => toggleSort("licenseType")}>
                    유형 <SortIcon col="licenseType" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th className={thStaticClass}>버전</th>
                  <th className={thClass} onClick={() => toggleSort("user")}>
                    사용자 <SortIcon col="user" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th className={thClass} onClick={() => toggleSort("department")}>
                    부서 <SortIcon col="department" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th className={thClass} onClick={() => toggleSort("company")}>
                    법인 <SortIcon col="company" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th className={thClass} onClick={() => toggleSort("status")}>
                    상태 <SortIcon col="status" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th className={thClass} onClick={() => toggleSort("renewalDate")}>
                    갱신 필요일 <SortIcon col="renewalDate" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th className={thClass} onClick={() => toggleSort("usageDate")}>
                    사용일자 <SortIcon col="usageDate" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th className={thStaticClass}>노션</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-gray-400">
                      {filtered.length === 0 ? "검색 결과가 없습니다" : "페이지 범위를 벗어났습니다"}
                    </td>
                  </tr>
                ) : (
                  paginated.map((r) => {
                    const days = daysLeft(r.renewalDate);
                    const isExpiring = days !== null && days >= 0 && days <= 30;
                    return (
                      <tr key={r.id} className="border-b border-gray-50 hover:bg-blue-50/40 transition-colors">
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="font-semibold text-gray-900 text-xs">{r.swCategory || "—"}</div>
                          {r.swDetail && <div className="text-xs text-gray-400">{r.swDetail}</div>}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <TypeBadge type={r.licenseType} />
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-600">
                          {r.version.length > 0 ? r.version.join(", ") : "—"}
                        </td>
                        <td className="px-3 py-3 text-xs">
                          <div className="font-medium text-gray-900">{r.user || "재고"}</div>
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-500">{r.department || "—"}</td>
                        <td className="px-3 py-3 text-xs text-gray-600">{r.company || "—"}</td>
                        <td className="px-3 py-3">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="px-3 py-3 text-xs whitespace-nowrap">
                          {r.renewalDate ? (
                            <span className={
                              r.status === "만료" ? "text-gray-400" :
                              isExpiring ? "text-red-600 font-semibold" :
                              "text-gray-600"
                            }>
                              {fmtDate(r.renewalDate)}
                              {isExpiring && days !== null && (
                                <span className="ml-1 bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full text-xs">
                                  D-{days}
                                </span>
                              )}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-500">{fmtDate(r.usageDate)}</td>
                        <td className="px-3 py-3">
                          {r.notionUrl ? (
                            <a href={r.notionUrl} target="_blank" rel="noopener noreferrer"
                              className="text-blue-500 hover:text-blue-700 text-xs underline">
                              보기
                            </a>
                          ) : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          <Pagination
            total={filtered.length}
            page={currentPage}
            size={PAGE_SIZE}
            onChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  );
}
