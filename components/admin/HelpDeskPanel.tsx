"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import type { HelpDeskTicket } from "@/lib/notion";
import type { FeedbackEntry } from "@/app/api/feedback/route";

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

function getMonthRange(start: string, end: string): string[] {
  const result: string[] = [];
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    result.push(`${y}-${String(m).padStart(2, "0")}`);
    m++; if (m > 12) { m = 1; y++; }
  }
  return result;
}

function nowYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function oneYearAgo(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
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

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-1">
      <div className="text-2xl font-extrabold" style={{ color }}>{value}</div>
      <div className="text-xs font-medium text-gray-500">{label}</div>
    </div>
  );
}

// ── Monthly Line Chart (SVG) ─────────────────────────────────
function MonthlyLineChart({ data }: { data: { month: string; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1);
  const W = 600, H = 170, PAD_X = 40, PAD_TOP = 20, PAD_BOT = 28;
  const chartH = H - PAD_TOP - PAD_BOT;
  const chartW = W - PAD_X * 2;
  const n = data.length;

  const xOf = (i: number) => PAD_X + (i / Math.max(n - 1, 1)) * chartW;
  const yOf = (v: number) => PAD_TOP + chartH * (1 - v / max);

  const points = data.map((d, i) => `${xOf(i)},${yOf(d.count)}`).join(" ");
  const areaPoints = [
    `${xOf(0)},${PAD_TOP + chartH}`,
    ...data.map((d, i) => `${xOf(i)},${yOf(d.count)}`),
    `${xOf(n - 1)},${PAD_TOP + chartH}`,
  ].join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
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

      {/* Area fill */}
      {n > 1 && <polygon points={areaPoints} fill="url(#lineGrad)" />}

      {/* Line */}
      {n > 1 && (
        <polyline points={points} fill="none" stroke="#7C3AED" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      )}

      {/* Dots + labels + x-axis */}
      {data.map((d, i) => {
        const cx = xOf(i), cy = yOf(d.count);
        return (
          <g key={d.month}>
            <circle cx={cx} cy={cy} r={4} fill="white" stroke="#7C3AED" strokeWidth={2} />
            {d.count > 0 && (
              <text x={cx} y={cy - 9} textAnchor="middle" fontSize={10} fontWeight="700" fill="#5B21B6">
                {d.count}
              </text>
            )}
            <text x={cx} y={H - 4} textAnchor="middle" fontSize={10} fill="#94A3B8">
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

// ── Star display ─────────────────────────────────────────────
function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <span key={s} style={{ color: s <= rating ? "#F59E0B" : "#D1D5DB", fontSize: 13 }}>★</span>
      ))}
    </span>
  );
}

// ── HTML Report Generator ────────────────────────────────────
function generateReportHTML(opts: {
  company: string;
  startMonth: string;
  endMonth: string;
  tickets: HelpDeskTicket[];
  feedbacks: Record<string, FeedbackEntry>;
}): string {
  const { company, startMonth, endMonth, tickets, feedbacks } = opts;
  const months = getMonthRange(startMonth, endMonth);

  const filtered = tickets.filter(t => {
    const inRange = (t.submittedAt || "").slice(0, 7) >= startMonth
                 && (t.submittedAt || "").slice(0, 7) <= endMonth;
    const inCompany = company === "all" || t.company === company;
    return inRange && inCompany;
  });

  const total     = filtered.length;
  const done      = filtered.filter(t => t.status === "완료").length;
  const inProg    = filtered.filter(t => t.status === "진행 중").length;
  const completed = filtered.filter(t => t.status === "완료");
  const avgDays   = completed.length > 0
    ? Math.round(completed.reduce((s, t) => s + processingDays(t.submittedAt, t.lastEditedAt), 0) / completed.length)
    : null;

  const byType: Record<string, number> = {};
  filtered.forEach(t => { if (t.inquiryType) byType[t.inquiryType] = (byType[t.inquiryType] ?? 0) + 1; });
  const typeRows = Object.entries(byType).sort((a, b) => b[1] - a[1]);

  const monthly = months.map(m => ({
    label: monthLabel(m),
    count: filtered.filter(t => (t.submittedAt || "").startsWith(m)).length,
  }));

  const fbList = filtered.map(t => feedbacks[t.id]).filter(Boolean) as FeedbackEntry[];
  const avgRating = fbList.length > 0
    ? (fbList.reduce((s, f) => s + f.rating, 0) / fbList.length).toFixed(1)
    : null;

  const periodLabel = startMonth === endMonth ? monthLabel(startMonth)
    : `${monthLabel(startMonth)} ~ ${monthLabel(endMonth)}`;
  const companyLabel = company === "all" ? "전체 법인" : company;
  const today = new Date().toLocaleDateString("ko-KR");

  const maxMonthly = Math.max(...monthly.map(m => m.count), 1);
  const chartH = 120, chartW = 520, padX = 40, padY = 20;
  const n = monthly.length;
  const xOf = (i: number) => padX + (i / Math.max(n - 1, 1)) * (chartW - padX * 2);
  const yOf = (v: number) => padY + (chartH - padY * 2) * (1 - v / maxMonthly);
  const linePoints = monthly.map((m, i) => `${xOf(i)},${yOf(m.count)}`).join(" ");

  const tableRows = filtered.slice(0, 200).map(t => `
    <tr>
      <td>${(t.submittedAt || "").slice(0, 10)}</td>
      <td>${t.company || "—"}</td>
      <td>${t.department || "—"}</td>
      <td>${t.requester || "—"}</td>
      <td>${t.inquiryType || "—"}</td>
      <td>${t.urgency || "—"}</td>
      <td class="content">${(t.content || t.title || "—").replace(/</g, "&lt;")}</td>
      <td><span class="badge ${t.status === "완료" ? "done" : "prog"}">${t.status}</span></td>
      <td>${t.assignee || "—"}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>문의 접수 현황 보고서 · ${companyLabel} · ${periodLabel}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; background: #F8FAFC; color: #1E293B; }
  .page { max-width: 1000px; margin: 0 auto; padding: 40px 32px; }
  .cover { text-align: center; padding: 60px 0 40px; border-bottom: 2px solid #E2E8F0; margin-bottom: 32px; }
  .cover h1 { font-size: 28px; font-weight: 800; color: #1E293B; margin-bottom: 8px; }
  .cover .meta { font-size: 14px; color: #64748B; margin-top: 6px; }
  .cover .period { display: inline-block; background: #7C3AED; color: white; padding: 4px 16px; border-radius: 20px; font-size: 13px; font-weight: 700; margin-top: 12px; }
  .section { margin-bottom: 32px; }
  .section-title { font-size: 15px; font-weight: 700; color: #334155; border-left: 4px solid #7C3AED; padding-left: 10px; margin-bottom: 16px; }
  .stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 24px; }
  .stat-card { background: white; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; text-align: center; }
  .stat-card .value { font-size: 26px; font-weight: 800; color: #7C3AED; }
  .stat-card .label { font-size: 11px; color: #94A3B8; margin-top: 4px; }
  .chart-box { background: white; border: 1px solid #E2E8F0; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
  .chart-title { font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; border: 1px solid #E2E8F0; font-size: 12px; }
  thead th { background: #F1F5F9; padding: 10px 12px; text-align: left; font-weight: 600; color: #475569; border-bottom: 1px solid #E2E8F0; white-space: nowrap; }
  tbody td { padding: 9px 12px; border-bottom: 1px solid #F8FAFC; color: #334155; vertical-align: top; }
  tbody tr:hover td { background: #F8FAFC; }
  td.content { max-width: 260px; }
  .badge { padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 700; }
  .badge.done { background: #F0FDF4; color: #059669; }
  .badge.prog { background: #EFF6FF; color: #1D4ED8; }
  .type-bar { margin-bottom: 10px; }
  .type-row { display: flex; align-items: center; gap-8px; margin-bottom: 8px; }
  .type-label { font-size: 12px; color: #475569; width: 140px; flex-shrink: 0; }
  .bar-wrap { flex: 1; background: #F1F5F9; border-radius: 6px; height: 20px; overflow: hidden; }
  .bar-fill { height: 100%; background: #7C3AED; border-radius: 6px; display: flex; align-items: center; padding-left: 8px; }
  .bar-fill span { color: white; font-size: 10px; font-weight: 700; }
  .footer { text-align: center; padding: 24px 0 8px; font-size: 11px; color: #CBD5E1; border-top: 1px solid #E2E8F0; margin-top: 40px; }
  @media print { body { background: white; } .page { padding: 20px; } }
</style>
</head>
<body>
<div class="page">

  <div class="cover">
    <h1>문의 접수 현황 보고서</h1>
    <div class="meta">IDS 자산관리파트 Help Desk · ${companyLabel}</div>
    <div><span class="period">${periodLabel}</span></div>
    <div class="meta" style="margin-top:10px;">작성일: ${today}</div>
  </div>

  <!-- 요약 -->
  <div class="section">
    <div class="section-title">요약 통계</div>
    <div class="stats">
      <div class="stat-card"><div class="value">${total}</div><div class="label">전체 접수</div></div>
      <div class="stat-card"><div class="value" style="color:#1D4ED8">${inProg}</div><div class="label">진행 중</div></div>
      <div class="stat-card"><div class="value" style="color:#059669">${done}</div><div class="label">완료</div></div>
      <div class="stat-card"><div class="value" style="color:#B45309">${avgDays !== null ? avgDays + "일" : "—"}</div><div class="label">평균 처리일</div></div>
      <div class="stat-card"><div class="value" style="color:#F59E0B">${avgRating ? "★ " + avgRating : "—"}</div><div class="label">평균 만족도</div></div>
    </div>
  </div>

  <!-- 월별 추이 -->
  <div class="section">
    <div class="section-title">월별 접수 추이</div>
    <div class="chart-box">
      <svg viewBox="0 0 ${chartW} ${chartH}" width="100%" style="overflow:visible">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#7C3AED" stop-opacity="0.15"/>
            <stop offset="100%" stop-color="#7C3AED" stop-opacity="0"/>
          </linearGradient>
        </defs>
        ${[0,0.25,0.5,0.75,1].map(p => {
          const y = padY + (chartH - padY*2) * (1 - p);
          return `<line x1="${padX}" y1="${y}" x2="${chartW - padX}" y2="${y}" stroke="#F1F5F9" stroke-width="1"/>
                  <text x="${padX - 5}" y="${y + 4}" text-anchor="end" font-size="9" fill="#94A3B8">${Math.round(maxMonthly * p)}</text>`;
        }).join("")}
        ${n > 1 ? `<polygon points="${padX},${chartH - padY} ${linePoints} ${xOf(n-1)},${chartH - padY}" fill="url(#g)"/>` : ""}
        ${n > 1 ? `<polyline points="${linePoints}" fill="none" stroke="#7C3AED" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>` : ""}
        ${monthly.map((m, i) => {
          const cx = xOf(i), cy = yOf(m.count);
          return `<circle cx="${cx}" cy="${cy}" r="4" fill="white" stroke="#7C3AED" stroke-width="2"/>
                  ${m.count > 0 ? `<text x="${cx}" y="${cy - 9}" text-anchor="middle" font-size="9" font-weight="700" fill="#5B21B6">${m.count}</text>` : ""}
                  <text x="${cx}" y="${chartH - 2}" text-anchor="middle" font-size="9" fill="#94A3B8">${m.label}</text>`;
        }).join("")}
      </svg>
    </div>
  </div>

  <!-- 유형별 현황 -->
  ${typeRows.length > 0 ? `
  <div class="section">
    <div class="section-title">문의유형별 현황</div>
    <div class="chart-box">
      ${typeRows.map(([type, count]) => {
        const pct = total > 0 ? Math.max((count / total) * 100, count > 0 ? 2 : 0) : 0;
        return `<div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
            <span style="color:#475569;font-weight:600">${type}</span>
            <span style="color:#94A3B8">${count}건 · ${Math.round(count/total*100)}%</span>
          </div>
          <div style="background:#F1F5F9;border-radius:6px;height:20px;overflow:hidden">
            <div style="width:${pct}%;background:#7C3AED;height:100%;border-radius:6px;display:flex;align-items:center;padding-left:8px">
              <span style="color:white;font-size:10px;font-weight:700">${count}</span>
            </div>
          </div>
        </div>`;
      }).join("")}
    </div>
  </div>` : ""}

  <!-- 목록 -->
  <div class="section">
    <div class="section-title">문의 목록 ${filtered.length > 200 ? "(최대 200건 표시)" : `(${filtered.length}건)`}</div>
    <table>
      <thead>
        <tr>
          <th>접수일</th><th>법인</th><th>부서</th><th>문의자</th>
          <th>유형</th><th>긴급도</th><th>문의내용</th><th>상태</th><th>담당자</th>
        </tr>
      </thead>
      <tbody>${tableRows || '<tr><td colspan="9" style="text-align:center;padding:20px;color:#94A3B8">데이터 없음</td></tr>'}</tbody>
    </table>
  </div>

  <div class="footer">IDS 자산관리파트 · PC/OA 관리팀 · 본 보고서는 자동 생성되었습니다.</div>
</div>
</body>
</html>`;
}

// ── Main Panel ───────────────────────────────────────────────
type Tab = "overview" | "type" | "company" | "list" | "report" | "assignee" | "repeat";

export default function HelpDeskPanel({ company: companyFilter = "" }: { company?: string }) {
  const [tickets, setTickets]       = useState<HelpDeskTicket[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [tab, setTab]               = useState<Tab>("overview");
  const [feedbacks, setFeedbacks]   = useState<Record<string, FeedbackEntry>>({});
  const [copiedId, setCopiedId]     = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [emailSentIds, setEmailSentIds] = useState<Set<string>>(new Set());

  const [listFilter, setListFilter] = useState({
    status: "all", type: "all", company: "all", urgency: "all", search: "",
  });

  // Report state
  const [reportCompany,    setReportCompany]    = useState("all");
  const [reportStartMonth, setReportStartMonth] = useState(oneYearAgo);
  const [reportEndMonth,   setReportEndMonth]   = useState(nowYearMonth);

  const load = useCallback((force = false) => {
    setLoading(true);
    setError(null);
    fetch(`/api/helpdesk${force ? "?refresh=1" : ""}`)
      .then(r => r.json())
      .then(res => {
        if (res.error) setError(res.error);
        setTickets(res.data ?? []);
        setLastSynced(res.lastSynced ?? null);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // 완료 티켓의 피드백 로드
  useEffect(() => {
    const completed = tickets.filter(t => t.status === "완료");
    Promise.all(
      completed.map(t =>
        fetch(`/api/feedback?id=${t.id}`)
          .then(r => r.json())
          .then(res => res.data ? [t.id, res.data] as const : null)
          .catch(() => null)
      )
    ).then(results => {
      const map: Record<string, FeedbackEntry> = {};
      results.forEach(r => { if (r) map[r[0]] = r[1]; });
      setFeedbacks(map);
    });
  }, [tickets]);

  const months = useMemo(() => last6Months(), []);

  const displayTickets = useMemo(() =>
    companyFilter ? tickets.filter(t => t.company === companyFilter) : tickets,
    [tickets, companyFilter]
  );

  // ── Analytics ────────────────────────────────────────────
  const total      = displayTickets.length;
  const inProgress = displayTickets.filter(t => t.status === "진행 중").length;
  const done       = displayTickets.filter(t => t.status === "완료").length;

  const completedTickets = displayTickets.filter(t => t.status === "완료");
  const avgProcessDays = completedTickets.length > 0
    ? Math.round(completedTickets.reduce((s, t) => s + processingDays(t.submittedAt, t.lastEditedAt), 0) / completedTickets.length)
    : null;

  const fbList     = Object.values(feedbacks);
  const avgRating  = fbList.length > 0
    ? (fbList.reduce((s, f) => s + f.rating, 0) / fbList.length).toFixed(1)
    : null;

  const byType = useMemo(() => {
    const m = new Map<string, number>();
    displayTickets.forEach(t => { if (t.inquiryType) m.set(t.inquiryType, (m.get(t.inquiryType) ?? 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1])
      .map(([type, count], i) => ({ type, count, color: TYPE_COLORS[i % TYPE_COLORS.length] }));
  }, [displayTickets]);

  const byCompany = useMemo(() => {
    const m = new Map<string, number>();
    displayTickets.forEach(t => { if (t.company) m.set(t.company, (m.get(t.company) ?? 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [displayTickets]);

  const byUrgency = useMemo(() => {
    const order = ["매우 급합니다", "조금 급합니다", "기다릴 수 있어요"];
    const m = new Map<string, number>();
    displayTickets.forEach(t => { if (t.urgency) m.set(t.urgency, (m.get(t.urgency) ?? 0) + 1); });
    return order.filter(u => m.has(u)).map(u => [u, m.get(u)!] as [string, number]);
  }, [displayTickets]);

  const monthlyTotal = useMemo(() =>
    months.map(m => ({ month: m, count: displayTickets.filter(t => (t.submittedAt || "").startsWith(m)).length })),
    [displayTickets, months]);

  const companyMonthly = useMemo(() => {
    const companies = [...new Set(displayTickets.map(t => t.company).filter(Boolean))].sort();
    return companies.map(company => ({
      company,
      monthlyCounts: months.map(m => displayTickets.filter(t => t.company === company && (t.submittedAt || "").startsWith(m)).length),
      total: displayTickets.filter(t => t.company === company).length,
    })).sort((a, b) => b.total - a.total);
  }, [displayTickets, months]);

  // ── List filters ─────────────────────────────────────────
  const uniqueTypes     = [...new Set(displayTickets.map(t => t.inquiryType).filter(Boolean))].sort();
  const uniqueCompanies = [...new Set(displayTickets.map(t => t.company).filter(Boolean))].sort();
  const uniqueUrgencies = ["매우 급합니다", "조금 급합니다", "기다릴 수 있어요"].filter(u => displayTickets.some(t => t.urgency === u));

  const filteredList = useMemo(() => displayTickets.filter(t => {
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
  }), [displayTickets, listFilter]);

  // ── Feedback link copy ───────────────────────────────────
  const copyFeedbackLink = (id: string) => {
    const url = `${window.location.origin}/inquiry/feedback/${id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // ── Send feedback email ───────────────────────────────────
  const sendFeedbackEmail = async (ticket: HelpDeskTicket) => {
    if (!ticket.requesterEmail) return;
    setSendingEmail(ticket.id);
    try {
      const res = await fetch("/api/helpdesk/send-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: ticket.id,
          requesterEmail: ticket.requesterEmail,
          requesterName: ticket.requester || "고객",
          ticketContent: ticket.content || ticket.title || "",
          assignee: ticket.assignee || "담당자",
        }),
      });
      const data = await res.json();
      if (res.ok || data.skipped) {
        setEmailSentIds(prev => new Set([...prev, ticket.id]));
      }
    } catch (e) {
      console.error("email send failed", e);
    } finally {
      setSendingEmail(null);
    }
  };

  // ── HTML Report download ─────────────────────────────────
  const downloadReport = () => {
    const html = generateReportHTML({
      company: reportCompany,
      startMonth: reportStartMonth,
      endMonth: reportEndMonth,
      tickets,
      feedbacks,
    });
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const compTag = reportCompany === "all" ? "전체" : reportCompany;
    a.download = `헬프데스크_보고서_${compTag}_${reportStartMonth}~${reportEndMonth}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

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
          <p className="text-sm text-gray-500">
            IDS 자산관리파트 Help Desk{companyFilter ? ` · ${companyFilter}` : ""} · 전체 {total}건
            {lastSynced && (
              <span className="ml-2 text-gray-300 text-[10px]">
                {new Date(lastSynced).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 동기화
              </span>
            )}
          </p>
        </div>
        <button onClick={() => load(true)}
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
      <div className="grid grid-cols-5 gap-3 mb-6">
        <StatCard label="전체 접수"  value={total}                                                    color="#1E40AF" />
        <StatCard label="진행 중"    value={inProgress}                                               color="#1D4ED8" />
        <StatCard label="완료"       value={done}                                                     color="#059669" />
        <StatCard label="평균 처리일" value={avgProcessDays !== null ? `${avgProcessDays}일` : "—"}  color="#7C3AED" />
        <StatCard label="평균 만족도" value={avgRating ? `★ ${avgRating}` : "—"}                     color="#F59E0B" />
      </div>

      {/* ── Tab Bar ── */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit">
        {([
          ["overview",  "📈", "개요"],
          ["type",      "🏷",  "유형분석"],
          ["company",   "🏢", "법인현황"],
          ["assignee",  "👤", "담당자"],
          ["repeat",    "🔁", "반복분석"],
          ["list",      "📋", "목록"],
          ["report",    "📄", "보고서"],
        ] as [Tab, string, string][]).map(([id, icon, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              tab === id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}>
            {icon} {label}
          </button>
        ))}
      </div>

      {/* ════ Tab: 개요 */}
      {tab === "overview" && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4">
              월별 접수 추이
              <span className="text-xs font-normal text-gray-400 ml-2">최근 6개월</span>
            </h3>
            <MonthlyLineChart data={monthlyTotal} />
          </div>

          <div className="grid grid-cols-2 gap-4">
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

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-4">
                최근 접수
                <span className="text-xs font-normal text-gray-400 ml-1">최신 5건</span>
              </h3>
              <div className="space-y-1">
                {displayTickets.slice(0, 5).map(t => (
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

          {/* 만족도 요약 */}
          {fbList.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-4">
                만족도 평가 현황
                <span className="text-xs font-normal text-gray-400 ml-2">{fbList.length}건 수집</span>
              </h3>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-3xl font-extrabold text-amber-500">{avgRating}</div>
                  <Stars rating={Math.round(Number(avgRating))} />
                  <div className="text-[10px] text-gray-400 mt-1">평균 평점</div>
                </div>
                <div className="flex-1 space-y-1.5">
                  {[5,4,3,2,1].map(s => {
                    const cnt = fbList.filter(f => f.rating === s).length;
                    const pct = fbList.length > 0 ? (cnt / fbList.length) * 100 : 0;
                    return (
                      <div key={s} className="flex items-center gap-2 text-xs">
                        <span className="w-3 text-gray-400 text-right">{s}</span>
                        <span className="text-amber-400 text-[11px]">★</span>
                        <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-6 text-gray-400 text-right">{cnt}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════ Tab: 유형분석 */}
      {tab === "type" && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4">문의유형별 현황</h3>
            <div className="space-y-3">
              {byType.map(({ type, count, color }) => (
                <HBar key={type} label={type} count={count} total={total} color={color} />
              ))}
              {byType.length === 0 && <p className="text-xs text-gray-300 text-center py-6">데이터 없음</p>}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4">유형 × 긴급도 교차 분석</h3>
            <div className="overflow-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-100">
                    <th className="text-left py-2.5 pr-5 text-gray-500 font-semibold">문의유형</th>
                    {["매우 급합니다","조금 급합니다","기다릴 수 있어요"].map(u => (
                      <th key={u} className="text-center py-2.5 px-4 text-gray-500 font-semibold whitespace-nowrap">{u}</th>
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

      {/* ════ Tab: 법인현황 */}
      {tab === "company" && (
        <div className="space-y-4">
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
                                  style={{ background: `rgba(124,58,237,${intensity})` }}>
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

      {/* ════ Tab: 목록 */}
      {tab === "list" && (
        <div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex flex-wrap gap-2.5 items-center">
            <input type="text" placeholder="내용 · 요청자 · 부서 검색..."
              value={listFilter.search}
              onChange={e => setListFilter(f => ({ ...f, search: e.target.value }))}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-violet-400 w-52" />

            {([
              { key: "status",  opts: ["all","진행 중","완료"],   label: "상태" },
              { key: "type",    opts: ["all",...uniqueTypes],       label: "유형" },
              { key: "company", opts: ["all",...uniqueCompanies],   label: "법인" },
              { key: "urgency", opts: ["all",...uniqueUrgencies],   label: "긴급도" },
            ] as { key: string; opts: string[]; label: string }[]).map(({ key, opts, label }) => (
              <select key={key}
                value={(listFilter as Record<string, string>)[key]}
                onChange={e => setListFilter(f => ({ ...f, [key]: e.target.value }))}
                className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-violet-400 bg-white text-gray-700">
                <option value="all">{label} 전체</option>
                {opts.filter(o => o !== "all").map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ))}
            <span className="ml-auto text-xs text-gray-400">{filteredList.length}건</span>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 sticky top-0">
                  {["상태","유형","긴급도","법인","부서","문의자","문의내용","접수일","담당자","만족도",""].map((h, i) => (
                    <th key={i} className="px-3 py-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredList.length === 0 ? (
                  <tr><td colSpan={11} className="text-center py-12 text-gray-300">조건에 맞는 데이터가 없습니다</td></tr>
                ) : filteredList.map(t => {
                  const fb = feedbacks[t.id];
                  return (
                    <tr key={t.id} className="border-b border-gray-50 hover:bg-violet-50/20 transition-colors">
                      <td className="px-3 py-2.5"><StatusBadge status={t.status} /></td>
                      <td className="px-3 py-2.5">
                        <span className="text-[10px] font-semibold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded whitespace-nowrap">
                          {t.inquiryType}
                        </span>
                      </td>
                      <td className="px-3 py-2.5"><UrgencyBadge urgency={t.urgency} /></td>
                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{t.company}</td>
                      <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{t.department}</td>
                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{t.requester}</td>
                      <td className="px-3 py-2.5 max-w-[220px]">
                        <p className="truncate text-gray-700" title={t.content || t.title}>
                          {t.content || t.title || "—"}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">
                        {(t.submittedAt || "").slice(0, 10) || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{t.assignee || "—"}</td>
                      <td className="px-3 py-2.5">
                        {fb ? (
                          <div className="flex flex-col gap-0.5">
                            <Stars rating={fb.rating} />
                            {fb.comment && <p className="text-[9px] text-gray-400 max-w-[100px] truncate" title={fb.comment}>{fb.comment}</p>}
                          </div>
                        ) : t.status === "완료" ? (
                          <span className="text-[10px] text-gray-300">미평가</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          {t.notionUrl && (
                            <a href={t.notionUrl} target="_blank" rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-600 transition-colors" title="노션에서 보기">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                              </svg>
                            </a>
                          )}
                          {t.status === "완료" && !fb && (
                            <button onClick={() => copyFeedbackLink(t.id)}
                              title="평가 링크 복사"
                              className="text-violet-400 hover:text-violet-600 transition-colors text-[10px] font-medium whitespace-nowrap">
                              {copiedId === t.id ? "✓ 복사됨" : "평가링크"}
                            </button>
                          )}
                          {t.status === "완료" && t.requesterEmail && !emailSentIds.has(t.id) && (
                            <button onClick={() => sendFeedbackEmail(t)}
                              disabled={sendingEmail === t.id}
                              title={`만족도 평가 이메일 발송 (${t.requesterEmail})`}
                              className="text-blue-400 hover:text-blue-600 transition-colors text-[10px] font-medium whitespace-nowrap disabled:opacity-40">
                              {sendingEmail === t.id ? "발송중..." : "이메일"}
                            </button>
                          )}
                          {t.status === "완료" && emailSentIds.has(t.id) && (
                            <span className="text-green-500 text-[10px] whitespace-nowrap">✓ 발송됨</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════ Tab: 담당자 */}
      {tab === "assignee" && (() => {
        // 담당자별 평가 데이터 집계
        const now = new Date();
        const thisYear = now.getFullYear();

        // 평가가 있는 완료 티켓만 대상
        const ratedTickets = displayTickets.filter(t => t.status === "완료" && feedbacks[t.id] && t.assignee);
        // 전체 배정 티켓 (처리 통계용)
        const assignedTickets = displayTickets.filter(t => t.assignee);

        // 담당자 목록 (배정 티켓 기준으로 확대)
        const assigneeNames = [...new Set(assignedTickets.map(t => t.assignee))].sort();

        if (assigneeNames.length === 0) return (
          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400 text-sm">
            배정된 담당자가 없습니다.<br />
            <span className="text-xs text-gray-300 mt-1 block">Notion에서 티켓에 담당자를 지정해주세요.</span>
          </div>
        );

        // 최근 6개월 라벨
        const recentMonths = last6Months();

        // 담당자별 통계 계산
        const assigneeStats = assigneeNames.map(name => {
          const myRated   = ratedTickets.filter(t => t.assignee === name);
          const myAll     = assignedTickets.filter(t => t.assignee === name);
          const myDone    = myAll.filter(t => t.status === "완료");
          const ratings   = myRated.map(t => feedbacks[t.id].rating);

          // 처리 통계
          const allCount      = myAll.length;
          const doneCount     = myDone.length;
          const completionRate = allCount > 0 ? Math.round((doneCount / allCount) * 100) : 0;
          const avgDays = myDone.length > 0
            ? Math.round(myDone.reduce((s, t) => s + processingDays(t.submittedAt, t.lastEditedAt), 0) / myDone.length)
            : null;

          // 만족도 평균
          const totalAvg = ratings.length > 0
            ? (ratings.reduce((s, r) => s + r, 0) / ratings.length)
            : null;

          // 연평균 (올해)
          const yearRatings = myRated
            .filter(t => new Date(t.lastEditedAt).getFullYear() === thisYear)
            .map(t => feedbacks[t.id].rating);
          const yearAvg = yearRatings.length > 0
            ? (yearRatings.reduce((s, r) => s + r, 0) / yearRatings.length)
            : null;

          // 월별 평균 (최근 6개월)
          const monthlyAvg = recentMonths.map(m => {
            const mRatings = myRated
              .filter(t => (t.lastEditedAt || "").startsWith(m))
              .map(t => feedbacks[t.id].rating);
            return {
              month: m,
              avg: mRatings.length > 0
                ? (mRatings.reduce((s, r) => s + r, 0) / mRatings.length)
                : null,
              count: mRatings.length,
            };
          });

          return { name, totalAvg, yearAvg, monthlyAvg, totalCount: ratings.length, allCount, doneCount, completionRate, avgDays };
        }).sort((a, b) => b.allCount - a.allCount);

        const fmtAvg = (v: number | null) =>
          v !== null ? v.toFixed(1) : "—";

        const ratingColor = (v: number | null) => {
          if (v === null) return "#D1D5DB";
          if (v >= 4.5) return "#059669";
          if (v >= 3.5) return "#7C3AED";
          if (v >= 2.5) return "#F59E0B";
          return "#EF4444";
        };

        return (
          <div className="space-y-4">

            {/* 담당자별 종합 카드 */}
            <div className="grid grid-cols-1 gap-3">
              {assigneeStats.map(({ name, totalAvg, yearAvg, totalCount, allCount, doneCount, completionRate, avgDays }) => (
                <div key={name} className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-4 flex-wrap">
                  <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-violet-600">{name.slice(0, 1)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-800 text-sm">{name}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">평가 수집 {totalCount}건</div>
                  </div>
                  <div className="flex gap-5 flex-wrap">
                    <div className="text-center">
                      <div className="text-lg font-extrabold text-gray-800">{allCount}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">총 배정</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-extrabold text-green-600">{doneCount}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">완료</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-extrabold" style={{ color: completionRate >= 80 ? "#059669" : completionRate >= 50 ? "#F59E0B" : "#EF4444" }}>
                        {completionRate}%
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">완료율</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-extrabold text-violet-600">
                        {avgDays !== null ? `${avgDays}일` : "—"}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">평균 처리일</div>
                    </div>
                    <div className="w-px bg-gray-100 self-stretch mx-1" />
                    <div className="text-center">
                      <div className="text-lg font-extrabold" style={{ color: ratingColor(yearAvg) }}>
                        {fmtAvg(yearAvg)}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{thisYear}년 만족도</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-extrabold" style={{ color: ratingColor(totalAvg) }}>
                        {fmtAvg(totalAvg)}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">전체 만족도</div>
                    </div>
                    {totalCount > 0 && (
                      <div className="text-center">
                        <Stars rating={Math.round(yearAvg ?? totalAvg ?? 0)} />
                        <div className="text-[10px] text-gray-400 mt-0.5">별점</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* 처리 통계 요약 테이블 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-4">담당자별 처리 통계</h3>
              <div className="overflow-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-100">
                      <th className="text-left py-2.5 pr-4 text-gray-500 font-semibold">담당자</th>
                      <th className="text-center py-2.5 px-3 text-gray-500 font-semibold">총 배정</th>
                      <th className="text-center py-2.5 px-3 text-gray-500 font-semibold">완료</th>
                      <th className="text-center py-2.5 px-3 text-gray-500 font-semibold">진행 중</th>
                      <th className="text-center py-2.5 px-3 text-gray-500 font-semibold">완료율</th>
                      <th className="text-center py-2.5 px-3 text-gray-500 font-semibold">평균 처리일</th>
                      <th className="text-center py-2.5 px-3 text-gray-700 font-bold">만족도</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assigneeStats.map(({ name, allCount, doneCount, completionRate, avgDays, totalAvg }) => (
                      <tr key={name} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-2.5 pr-4">
                          <span className="flex items-center gap-1.5">
                            <span className="w-6 h-6 rounded-full bg-violet-100 inline-flex items-center justify-center text-[10px] font-bold text-violet-600 flex-shrink-0">
                              {name.slice(0, 1)}
                            </span>
                            <span className="font-medium text-gray-700">{name}</span>
                          </span>
                        </td>
                        <td className="text-center py-2.5 px-3 font-bold text-gray-800">{allCount}</td>
                        <td className="text-center py-2.5 px-3 font-bold text-green-600">{doneCount}</td>
                        <td className="text-center py-2.5 px-3 text-blue-600 font-medium">{allCount - doneCount}</td>
                        <td className="text-center py-2.5 px-3">
                          <span className="font-bold" style={{ color: completionRate >= 80 ? "#059669" : completionRate >= 50 ? "#F59E0B" : "#EF4444" }}>
                            {completionRate}%
                          </span>
                        </td>
                        <td className="text-center py-2.5 px-3 text-violet-600 font-medium">
                          {avgDays !== null ? `${avgDays}일` : "—"}
                        </td>
                        <td className="text-center py-2.5 px-3">
                          <span className="font-extrabold text-[13px]" style={{ color: ratingColor(totalAvg) }}>
                            {fmtAvg(totalAvg)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 월별 평균 테이블 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-4">
                담당자별 월평균 만족도
                <span className="text-xs font-normal text-gray-400 ml-2">최근 6개월</span>
              </h3>
              <div className="overflow-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-100">
                      <th className="text-left py-2.5 pr-6 text-gray-500 font-semibold whitespace-nowrap">담당자</th>
                      {recentMonths.map(m => (
                        <th key={m} className="text-center py-2.5 px-4 text-gray-500 font-semibold whitespace-nowrap">
                          {monthLabel(m)}
                        </th>
                      ))}
                      <th className="text-center py-2.5 px-4 text-gray-500 font-semibold">{thisYear}년</th>
                      <th className="text-center py-2.5 px-4 text-gray-700 font-bold">전체</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assigneeStats.map(({ name, monthlyAvg, yearAvg, totalAvg }) => (
                      <tr key={name} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-3 pr-6 font-semibold text-gray-700 whitespace-nowrap flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-violet-100 inline-flex items-center justify-center text-[10px] font-bold text-violet-600 flex-shrink-0">
                            {name.slice(0, 1)}
                          </span>
                          {name}
                        </td>
                        {monthlyAvg.map(({ month, avg, count }) => (
                          <td key={month} className="text-center py-3 px-4">
                            {avg !== null ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="font-bold text-[13px]" style={{ color: ratingColor(avg) }}>
                                  {avg.toFixed(1)}
                                </span>
                                <span className="text-[9px] text-gray-300">{count}건</span>
                              </div>
                            ) : <span className="text-gray-200">—</span>}
                          </td>
                        ))}
                        <td className="text-center py-3 px-4">
                          <span className="font-bold text-[13px]" style={{ color: ratingColor(yearAvg) }}>
                            {fmtAvg(yearAvg)}
                          </span>
                        </td>
                        <td className="text-center py-3 px-4">
                          <span className="font-extrabold text-[14px]" style={{ color: ratingColor(totalAvg) }}>
                            {fmtAvg(totalAvg)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 최근 피드백 코멘트 */}
            {(() => {
              const comments = ratedTickets
                .filter(t => feedbacks[t.id]?.comment)
                .sort((a, b) => (feedbacks[b.id].submittedAt > feedbacks[a.id].submittedAt ? 1 : -1))
                .slice(0, 10);
              if (comments.length === 0) return null;
              return (
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h3 className="text-sm font-bold text-gray-800 mb-4">최근 피드백 코멘트</h3>
                  <div className="space-y-3">
                    {comments.map(t => {
                      const fb = feedbacks[t.id];
                      return (
                        <div key={t.id} className="flex gap-3 py-3 border-b border-gray-50 last:border-0">
                          <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center text-[10px] font-bold text-violet-600 flex-shrink-0 mt-0.5">
                            {t.assignee.slice(0, 1)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-gray-700">{t.assignee}</span>
                              <Stars rating={fb.rating} />
                              <span className="text-[10px] text-gray-300 ml-auto">
                                {fb.submittedAt.slice(0, 10)}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 leading-relaxed">{fb.comment}</p>
                            <p className="text-[10px] text-gray-300 mt-1">
                              {[t.company, t.requester].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* ════ Tab: 반복분석 */}
      {tab === "repeat" && (() => {
        const recentMonths = last6Months();

        const typeMonthly = byType.map(({ type, color }) => {
          const counts = recentMonths.map(m =>
            displayTickets.filter(t => t.inquiryType === type && (t.submittedAt || "").startsWith(m)).length
          );
          const totalSum = counts.reduce((s, c) => s + c, 0);
          const lastIdx  = counts.length - 1;
          const curCount = counts[lastIdx];
          const prevCount = counts[lastIdx - 1] ?? 0;
          const otherCounts = counts.slice(0, lastIdx);
          const otherAvg = otherCounts.length > 0
            ? otherCounts.reduce((s, c) => s + c, 0) / otherCounts.length
            : 0;
          const isSpike = curCount >= 2 && otherAvg > 0 && curCount >= otherAvg * 2;
          const trend = curCount > prevCount ? "up" : curCount < prevCount ? "down" : "flat";
          return { type, color, counts, totalSum, curCount, prevCount, otherAvg, isSpike, trend };
        }).filter(({ totalSum }) => totalSum > 0);

        const spikes = typeMonthly.filter(t => t.isSpike);

        return (
          <div className="space-y-4">
            {spikes.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <h3 className="text-sm font-bold text-red-700 mb-2">⚠️ 이번 달 급증 유형 감지</h3>
                <div className="space-y-1">
                  {spikes.map(({ type, curCount, otherAvg }) => (
                    <div key={type} className="text-xs text-red-600 flex items-center gap-2">
                      <span className="font-bold">{type}</span>
                      <span>— 이번 달 {curCount}건</span>
                      <span className="text-red-400">(월평균 {otherAvg.toFixed(1)}건 대비 {Math.round(curCount / Math.max(otherAvg, 0.1))}배)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-4">
                유형별 문의 월간 추이
                <span className="text-xs font-normal text-gray-400 ml-2">최근 6개월</span>
              </h3>
              <div className="overflow-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-100">
                      <th className="text-left py-2.5 pr-4 text-gray-500 font-semibold whitespace-nowrap">유형</th>
                      {recentMonths.map(m => (
                        <th key={m} className="text-center py-2.5 px-3 text-gray-500 font-semibold whitespace-nowrap">{monthLabel(m)}</th>
                      ))}
                      <th className="text-center py-2.5 px-3 text-gray-500 font-semibold">전월비</th>
                      <th className="text-center py-2.5 px-3 text-gray-700 font-bold">합계</th>
                    </tr>
                  </thead>
                  <tbody>
                    {typeMonthly.map(({ type, color, counts, totalSum, curCount, prevCount, isSpike, trend }) => {
                      const maxCnt = Math.max(...counts, 1);
                      return (
                        <tr key={type} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${isSpike ? "bg-red-50/40" : ""}`}>
                          <td className="py-2.5 pr-4">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: color }} />
                              <span className="font-medium text-gray-700 whitespace-nowrap">{type}</span>
                              {isSpike && <span className="text-[9px] bg-red-100 text-red-600 px-1 py-0.5 rounded font-bold">급증</span>}
                            </span>
                          </td>
                          {counts.map((cnt, i) => {
                            const alpha = cnt > 0 ? Math.round((0.25 + (cnt / maxCnt) * 0.75) * 255).toString(16).padStart(2, "0") : "00";
                            return (
                              <td key={i} className="text-center py-2.5 px-3">
                                {cnt > 0 ? (
                                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-white text-[11px] font-bold"
                                    style={{ background: `${color}${alpha}` }}>
                                    {cnt}
                                  </span>
                                ) : <span className="text-gray-200">—</span>}
                              </td>
                            );
                          })}
                          <td className="text-center py-2.5 px-3">
                            <span className={`text-base font-bold ${trend === "up" ? "text-red-500" : trend === "down" ? "text-green-500" : "text-gray-300"}`}>
                              {trend === "up" ? `↑${curCount - prevCount}` : trend === "down" ? `↓${prevCount - curCount}` : "→"}
                            </span>
                          </td>
                          <td className="text-center py-2.5 px-3 font-bold text-gray-800">{totalSum}</td>
                        </tr>
                      );
                    })}
                    {typeMonthly.length === 0 && (
                      <tr><td colSpan={recentMonths.length + 3} className="text-center py-10 text-gray-300">데이터 없음</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {typeMonthly.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                {typeMonthly.slice(0, 6).map(({ type, color, counts }) => {
                  const maxVal = Math.max(...counts, 1);
                  return (
                    <div key={type} className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: color }} />
                        <span className="text-xs font-bold text-gray-700 truncate">{type}</span>
                      </div>
                      <div className="flex items-end gap-1 h-14">
                        {counts.map((cnt, i) => (
                          <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5">
                            {cnt > 0 && <span className="text-[9px] text-gray-400">{cnt}</span>}
                            <div className="w-full rounded-t-sm"
                              style={{
                                height: `${Math.max((cnt / maxVal) * 100, cnt > 0 ? 8 : 0)}%`,
                                background: color,
                                opacity: 0.35 + (cnt / maxVal) * 0.65,
                              }} />
                            <span className="text-[8px] text-gray-300">{monthLabel(recentMonths[i]).slice(-2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ════ Tab: 보고서 */}
      {tab === "report" && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4">보고서 옵션</h3>
            <div className="flex flex-wrap gap-4 items-end">

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">시작 월</label>
                <input type="month" value={reportStartMonth}
                  onChange={e => setReportStartMonth(e.target.value)}
                  max={reportEndMonth}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-violet-400" />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">종료 월</label>
                <input type="month" value={reportEndMonth}
                  onChange={e => setReportEndMonth(e.target.value)}
                  min={reportStartMonth}
                  max={nowYearMonth()}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-violet-400" />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">법인</label>
                <select value={reportCompany} onChange={e => setReportCompany(e.target.value)}
                  className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-violet-400 bg-white text-gray-700">
                  <option value="all">전체 법인</option>
                  {uniqueCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* 빠른 기간 선택 */}
              <div className="flex gap-1.5">
                {[
                  { label: "이번 달", fn: () => { setReportStartMonth(nowYearMonth()); setReportEndMonth(nowYearMonth()); } },
                  { label: "최근 3개월", fn: () => {
                    const d = new Date(); d.setMonth(d.getMonth() - 2);
                    setReportStartMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
                    setReportEndMonth(nowYearMonth());
                  }},
                  { label: "최근 6개월", fn: () => {
                    const d = new Date(); d.setMonth(d.getMonth() - 5);
                    setReportStartMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
                    setReportEndMonth(nowYearMonth());
                  }},
                  { label: "올해", fn: () => {
                    setReportStartMonth(`${new Date().getFullYear()}-01`);
                    setReportEndMonth(nowYearMonth());
                  }},
                ].map(({ label, fn }) => (
                  <button key={label} onClick={fn}
                    className="text-[10px] font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 hover:border-violet-300 hover:text-violet-600 transition-colors">
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 미리보기 요약 */}
          {(() => {
            const previewTickets = tickets.filter(t => {
              const m = (t.submittedAt || "").slice(0, 7);
              const inRange = m >= reportStartMonth && m <= reportEndMonth;
              const inCo = reportCompany === "all" || t.company === reportCompany;
              return inRange && inCo;
            });
            const previewDone = previewTickets.filter(t => t.status === "완료").length;
            const previewFbs  = previewTickets.map(t => feedbacks[t.id]).filter(Boolean) as FeedbackEntry[];
            const previewAvgR = previewFbs.length > 0
              ? (previewFbs.reduce((s,f) => s + f.rating, 0) / previewFbs.length).toFixed(1)
              : null;

            return (
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-5">
                <h3 className="text-sm font-bold text-violet-800 mb-3">
                  보고서 미리보기
                  <span className="text-xs font-normal text-violet-500 ml-2">
                    {reportCompany === "all" ? "전체 법인" : reportCompany} · {monthLabel(reportStartMonth)}~{monthLabel(reportEndMonth)}
                  </span>
                </h3>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "접수 건수", value: previewTickets.length, color: "#7C3AED" },
                    { label: "완료",      value: previewDone,            color: "#059669" },
                    { label: "진행 중",   value: previewTickets.length - previewDone, color: "#1D4ED8" },
                    { label: "평균 만족도", value: previewAvgR ? `★ ${previewAvgR}` : "—", color: "#F59E0B" },
                  ].map(item => (
                    <div key={item.label} className="bg-white rounded-lg p-3 text-center border border-violet-100">
                      <div className="text-xl font-extrabold" style={{ color: item.color }}>{item.value}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{item.label}</div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-violet-600">
                  {previewTickets.length > 0
                    ? `총 ${previewTickets.length}건의 데이터가 포함된 HTML 보고서를 생성합니다.`
                    : "선택한 조건에 해당하는 데이터가 없습니다."}
                </p>
              </div>
            );
          })()}

          <button onClick={downloadReport}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
            style={{ background: "#7C3AED" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            HTML 보고서 다운로드
          </button>

          {/* 만족도 평가 안내 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-3">만족도 평가 링크 안내</h3>
            <p className="text-xs text-gray-500 mb-3">
              문의 처리 완료 후 <strong>목록 탭</strong>에서 완료된 티켓의 <span className="text-violet-600 font-semibold">평가링크</span> 버튼을 눌러 링크를 복사한 뒤 사용자에게 전달하세요.
            </p>
            <div className="bg-violet-50 border border-violet-100 rounded-lg px-4 py-3 font-mono text-[11px] text-violet-700 break-all">
              {typeof window !== "undefined" ? window.location.origin : ""}/inquiry/feedback/[티켓ID]
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
