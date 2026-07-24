"use client";

import { useEffect, useState, useMemo } from "react";
import type { MobileSession } from "@/app/admin/mobile/page";
import type { HelpDeskTicket } from "@/lib/notion";
import { safeJson } from "@/lib/fetch-json";

interface Props {
  session: MobileSession;
}

const URGENCY_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  "매우 급합니다":    { bg: "#FEF2F2", text: "#DC2626", bar: "#EF4444" },
  "조금 급합니다":   { bg: "#FFFBEB", text: "#B45309", bar: "#F59E0B" },
  "기다릴 수 있어요": { bg: "#F0FDF4", text: "#059669", bar: "#10B981" },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  "시작 전": { bg: "#F8FAFC", text: "#64748B" },
  "진행 중": { bg: "#EFF6FF", text: "#1D4ED8" },
  "완료":    { bg: "#F0FDF4", text: "#059669" },
};

function UrgencyBadge({ urgency }: { urgency: string }) {
  const c = URGENCY_COLORS[urgency] ?? { bg: "#F9FAFB", text: "#6B7280", bar: "#9CA3AF" };
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
      style={{ background: c.bg, color: c.text }}>
      {urgency || "—"}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? { bg: "#F9FAFB", text: "#6B7280" };
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap"
      style={{ background: c.bg, color: c.text }}>
      {status || "—"}
    </span>
  );
}

function fmtDate(iso: string) {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

function timeSince(iso: string): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "오늘";
  if (days === 1) return "1일 전";
  if (days < 30) return `${days}일 전`;
  if (days < 365) return `${Math.floor(days / 30)}개월 전`;
  return `${Math.floor(days / 365)}년 전`;
}

function DetailSheet({ ticket, onClose, onStatusChange }: {
  ticket: HelpDeskTicket;
  onClose: () => void;
  onStatusChange: (id: string, status: string) => Promise<void>;
}) {
  const [updating, setUpdating] = useState(false);
  const [statusError, setStatusError] = useState("");
  const STATUSES = ["시작 전", "진행 중", "완료"];

  async function changeStatus(s: string) {
    if (s === ticket.status) return;
    setUpdating(true);
    setStatusError("");
    try {
      await onStatusChange(ticket.id, s);
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : String(e));
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div className="bg-white rounded-t-3xl p-5 max-h-[90dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 pr-3">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <StatusBadge status={ticket.status} />
              <UrgencyBadge urgency={ticket.urgency} />
              {ticket.inquiryType && (
                <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{ticket.inquiryType}</span>
              )}
            </div>
            <div className="text-base font-extrabold text-gray-900 leading-tight">{ticket.title || "—"}</div>
            <div className="text-xs text-gray-500 mt-1">{ticket.company} · {ticket.department}</div>
          </div>
          <button onClick={onClose} className="text-gray-400 p-1 flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* 상태 변경 버튼 */}
        <div className="flex gap-2 mb-4">
          {STATUSES.map(s => {
            const c = STATUS_COLORS[s] ?? { bg: "#F8FAFC", text: "#64748B" };
            const active = ticket.status === s;
            return (
              <button key={s} onClick={() => changeStatus(s)} disabled={updating}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all"
                style={active ? { background: c.text, color: "#fff" } : { background: c.bg, color: c.text }}>
                {s}
              </button>
            );
          })}
        </div>
        {updating && <div className="text-center text-xs text-blue-500 -mt-2 mb-3">업데이트 중...</div>}
        {statusError && <div className="text-center text-xs text-red-500 -mt-2 mb-3">{statusError}</div>}

        {/* 문의 내용 */}
        {ticket.content && (
          <div className="mb-4">
            <div className="text-xs font-semibold text-gray-500 mb-1.5">문의 내용</div>
            <div className="bg-gray-50 rounded-xl p-3.5 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{ticket.content}</div>
          </div>
        )}

        {/* 처리 내용 */}
        {ticket.actionNote && (
          <div className="mb-4">
            <div className="text-xs font-semibold text-gray-500 mb-1.5">처리 내용</div>
            <div className="bg-blue-50 rounded-xl p-3.5 text-sm text-blue-900 leading-relaxed whitespace-pre-wrap">{ticket.actionNote}</div>
          </div>
        )}

        {/* 정보 */}
        <div className="space-y-2.5 text-sm">
          <InfoRow label="요청자" value={`${ticket.requester} (${ticket.requesterEmail || "—"})`} />
          <InfoRow label="담당자" value={ticket.assignee || "미배정"} />
          <InfoRow label="자산번호" value={ticket.assetNo || "—"} />
          <InfoRow label="접수일" value={`${fmtDate(ticket.submittedAt)} (${timeSince(ticket.submittedAt)})`} />
          <InfoRow label="최종수정" value={`${fmtDate(ticket.lastEditedAt)} (${timeSince(ticket.lastEditedAt)})`} />
          {ticket.actionCategory?.length > 0 && (
            <InfoRow label="처리유형" value={ticket.actionCategory.join(", ")} />
          )}
          {ticket.actionMethod && <InfoRow label="처리방법" value={ticket.actionMethod} />}
        </div>

        {ticket.notionUrl && (
          <a href={ticket.notionUrl} target="_blank" rel="noopener noreferrer"
            className="mt-4 flex items-center justify-center gap-1.5 text-xs text-gray-400 py-2">
            Notion에서 보기 ↗
          </a>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-gray-400 w-20 flex-shrink-0 text-xs pt-0.5">{label}</span>
      <span className="flex-1 font-medium text-gray-900 text-sm break-all">{value || "—"}</span>
    </div>
  );
}

export default function MobileHelpDesk({ session }: Props) {
  const [tickets, setTickets] = useState<HelpDeskTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("미완료");
  const [filterUrgency, setFilterUrgency] = useState("전체");
  const [selected, setSelected] = useState<HelpDeskTicket | null>(null);
  const [error, setError] = useState("");

  const isSuper = session.role === "super";
  const companyParam = !isSuper && session.company ? `?company=${encodeURIComponent(session.company)}` : "";

  useEffect(() => {
    fetch(`/api/helpdesk${companyParam}`)
      .then(r => safeJson(r))
      .then(data => {
        if (Array.isArray(data.data)) setTickets(data.data);
        else if (data.error) setError(data.error);
        else setError("데이터를 불러오지 못했습니다.");
      })
      .catch(() => setError("네트워크 오류"))
      .finally(() => setLoading(false));
  }, [companyParam]);

  async function handleStatusChange(id: string, status: string) {
    const res = await fetch("/api/helpdesk/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, fields: { status } }),
    });
    const json = await safeJson(res);
    if (!json.ok) throw new Error(json.error ?? "상태 변경 실패");
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    setSelected(prev => prev?.id === id ? { ...prev, status } : prev);
  }

  const urgencyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    tickets.filter(t => t.status !== "완료").forEach(t => {
      counts[t.urgency] = (counts[t.urgency] ?? 0) + 1;
    });
    return counts;
  }, [tickets]);

  const filtered = useMemo(() => {
    return tickets.filter(t => {
      if (filterStatus === "미완료" && t.status === "완료") return false;
      if (filterStatus === "완료" && t.status !== "완료") return false;
      if (filterUrgency !== "전체" && t.urgency !== filterUrgency) return false;
      if (search) {
        const q = search.toLowerCase();
        return [t.title, t.requester, t.company, t.department, t.inquiryType, t.assignee].some(v => v?.toLowerCase().includes(q));
      }
      return true;
    });
  }, [tickets, filterStatus, filterUrgency, search]);

  return (
    <div className="flex flex-col h-full">
      {/* 긴급도별 칩 요약 */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {Object.entries(URGENCY_COLORS).map(([urgency, colors]) => {
            const cnt = urgencyCounts[urgency] ?? 0;
            if (cnt === 0) return null;
            return (
              <button key={urgency}
                onClick={() => { setFilterUrgency(urgency); setFilterStatus("미완료"); }}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border"
                style={{ background: colors.bg, color: colors.text, borderColor: colors.bar + "44" }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: colors.bar }} />
                {urgency} {cnt}
              </button>
            );
          })}
        </div>
      </div>

      {/* 필터 */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 space-y-2">
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="제목 · 요청자 · 법인 · 담당자 검색..."
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400"
        />
        <div className="flex gap-2">
          {["미완료", "완료", "전체"].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors
                ${filterStatus === s ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>
              {s}
            </button>
          ))}
          {filterUrgency !== "전체" && (
            <button onClick={() => setFilterUrgency("전체")}
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
              {filterUrgency} ✕
            </button>
          )}
        </div>
      </div>

      {/* 목록 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading && <div className="text-center text-gray-400 text-sm py-8">로딩 중...</div>}
        {error && <div className="text-center text-red-500 text-sm py-8">{error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-8">조건에 맞는 티켓이 없습니다</div>
        )}
        {filtered.map(t => {
          const uc = URGENCY_COLORS[t.urgency];
          return (
            <button key={t.id} onClick={() => setSelected(t)}
              className="w-full bg-white rounded-2xl shadow-sm p-4 text-left active:opacity-70 transition-opacity">
              {/* 긴급도 바 */}
              {uc && <div className="h-0.5 rounded-full mb-3" style={{ background: uc.bar }} />}
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <StatusBadge status={t.status} />
                    <UrgencyBadge urgency={t.urgency} />
                    {t.inquiryType && (
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{t.inquiryType}</span>
                    )}
                  </div>
                  <div className="font-bold text-gray-900 text-sm leading-tight">{t.title || "제목 없음"}</div>
                  <div className="text-xs text-gray-500 mt-1">{t.requester} · {t.company}</div>
                  {t.assignee && <div className="text-xs text-gray-400 mt-0.5">담당: {t.assignee}</div>}
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="text-xs text-gray-400">{timeSince(t.submittedAt)}</div>
                </div>
              </div>
              {t.content && (
                <div className="mt-2 text-xs text-gray-400 line-clamp-2 leading-relaxed">{t.content}</div>
              )}
            </button>
          );
        })}
        <div className="text-center text-xs text-gray-300 py-2">{filtered.length}건 / 전체 {tickets.length}건</div>
      </div>

      {selected && (
        <DetailSheet ticket={selected} onClose={() => setSelected(null)} onStatusChange={handleStatusChange} />
      )}
    </div>
  );
}
