"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import type { MeetingRentalTicket, MeetingEquipment } from "@/types";
import EnvVarMissing from "@/components/ui/EnvVarMissing";
import { safeJson } from "@/lib/fetch-json";
import { useAdminDarkMode } from "@/lib/use-admin-dark-mode";

const COMPANIES = [
  "대웅", "대웅제약", "대웅바이오", "대웅개발", "대웅펫",
  "IdsTrust", "한올바이오파마", "시지바이오", "시지메디텍", "엠서클",
  "유와이즈원", "더편한샵", "디엔코스메틱스", "페이지원", "HR코리아",
  "클리슈어리서치", "아이엔테라퓨틱스", "아피셀테라퓨틱스", "다나아데이터", "기타",
];

const TICKET_STATUSES = ["시작 전", "진행 중", "완료"] as const;
const TICKET_STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  "시작 전": { bg: "#FAFAFA", text: "#71717A" },
  "진행 중": { bg: "#FFF7ED", text: "#C2410C" },
  "완료":    { bg: "#F0FDF4", text: "#059669" },
};

function fmtDate(d?: string) { return d ? d.slice(0, 10) : "—"; }
function fmtDateTime(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}
function daysLeft(d?: string): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-1">
      <div className="text-2xl font-extrabold" style={{ color }}>{value}</div>
      <div className="text-xs font-medium text-gray-500">{label}</div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// 신청 티켓 탭
// ──────────────────────────────────────────────────────────────

function InlineTicketStatusCell({ ticket, onUpdated }: {
  ticket: MeetingRentalTicket;
  onUpdated: (id: string, fields: Partial<MeetingRentalTicket>) => void;
}) {
  const dark = useAdminDarkMode();
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<"idle" | "done" | "error">("idle");

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as MeetingRentalTicket["status"];
    setSaving(true); setResult("idle");
    try {
      const res = await fetch("/api/meeting-rental-tickets/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ticket.id, fields: { status: newStatus } }),
      });
      const json = await safeJson(res);
      if (json.ok) { onUpdated(ticket.id, { status: newStatus }); setResult("done"); }
      else setResult("error");
    } catch { setResult("error"); }
    finally { setSaving(false); setTimeout(() => setResult("idle"), 2000); }
  };

  const c = TICKET_STATUS_STYLE[ticket.status] ?? { bg: "#F4F4F5", text: "#71717A" };
  return (
    <div className="flex items-center gap-1">
      <select
        value={ticket.status}
        onChange={handleChange}
        disabled={saving}
        style={{ background: dark ? "#18181B" : c.bg, color: c.text }}
        className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-transparent focus:outline-none focus:ring-1 focus:ring-blue-200 cursor-pointer disabled:opacity-50 appearance-none"
      >
        {TICKET_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      {saving && <span className="text-[9px] text-gray-400">⋯</span>}
      {result === "done"  && <span className="text-[9px] text-green-600">✓</span>}
      {result === "error" && <span className="text-[9px] text-red-500">!</span>}
    </div>
  );
}

function InlineTicketAssigneeCell({ ticket, assigneeList, onUpdated }: {
  ticket: MeetingRentalTicket;
  assigneeList: { id: string; name: string }[];
  onUpdated: (id: string, fields: Partial<MeetingRentalTicket>) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<"idle" | "done" | "error">("idle");

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newName = e.target.value;
    setSaving(true); setResult("idle");
    try {
      const found = assigneeList.find(u => u.name === newName);
      const res = await fetch("/api/meeting-rental-tickets/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ticket.id, fields: { assigneeId: found?.id ?? "" } }),
      });
      const json = await safeJson(res);
      if (json.ok) {
        onUpdated(ticket.id, { assignee: newName || "", assigneeId: found?.id ?? "" });
        setResult("done");
      } else setResult("error");
    } catch { setResult("error"); }
    finally { setSaving(false); setTimeout(() => setResult("idle"), 2000); }
  };

  return (
    <div className="flex items-center gap-1">
      <select
        value={ticket.assignee ?? ""}
        onChange={handleChange}
        disabled={saving}
        className="text-xs text-gray-600 border border-transparent hover:border-gray-200 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-200 rounded-lg px-1 py-0.5 cursor-pointer disabled:opacity-50 max-w-[96px]"
      >
        <option value="">미배정</option>
        {assigneeList.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
      </select>
      {saving && <span className="text-[9px] text-gray-400">⋯</span>}
      {result === "done"  && <span className="text-[9px] text-green-600">✓</span>}
      {result === "error" && <span className="text-[9px] text-red-500">!</span>}
    </div>
  );
}

function TicketDetailModal({ ticket, onClose }: { ticket: MeetingRentalTicket; onClose: () => void }) {
  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-start gap-4 py-3 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 w-20 shrink-0 pt-0.5">{label}</span>
      <div className="flex-1 text-sm text-gray-800">{children}</div>
    </div>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">{ticket.requester || "—"}님의 대여신청</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="px-6 py-1">
          <Row label="법인"><span>{ticket.company || "—"}</span></Row>
          <Row label="부서"><span>{ticket.department || "—"}</span></Row>
          <Row label="이메일"><span>{ticket.email || "—"}</span></Row>
          <Row label="신청 기간">
            <span>{ticket.startAt && ticket.endAt ? `${fmtDateTime(ticket.startAt)} ~ ${fmtDateTime(ticket.endAt)}` : "—"}</span>
          </Row>
          <Row label="상태"><span>{ticket.status}</span></Row>
          <Row label="담당자"><span>{ticket.assignee || "미배정"}</span></Row>
          <Row label="제출일"><span>{fmtDateTime(ticket.createdAt)}</span></Row>
        </div>
        {ticket.notionUrl && (
          <div className="px-6 py-4 border-t border-gray-100">
            <a href={ticket.notionUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
              노션에서 보기 ↗
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function TicketsTab() {
  const [tickets, setTickets]       = useState<MeetingRentalTicket[]>([]);
  const [loading, setLoading]       = useState(true);
  const [missingEnv, setMissingEnv] = useState<string | null>(null);
  const [assigneeList, setAssigneeList] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch]         = useState("");
  const [filterCompany, setFilterCompany] = useState("전체");
  const [filterStatus, setFilterStatus]   = useState("전체");
  const [detailTicket, setDetailTicket]   = useState<MeetingRentalTicket | null>(null);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/meeting-rental-tickets${refresh ? "?refresh=1" : ""}`);
      const json = await safeJson(res);
      if (json.missingEnv) { setMissingEnv(json.missingEnv); return; }
      setTickets(json.data ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch("/api/repair-tickets/assignees")
      .then(r => safeJson(r))
      .then(res => { if (res.ok) setAssigneeList(res.assignees ?? []); })
      .catch(() => {});
  }, []);

  const handleUpdated = useCallback((id: string, fields: Partial<MeetingRentalTicket>) => {
    setTickets(prev => prev.map(t => t.id === id ? { ...t, ...fields } : t));
    setDetailTicket(prev => prev && prev.id === id ? { ...prev, ...fields } : prev);
  }, []);

  const companyOptions = useMemo(() =>
    ["전체", ...Array.from(new Set(tickets.map(t => t.company).filter(Boolean))).sort()], [tickets]);

  const stats = useMemo(() => ({
    total:      tickets.length,
    notStarted: tickets.filter(t => t.status === "시작 전").length,
    inProgress: tickets.filter(t => t.status === "진행 중").length,
    done:       tickets.filter(t => t.status === "완료").length,
  }), [tickets]);

  const filtered = useMemo(() => tickets.filter(t => {
    if (filterCompany !== "전체" && t.company !== filterCompany) return false;
    if (filterStatus  !== "전체" && t.status  !== filterStatus)  return false;
    if (search) {
      const q = search.toLowerCase();
      if (![t.requester, t.department, t.email, t.company].some(v => v?.toLowerCase().includes(q))) return false;
    }
    return true;
  }), [tickets, filterCompany, filterStatus, search]);

  if (loading) return <div className="text-center py-20 text-gray-400">데이터 로딩 중…</div>;
  if (missingEnv) return <EnvVarMissing varName={missingEnv} />;

  return (
    <div>
      <div className="flex items-end justify-between mb-4">
        <div className="text-sm text-gray-500">{filtered.length}건 조회됨</div>
        <button onClick={() => load(true)}
          className="px-3 py-2 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors">
          🔄 새로고침
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-5">
        <StatCard label="전체"   value={stats.total}      color="#18181B" />
        <StatCard label="시작 전" value={stats.notStarted} color="#71717A" />
        <StatCard label="진행 중" value={stats.inProgress} color="#C2410C" />
        <StatCard label="완료"   value={stats.done}       color="#059669" />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 space-y-3">
        <div className="relative">
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-3 pr-8 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="신청자, 부서, 이메일, 법인 검색…" />
          {search && <button onClick={() => setSearch("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-base">×</button>}
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)}
            className={`appearance-none px-3 py-2 border rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer ${filterCompany !== "전체" ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-gray-300 text-gray-600"}`}>
            <option value="전체">법인: 전체</option>
            {companyOptions.filter(o => o !== "전체").map(o => <option key={o}>{o}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className={`appearance-none px-3 py-2 border rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer ${filterStatus !== "전체" ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-gray-300 text-gray-600"}`}>
            <option value="전체">상태: 전체</option>
            {TICKET_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-auto shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {["신청자", "법인", "부서", "이메일", "신청기간", "상태", "담당자", "제출일"].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">검색 결과가 없습니다</td></tr>
            ) : filtered.map(t => (
              <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50/80 transition-colors">
                <td className="px-3 py-3 whitespace-nowrap cursor-pointer" onClick={() => setDetailTicket(t)}>
                  <span className="text-xs font-semibold text-blue-600 hover:underline">{t.requester || "—"}</span>
                </td>
                <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">{t.company || "—"}</td>
                <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{t.department || "—"}</td>
                <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{t.email || "—"}</td>
                <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">
                  {t.startAt && t.endAt ? `${fmtDateTime(t.startAt)} ~ ${fmtDateTime(t.endAt)}` : "—"}
                </td>
                <td className="px-3 py-3 whitespace-nowrap"><InlineTicketStatusCell ticket={t} onUpdated={handleUpdated} /></td>
                <td className="px-3 py-3 whitespace-nowrap"><InlineTicketAssigneeCell ticket={t} assigneeList={assigneeList} onUpdated={handleUpdated} /></td>
                <td className="px-3 py-3 text-xs text-gray-400 whitespace-nowrap">{fmtDateTime(t.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detailTicket && <TicketDetailModal ticket={detailTicket} onClose={() => setDetailTicket(null)} />}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// 장비 현황 탭
// ──────────────────────────────────────────────────────────────

function EquipmentStatusBadge({ status }: { status: string }) {
  const isRented = status.includes("대여중");
  const cls = isRented ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-700";
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${cls}`}>{status || "—"}</span>;
}

function DDay({ date }: { date: string }) {
  const d = daysLeft(date);
  if (d === null) return <span className="text-gray-400 text-xs">—</span>;
  if (d < 0)   return <span className="text-red-600 font-bold text-xs bg-red-50 px-1.5 py-0.5 rounded-full">D+{Math.abs(d)} 초과</span>;
  if (d === 0) return <span className="text-red-600 font-bold text-xs bg-red-50 px-1.5 py-0.5 rounded-full">D-Day</span>;
  if (d <= 7)  return <span className="text-orange-600 font-semibold text-xs bg-orange-50 px-1.5 py-0.5 rounded-full">D-{d}</span>;
  return <span className="text-gray-500 text-xs">{fmtDate(date)}</span>;
}

function EquipmentFormModal({ title, initial, onSave, onClose, showInUse }: {
  title: string;
  initial: {
    name: string; company: string; department: string; currentUser: string;
    userEmail: string; startDate: string; returnDue: string; note: string; inUse: boolean;
  };
  onSave: (fields: typeof initial) => Promise<void>;
  onClose: () => void;
  showInUse: boolean;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof initial, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.name.trim()) { setError("장비명은 필수입니다."); return; }
    setSaving(true); setError("");
    try { await onSave(form); onClose(); }
    catch (e) { setError(String(e)); }
    finally { setSaving(false); }
  }

  const lbl = "block text-xs font-semibold text-gray-500 mb-1";
  const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 bg-blue-600 text-white flex items-center justify-between shrink-0">
          <div className="font-bold text-base">{title}</div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          <div><label className={lbl}>장비명 *</label>
            <input value={form.name} onChange={e => set("name", e.target.value)} className={inp} placeholder="예: 무선 마이크 #1" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>법인</label>
              <select value={form.company} onChange={e => set("company", e.target.value)} className={inp}>
                <option value="">— 선택 —</option>
                {COMPANIES.map(c => <option key={c}>{c}</option>)}
              </select></div>
            <div><label className={lbl}>부서</label>
              <input value={form.department} onChange={e => set("department", e.target.value)} className={inp} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>현재사용자</label>
              <input value={form.currentUser} onChange={e => set("currentUser", e.target.value)} className={inp} /></div>
            <div><label className={lbl}>사용자 이메일</label>
              <input type="email" value={form.userEmail} onChange={e => set("userEmail", e.target.value)} className={inp} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>대여시작일</label>
              <input type="date" value={form.startDate} onChange={e => set("startDate", e.target.value)} className={inp} /></div>
            <div><label className={lbl}>반납예정일</label>
              <input type="date" value={form.returnDue} onChange={e => set("returnDue", e.target.value)} className={inp} /></div>
          </div>
          <div><label className={lbl}>비고</label>
            <input value={form.note} onChange={e => set("note", e.target.value)} className={inp} /></div>
          {showInUse && (
            <label className="flex items-center gap-3 cursor-pointer select-none pt-1">
              <input type="checkbox" checked={form.inUse} onChange={e => set("inUse", e.target.checked)}
                className="w-4 h-4 rounded accent-red-600" />
              <span className="text-sm font-medium text-gray-700">대여중 (체크 해제 시 대여가능 상태로 전환)</span>
            </label>
          )}
          {error && <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
        </div>
        <div className="px-5 py-4 border-t flex gap-2 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">취소</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors">
            {saving ? "저장 중…" : "✓ Notion에 저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EquipmentTab() {
  const [records, setRecords]       = useState<MeetingEquipment[]>([]);
  const [loading, setLoading]       = useState(true);
  const [missingEnv, setMissingEnv] = useState<string | null>(null);
  const [search, setSearch]         = useState("");
  const [filterCompany, setFilterCompany] = useState("전체");
  const [filterStatus, setFilterStatus]   = useState("전체");
  const [createOpen, setCreateOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<MeetingEquipment | null>(null);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/meeting-equipment${refresh ? "?refresh=1" : ""}`);
      const json = await safeJson(res);
      if (json.missingEnv) { setMissingEnv(json.missingEnv); return; }
      setRecords(json.data ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = useCallback(async (fields: Record<string, string | boolean>) => {
    const res  = await fetch("/api/meeting-equipment/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields) });
    const json = await safeJson(res);
    if (!json.ok) throw new Error(json.error ?? "등록 실패");
    await load(true);
  }, [load]);

  const handleUpdate = useCallback(async (id: string, fields: object) => {
    const res  = await fetch("/api/meeting-equipment/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, fields }) });
    const json = await safeJson(res);
    if (!json.ok) throw new Error(json.error ?? "수정 실패");
    await load(true);
  }, [load]);

  const companyOptions = useMemo(() =>
    ["전체", ...Array.from(new Set(records.map(r => r.company).filter(Boolean))).sort()], [records]);

  const stats = useMemo(() => ({
    total:    records.length,
    inUse:    records.filter(r => r.inUse).length,
    available: records.filter(r => !r.inUse).length,
  }), [records]);

  const filtered = useMemo(() => records.filter(r => {
    if (filterCompany !== "전체" && r.company !== filterCompany) return false;
    if (filterStatus  === "대여중"   && !r.inUse) return false;
    if (filterStatus  === "대여가능" && r.inUse)  return false;
    if (search) {
      const q = search.toLowerCase();
      if (![r.name, r.currentUser, r.department, r.company, r.userEmail].some(v => v?.toLowerCase().includes(q))) return false;
    }
    return true;
  }), [records, filterCompany, filterStatus, search]);

  if (loading) return <div className="text-center py-20 text-gray-400">데이터 로딩 중…</div>;
  if (missingEnv) return <EnvVarMissing varName={missingEnv} />;

  return (
    <div>
      <div className="flex items-end justify-between mb-4">
        <div className="text-sm text-gray-500">{filtered.length}건 조회됨</div>
        <div className="flex gap-2">
          <button onClick={() => load(true)}
            className="px-3 py-2 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors">
            🔄 새로고침
          </button>
          <button onClick={() => setCreateOpen(true)}
            className="px-4 py-2 text-xs bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors">
            + 신규 등록
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatCard label="전체"   value={stats.total}     color="#18181B" />
        <StatCard label="대여중"  value={stats.inUse}     color="#DC2626" />
        <StatCard label="대여가능" value={stats.available} color="#4338CA" />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 space-y-3">
        <div className="relative">
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-3 pr-8 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="장비명, 사용자, 부서, 법인 검색…" />
          {search && <button onClick={() => setSearch("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-base">×</button>}
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)}
            className={`appearance-none px-3 py-2 border rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer ${filterCompany !== "전체" ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-gray-300 text-gray-600"}`}>
            <option value="전체">법인: 전체</option>
            {companyOptions.filter(o => o !== "전체").map(o => <option key={o}>{o}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className={`appearance-none px-3 py-2 border rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer ${filterStatus !== "전체" ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-gray-300 text-gray-600"}`}>
            {["전체", "대여중", "대여가능"].map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-auto shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {["장비명", "상태", "법인", "부서", "현재사용자", "이메일", "대여시작일", "반납예정일", "비고"].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-12 text-gray-400">검색 결과가 없습니다</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/80 transition-colors">
                <td className="px-3 py-3 whitespace-nowrap cursor-pointer" onClick={() => setEditRecord(r)}>
                  <span className="text-xs font-semibold text-blue-600 hover:underline">{r.name || "—"}</span>
                </td>
                <td className="px-3 py-3 whitespace-nowrap"><EquipmentStatusBadge status={r.status} /></td>
                <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">{r.company || "—"}</td>
                <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{r.department || "—"}</td>
                <td className="px-3 py-3 text-xs text-gray-700 whitespace-nowrap">{r.currentUser || "—"}</td>
                <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{r.userEmail || "—"}</td>
                <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(r.startDate)}</td>
                <td className="px-3 py-3 whitespace-nowrap">{r.returnDue ? <DDay date={r.returnDue} /> : <span className="text-gray-400 text-xs">—</span>}</td>
                <td className="px-3 py-3 max-w-[160px] text-xs text-gray-500 truncate" title={r.note}>{r.note || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {createOpen && (
        <EquipmentFormModal
          title="회의실 무선 장비 등록"
          initial={{ name: "", company: "", department: "", currentUser: "", userEmail: "", startDate: "", returnDue: "", note: "", inUse: false }}
          showInUse={false}
          onSave={handleCreate}
          onClose={() => setCreateOpen(false)}
        />
      )}
      {editRecord && (
        <EquipmentFormModal
          title="장비 정보 수정"
          initial={{
            name: editRecord.name, company: editRecord.company, department: editRecord.department,
            currentUser: editRecord.currentUser, userEmail: editRecord.userEmail,
            startDate: editRecord.startDate, returnDue: editRecord.returnDue, note: editRecord.note,
            inUse: editRecord.inUse,
          }}
          showInUse
          onSave={(fields) => handleUpdate(editRecord.id, fields)}
          onClose={() => setEditRecord(null)}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// 메인 패널
// ──────────────────────────────────────────────────────────────

type Tab = "tickets" | "equipment";

export default function MeetingRentalPanel() {
  const [tab, setTab] = useState<Tab>("tickets");

  return (
    <div className="fade-in">
      <div className="flex items-end justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-0.5">회의실 무선 장비 대여 관리</h2>
          <p className="text-sm text-gray-500">대여신청 티켓 처리 및 장비 현황 관리 (Notion 실시간 연동)</p>
        </div>
      </div>

      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {([
          { id: "tickets",   label: "신청 티켓" },
          { id: "equipment", label: "장비 현황" },
        ] as { id: Tab; label: string }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${tab === t.id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "tickets" ? <TicketsTab /> : <EquipmentTab />}
    </div>
  );
}
