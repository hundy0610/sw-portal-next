"use client";

import { useEffect, useState, useMemo } from "react";
import type { SwItem, SwDbRecord } from "@/types";
import EnvVarMissing from "@/components/ui/EnvVarMissing";
import { scGet, scSet } from "@/lib/session-cache";
import { safeJson } from "@/lib/fetch-json";

const SC_SWDB  = "sc:overview:swdb";
const SC_SWREC = (co: string) => `sc:overview:swrec${co ? `:${co}` : ""}`;
const TTL_SWDB  = 10 * 60 * 1000;
const TTL_SWREC =  5 * 60 * 1000;

// ── 색상 상수 ─────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  "사용중": "#3B82F6", "신규등록": "#8B5CF6", "재고": "#10B981",
  "출고준비중": "#06B6D4", "갱신필요": "#F97316", "반납예정": "#EAB308",
  "만료": "#9CA3AF", "미확인": "#D1D5DB",
};
const TYPE_COLORS: Record<string, string> = {
  "영구": "#3B82F6", "구독(업체)": "#8B5CF6", "구독(웹)": "#06B6D4",
};
const PALETTE = [
  "#6366f1","#f59e0b","#10b981","#ef4444","#3b82f6","#8b5cf6",
  "#ec4899","#14b8a6","#f97316","#84cc16","#06b6d4","#a855f7",
];

// ── SW 매크로 카테고리 ─────────────────────────────────────────
const SW_CAT_RULES: { label: string; icon: string; color: string; keywords: string[] }[] = [
  { label: "문서작업용", icon: "📝", color: "#3B82F6",
    keywords: ["office","word","excel","powerpoint","365","한글","hwp","acrobat","pdf","한셀","한쇼","thinkfree","docs","sheets","slides","hancom","libreoffice","foxit"] },
  { label: "AI 툴",    icon: "🤖", color: "#8B5CF6",
    keywords: ["copilot","chatgpt","gpt","claude","midjourney","cursor","tabnine","gemini","codeium","stable diffusion","ai","wrtn"] },
  { label: "개발 툴",  icon: "💻", color: "#10B981",
    keywords: ["vscode","vs code","intellij","pycharm","eclipse","xcode","git","github","gitlab","docker","postman","dbeaver","sourcetree","datagrip","rider","goland","webstorm"] },
  { label: "협업 툴",  icon: "🤝", color: "#F97316",
    keywords: ["notion","slack","teams","zoom","webex","google meet","trello","asana","monday","카카오워크","miro","confluence","jira","dooray"] },
  { label: "디자인 툴", icon: "🎨", color: "#EC4899",
    keywords: ["figma","photoshop","illustrator","indesign","adobe cc","adobe creative","sketch","after effects","premiere","lightroom","canva","zeplin","invision"] },
  { label: "보안/관리", icon: "🛡️", color: "#EF4444",
    keywords: ["v3","ahnlab","알약","antivirus","vpn","dlp","endpoint","mcafee","symantec","fortinet","crowdstrike","wireshark","nessus"] },
];
const EXTRA_CAT = { label: "기타", icon: "📦", color: "#9CA3AF" };

function getMacroCategory(name?: string) {
  if (!name) return EXTRA_CAT;
  const lower = name.toLowerCase();
  for (const r of SW_CAT_RULES) {
    if (r.keywords.some(k => lower.includes(k))) return r;
  }
  return EXTRA_CAT;
}

// ── Donut Chart ───────────────────────────────────────────────
interface DonutSeg { label: string; value: number; color: string; icon?: string }

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
                <circle key={s.label} cx={cx} cy={cy} r={r} fill="none"
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
                {hoverSeg.label.length > 6 ? hoverSeg.label.slice(0,5)+"…" : hoverSeg.label}
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
          <div key={s.label}
            className={`flex items-center gap-2 text-xs rounded px-2 py-0.5 cursor-pointer transition-colors ${hovered === s.label ? "bg-gray-100" : "hover:bg-gray-50"}`}
            onMouseEnter={() => setHovered(s.label)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
            <span className="text-gray-600 flex-1 truncate">{s.icon ? `${s.icon} ` : ""}{s.label}</span>
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

// ── 수평 막대 차트 ────────────────────────────────────────────
function HBarChart({ data, maxShow = 10 }: {
  data: { label: string; value: number; color: string; sub?: string }[];
  maxShow?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const shown = (showAll ? data : data.slice(0, maxShow)).filter(d => d.value > 0);
  const max = data[0]?.value ?? 1;
  return (
    <div className="flex flex-col gap-2">
      {shown.map(d => {
        const pct = Math.max(3, Math.round((d.value / max) * 100));
        return (
          <div key={d.label} className="flex items-center gap-2.5">
            <div className="w-28 shrink-0 text-right text-xs text-gray-600 font-medium truncate" title={d.label}>{d.label}</div>
            <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: d.color || "#3B82F6" }} />
            </div>
            <div className="w-12 shrink-0 text-right">
              <span className="text-xs font-bold text-gray-800">{d.value}</span>
              {d.sub && <span className="text-xs text-gray-400 ml-1">{d.sub}</span>}
            </div>
          </div>
        );
      })}
      {data.length > maxShow && (
        <button onClick={() => setShowAll(v => !v)}
          className="text-xs text-gray-400 hover:text-blue-600 py-1 text-center transition-colors">
          {showAll ? "▲ 줄이기" : `▼ 더 보기 (${data.filter(d => d.value > 0).length - maxShow}개)`}
        </button>
      )}
    </div>
  );
}

function LoadingBox() {
  return <div className="h-32 flex items-center justify-center text-xs text-gray-400">불러오는 중...</div>;
}

// ── 차트 탭 옵션 ──────────────────────────────────────────────
const CHART_TABS = [
  { id: "category", label: "카테고리별", icon: "📂" },
  { id: "company",  label: "법인별",    icon: "🏭" },
  { id: "dept",     label: "부서별",    icon: "🏢" },
  { id: "type",     label: "라이선스 유형", icon: "💳" },
] as const;
type ChartTabId = (typeof CHART_TABS)[number]["id"];

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export default function OverviewPanel({ company = "" }: { company?: string }) {
  const isCompanyFiltered = company !== "";

  const [swDb,       setSwDb]       = useState<SwItem[]>([]);
  const [swRecs,     setSwRecs]     = useState<SwDbRecord[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [missingEnv, setMissingEnv] = useState<string | null>(null);

  const [filterCompany, setFilterCompany] = useState("전체");
  const [chartTab,      setChartTab]      = useState<ChartTabId>("category");

  useEffect(() => {
    const swRecUrl = isCompanyFiltered
      ? `/api/sw-records?company=${encodeURIComponent(company)}`
      : "/api/sw-records";
    const dbKey  = SC_SWDB;
    const recKey = SC_SWREC(company);
    const cachedDb  = scGet<SwItem[]>(dbKey);
    const cachedRec = scGet<SwDbRecord[]>(recKey);

    if (cachedDb && cachedRec) {
      setSwDb(cachedDb); setSwRecs(cachedRec); setLoading(false);
      Promise.all([
        fetch("/api/sw-db").then(r => safeJson(r)),
        fetch(swRecUrl).then(r => safeJson(r)),
      ]).then(([sw, recs]) => {
        if (recs.missingEnv) return;
        setSwDb(sw.data ?? []); setSwRecs(recs.data ?? []);
        scSet(dbKey, sw.data ?? [], TTL_SWDB);
        scSet(recKey, recs.data ?? [], TTL_SWREC);
      }).catch(() => {});
      return;
    }
    Promise.all([
      fetch("/api/sw-db").then(r => safeJson(r)),
      fetch(swRecUrl).then(r => safeJson(r)),
    ]).then(([sw, recs]) => {
      if (recs.missingEnv) { setMissingEnv(recs.missingEnv); return; }
      setSwDb(sw.data ?? []); setSwRecs(recs.data ?? []);
      scSet(dbKey, sw.data ?? [], TTL_SWDB);
      scSet(recKey, recs.data ?? [], TTL_SWREC);
    }).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company]);

  // ── 필터 ──────────────────────────────────────────────────
  const companyOptions = useMemo(() => {
    const set = new Set(swRecs.map(r => r.company).filter(Boolean));
    return ["전체", ...Array.from(set).sort()];
  }, [swRecs]);

  const filteredRecs = useMemo(() => {
    if (isCompanyFiltered) return swRecs;
    if (filterCompany === "전체") return swRecs;
    return swRecs.filter(r => r.company === filterCompany);
  }, [swRecs, filterCompany, isCompanyFiltered]);

  // ── 통계 계산 ─────────────────────────────────────────────
  const subRecs     = filteredRecs.filter(r => r.licenseType === "구독(업체)" || r.licenseType === "구독(웹)");
  const permRecs    = filteredRecs.filter(r => r.licenseType === "영구");
  const activeSubs  = subRecs.filter(r => r.status === "사용중" || r.status === "신규등록").length;

  const renewingSoonRecs = useMemo(() => filteredRecs.filter(r => {
    if (!r.renewalDate) return false;
    const d = Math.ceil((new Date(r.renewalDate).getTime() - Date.now()) / 86400000);
    return d >= 0 && d <= 30;
  }), [filteredRecs]);

  // 상태별 도넛 세그
  const statusSegs: DonutSeg[] = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of filteredRecs) { const k = r.status || "미확인"; map[k] = (map[k] ?? 0) + 1; }
    return Object.entries(map).sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value, color: STATUS_COLORS[label] ?? "#9CA3AF" }));
  }, [filteredRecs]);

  // 라이선스 유형 도넛 세그
  const typeSegs: DonutSeg[] = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of filteredRecs) { const k = r.licenseType || "기타"; map[k] = (map[k] ?? 0) + 1; }
    return Object.entries(map).sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value, color: TYPE_COLORS[label] ?? "#9CA3AF" }));
  }, [filteredRecs]);

  // 인터랙티브 차트 데이터
  const chartData = useMemo(() => {
    if (chartTab === "category") {
      const map: Record<string, { value: number; color: string; icon: string }> = {};
      for (const r of filteredRecs) {
        const cat = getMacroCategory(r.swCategory);
        if (!map[cat.label]) map[cat.label] = { value: 0, color: cat.color, icon: cat.icon };
        map[cat.label].value++;
      }
      return Object.entries(map).map(([label, v]) => ({ label, ...v })).sort((a, b) => b.value - a.value);
    }
    if (chartTab === "company") {
      const map: Record<string, number> = {};
      for (const r of filteredRecs) { const k = r.company || "미지정"; map[k] = (map[k] ?? 0) + 1; }
      return Object.entries(map).map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length] }))
        .sort((a, b) => b.value - a.value);
    }
    if (chartTab === "dept") {
      const map: Record<string, number> = {};
      for (const r of filteredRecs) { const k = r.department || "미지정"; map[k] = (map[k] ?? 0) + 1; }
      return Object.entries(map).map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length] }))
        .sort((a, b) => b.value - a.value);
    }
    if (chartTab === "type") {
      const map: Record<string, number> = {};
      for (const r of filteredRecs) { const k = r.licenseType || "기타"; map[k] = (map[k] ?? 0) + 1; }
      return Object.entries(map).map(([label, value]) => ({ label, value, color: TYPE_COLORS[label] ?? "#9CA3AF" }))
        .sort((a, b) => b.value - a.value);
    }
    return [];
  }, [filteredRecs, chartTab]);

  // Top SW 사용 현황
  const topSwData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of filteredRecs) { const k = r.swCategory || "미지정"; map[k] = (map[k] ?? 0) + 1; }
    return Object.entries(map).map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length] }))
      .sort((a, b) => b.value - a.value);
  }, [filteredRecs]);

  if (loading) return <LoadingBox />;
  if (missingEnv) return <EnvVarMissing varName={missingEnv} />;

  const isFiltered = !isCompanyFiltered && filterCompany !== "전체";
  const rn = renewingSoonRecs.length;

  return (
    <div className="flex flex-col gap-6">

      {/* 페이지 타이틀 + 필터 */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">전사 라이선스 현황</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {isCompanyFiltered ? `${company} SW 자산 현황` : "소프트웨어 자산 현황 요약 (실시간 Notion 연동)"}
          </p>
        </div>
        {/* 법인 필터 (슈퍼어드민) */}
        {!isCompanyFiltered && (
          <div className="flex items-center gap-2">
            <select
              value={filterCompany}
              onChange={e => setFilterCompany(e.target.value)}
              className={`appearance-none pl-3 pr-7 py-2 border rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-colors ${
                isFiltered ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-gray-200 text-gray-600"
              }`}
            >
              {companyOptions.map(c => <option key={c} value={c}>{c === "전체" ? "전체 법인" : c}</option>)}
            </select>
            {isFiltered && (
              <button onClick={() => setFilterCompany("전체")}
                className="text-xs text-gray-400 hover:text-red-500 border border-gray-200 px-2.5 py-2 rounded-lg transition-colors">
                초기화
              </button>
            )}
          </div>
        )}
        {isCompanyFiltered && (
          <span className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs font-semibold text-blue-700">🏭 {company}</span>
        )}
      </div>

      {/* ── ① KPI 카드 4개 ───────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "전체 SW 레코드",
            val: filteredRecs.length.toLocaleString(),
            unit: "건",
            sub: `영구 ${permRecs.length} · 구독 ${subRecs.length}`,
            color: "#3B82F6", dot: "#DBEAFE",
          },
          {
            label: "구독 사용 중",
            val: activeSubs.toLocaleString(),
            unit: "건",
            sub: `전체 구독 ${subRecs.length}건 중`,
            color: "#10B981", dot: "#D1FAE5",
          },
          {
            label: "갱신 임박",
            val: rn.toLocaleString(),
            unit: "건",
            sub: "30일 이내 갱신 필요일",
            color: rn > 0 ? "#F97316" : "#9CA3AF",
            dot:   rn > 0 ? "#FFEDD5" : "#F3F4F6",
          },
          ...(!isCompanyFiltered ? [{
            label: "SW DB 승인 목록",
            val: swDb.filter(s => s.status === "approved").length.toLocaleString(),
            unit: "종",
            sub: `금지 ${swDb.filter(s => s.status === "banned").length}종 포함 전체 ${swDb.length}종`,
            color: "#8B5CF6", dot: "#EDE9FE",
          }] : [{
            label: "영구 라이선스",
            val: permRecs.length.toLocaleString(),
            unit: "건",
            sub: `사용중 ${permRecs.filter(r => r.status === "사용중").length}건`,
            color: "#8B5CF6", dot: "#EDE9FE",
          }]),
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs font-semibold text-gray-500">{k.label}</span>
              <span className="w-2 h-2 rounded-full mt-0.5" style={{ background: k.color }} />
            </div>
            <div className="flex items-end gap-1">
              <span className="text-3xl font-extrabold" style={{ color: k.color }}>{k.val}</span>
              <span className="text-sm font-semibold text-gray-400 mb-0.5">{k.unit}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ── ② 상태별 현황 | 라이선스 유형 분포 ─────────────────── */}
      <div className="grid grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-gray-700">SW 상태별 현황</span>
            <span className="text-xs text-gray-400">{filteredRecs.length}건 기준</span>
          </div>
          {filteredRecs.length === 0
            ? <div className="h-24 flex items-center justify-center text-xs text-gray-400">데이터 없음</div>
            : <DonutChart data={statusSegs} title="상태" />
          }
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-gray-700">라이선스 유형 분포</span>
            <span className="text-xs text-gray-400">구독 {subRecs.length} · 영구 {permRecs.length}</span>
          </div>
          {filteredRecs.length === 0
            ? <div className="h-24 flex items-center justify-center text-xs text-gray-400">데이터 없음</div>
            : <DonutChart data={typeSegs} title="유형" />
          }
        </div>
      </div>

      {/* ── ③ 갱신 임박 목록 ─────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-700">갱신 임박 현황</span>
            {rn > 0 && (
              <span className="text-xs font-bold text-white bg-orange-500 rounded-full px-2 py-0.5">{rn}건</span>
            )}
          </div>
          <span className="text-xs text-gray-400">30일 이내 갱신 필요일 기준</span>
        </div>

        {rn === 0 ? (
          <div className="py-10 text-center text-xs text-gray-400">30일 이내 갱신 임박 항목 없음 ✓</div>
        ) : (
          <>
            {/* 컬럼 헤더 */}
            <div className="grid px-5 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100"
              style={{ gridTemplateColumns: "64px 1fr 100px 80px 80px 90px 90px" }}>
              <span>D-day</span><span>SW명</span><span>사용자</span>
              <span>부서</span><span>법인</span><span>갱신일</span><span>주기</span>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
              {[...renewingSoonRecs]
                .sort((a, b) => new Date(a.renewalDate).getTime() - new Date(b.renewalDate).getTime())
                .map(r => {
                  const days = Math.ceil((new Date(r.renewalDate).getTime() - Date.now()) / 86400000);
                  const bgCls = days <= 7 ? "bg-red-500" : days <= 14 ? "bg-orange-400" : "bg-yellow-400";
                  return (
                    <div key={r.id}
                      className="grid items-center px-5 py-2.5 hover:bg-gray-50 transition-colors"
                      style={{ gridTemplateColumns: "64px 1fr 100px 80px 80px 90px 90px" }}>
                      <span className={`text-[10px] font-bold text-white ${bgCls} rounded px-1.5 py-0.5 w-fit`}>D-{days}</span>
                      <span className="text-xs font-semibold text-gray-900 truncate pr-2">
                        {r.swCategory}{r.swDetail ? ` · ${r.swDetail}` : ""}
                      </span>
                      <span className="text-xs text-gray-600 truncate pr-1">{r.user || "—"}</span>
                      <span className="text-xs text-gray-400 truncate pr-1">{r.department || "—"}</span>
                      <span className="text-xs text-gray-400 truncate pr-1">{r.company || "—"}</span>
                      <span className="text-xs text-gray-500">{r.renewalDate?.slice(0, 10) || "—"}</span>
                      <span className="text-xs text-gray-400">{r.renewalCycle || "—"}</span>
                    </div>
                  );
                })}
            </div>
            <div className="px-5 py-2 text-right text-xs text-gray-400 border-t border-gray-100">
              {rn}건 표시
            </div>
          </>
        )}
      </div>

      {/* ── ④ 현황 차트 (탭 전환) ────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <span className="text-sm font-bold text-gray-700">현황 분석</span>
          <span className="text-xs text-gray-400">{filteredRecs.length}건 기준</span>
        </div>
        {/* 탭 */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {CHART_TABS.filter(t => !(isCompanyFiltered && t.id === "company")).map(t => (
            <button key={t.id} onClick={() => setChartTab(t.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                chartTab === t.id
                  ? "bg-gray-800 text-white border-gray-800"
                  : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-400"
              }`}>
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        {/* 차트 본문 */}
        <div className="px-5 py-5">
          {filteredRecs.length === 0
            ? <div className="py-8 text-center text-xs text-gray-400">데이터 없음</div>
            : (chartTab === "category" || chartTab === "type")
              ? <DonutChart data={chartData} title={CHART_TABS.find(t => t.id === chartTab)!.label} />
              : <HBarChart data={chartData} maxShow={12} />
          }
        </div>
      </div>

      {/* ── ⑤ Top SW 사용 현황 ───────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <span className="text-sm font-bold text-gray-700">SW별 사용 현황 Top</span>
          <span className="text-xs text-gray-400">{topSwData.length}종</span>
        </div>
        <div className="px-5 py-5">
          {topSwData.length === 0
            ? <div className="py-6 text-center text-xs text-gray-400">데이터 없음</div>
            : <HBarChart data={topSwData} maxShow={15} />
          }
        </div>
      </div>

    </div>
  );
}
