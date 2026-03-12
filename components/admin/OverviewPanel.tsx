"use client";

import { useEffect, useState, useMemo } from "react";
import type { SwItem, SwDbRecord } from "@/types";
import { ProgressBar } from "@/components/ui/ProgressBar";

// ── SW 매크로 카테고리 규칙 ──────────────────────────────────────
const SW_CAT_RULES: { label: string; icon: string; keywords: string[]; chartColor: string }[] = [
  { label: "문서작업용", icon: "📝", chartColor: "#3B82F6",
    keywords: ["office","word","excel","powerpoint","365","한글","hwp","acrobat","pdf","한셀","한쇼","thinkfree","docs","sheets","slides","hancom","libreoffice","foxit"] },
  { label: "AI 툴",    icon: "🤖", chartColor: "#8B5CF6",
    keywords: ["copilot","chatgpt","gpt","claude","midjourney","cursor","tabnine","gemini","codeium","stable diffusion","ai","wrtn"] },
  { label: "개발 툴",  icon: "💻", chartColor: "#10B981",
    keywords: ["vscode","vs code","intellij","pycharm","eclipse","xcode","git","github","gitlab","docker","postman","dbeaver","sourcetree","datagrip","rider","goland","webstorm"] },
  { label: "협업 툴",  icon: "🤝", chartColor: "#F97316",
    keywords: ["notion","slack","teams","zoom","webex","google meet","trello","asana","monday","카카오워크","miro","confluence","jira","dooray"] },
  { label: "디자인 툴",icon: "🎨", chartColor: "#EC4899",
    keywords: ["figma","photoshop","illustrator","indesign","adobe cc","adobe creative","sketch","after effects","premiere","lightroom","canva","zeplin","invision"] },
  { label: "보안/관리",icon: "🛡️", chartColor: "#EF4444",
    keywords: ["v3","ahnlab","알약","antivirus","vpn","dlp","endpoint","mcafee","symantec","fortinet","crowdstrike","wireshark","nessus"] },
];
const EXTRA_CAT = { label: "기타", icon: "📦", chartColor: "#9CA3AF" };

function getMacroCategory(swName?: string): { label: string; icon: string; chartColor: string } {
  if (!swName) return EXTRA_CAT;
  const lower = swName.toLowerCase();
  for (const rule of SW_CAT_RULES) {
    if (rule.keywords.some(kw => lower.includes(kw))) return rule;
  }
  return EXTRA_CAT;
}

// ── 차트 타입 옵션 ─────────────────────────────────────────────
const CHART_OPTIONS = [
  { id: "category", label: "SW 카테고리별", icon: "📂" },
  { id: "company",  label: "법인별",       icon: "🏭" },
  { id: "dept",     label: "부서별",       icon: "🏢" },
  { id: "type",     label: "구독 / 영구",  icon: "💳" },
  { id: "status",   label: "상태별",       icon: "🔵" },
] as const;
type ChartOptionId = (typeof CHART_OPTIONS)[number]["id"];

// ── SVG 도넛 차트 ──────────────────────────────────────────────
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
    <div className="flex flex-col gap-4">
      <div className="text-xs font-semibold text-gray-500 text-center">{title}</div>
      <div className="flex items-center gap-5 flex-wrap justify-center">
        <div className="relative">
          <svg width="128" height="128" viewBox="0 0 128 128" className="shrink-0">
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
                <text x="64" y="72" textAnchor="middle" fontSize="8.5" fill="#6B7280">{hoverSeg.label.length > 6 ? hoverSeg.label.slice(0,5)+"…" : hoverSeg.label}</text>
              </>
            ) : (
              <>
                <text x="64" y="58" textAnchor="middle" fontSize="16" fontWeight="800" fill="#111827">{total.toLocaleString()}</text>
                <text x="64" y="72" textAnchor="middle" fontSize="9" fill="#9CA3AF">전체</text>
              </>
            )}
          </svg>
        </div>
        <div className="flex flex-col gap-1.5 min-w-0 flex-1 max-w-[200px]">
          {segs.map(s => (
            <div
              key={s.label}
              className={`flex items-center gap-2 text-xs rounded-md px-2 py-0.5 cursor-pointer transition-colors ${hovered === s.label ? "bg-gray-100" : "hover:bg-gray-50"}`}
              onMouseEnter={() => setHovered(s.label)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className="w-2.5 h-2.5 rounded-sm shrink-0 transition-all" style={{ background: s.color }} />
              <span className="text-gray-600 flex-1 truncate">{s.icon} {s.label}</span>
              <span className="font-bold text-gray-900 ml-1 shrink-0">{s.value}</span>
              <span className="text-gray-400 w-8 text-right shrink-0">
                {total > 0 ? `${Math.round(s.value / total * 100)}%` : "0%"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 수평 막대 차트 (상윀N개 + 전체) ──────────────────────────
function HBarChart({ data, maxShow = 10 }: {
  data: { label: string; value: number; color: string; sub?: string }[];
  maxShow?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? data : data.slice(0, maxShow);
  const max = data[0]?.value ?? 1;
  return (
    <div className="flex flex-col gap-2">
      {shown.filter(d => d.value > 0).map((d, i) => {
        const pct = Math.max(3, Math.round((d.value / max) * 100));
        return (
          <div key={d.label} className="flex items-center gap-2.5 group">
            <div className="w-28 shrink-0 text-right text-xs text-gray-600 font-medium truncate" title={d.label}>{d.label}</div>
            <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: d.color || "#3B82F6" }}
              />
            </div>
            <div className="w-14 shrink-0 text-right">
              <span className="text-xs font-bold text-gray-800">{d.value}</span>
              {d.sub && <span className="text-xs text-gray-400 ml-1">{d.sub}</span>}
            </div>
          </div>
        );
      })}
      {data.length > maxShow && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="text-xs text-gray-400 hover:text-blue-600 py-1 text-center transition-colors"
        >
          {showAll ? "▲ 줄이기" : `▼ 더 보기 (${data.length - maxShow}개)`}
        </button>
      )}
    </div>
  );
}

// ── 상태 색상 ──────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  "사용중": "#3B82F6", "신규등록": "#8B5CF6",
  "재고": "#10B981", "출고준비중": "#06B6D4",
  "갱신필요": "#F97316", "반납예정": "#EAB308",
  "만료": "#9CA3AF", "미확인": "#D1D5DB",
};

const CORP_COLORS = ["#3B82F6","#8B5CF6","#10B981","#F97316","#06B6D4","#EC4899","#EAB308","#6366F1","#84CC16","#F43F5E"];

// ── 메인 컴포넌트 ──────────────────────────────────────────────
export default function OverviewPanel() {
  const [swDb,    setSwDb]    = useState<SwItem[]>([]);
  const [swRecs,  setSwRecs]  = useState<SwDbRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // 글로벌 필터
  const [filterCompany, setFilterCompany] = useState("전체");
  const [filterSwName,  setFilterSwName]  = useState("전체");

  // 인터랙티브 차트 선택
  const [chartOpt, setChartOpt] = useState<ChartOptionId>("category");

  useEffect(() => {
    Promise.all([
      fetch("/api/sw-db").then(r => r.json()),
      fetch("/api/sw-records").then(r => r.json()),
    ]).then(([sw, recs]) => {
      setSwDb(sw.data ?? []);
      setSwRecs(recs.data ?? []);
    }).finally(() => setLoading(false));
  }, []);

  // ── 필터 옵션 ─────────────────────────────────────────────────
  const companyOptions = useMemo(() => {
    const set = new Set(swRecs.map(r => r.company).filter(Boolean));
    return ["전체", ...Array.from(set).sort()];
  }, [swRecs]);

  const swNameOptions = useMemo(() => {
    const set = new Set(swRecs.map(r => r.swCategory).filter(Boolean));
    return ["전체", ...Array.from(set).sort()];
  }, [swRecs]);

  // ── 필터 적용 레코드 ──────────────────────────────────────────
  const filteredRecs = useMemo(() => {
    return swRecs.filter(r => {
      if (filterCompany !== "전체" && r.company    !== filterCompany) return false;
      if (filterSwName  !== "전체" && r.swCategory !== filterSwName)  return false;
      return true;
    });
  }, [swRecs, filterCompany, filterSwName]);

  const isFiltered = filterCompany !== "전체" || filterSwName !== "전체";

  // ── 기본 통계 ─────────────────────────────────────────────────
  const approved  = swDb.filter(s => s.status === "approved").length;
  const banned    = swDb.filter(s => s.status === "banned").length;
  const subRecs   = filteredRecs.filter(r => r.licenseType === "구독(업체)" || r.licenseType === "구독(웹)");
  const activeSubs = subRecs.filter(r => r.status === "사용중" || r.status === "신규등록").length;

  const renewingSoonRecs = useMemo(() => filteredRecs.filter(r => {
    if (!r.renewalDate) return false;
    const d = Math.ceil((new Date(r.renewalDate).getTime() - Date.now()) / 86400000);
    return d >= 0 && d <= 30;
  }), [filteredRecs]);
  const renewingSoon = renewingSoonRecs.length;

  const kpis = [
    {
      label: "전체 SW 레코드",
      val: `${filteredRecs.length}건`,
      sub: `영구 ${filteredRecs.filter(r => r.licenseType === "영구").length} · 구독 ${subRecs.length}`,
      color: "#0052CC", bg: "#EBF0FF",
    },
    {
      label: "구독 중인 SW",
      val: `${activeSubs}개`,
      sub: "SW 데이터베이스 기준",
      color: "#00875A", bg: "#E3FCEF",
    },
    {
      label: "갱신 임박 (30일)",
      val: `${renewingSoon}건`,
      sub: "갱신 필요일 기준",
      color: renewingSoon > 0 ? "#DE350B" : "#6B778C",
      bg:    renewingSoon > 0 ? "#FFEBE6" : "#F4F5F7",
    },
    {
      label: "SW DB 관리",
      val: `${swDb.length}종`,
      sub: `승인 ${approved} · 금지 ${banned}`,
      color: "#6554C0", bg: "#EAE6FF",
    },
  ];

  // ── 차트 데이터 계산 ──────────────────────────────────────────
  const chartData = useMemo(() => {
    if (chartOpt === "category") {
      const map: Record<string, { value: number; color: string; icon: string }> = {};
      for (const r of filteredRecs) {
        const cat = getMacroCategory(r.swCategory);
        if (!map[cat.label]) map[cat.label] = { value: 0, color: cat.chartColor, icon: cat.icon };
        map[cat.label].value++;
      }
      return Object.entries(map)
        .map(([label, v]) => ({ label, ...v }))
        .sort((a, b) => b.value - a.value);
    }
    if (chartOpt === "company") {
      const map: Record<string, number> = {};
      for (const r of filteredRecs) {
        const k = r.company || "미지정";
        map[k] = (map[k] ?? 0) + 1;
      }
      return Object.entries(map)
        .map(([label, value], i) => ({ label, value, color: CORP_COLORS[i % CORP_COLORS.length] }))
        .sort((a, b) => b.value - a.value);
    }
    if (chartOpt === "dept") {
      const map: Record<string, number> = {};
      for (const r of filteredRecs) {
        const k = r.department || "미지정";
        map[k] = (map[k] ?? 0) + 1;
      }
      return Object.entries(map)
        .map(([label, value], i) => ({ label, value, color: CORP_COLORS[i % CORP_COLORS.length] }))
        .sort((a, b) => b.value - a.value);
    }
    if (chartOpt === "type") {
      const map: Record<string, number> = {};
      for (const r of filteredRecs) {
        const k = r.licenseType || "기타";
        map[k] = (map[k] ?? 0) + 1;
      }
      const TYPE_COLORS: Record<string, string> = {
        "영구": "#3B82F6",
        "구독(업체)": "#8B5CF6",
        "구독(웹)": "#06B6D4",
      };
      return Object.entries(map)
        .map(([label, value]) => ({ label, value, color: TYPE_COLORS[label] ?? "#9CA3AF" }))
        .sort((a, b) => b.value - a.value);
    }
    if (chartOpt === "status") {
      const map: Record<string, number> = {};
      for (const r of filteredRecs) {
        const k = r.status || "미확인";
        map[k] = (map[k] ?? 0) + 1;
      }
      return Object.entries(map)
        .map(([label, value]) => ({ label, value, color: STATUS_COLORS[label] ?? "#9CA3AF" }))
        .sort((a, b) => b.value - a.value);
    }
    return [];
  }, [filteredRecs, chartOpt]);

  // 카테고리 / 유형 / 상태: 도넛 차트
  // 법인 / 부서: 막대 차트 (항목 많을 수 있음)
  const useDonut = chartOpt === "category" || chartOpt === "type" || chartOpt === "status";

  const selectedOpt = CHART_OPTIONS.find(o => o.id === chartOpt)!;

  if (loading) return <div className="text-center py-20 text-gray-400">노션 데이터 로딩 중...</div>;

  return (
    <div className="fade-in">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-gray-900 mb-0.5">관리자 대시보드</h2>
        <p className="text-sm text-gray-500">전사 소프트웨어 자산 현황 (실시간 Notion 연동)</p>
      </div>

      {/* ── 글로벌 필터 ─────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5 flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-gray-500">🔍 데이터 필터</span>

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

        {isFiltered && (
          <button
            onClick={() => { setFilterCompany("전체"); setFilterSwName("전체"); }}
            className="text-xs text-gray-500 border border-gray-200 px-3 py-2 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
          >
            × 초기화
          </button>
        )}
        <span className={`text-xs font-semibold ml-auto ${isFiltered ? "text-blue-600" : "text-gray-400"}`}>
          {isFiltered ? `필터 적용 · ${filteredRecs.length}건` : `전체 ${filteredRecs.length}건`}
        </span>
      </div>

      {/* ── KPI 카드 ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="bg-white border border-gray-200 rounded-lg p-4"
            style={{ borderLeft: `3px solid ${k.color}` }}
          >
            <div className="text-2xl font-extrabold mb-1" style={{ color: k.color }}>{k.val}</div>
            <div className="text-sm font-semibold text-gray-800 mb-0.5">{k.label}</div>
            <div className="text-xs text-gray-500">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── 현황 + 갱신 임박 ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* SW 상태별 현황 */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="font-bold text-sm text-gray-900 mb-4">🗂 SW 상태별 현황</div>
          {filteredRecs.length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-6">데이터 없음</div>
          ) : (() => {
            const groups = [
              { label: "사용중",   color: "bg-blue-500",   count: filteredRecs.filter(r => r.status === "사용중").length },
              { label: "재고",     color: "bg-green-500",  count: filteredRecs.filter(r => r.status === "재고").length },
              { label: "갱신필요", color: "bg-red-500",    count: filteredRecs.filter(r => r.status === "갱신필요").length },
              { label: "만료",     color: "bg-gray-400",   count: filteredRecs.filter(r => r.status === "만료").length },
              { label: "반납예정", color: "bg-yellow-400", count: filteredRecs.filter(r => r.status === "반납예정").length },
              { label: "기타",     color: "bg-gray-300",   count: filteredRecs.filter(r => !["사용중","재고","갱신필요","만료","반납예정"].includes(r.status)).length },
            ];
            const total = filteredRecs.length;
            return (
              <div className="flex flex-col gap-3">
                {groups.filter(g => g.count > 0).map(g => {
                  const pct = Math.round((g.count / total) * 100);
                  return (
                    <div key={g.label}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-medium text-gray-800">{g.label}</span>
                        <span className="text-xs text-gray-400">{g.count}건 ({pct}%)</span>
                      </div>
                      <ProgressBar value={pct} height={5} />
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* 갱신 임박 */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="font-bold text-sm text-gray-900">⏰ 갱신 임박 (30일 이내)</div>
            {renewingSoon > 0 && (
              <span className="text-xs font-semibold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                {renewingSoon}건
              </span>
            )}
          </div>
          {(() => {
            const urgent = [...renewingSoonRecs].sort((a, b) => {
              const da = Math.ceil((new Date(a.renewalDate).getTime() - Date.now()) / 86400000);
              const db = Math.ceil((new Date(b.renewalDate).getTime() - Date.now()) / 86400000);
              return da - db;
            });
            if (urgent.length === 0)
              return <div className="text-sm text-gray-400 text-center py-3">30일 이내 갱신 임박 없음 ✓</div>;

            const shown     = urgent.slice(0, 8);
            const remaining = urgent.length - shown.length;
            return (
              <div className="overflow-y-auto" style={{ maxHeight: 240 }}>
                <div className="flex flex-col divide-y divide-gray-100">
                  {shown.map(r => {
                    const days     = Math.ceil((new Date(r.renewalDate).getTime() - Date.now()) / 86400000);
                    const urgColor = days <= 7 ? "bg-red-500" : days <= 14 ? "bg-orange-400" : "bg-yellow-400";
                    return (
                      <div key={r.id} className="flex items-center gap-2 py-2">
                        <span className={`shrink-0 text-xs font-bold text-white ${urgColor} rounded px-1.5 py-0.5 min-w-[40px] text-center`}>
                          D-{days}
                        </span>
                        <span className="flex-1 text-xs font-semibold text-gray-900 truncate">
                          {r.swCategory}{r.swDetail ? ` · ${r.swDetail}` : ""}
                        </span>
                        <span className="text-xs text-gray-400 shrink-0 truncate max-w-[120px] text-right hidden sm:block">
                          {r.user || "—"}
                        </span>
                      </div>
                    );
                  })}
                  {remaining > 0 && (
                    <div className="pt-2 text-xs text-gray-400 text-center">
                      + {remaining}건 더 있음 (라이선스 현황에서 �E인)
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── 인터랙티브 차트 ──────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="font-bold text-sm text-gray-900">📊 현황 차트</div>
          <div className="text-xs text-gray-400">{filteredRecs.length}건 기좀</div>
        </div>

        {/* 옵션 탭 */}
        <div className="flex flex-wrap gap-2 mb-5">
          {CHART_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => setChartOpt(opt.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                chartOpt === opt.id
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
              }`}
            >
              <span>{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>

        {/* 차트 렌더 */}
        {filteredRecs.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">데이터 없음</div>
        ) : useDonut ? (
          <DonutChart
            data={chartData.map(d => ({ label: d.label, value: d.value, color: d.color, icon: "icon" in d ? (d as any).icon : undefined }))}
            title={`${selectedOpt.icon} ${selectedOpt.label} 분포`}
          />
        ) : (
          <div>
            <div className="text-xs text-gray-500 font-semibold mb-3">{selectedOpt.icon} {selectedOpt.label} 현황</div>
            <HBarChart
              data={chartData.map(d => ({ label: d.label, value: d.value, color: d.color }))}
              maxShow={10}
            />
          </div>
        )}
      </div>

      {/* ── 포털 관리 빠른 링크 ─────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="font-bold text-sm text-gray-900 mb-1">⚙️ 포털 관리</div>
        <p className="text-xs text-gray-400 mb-4">Notion에서 직접 데이터를 편집할 수 있습니다.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "SW DB 편집",     icon: "🗄",  url: process.env.NEXT_PUBLIC_NOTION_TRACKER_URL    || "#", desc: "화이트/블랙리스트",   color: "hover:border-blue-300 hover:bg-blue-50" },
            { label: "SW 데이터베이스", icon: "📋", url: process.env.NEXT_PUBLIC_NOTION_SW_UNIFIED_URL || "#", desc: "라이선스/구독 통합편집", color: "hover:border-green-300 hover:bg-green-50" },
            { label: "라이선스 현황",   icon: "🔑",  url: process.env.NEXT_PUBLIC_NOTION_SW_UNIFIED_URL || "#", desc: "라이선스 추가/수정",   color: "hover:border-yellow-300 hover:bg-yellow-50" },
            { label: "티켓 처리",       icon: "🎫",  url: "#",                                                   desc: "Notion에서 처리",     color: "hover:border-purple-300 hover:bg-purple-50" },
          ].map((link) => (
            <a
              key={link.label}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 transition-all text-center ${link.color}`}
            >
              <span className="text-2xl">{link.icon}</span>
              <div className="text-xs font-semibold text-gray-800">{link.label}</div>
              <div className="text-xs text-gray-400">{link.desc}</div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
