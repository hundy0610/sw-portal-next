"use client";

import { useEffect, useState, useMemo } from "react";
import type { SwDbRecord } from "@/types";

const PAGE_SIZE = 30;

// ── SW 매크로 카테고리 ──────────────────────────────────────────────────
const SW_CAT_RULES: {
  label: string; icon: string; color: string; bg: string; chartColor: string; keywords: string[];
}[] = [
  {
    label: "문서작업용", icon: "📝", color: "text-blue-700", bg: "bg-blue-50", chartColor: "#3B82F6",
    keywords: ["office","word","excel","powerpoint","365","한컴","hwp","acrobat","pdf","한글","한셀","한쇼","thinkfree","docs","sheets","slides"],
  },
  {
    label: "AI 툴", icon: "🤖", color: "text-violet-700", bg: "bg-violet-50", chartColor: "#8B5CF6",
    keywords: ["copilot","chatgpt","gpt","claude","midjourney","cursor","tabnine","gemini","codeium","ai","stable diffusion"],
  },
  {
    label: "개발 툴", icon: "💻", color: "text-emerald-700", bg: "bg-emerald-50", chartColor: "#10B981",
    keywords: ["vscode","vs code","intellij","pycharm","eclipse","xcode","git","github","gitlab","docker","postman","dbeaver","sourcetree","datagrip","rider","goland","clion","webstorm","터미널","terminal"],
  },
  {
    label: "협업 툴", icon: "🤝", color: "text-orange-700", bg: "bg-orange-50", chartColor: "#F97316",
    keywords: ["notion","slack","teams","zoom","webex","google meet","trello","asana","monday","카카오워크","miro","confluence","jira"],
  },
  {
    label: "디자인 툴", icon: "🎨", color: "text-pink-700", bg: "bg-pink-50", chartColor: "#EC4899",
    keywords: ["figma","photoshop","illustrator","indesign","adobe cc","adobe creative","sketch","after effects","premiere","lightroom","xd","canva","blender"],
  },
  {
    label: "보안/관리", icon: "🛡️", color: "text-red-700", bg: "bg-red-50", chartColor: "#EF4444",
    keywords: ["v3","ahnlab","vpn","lastpass","1password","norton","kaspersky","dlp","endpoint","antivirus","백신","보안"],
  },
];

const EXTRA_CAT = { label: "기타", icon: "📦", color: "text-gray-700", bg: "bg-gray-50", chartColor: "#9CA3AF" };

function getSwMacroCategory(swName: string) {
  if (!swName) return EXTRA_CAT;
  const lower = swName.toLowerCase();
  for (const rule of SW_CAT_RULES) {
    if (rule.keywords.some(kw => lower.includes(kw))) return rule;
  }
  return EXTRA_CAT;
}

// ── 상태 스타일 ─────────────────────────────────────────────────────────
const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string; chartColor: string }> = {
  "사용중":     { bg: "bg-blue-50",   text: "text-blue-700",   dot: "bg-blue-500",   chartColor: "#3B82F6" },
  "재고":       { bg: "bg-green-50",  text: "text-green-700",  dot: "bg-green-500",  chartColor: "#10B981" },
  "갱신필요":   { bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-400", chartColor: "#F97316" },
  "만료":       { bg: "bg-gray-100",  text: "text-gray-500",   dot: "bg-gray-400",   chartColor: "#9CA3AF" },
  "신규등록":   { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500", chartColor: "#8B5CF6" },
  "반납예정":   { bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-400", chartColor: "#EAB308" },
  "출고준비중": { bg: "bg-cyan-50",   text: "text-cyan-700",   dot: "bg-cyan-400",   chartColor: "#06B6D4" },
  "임시지급":   { bg: "bg-sky-50",    text: "text-sky-700",    dot: "bg-sky-400",    chartColor: "#0EA5E9" },
  "미확인":     { bg: "bg-gray-50",   text: "text-gray-400",   dot: "bg-gray-300",   chartColor: "#D1D5DB" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { bg: "bg-gray-100", text: "text-gray-500", dot: "bg-gray-400", chartColor: "#9CA3AF" };
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

function fmtDate(d?: string) { return d ? d.slice(0, 10) : "—"; }
function daysLeft(d?: string): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

// ── SVG 도넛 차트 ───────────────────────────────────────────────────────
interface DonutSegment { label: string; value: number; color: string; icon?: string; }

function DonutChart({ data }: { data: DonutSegment[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = 50, cx = 60, cy = 60;
  const C = 2 * Math.PI * r;
  let cumOffset = 0;
  const segs = data.filter(d => d.value > 0).map(d => {
    const len = total > 0 ? (d.value / total) * C : 0;
    const startOff = cumOffset;
    cumOffset += len;
    return { ...d, len, startOff };
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
                strokeDashoffset={-s.startOff}
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            ))
        }
        <text x="60" y="55" textAnchor="middle" fontSize="15" fontWeight="700" fill="#111827">{total.toLocaleString()}</text>
        <text x="60" y="70" textAnchor="middle" fontSize="9" fill="#9CA3AF">전체</text>
      </svg>
      <div className="flex flex-col gap-1.5 min-w-0">
        {segs.map(s => (
          <div key={s.label} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
            <span className="text-gray-600 flex-1 max-w-[110px] truncate">{s.icon} {s.label}</span>
            <span className="font-bold text-gray-900 ml-1 shrink-0">{s.value}</span>
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
function HorizBarChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex flex-col gap-2.5">
      {data.filter(d => d.value > 0).map(d => (
        <div key={d.label} className="flex items-center gap-2 text-xs">
          <span className="text-gray-600 w-20 shrink-0 truncate">{d.label}</span>
          <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-2.5 rounded-full"
              style={{ width: `${(d.value / max) * 100}%`, background: d.color, transition: "width 0.5s ease" }}
            />
          </div>
          <span className="font-semibold text-gray-800 w-6 text-right shrink-0">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── 정렬 아이콘 ─────────────────────────────────────────────────────────
type SortKey = "swCategory" | "licenseType" | "department" | "user" | "company" | "status" | "renewalDate" | "usageDate";

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: "asc" | "desc" }) {
  if (sortKey !== col) return <span className="ml-0.5 text-gray-300">↕</span>;
  return <span className="ml-0.5 text-blue-600">{sortDir === "asc" ? "↑" : "↓"}</span>;
}

// ── 페이지네이션 ────────────────────────────────────────────────────────
function Pagination({ total, page, size, onChange }: {
  total: number; page: number; size: number; onChange: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / size));
  if (totalPages <= 1) return null;
  const start = (page - 1) * size + 1;
  const end = Math.min(page * size, total);
  const pages: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }
  const btn = "w-8 h-8 rounded-lg text-xs flex items-center justify-center transition-colors";
  return (
    <div className="flex items-center justify-between mt-4">
      <span className="text-xs text-gray-400">{start}–{end} / {total}건</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(page - 1)} disabled={page === 1}
          className={`${btn} border border-gray-200 ${page === 1 ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-100"}`}>‹</button>
        {pages.map((p, i) => p === "…"
          ? <span key={`e${i}`} className="w-8 text-center text-xs text-gray-400">…</span>
          : <button key={p} onClick={() => onChange(p as number)}
              className={`${btn} ${page === p ? "bg-blue-600 text-white" : "border border-gray-200 hover:bg-gray-100 text-gray-600"}`}>
              {p}
            </button>
        )}
        <button onClick={() => onChange(page + 1)} disabled={page === totalPages}
          className={`${btn} border border-gray-200 ${page === totalPages ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-100"}`}>›</button>
      </div>
    </div>
  );
}

// ── 카테고리 아코디언 뷰 ────────────────────────────────────────────────
interface SwGroup { swName: string; records: SwDbRecord[]; using: number; stock: number; expired: number; renewal: number; urgent: number; minDays: number | null; }
interface CatGroup { label: string; icon: string; color: string; bg: string; swGroups: SwGroup[]; totalRecs: number; usingRecs: number; urgentRecs: number; }

function CategoryView({ records }: { records: SwDbRecord[] }) {
  const [expandedSw, setExpandedSw] = useState<string | null>(null);

  const catGroups = useMemo<CatGroup[]>(() => {
    const catMap: Record<string, SwDbRecord[]> = {};
    for (const r of records) {
      const { label } = getSwMacroCategory(r.swCategory);
      if (!catMap[label]) catMap[label] = [];
      catMap[label].push(r);
    }
    const ORDER = ["문서작업용", "AI 툴", "개발 툴", "협업 툴", "디자인 툴", "보안/관리", "기타"];
    return ORDER.filter(label => catMap[label]).map(label => {
      const info = label === "기타" ? EXTRA_CAT : (SW_CAT_RULES.find(r => r.label === label) ?? EXTRA_CAT);
      const recs = catMap[label];
      const swMap: Record<string, SwDbRecord[]> = {};
      for (const r of recs) {
        const key = r.swCategory || "알 수 없음";
        if (!swMap[key]) swMap[key] = [];
        swMap[key].push(r);
      }
      const swGroups: SwGroup[] = Object.entries(swMap).map(([swName, swRecs]) => {
        const using   = swRecs.filter(r => r.status === "사용중" || r.status === "신규등록").length;
        const stock   = swRecs.filter(r => r.status === "재고" || r.status === "출고준비중").length;
        const expired = swRecs.filter(r => r.status === "만료").length;
        const renewal = swRecs.filter(r => r.status === "갱신필요").length;
        const days    = swRecs.map(r => daysLeft(r.renewalDate)).filter((d): d is number => d !== null && d >= 0);
        const urgent  = days.filter(d => d <= 30).length;
        const minDays = days.length > 0 ? Math.min(...days) : null;
        return { swName, records: swRecs, using, stock, expired, renewal, urgent, minDays };
      }).sort((a, b) => (b.using + b.stock) - (a.using + a.stock));
      return {
        label, icon: info.icon, color: info.color, bg: info.bg, swGroups,
        totalRecs: recs.length,
        usingRecs: recs.filter(r => r.status === "사용중" || r.status === "신규등록").length,
        urgentRecs: recs.filter(r => { const d = daysLeft(r.renewalDate); return d !== null && d >= 0 && d <= 30; }).length,
      };
    });
  }, [records]);

  if (records.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <div className="text-3xl mb-2">📋</div>
        <div>조건에 맞는 데이터가 없습니다.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {catGroups.map(cat => (
        <div key={cat.label}>
          <div
            className={`flex items-center justify-between px-4 py-3 rounded-t-xl border border-b-0 ${cat.bg}`}
            style={{ borderColor: "rgba(0,0,0,0.08)" }}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{cat.icon}</span>
              <span className={`font-bold text-sm ${cat.color}`}>{cat.label}</span>
              <span className="text-xs text-gray-400">{cat.swGroups.length}종</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-gray-500">총 <strong>{cat.totalRecs}</strong>건</span>
              <span className="text-blue-600">사용중 <strong>{cat.usingRecs}</strong></span>
              {cat.urgentRecs > 0 && (
                <span className="text-red-600 font-semibold bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                  ⚠ 갱신임박 {cat.urgentRecs}건
                </span>
              )}
            </div>
          </div>
          <div className="border border-gray-200 rounded-b-xl overflow-hidden bg-white">
            {cat.swGroups.map((sw, idx) => {
              const isExpanded = expandedSw === `${cat.label}::${sw.swName}`;
              const key = `${cat.label}::${sw.swName}`;
              return (
                <div key={sw.swName} className={idx > 0 ? "border-t border-gray-100" : ""}>
                  <div
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer group"
                    onClick={() => setExpandedSw(isExpanded ? null : key)}
                  >
                    <span className="w-2 h-2 rounded-full bg-gray-300 group-hover:bg-blue-400 transition-colors shrink-0" />
                    <span className="font-semibold text-sm text-gray-900 flex-1 min-w-0 truncate">{sw.swName}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {sw.using > 0 && <span className="text-xs text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full font-semibold">사용중 {sw.using}</span>}
                      {sw.stock > 0 && <span className="text-xs text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full font-semibold">재고 {sw.stock}</span>}
                      {sw.renewal > 0 && <span className="text-xs text-orange-700 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-full font-semibold">갱신필요 {sw.renewal}</span>}
                      {sw.expired > 0 && <span className="text-xs text-gray-400 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full">만료 {sw.expired}</span>}
                      {sw.minDays !== null && sw.minDays <= 30 && sw.minDays >= 0 && (
                        <span className="text-xs text-red-600 font-bold bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">D-{sw.minDays}</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 w-10 text-right shrink-0">{sw.records.length}건</span>
                    <svg className={`text-gray-400 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </div>
                  {isExpanded && (
                    <div className="bg-gray-50 border-t border-gray-100 px-4 py-3">
                      <div className="text-xs text-gray-500 font-semibold mb-2.5">📋 세부 내역 ({sw.records.length}건)</div>
                      <div className="flex flex-col gap-1.5">
                        {sw.records.map(r => {
                          const days = daysLeft(r.renewalDate);
                          const isUrgent = days !== null && days >= 0 && days <= 30;
                          return (
                            <div key={r.id}
                              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs ${isUrgent ? "bg-red-50 border border-red-100" : "bg-white border border-gray-100"}`}>
                              <StatusBadge status={r.status} />
                              <span className="font-semibold text-gray-800 min-w-[60px]">{r.user || "재고"}</span>
                              <span className="text-gray-400">{r.department || "—"}</span>
                              <span className="text-gray-400">{r.company || "—"}</span>
                              <div className="ml-auto flex items-center gap-2">
                                {r.swDetail && <span className="text-gray-400">{r.swDetail}</span>}
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
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 메인 컴포넌트 ───────────────────────────────────────────────────────
export default function LicensePanel() {
  const [records,  setRecords]  = useState<SwDbRecord[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [mainTab,  setMainTab]  = useState<"analytics" | "search">("analytics");
  const [detailView, setDetailView] = useState<"category" | "list">("category");

  // 필터 상태
  const [search,          setSearch]          = useState("");
  const [filterMacrocat,  setFilterMacrocat]  = useState("전체");
  const [filterStatus,    setFilterStatus]    = useState("전체");
  const [filterType,      setFilterType]      = useState("전체");
  const [filterCompany,   setFilterCompany]   = useState("전체");
  const [filterDept,      setFilterDept]      = useState("전체");
  const [showExpiringSoon, setShowExpiringSoon] = useState(false);

  // 정렬 / 페이지
  const [sortKey,      setSortKey]      = useState<SortKey>("swCategory");
  const [sortDir,      setSortDir]      = useState<"asc" | "desc">("asc");
  const [currentPage,  setCurrentPage]  = useState(1);

  useEffect(() => {
    fetch("/api/sw-records")
      .then(r => r.json())
      .then(res => setRecords(res.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterMacrocat, filterStatus, filterType, filterCompany, filterDept, showExpiringSoon]);

  // ── 통계 ────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:    records.length,
    using:    records.filter(r => r.status === "사용중" || r.status === "신규등록").length,
    stock:    records.filter(r => r.status === "재고").length,
    expiring: records.filter(r => { const d = daysLeft(r.renewalDate); return d !== null && d >= 0 && d <= 30; }).length,
    expired:  records.filter(r => r.status === "만료").length,
  }), [records]);

  // ── 차트 데이터 ─────────────────────────────────────────────────────
  const catChartData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of records) {
      const { label } = getSwMacroCategory(r.swCategory);
      map[label] = (map[label] ?? 0) + 1;
    }
    const ORDER = ["문서작업용", "AI 툴", "개발 툴", "협업 툴", "디자인 툴", "보안/관리", "기타"];
    return ORDER.filter(l => map[l]).map(l => {
      const info = l === "기타" ? EXTRA_CAT : (SW_CAT_RULES.find(r => r.label === l) ?? EXTRA_CAT);
      return { label: l, value: map[l], color: info.chartColor, icon: info.icon };
    });
  }, [records]);

  const statusChartData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of records) { map[r.status] = (map[r.status] ?? 0) + 1; }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({
      label, value, color: STATUS_STYLE[label]?.chartColor ?? "#9CA3AF",
    }));
  }, [records]);

  // ── 카테고리 카드 데이터 ─────────────────────────────────────────────
  const catStats = useMemo(() => {
    const ORDER = ["문서작업용", "AI 툴", "개발 툴", "협업 툴", "디자인 툴", "보안/관리", "기타"];
    const map: Record<string, SwDbRecord[]> = {};
    for (const r of records) {
      const { label } = getSwMacroCategory(r.swCategory);
      if (!map[label]) map[label] = [];
      map[label].push(r);
    }
    return ORDER.map(label => {
      const info = label === "기타" ? EXTRA_CAT : (SW_CAT_RULES.find(r => r.label === label) ?? EXTRA_CAT);
      const recs = map[label] ?? [];
      const using  = recs.filter(r => r.status === "사용중" || r.status === "신규등록").length;
      const urgent = recs.filter(r => { const d = daysLeft(r.renewalDate); return d !== null && d >= 0 && d <= 30; }).length;
      return { ...info, total: recs.length, using, urgent };
    }).filter(c => c.total > 0);
  }, [records]);

  // ── 드롭다운 옵션 ───────────────────────────────────────────────────
  const statusOptions = useMemo(() => ["전체", ...Array.from(new Set(records.map(r => r.status).filter(Boolean)))], [records]);
  const typeOptions   = useMemo(() => ["전체", ...Array.from(new Set(records.map(r => r.licenseType).filter(Boolean)))], [records]);
  const companyOptions = useMemo(() => ["전체", ...Array.from(new Set(records.map(r => r.company).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ko"))], [records]);
  const deptOptions    = useMemo(() => ["전체", ...Array.from(new Set(records.map(r => r.department).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ko"))], [records]);
  const macroCatOptions = useMemo(() => {
    const cats = Array.from(new Set(records.map(r => getSwMacroCategory(r.swCategory).label)));
    return ["전체", ...["문서작업용","AI 툴","개발 툴","협업 툴","디자인 툴","보안/관리","기타"].filter(c => cats.includes(c))];
  }, [records]);

  // ── 필터링 ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => records.filter(r => {
    if (filterType      !== "전체" && r.licenseType !== filterType)    return false;
    if (filterStatus    !== "전체" && r.status      !== filterStatus)  return false;
    if (filterCompany   !== "전체" && r.company     !== filterCompany) return false;
    if (filterDept      !== "전체" && r.department  !== filterDept)    return false;
    if (filterMacrocat  !== "전체" && getSwMacroCategory(r.swCategory).label !== filterMacrocat) return false;
    if (showExpiringSoon) {
      const d = daysLeft(r.renewalDate);
      if (d === null || d < 0 || d > 30) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      if (![r.swCategory, r.swDetail, r.user, r.department, r.company, r.licenseType, r.status]
        .filter(Boolean).some(v => v.toLowerCase().includes(q))) return false;
    }
    return true;
  }), [records, filterType, filterStatus, filterCompany, filterDept, filterMacrocat, showExpiringSoon, search]);

  // ── 정렬 ───────────────────────────────────────────────────────────
  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    let av = (a[sortKey] ?? "") as string;
    let bv = (b[sortKey] ?? "") as string;
    if (Array.isArray(av)) av = (av as string[])[0] ?? "";
    if (Array.isArray(bv)) bv = (bv as string[])[0] ?? "";
    return sortDir === "asc" ? av.localeCompare(bv, "ko") : bv.localeCompare(av, "ko");
  }), [filtered, sortKey, sortDir]);

  const paginated = useMemo(() =>
    sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [sorted, currentPage]
  );

  function toggleSort(col: SortKey) {
    if (sortKey === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(col); setSortDir("asc"); }
  }

  const activeFilters = [
    { label: `분류: ${filterMacrocat}`,  active: filterMacrocat !== "전체",  clear: () => setFilterMacrocat("전체")  },
    { label: `유형: ${filterType}`,       active: filterType     !== "전체",  clear: () => setFilterType("전체")      },
    { label: `상태: ${filterStatus}`,     active: filterStatus   !== "전체",  clear: () => setFilterStatus("전체")    },
    { label: `법인: ${filterCompany}`,    active: filterCompany  !== "전체",  clear: () => setFilterCompany("전체")   },
    { label: `부서: ${filterDept}`,       active: filterDept     !== "전체",  clear: () => setFilterDept("전체")      },
    { label: "갱신임박 30일",              active: showExpiringSoon,            clear: () => setShowExpiringSoon(false) },
  ].filter(f => f.active);

  function resetFilters() {
    setSearch(""); setFilterMacrocat("전체"); setFilterType("전체");
    setFilterStatus("전체"); setFilterCompany("전체"); setFilterDept("전체"); setShowExpiringSoon(false);
  }

  const thB = "px-3 py-2.5 text-left text-xs font-semibold text-gray-500 select-none cursor-pointer hover:text-blue-600 whitespace-nowrap";
  const thS = "px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap";

  if (loading) return <div className="text-center py-20 text-gray-400">Notion 데이터 로딩 중...</div>;

  return (
    <div className="fade-in">
      {/* ── 헤더 ── */}
      <div className="mb-5">
        <h2 className="text-xl font-bold text-gray-900 mb-0.5">라이선스 현황</h2>
        <p className="text-sm text-gray-500">SW 라이선스 사용 현황 (Notion 실시간 연동)</p>
      </div>

      {/* ── KPI 카드 ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {[
          { label: "전체",     value: stats.total,    accent: "border-l-gray-400",  txt: "text-gray-900" },
          { label: "사용중",   value: stats.using,    accent: "border-l-blue-500",  txt: "text-blue-700" },
          { label: "재고",     value: stats.stock,    accent: "border-l-green-500", txt: "text-green-700" },
          { label: "갱신임박", value: stats.expiring, accent: "border-l-red-500",   txt: stats.expiring > 0 ? "text-red-600" : "text-gray-400" },
          { label: "만료",     value: stats.expired,  accent: "border-l-gray-300",  txt: "text-gray-400" },
        ].map(s => (
          <div key={s.label} className={`bg-white border border-gray-200 rounded-xl p-4 border-l-4 ${s.accent}`}>
            <div className="text-xs text-gray-500 mb-1">{s.label}</div>
            <div className={`text-2xl font-bold ${s.txt}`}>{s.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* ── 탭 버튼 ── */}
      <div className="flex gap-1.5 mb-5">
        {([["analytics", "📊 현황 분석"], ["search", "🔍 상세 검색"]] as const).map(([tab, label]) => (
          <button key={tab} onClick={() => setMainTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all border ${
              mainTab === tab
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════
          Tab: 현황 분석
      ══════════════════════════════════ */}
      {mainTab === "analytics" && (
        <div className="space-y-5">
          {/* 차트 2개 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="text-sm font-bold text-gray-800 mb-4">📊 카테고리별 분포</div>
              <DonutChart data={catChartData} />
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="text-sm font-bold text-gray-800 mb-4">📈 상태별 현황</div>
              <HorizBarChart data={statusChartData} />
            </div>
          </div>

          {/* 카테고리 카드 그리드 */}
          <div>
            <div className="text-sm font-bold text-gray-800 mb-3">
              🗂️ 카테고리별 현황
              <span className="ml-2 text-xs font-normal text-gray-400">카드를 클릭하면 상세 검색으로 이동합니다</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {catStats.map(cat => (
                <button
                  key={cat.label}
                  onClick={() => { setMainTab("search"); setFilterMacrocat(cat.label); }}
                  className={`${cat.bg} rounded-xl p-4 text-left border hover:shadow-md transition-all group`}
                  style={{ borderColor: "rgba(0,0,0,0.07)" }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{cat.icon}</span>
                    <span className={`font-bold text-sm ${cat.color}`}>{cat.label}</span>
                  </div>
                  <div className="text-2xl font-extrabold text-gray-900 mb-1">{cat.total}</div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-blue-600">사용중 {cat.using}</span>
                    {cat.urgent > 0 && (
                      <span className="text-red-600 font-semibold">⚠ {cat.urgent}</span>
                    )}
                  </div>
                  <div className={`mt-2 text-xs ${cat.color} opacity-0 group-hover:opacity-100 transition-opacity font-medium`}>
                    상세 검색 →
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════
          Tab: 상세 검색
      ══════════════════════════════════ */}
      {mainTab === "search" && (
        <div>
          {/* 필터 영역 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14"
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="SW명, 사용자, 부서, 법인 검색..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && (
                  <button onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-base leading-none">×</button>
                )}
              </div>
              <button onClick={() => setShowExpiringSoon(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                  showExpiringSoon
                    ? "bg-red-600 text-white border-red-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-red-400 hover:text-red-600"
                }`}>
                ⏰ 갱신임박 30일
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "분류",  value: filterMacrocat, options: macroCatOptions, setter: setFilterMacrocat },
                { label: "유형",  value: filterType,     options: typeOptions,     setter: setFilterType     },
                { label: "상태",  value: filterStatus,   options: statusOptions,   setter: setFilterStatus   },
                { label: "법인",  value: filterCompany,  options: companyOptions,  setter: setFilterCompany  },
                { label: "부서",  value: filterDept,     options: deptOptions,     setter: setFilterDept     },
              ].map(({ label, value, options, setter }) => (
                <div key={label} className="relative">
                  <select value={value} onChange={e => setter(e.target.value)}
                    className={`appearance-none pl-3 pr-7 py-2 border rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-colors ${
                      value !== "전체"
                        ? "bg-blue-50 border-blue-300 text-blue-700"
                        : "bg-white border-gray-300 text-gray-600"
                    }`}>
                    <option value="전체">{label}: 전체</option>
                    {options.filter(o => o !== "전체").map(o => <option key={o}>{o}</option>)}
                  </select>
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▾</span>
                </div>
              ))}
              {activeFilters.length > 0 && (
                <button onClick={resetFilters}
                  className="px-3 py-2 rounded-lg text-xs font-medium text-gray-500 border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors">
                  × 필터 초기화
                </button>
              )}
            </div>
            {activeFilters.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-gray-100">
                <span className="text-xs text-gray-400 mr-1">적용된 필터:</span>
                {activeFilters.map(f => (
                  <span key={f.label} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                    {f.label}
                    <button onClick={f.clear} className="hover:text-blue-900 font-bold text-blue-500">×</button>
                  </span>
                ))}
                <span className="ml-auto text-xs text-gray-400 font-medium">{filtered.length}건</span>
              </div>
            )}
            {activeFilters.length === 0 && (
              <div className="text-right text-xs text-gray-400">{records.length}건 전체</div>
            )}
          </div>

          {/* 뷰 토글 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-1.5">
              {([["category", "📂 카테고리별"], ["list", "📋 전체 목록"]] as const).map(([v, label]) => (
                <button key={v} onClick={() => setDetailView(v)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all border ${
                    detailView === v
                      ? "bg-gray-800 text-white border-gray-800"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}>
                  {label}
                </button>
              ))}
            </div>
            <span className="text-xs text-gray-400">{filtered.length}건 조회됨</span>
          </div>

          {/* 카테고리별 뷰 */}
          {detailView === "category" && <CategoryView records={filtered} />}

          {/* 전체 목록 뷰 */}
          {detailView === "list" && (
            <>
              <div className="bg-white border border-gray-200 rounded-xl overflow-auto shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className={thB} onClick={() => toggleSort("swCategory")}>SW <SortIcon col="swCategory" sortKey={sortKey} sortDir={sortDir} /></th>
                      <th className={thB} onClick={() => toggleSort("licenseType")}>유형 <SortIcon col="licenseType" sortKey={sortKey} sortDir={sortDir} /></th>
                      <th className={thS}>버전</th>
                      <th className={thB} onClick={() => toggleSort("user")}>사용자 <SortIcon col="user" sortKey={sortKey} sortDir={sortDir} /></th>
                      <th className={thB} onClick={() => toggleSort("department")}>부서 <SortIcon col="department" sortKey={sortKey} sortDir={sortDir} /></th>
                      <th className={thB} onClick={() => toggleSort("company")}>법인 <SortIcon col="company" sortKey={sortKey} sortDir={sortDir} /></th>
                      <th className={thB} onClick={() => toggleSort("status")}>상태 <SortIcon col="status" sortKey={sortKey} sortDir={sortDir} /></th>
                      <th className={thB} onClick={() => toggleSort("renewalDate")}>갱신일 <SortIcon col="renewalDate" sortKey={sortKey} sortDir={sortDir} /></th>
                      <th className={thS}>노션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-12 text-gray-400">검색 결과가 없습니다</td>
                      </tr>
                    ) : paginated.map(r => {
                      const days = daysLeft(r.renewalDate);
                      const isExpiring = days !== null && days >= 0 && days <= 30;
                      return (
                        <tr key={r.id} className="border-b border-gray-50 hover:bg-blue-50/40 transition-colors">
                          <td className="px-3 py-3 whitespace-nowrap">
                            <div className="font-semibold text-gray-900 text-xs">{r.swCategory || "—"}</div>
                            {r.swDetail && <div className="text-xs text-gray-400">{r.swDetail}</div>}
                          </td>
                          <td className="px-3 py-3"><TypeBadge type={r.licenseType} /></td>
                          <td className="px-3 py-3 text-xs text-gray-600">{(r.version ?? []).length > 0 ? r.version.join(", ") : "—"}</td>
                          <td className="px-3 py-3 text-xs font-medium text-gray-900">{r.user || "재고"}</td>
                          <td className="px-3 py-3 text-xs text-gray-500">{r.department || "—"}</td>
                          <td className="px-3 py-3 text-xs text-gray-600">{r.company || "—"}</td>
                          <td className="px-3 py-3"><StatusBadge status={r.status} /></td>
                          <td className="px-3 py-3 text-xs whitespace-nowrap">
                            {r.renewalDate ? (
                              <span className={
                                r.status === "만료" ? "text-gray-400" :
                                isExpiring ? "text-red-600 font-semibold" : "text-gray-600"
                              }>
                                {fmtDate(r.renewalDate)}
                                {isExpiring && days !== null && (
                                  <span className="ml-1 bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full text-xs">D-{days}</span>
                                )}
                              </span>
                            ) : "—"}
                          </td>
                          <td className="px-3 py-3">
                            {r.notionUrl
                              ? <a href={r.notionUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 text-xs underline">보기</a>
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination total={filtered.length} page={currentPage} size={PAGE_SIZE} onChange={setCurrentPage} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
