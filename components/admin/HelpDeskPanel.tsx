"use client";

import { useEffect, useState, useMemo } from "react";
import type { HelpDeskTicket } from "@/lib/notion";

// ── Color configs ────────────────────────────────────────────
const URGENCY: Record<string, { bg: string; text: string; bar: string }> = {
  "매우 급합니다":    { bg: "#FEF2F2", text: "#DC2626", bar: "#EF4444" },
  "조금 급합니다":   { bg: "#FFFBEB", text: "#B45309", bar: "#F59E0B" },
  "기다릴 수 있어요": { bg: "#F0FDF4", text: "#059669", bar: "#10B981" },
};

const STATUS: Record<string, { bg: string; text: string }> = {
  "진행 중": { bg: "#EFF6FF", text: "#1D4ED8" },
  "완료":    { bg: "#F0FDF4", text: "#059669" },
};

const TYPE_COLORS = [
  "#3B82F6","#8B5CF6","#F59E0B","#EF4444",
  "#10B981","#6366F1","#EC4899","#0EA5E9","#6B7280",
];

// ── Helpers ──────────────────────────────────────────────────
function last6Months(): string[] {
  const result: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return result;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${y.slice(2)}/${m}`;
}

function processingDays(submittedAt: string, lastEditedAt: string): number {
  const diff = new Date(lastEditedAt).getTime() - new Date(submittedAt).getTime();
  return Math.max(0, Math.round(diff / 86400000));
}

// ── Sub-components ───────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const c = STATUS[status] ?? { bg: "#F1F5F9", text: "#64748B" };
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
      style={{ background: c.bg, color: c.text }}>
      {status || "—"}
    </span>
  );
}

function UrgencyBadge({ urgency }: { urgency: string }) {
  const c = URGENCY[urgency] ?? { bg: "#F1F5F9", text: "#64748B", bar: "#94A3B8" };
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
      style={{ background: c.bg, color: c.text }}>
      {urgency || "—"}
    </span>
  );
}

function StatCard({ label, value, color, bg }: { label: string; value: string | number; color: string; bg: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-1">
      <div className="text-2xl font-extrabold" style={{ color }}>{value}</div>
      <div className="text-xs font-medium text-gray-500">{label}</div>
    </div>
  );
}

// ── Monthly Bar Chart (SVG) ──────────────────────────────────
function MonthlyBarChart({ data }: { data: { month: string; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1);
  const W = 600, H = 170, PAD_X = 36, PAD_TOP = 20, PAD_BOT = 24;
  const chartH = H - PAD_TOP - PAD_BOT;
  const chartW = W - PAD_X * 2;
  const step = chartW / data.length;
  const BAR_W = Math.min(40, step * 0.6);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow: "visible" }}>
      {[0, 0.25, 0.5, 0.75, 1].map(pct => {
        const y = PAD_TOP + chartH * (1 - pct);
        const val = Math.round(max * pct);
        return (
          <g key={pct}>
            <line x1={PAD_X} y1={y} x2={W - PAD_X} y2={y} stroke="#F1F5F9" strokeWidth={1} />
            <text x={PAD_X - 6} y={y + 4} textAnchor="end" fontSize={9} fill="#94A3B8">{val}</text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const barH = max > 0 ? (d.count / max) * chartH : 0;
        const x = PAD_X + i * step + (step - BAR_W) / 2;
        const y = PAD_TOP + chartH - barH;
        return (
          <g key={d.month}>
            <rect x={x} y={PAD_TOP} width={BAR_W} height={chartH} rx={4} fill="#F8FAFC" />
            <rect x={x} y={y} width={BAR_W} height={barH} rx={4} fill="#3B82F6" opacity={0.85} />
            {d.count > 0 && (
              <text x={x + BAR_W / 2} y={y - 5} textAnchor="middle" fontSize={10} fontWeight="700" fill="#1E40AF">
                {d.count}
              </text>
            )}
            <text x={x + BAR_W / 2} y={H - 4} textAnchor="middle" fontSize={10} fill="#94A3B8">
              {monthLabel(d.month)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Horizontal Bar ───────────────────────────────────────────
function HBar({ label, count, total, color, note }: {
  label: string; count: number; total: number; color: string; note?: string;
}) {
  const pct = total > 0 ? Math.max((count / total) * 100, count > 0 ? 1.5 : 0) : 0;
  return (
    <div>
      <div className="flex justify-between items-center text-xs mb-1">
        <span className="font-medium text-gray-700 flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm inline-block flex-shrink-0" style={{ background: color }} />
          {label}
        </span>
        <span className="text-gray-400">{note ?? `${count}건 · ${total > 0 ? Math.round(count / total * 100) : 0}%`}</span>
      </div>
      <div className="h-5 bg-gray-100 rounded-lg overflow-hidden">
        <div className="h-full rounded-lg flex items-center pl-2 transition-all duration-300"
          style={{ width: `${pct}%`, background: color }}>
          {count > 0 && <span className="text-white text-[9px] font-bold">{count}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Main Panel ───────────────────────────────────────────────
type Tab = "overview" | "type" | "company" | "list";

export default function HelpDeskPanel() {
  const [tickets, setTickets] = useState<HelpDeskTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [listFilter, setListFilter] = useState({
    status: "all", type: "all", company: "all", urgency: "all", search: "",
  });

  const load = () => {
    setLoading(true);
    setError(null);
    fetch("/api/helpdesk")
      .then(r => r.json())
      .then(res => {
        if (res.error) setError(res.error);
        setTickets(res.data ?? []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const months = useMemo(() => last6Months(), []);

  // ── Analytics ────────────────────────────────────────────
  const total       = tickets.length;
  const inProgress  = tickets.filter(t => t.status === "진행 중").length;
  const done        = tickets.filter(t => t.status === "완료").length;

  const completedTickets = tickets.filter(t => t.status === "완료");
  const avgProcessDays = completedTickets.length > 0
    ? Math.round(completedTickets.reduce((s, t) => s + processingDays(t.submittedAt, t.lastEditedAt), 0) / completedTickets.length)
    : null;

  const byType = useMemo(() => {
    const m = new Map<string, number>();
    tickets.forEach(t => { if (t.inquiryType) m.set(t.inquiryType, (m.get(t.inquiryType) ?? 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1])
      .map(([type, count], i) => ({ type, count, color: TYPE_COLORS[i % TYPE_COLORS.length] }));
  }, [tickets]);

  const byCompany = useMemo(() => {
    const m = new Map<string, number>();
    tickets.forEach(t => { if (t.company) m.set(t.company, (m.get(t.company) ?? 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [tickets]);

  const byUrgency = useMemo(() => {
    const order = ["매우 급합니다", "조금 급합니다", "기다릴 수 있어요"];
    const m = new Map<string, number>();
    tickets.forEach(t => { if (t.urgency) m.set(t.urgency, (m.get(t.urgency) ?? 0) + 1); });
    return order.filter(u => m.has(u)).map(u => [u, m.get(u)!] as [string, number]);
  }, [tickets]);

  const monthlyTotal = useMemo(() =>
    months.map(m => ({ month: m, count: tickets.filter(t => (t.submittedAt || "").startsWith(m)).length })),
    [tickets, months]);

  const companyMonthly = useMemo(() => {
    const companies = [...new Set(tickets.map(t => t.company).filter(Boolean))].sort();
    return companies.map(company => ({
      company,
      monthlyCounts: months.map(m => tickets.filter(t => t.company === company && (t.submittedAt || "").startsWith(m)).length),
      total: tickets.filter(t => t.company === company).length,
    })).sort((a, b) => b.total - a.total);
  }, [tickets, months]);

  // ── List filters ─────────────────────────────────────────
  const uniqueTypes     = [...new Set(tickets.map(t => t.inquiryType).filter(Boolean))].sort();
  const uniqueCompanies = [...new Set(tickets.map(t => t.company).filter(Boolean))].sort();
  const uniqueUrgencies = ["매우 급합니다", "조금 급합니다", "기다릴 수 있어요"].filter(u =>
    tickets.some(t => t.urgency === u));

  const filteredList = useMemo(() => tickets.filter(t => {
    if (listFilter.status  !== "all" && t.status      !== listFilter.status)  return false;
    if (listFilter.type    !== "all" && t.inquiryType !== listFilter.type)    return false;
    if (listFilter.company !== "all" && t.company     !== listFilter.company) return false;
    if (listFilter.urgency !== "all" && t.urgency     !== listFilter.urgency) return false;
    if (listFilter.search) {
      const q = listFilter.search.toLowerCase();
      return (t.content || t.title || "").toLowerCase().includes(q)
        || (t.requester || "").toLowerCase().includes(q)
        || (t.department || "").toLowerCase().includes(q);
    }
    return true;
  }), [tickets, listFilter]);

  // ── Render ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400 text-sm gap-2">
        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25"/>
          <path d="M21 12a9 9 0 00-9-9"/>
        </svg>
        헬프데스크 데이터 불러오는 중...
      </div>
    );
  }

  return (
    <div className="fade-in">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-0.5">문의 접수 현황</h2>
          <p className="text-sm text-gray-500">IDS 자산관리파트 Help Desk · 전체 {total}건</p>
        </div>
        <button onClick={load}
          className="text-xs font-medium px-3 py-1.5 rounded border bg-white text-gray-600 border-gray-300 hover:border-gray-400 flex items-center gap-1 transition-colors">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
          </svg>
          새로고침
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          ⚠️ {error}
          {error.includes("NOTION_DB_HELPDESK") && (
            <p className="mt-1 text-xs text-red-500">Vercel 환경변수에 <code className="bg-red-100 px-1 rounded">NOTION_DB_HELPDESK</code>를 추가해주세요.</p>
          )}
        </div>
      )}

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatCard label="전체 접수" value={total}             color="#1E40AF" bg="#EFF6FF" />
        <StatCard label="진행 중"   value={inProgress}        color="#1D4ED8" bg="#EFF6FF" />
        <StatCard label="완료"      value={done}              color="#059669" bg="#F0FDF4" />
        <StatCard label="평균 처리일" value={avgProcessDays !== null ? `${avgProcessDays}일` : "—"} color="#7C3AED" bg="#F5F3FF" />
      </div>

      {/* ── Tab Bar ── */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit">
        {([
          ["overview", "📈", "개요"],
          ["type",     "🏷",  "유형분석"],
          ["company",  "🏢", "법인현황"],
          ["list",     "📋", "목록"],
        ] as [Tab, string, string][]).map(([id, icon, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              tab === id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}>
            {icon} {label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════ Tab: 개요 */}
      {tab === "overview" && (
        <div className="space-y-4">

          {/* Monthly chart */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4">월별 접수 추이 <span className="text-xs font-normal text-gray-400">(최근 6개월)</span></h3>
            <MonthlyBarChart data={monthlyTotal} />
          </div>

          <div className="grid grid-cols-2 gap-4">

            {/* Urgency */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-4">긴급도 분포</h3>
              <div className="space-y-3">
                {byUrgency.map(([urgency, count]) => (
                  <HBar key={urgency} label={urgency} count={count} total={total}
                    color={URGENCY[urgency]?.bar ?? "#94A3B8"} />
                ))}
                {byUrgency.length === 0 && <p className="text-xs text-gray-300 text-center py-4">데이터 없음</p>}
              </div>
            </div>

            {/* Recent 5 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-4">최근 접수 <span className="text-xs font-normal text-gray-400">최신 5건</span></h3>
              <div className="space-y-1">
                {tickets.slice(0, 5).map(t => (
                  <div key={t.id} className="flex items-start gap-2 py-2 border-b border-gray-50 last:border-0">
                    <StatusBadge status={t.status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">
                        {t.content || t.title || "(내용 없음)"}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {[t.company, t.requester, t.submittedAt?.slice(0, 10)].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {t.urgency && <UrgencyBadge urgency={t.urgency} />}
                  </div>
                ))}
                {tickets.length === 0 && <p className="text-xs text-gray-300 text-center py-6">데이터 없음</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════ Tab: 유형분석 */}
      {tab === "type" && (
        <div className="space-y-4">

          {/* Type bars */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4">문의유형별 현황</h3>
            <div className="space-y-3">
              {byType.map(({ type, count, color }) => (
                <HBar key={type} label={type} count={count} total={total} color={color} />
              ))}
              {byType.length === 0 && <p className="text-xs text-gray-300 text-center py-6">데이터 없음</p>}
            </div>
          </div>

          {/* Cross-table: type × urgency */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4">유형 × 긴급도 교차 분석</h3>
            <div className="overflow-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-100">
                    <th className="text-left py-2.5 pr-5 text-gray-500 font-semibold">문의유형</th>
                    {["매우 급합니다","조금 급합니다","기다릴 수 있어요"].map(u => (
                      <th key={u} className="text-center py-2.5 px-4 text-gray-500 font-semibold whitespace-nowrap">
                        {u}
                      </th>
                    ))}
                    <th className="text-center py-2.5 px-4 text-gray-700 font-bold">합계</th>
                  </tr>
                </thead>
                <tbody>
                  {byType.map(({ type, count, color }) => (
                    <tr key={type} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 pr-5">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: color }} />
                          <span className="font-medium text-gray-700">{type}</span>
                        </span>
                      </td>
                      {["매우 급합니다","조금 급합니다","기다릴 수 있어요"].map(u => {
                        const n = tickets.filter(t => t.inquiryType === type && t.urgency === u).length;
                        const c = URGENCY[u];
                        return (
                          <td key={u} className="text-center py-2.5 px-4">
                            {n > 0
                              ? <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: c?.bg, color: c?.text }}>{n}</span>
                              : <span className="text-gray-200">—</span>}
                          </td>
                        );
                      })}
                      <td className="text-center py-2.5 px-4 font-bold text-gray-800">{count}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                    <td className="py-2.5 pr-5 text-gray-700">합계</td>
                    {["매우 급합니다","조금 급합니다","기다릴 수 있어요"].map(u => (
                      <td key={u} className="text-center py-2.5 px-4 text-gray-700">
                        {tickets.filter(t => t.urgency === u).length || "—"}
                      </td>
                    ))}
                    <td className="text-center py-2.5 px-4 text-gray-900">{total}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════ Tab: 법인현황 */}
      {tab === "company" && (
        <div className="space-y-4">

          {/* Company × Month grid */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4">
              법인별 월간 접수 현황
              <span className="text-xs font-normal text-gray-400 ml-2">최근 6개월</span>
            </h3>
            <div className="overflow-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-100">
                    <th className="text-left py-2.5 pr-6 text-gray-500 font-semibold whitespace-nowrap">법인</th>
                    {months.map(m => (
                      <th key={m} className="text-center py-2.5 px-4 text-gray-500 font-semibold whitespace-nowrap">
                        {monthLabel(m)}
                      </th>
                    ))}
                    <th className="text-center py-2.5 px-4 text-gray-700 font-bold">합계</th>
                  </tr>
                </thead>
                <tbody>
                  {companyMonthly.map(({ company, monthlyCounts, total: compTotal }) => {
                    const colMax = Math.max(...monthlyCounts, 1);
                    return (
                      <tr key={company} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-3 pr-6 font-semibold text-gray-700 whitespace-nowrap">{company}</td>
                        {monthlyCounts.map((cnt, i) => {
                          const intensity = cnt > 0 ? 0.3 + (cnt / colMax) * 0.7 : 0;
                          return (
                            <td key={i} className="text-center py-3 px-4">
                              {cnt > 0 ? (
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-white text-[11px] font-bold"
                                  style={{ background: `rgba(37,99,235,${intensity})` }}>
                                  {cnt}
                                </span>
                              ) : <span className="text-gray-200">—</span>}
                            </td>
                          );
                        })}
                        <td className="text-center py-3 px-4 font-bold text-gray-800">{compTotal}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td className="py-2.5 pr-6 font-bold text-gray-700">합계</td>
                    {monthlyTotal.map(({ month, count }) => (
                      <td key={month} className="text-center py-2.5 px-4 font-bold text-gray-700">{count || "—"}</td>
                    ))}
                    <td className="text-center py-2.5 px-4 font-bold text-gray-900">{total}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Company ranking bars */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4">법인별 접수 총계</h3>
            <div className="space-y-3">
              {byCompany.map(([company, count], i) => (
                <HBar key={company} label={company} count={count} total={total}
                  color={TYPE_COLORS[i % TYPE_COLORS.length]} />
              ))}
              {byCompany.length === 0 && <p className="text-xs text-gray-300 text-center py-6">데이터 없음</p>}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════ Tab: 목록 */}
      {tab === "list" && (
        <div>
          {/* Filter bar */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex flex-wrap gap-2.5 items-center">
            <input type="text" placeholder="내용 · 요청자 · 부서 검색..."
              value={listFilter.search}
              onChange={e => setListFilter(f => ({ ...f, search: e.target.value }))}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 w-52" />

            {([
              { key: "status",  opts: ["all","진행 중","완료"],       label: "상태" },
              { key: "type",    opts: ["all",...uniqueTypes],         label: "유형" },
              { key: "company", opts: ["all",...uniqueCompanies],     label: "법인" },
              { key: "urgency", opts: ["all",...uniqueUrgencies],     label: "긴급도" },
            ] as { key: string; opts: string[]; label: string }[]).map(({ key, opts, label }) => (
              <select key={key}
                value={(listFilter as Record<string, string>)[key]}
                onChange={e => setListFilter(f => ({ ...f, [key]: e.target.value }))}
                className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white text-gray-700">
                <option value="all">{label} 전체</option>
                {opts.filter(o => o !== "all").map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ))}

            <span className="ml-auto text-xs text-gray-400">{filteredList.length}건</span>
          </div>

          {/* Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 sticky top-0">
                  {["상태","유형","긴급도","법인","부서","문의자","문의내용","접수일","담당자",""].map((h, i) => (
                    <th key={i} className="px-3 py-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredList.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-12 text-gray-300">조건에 맞는 데이터가 없습니다</td></tr>
                ) : filteredList.map(t => (
                  <tr key={t.id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                    <td className="px-3 py-2.5"><StatusBadge status={t.status} /></td>
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded whitespace-nowrap">
                        {t.inquiryType}
                      </span>
                    </td>
                    <td className="px-3 py-2.5"><UrgencyBadge urgency={t.urgency} /></td>
                    <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{t.company}</td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{t.department}</td>
                    <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{t.requester}</td>
                    <td className="px-3 py-2.5 max-w-[260px]">
                      <p className="truncate text-gray-700" title={t.content || t.title}>
                        {t.content || t.title || "—"}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">
                      {(t.submittedAt || "").slice(0, 10) || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{t.assignee || "—"}</td>
                    <td className="px-3 py-2.5">
                      {t.notionUrl && (
                        <a href={t.notionUrl} target="_blank" rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-700 flex items-center gap-0.5 whitespace-nowrap transition-colors">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                          보기
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
