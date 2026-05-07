"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import type { RepairTicket } from "@/types";
import { AssetModalInner, HwRecord, HW_STATUSES } from "@/components/admin/AssetModal";
import EnvVarMissing from "@/components/ui/EnvVarMissing";

// ── Color configs ────────────────────────────────────────────
const PRIORITY_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  "매우 급합니다.":    { bg: "#FEF2F2", text: "#DC2626", bar: "#EF4444" },
  "조금 급합니다.":   { bg: "#FFFBEB", text: "#B45309", bar: "#F59E0B" },
  "기다릴 수 있어요.": { bg: "#F0FDF4", text: "#059669", bar: "#10B981" },
};

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  "시작 전": { bg: "#F8FAFC", text: "#64748B" },
  "진행 중": { bg: "#FFF7ED", text: "#C2410C" },
  "완료":    { bg: "#F0FDF4", text: "#059669" },
  "이관":    { bg: "#EFF6FF", text: "#1D4ED8" },
  "기타":    { bg: "#FAF5FF", text: "#7E22CE" },
};

const FAULT_COLORS = [
  "#3B82F6","#8B5CF6","#F59E0B","#EF4444",
  "#10B981","#6366F1","#EC4899","#0EA5E9","#6B7280","#F97316",
];

type Tab = "overview" | "faults" | "company" | "assignee" | "list";

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


// ── Sub-components ───────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-1">
      <div className="text-2xl font-extrabold" style={{ color }}>{value}</div>
      <div className="text-xs font-medium text-gray-500">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_STYLE[status] ?? { bg: "#F1F5F9", text: "#64748B" };
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
      style={{ background: c.bg, color: c.text }}>
      {status || "—"}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const c = PRIORITY_COLORS[priority] ?? { bg: "#F1F5F9", text: "#64748B", bar: "#94A3B8" };
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
      style={{ background: c.bg, color: c.text }}>
      {priority || "—"}
    </span>
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
        <linearGradient id="repairLineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F97316" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#F97316" stopOpacity="0" />
        </linearGradient>
      </defs>
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
      {n > 1 && <polygon points={areaPoints} fill="url(#repairLineGrad)" />}
      {n > 1 && (
        <polyline points={points} fill="none" stroke="#F97316" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      )}
      {data.map((d, i) => {
        const cx = xOf(i), cy = yOf(d.count);
        return (
          <g key={d.month}>
            <circle cx={cx} cy={cy} r={4} fill="white" stroke="#F97316" strokeWidth={2} />
            {d.count > 0 && (
              <text x={cx} y={cy - 9} textAnchor="middle" fontSize={10} fontWeight="700" fill="#C2410C">
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
function HBar({ label, count, total, color }: {
  label: string; count: number; total: number; color: string;
}) {
  const pct = total > 0 ? Math.max((count / total) * 100, count > 0 ? 1.5 : 0) : 0;
  return (
    <div>
      <div className="flex justify-between items-center text-xs mb-1">
        <span className="font-medium text-gray-700 flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm inline-block flex-shrink-0" style={{ background: color }} />
          {label}
        </span>
        <span className="text-gray-400">{count}건 · {total > 0 ? Math.round(count / total * 100) : 0}%</span>
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

// ── Inline Table Cells ───────────────────────────────────────
const REPAIR_STATUSES_CONST = ["시작 전", "진행 중", "완료", "이관", "기타"] as const;

function InlineStatusCell({
  ticket,
  onUpdated,
}: {
  ticket: RepairTicket;
  onUpdated: (id: string, fields: Partial<RepairTicket>) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<"idle" | "done" | "error">("idle");

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as RepairTicket["status"];
    setSaving(true); setResult("idle");
    try {
      const res = await fetch("/api/repair-tickets/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ticket.id, fields: { status: newStatus } }),
      });
      const json = await res.json();
      if (json.ok) { onUpdated(ticket.id, { status: newStatus }); setResult("done"); }
      else setResult("error");
    } catch { setResult("error"); }
    finally { setSaving(false); setTimeout(() => setResult("idle"), 2000); }
  };

  const c = STATUS_STYLE[ticket.status] ?? { bg: "#F1F5F9", text: "#64748B" };
  return (
    <div className="flex items-center gap-1">
      <select
        value={ticket.status}
        onChange={handleChange}
        disabled={saving}
        style={{ background: c.bg, color: c.text }}
        className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-transparent focus:outline-none focus:ring-1 focus:ring-orange-200 cursor-pointer disabled:opacity-50 appearance-none"
      >
        {REPAIR_STATUSES_CONST.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      {saving && (
        <svg className="animate-spin w-3 h-3 text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25"/><path d="M21 12a9 9 0 00-9-9"/>
        </svg>
      )}
      {result === "done"  && <span className="text-[9px] text-green-600 flex-shrink-0">✓</span>}
      {result === "error" && <span className="text-[9px] text-red-500 flex-shrink-0">!</span>}
    </div>
  );
}

function InlineAssigneeCell({
  ticket,
  assigneeList,
  onUpdated,
}: {
  ticket: RepairTicket;
  assigneeList: { id: string; name: string }[];
  onUpdated: (id: string, fields: Partial<RepairTicket>) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<"idle" | "done" | "error">("idle");

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newName = e.target.value;
    setSaving(true); setResult("idle");
    try {
      const found = assigneeList.find(u => u.name === newName);
      const res = await fetch("/api/repair-tickets/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ticket.id, fields: { assigneeId: found?.id ?? "" } }),
      });
      const json = await res.json();
      if (json.ok) {
        onUpdated(ticket.id, { assignee: newName || undefined, assigneeId: found?.id ?? undefined });
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
        className="text-xs text-gray-600 border border-transparent hover:border-gray-200 bg-transparent focus:outline-none focus:ring-1 focus:ring-orange-200 rounded-lg px-1 py-0.5 cursor-pointer disabled:opacity-50 max-w-[96px]"
      >
        <option value="">미배정</option>
        {assigneeList.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
      </select>
      {saving && (
        <svg className="animate-spin w-3 h-3 text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25"/><path d="M21 12a9 9 0 00-9-9"/>
        </svg>
      )}
      {result === "done"  && <span className="text-[9px] text-green-600 flex-shrink-0">✓</span>}
      {result === "error" && <span className="text-[9px] text-red-500 flex-shrink-0">!</span>}
    </div>
  );
}

// ── Ticket Detail Modal ───────────────────────────────────────
function TicketFloating({ ticket, assigneeList, onClose, onUpdated }: {
  ticket: RepairTicket;
  anchorRect: DOMRect;
  assigneeList: { id: string; name: string }[];
  onClose: () => void;
  onUpdated?: (id: string, fields: Partial<RepairTicket>) => void;
}) {
  const [selectedStatus, setSelectedStatus]   = useState(ticket.status);
  const [selectedAssigneeName, setSelectedAssigneeName] = useState(ticket.assignee ?? "");
  const [selectedAssigneeId, setSelectedAssigneeId] = useState(ticket.assigneeId ?? "");
  const notionUsers = assigneeList;
  const usersLoaded = true;
  const [saving, setSaving]                   = useState<"status" | "assignee" | null>(null);
  const [saveResult, setSaveResult]           = useState<Record<string, "done" | "error">>({});
  const [copied, setCopied]                   = useState(false);
  const [editingNote, setEditingNote]         = useState(false);
  const [noteValue, setNoteValue]             = useState(ticket.actionNote ?? "");
  const [noteSaving, setNoteSaving]           = useState(false);
  const [noteSaveResult, setNoteSaveResult]   = useState<"idle" | "done" | "error">("idle");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [assetData, setAssetData]             = useState<HwRecord | null>(null);
  const [assetState, setAssetState]           = useState<"idle" | "loading" | "found" | "notfound" | "error">("idle");
  const [assetStatus, setAssetStatus]         = useState("");
  const [assetSaving, setAssetSaving]         = useState(false);
  const [assetSaveResult, setAssetSaveResult] = useState<"idle" | "done" | "error">("idle");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);


  const copyRequester = () => {
    navigator.clipboard.writeText(ticket.requester || "").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const loadAsset = () => {
    if (!ticket.assetId || assetState === "loading") return;
    setAssetState("loading");
    fetch(`/api/hw?search=${encodeURIComponent(ticket.assetId)}`)
      .then(r => r.json())
      .then(json => {
        const match = (json.records as HwRecord[])?.find(
          r => r.assetNo.toLowerCase() === ticket.assetId.toLowerCase()
        );
        if (match) { setAssetData(match); setAssetStatus(match.status); setAssetState("found"); }
        else setAssetState("notfound");
      })
      .catch(() => setAssetState("error"));
  };

  const saveAssetStatus = async () => {
    if (!assetData || assetStatus === assetData.status) return;
    setAssetSaving(true); setAssetSaveResult("idle");
    try {
      const res = await fetch("/api/hw/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: assetData.id, fields: { status: assetStatus } }),
      });
      const json = await res.json();
      if (json.ok) { setAssetData(prev => prev ? { ...prev, status: assetStatus } : prev); setAssetSaveResult("done"); }
      else setAssetSaveResult("error");
    } catch { setAssetSaveResult("error"); }
    finally { setAssetSaving(false); }
  };

  const saveNote = async () => {
    const value = textareaRef.current?.value ?? noteValue;
    setNoteSaving(true); setNoteSaveResult("idle");
    try {
      const res = await fetch("/api/repair-tickets/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ticket.id, fields: { actionNote: value } }),
      });
      const json = await res.json();
      if (json.ok) {
        setNoteValue(value);
        setNoteSaveResult("done");
        setEditingNote(false);
        onUpdated?.(ticket.id, { actionNote: value });
      } else setNoteSaveResult("error");
    } catch { setNoteSaveResult("error"); }
    finally { setNoteSaving(false); }
  };

  const saveField = async (field: "status" | "assignee") => {
    setSaving(field);
    setSaveResult(prev => ({ ...prev, [field]: undefined as unknown as "done" }));
    try {
      const fields: Record<string, string> = {};
      if (field === "status") fields.status = selectedStatus;
      if (field === "assignee") {
        const found = notionUsers.find(u => u.name === selectedAssigneeName && u.id !== "__current__");
        fields.assigneeId = found?.id ?? "";
      }
      const res = await fetch("/api/repair-tickets/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ticket.id, fields }),
      });
      const json = await res.json();
      if (json.ok) {
        setSaveResult(prev => ({ ...prev, [field]: "done" }));
        if (field === "status")   onUpdated?.(ticket.id, { status: selectedStatus as RepairTicket["status"] });
        if (field === "assignee") onUpdated?.(ticket.id, { assignee: selectedAssigneeName });
      } else setSaveResult(prev => ({ ...prev, [field]: "error" }));
    } catch { setSaveResult(prev => ({ ...prev, [field]: "error" })); }
    finally { setSaving(null); }
  };

  const DetailRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-start gap-4 py-3 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 w-20 shrink-0 pt-0.5">{label}</span>
      <div className="flex-1 text-sm text-gray-800">{children}</div>
    </div>
  );

  const REPAIR_STATUSES = ["시작 전", "진행 중", "완료", "이관", "기타"] as const;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden"
        style={{ maxHeight: "88vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-7 py-5 border-b border-gray-100 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs text-gray-400 font-mono">#{ticket.ticketNumber || "—"}</span>
              <PriorityBadge priority={ticket.priority} />
            </div>
            <h2 className="text-lg font-bold text-gray-900 leading-snug">{ticket.title || "—"}</h2>
          </div>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 shrink-0">
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-7 py-1">

          {/* 상태 변경 */}
          <DetailRow label="상태">
            <div className="flex items-center gap-2">
              <select
                value={selectedStatus}
                onChange={e => { setSelectedStatus(e.target.value as RepairTicket["status"]); setSaveResult(p => ({ ...p, status: undefined as unknown as "done" })); }}
                className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-orange-200"
              >
                {REPAIR_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button
                onClick={() => saveField("status")}
                disabled={saving === "status" || selectedStatus === ticket.status}
                className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-white font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {saving === "status" ? "저장 중…" : "저장"}
              </button>
              {saveResult.status === "done"  && <span className="text-xs text-green-600">✓ 변경됨</span>}
              {saveResult.status === "error" && <span className="text-xs text-red-500">실패</span>}
            </div>
          </DetailRow>

          {/* 고장유형 */}
          {ticket.faultTypes.length > 0 && (
            <DetailRow label="고장유형">
              <div className="flex flex-wrap gap-1.5">
                {ticket.faultTypes.map(f => (
                  <span key={f} className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full font-medium">{f}</span>
                ))}
              </div>
            </DetailRow>
          )}

          {/* 문의자 — 클릭 시 복사 */}
          <DetailRow label="문의자">
            <div className="flex items-center gap-2">
              <button
                onClick={copyRequester}
                className="text-sm text-gray-800 hover:text-blue-600 transition-colors flex items-center gap-1.5 group"
                title="클릭하여 복사"
              >
                {ticket.requester || "—"}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  className="opacity-30 group-hover:opacity-70">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
              </button>
              {copied && <span className="text-xs text-green-600 font-medium">복사됨!</span>}
              {ticket.company && <span className="text-gray-400 text-xs">· {ticket.company}</span>}
            </div>
          </DetailRow>

          {ticket.department && <DetailRow label="부서"><span>{ticket.department}</span></DetailRow>}
          {ticket.location   && <DetailRow label="위치"><span>{ticket.location}</span></DetailRow>}

          {/* 자산번호 — 클릭 시 자산 상세 */}
          {ticket.assetId && (
            <DetailRow label="자산번호">
              <div>
                <button
                  onClick={loadAsset}
                  className="font-mono text-blue-600 hover:underline hover:text-blue-700 transition-colors text-sm"
                >
                  {ticket.assetId}
                </button>
                {assetState === "loading" && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                    <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25"/><path d="M21 12a9 9 0 00-9-9"/>
                    </svg>
                    불러오는 중...
                  </div>
                )}
                {assetState === "notfound" && <p className="mt-2 text-xs text-gray-400">트래커 DB에서 찾을 수 없습니다.</p>}
                {assetState === "error"    && <p className="mt-2 text-xs text-red-400">조회 중 오류가 발생했습니다.</p>}
                {assetState === "found" && assetData && (
                  <div className="mt-3 bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                    {[
                      ["사용자", assetData.user],
                      ["모델명", assetData.model],
                      ["시리얼", assetData.serial],
                      ["제조사", assetData.maker],
                      ["CPU",    assetData.cpu],
                      ["RAM",    assetData.ram],
                      ["법인",   assetData.company],
                      ["부서",   assetData.dept],
                    ].map(([label, value]) => value ? (
                      <div key={label} className="flex gap-3">
                        <span className="text-xs text-gray-400 w-16 shrink-0">{label}</span>
                        <span className="text-gray-700">{value}</span>
                      </div>
                    ) : null)}
                    {assetData.price > 0 && (
                      <div className="flex gap-3">
                        <span className="text-xs text-gray-400 w-16 shrink-0">단가</span>
                        <span className="text-gray-700">{assetData.price.toLocaleString()}원</span>
                      </div>
                    )}
                    {assetData.residualValue > 0 && (
                      <div className="flex gap-3">
                        <span className="text-xs text-gray-400 w-16 shrink-0">잔존가치</span>
                        <span className="text-gray-700 font-medium">{assetData.residualValue.toLocaleString()}원</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-xs text-gray-400 w-16 shrink-0">상태</span>
                      <select
                        value={assetStatus}
                        onChange={e => { setAssetStatus(e.target.value); setAssetSaveResult("idle"); }}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none"
                      >
                        {HW_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <button
                        onClick={saveAssetStatus}
                        disabled={assetSaving || assetStatus === assetData.status}
                        className="text-xs px-2.5 py-1 rounded-lg bg-gray-700 text-white font-medium hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {assetSaving ? "저장 중…" : "저장"}
                      </button>
                      {assetSaveResult === "done"  && <span className="text-xs text-green-600">✓</span>}
                      {assetSaveResult === "error" && <span className="text-xs text-red-500">실패</span>}
                    </div>
                    {assetData.notionUrl && (
                      <a href={assetData.notionUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1 pt-1">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                          <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                        노션에서 보기
                      </a>
                    )}
                  </div>
                )}
              </div>
            </DetailRow>
          )}

          {/* 담당자 변경 */}
          <DetailRow label="담당자">
            <div className="flex items-center gap-2 flex-wrap">
              {!usersLoaded ? (
                <span className="text-sm text-gray-500 flex items-center gap-1.5">
                  <svg className="animate-spin w-3 h-3 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25"/><path d="M21 12a9 9 0 00-9-9"/>
                  </svg>
                  {ticket.assignee || "미배정"}
                </span>
              ) : (
                <select
                  value={selectedAssigneeName}
                  onChange={e => {
                    setSelectedAssigneeName(e.target.value);
                    setSaveResult(p => ({ ...p, assignee: undefined as unknown as "done" }));
                  }}
                  className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-orange-200"
                >
                  <option value="">미배정</option>
                  {notionUsers.map(u => (
                    <option key={u.id} value={u.name}>
                      {u.name}{u.id === "__current__" ? " (현재)" : ""}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={() => saveField("assignee")}
                disabled={saving === "assignee" || !usersLoaded || selectedAssigneeName === (ticket.assignee ?? "")}
                className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-white font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {saving === "assignee" ? "저장 중…" : "저장"}
              </button>
              {saveResult.assignee === "done"  && <span className="text-xs text-green-600">✓ 변경됨</span>}
              {saveResult.assignee === "error" && <span className="text-xs text-red-500">실패</span>}
            </div>
          </DetailRow>

          {/* 조치내용 */}
          <DetailRow label="조치내용">
            {editingNote ? (
              <div className="flex flex-col gap-2">
                <textarea
                  ref={textareaRef}
                  defaultValue={noteValue}
                  rows={4}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-200 resize-none"
                  placeholder="조치 내역을 입력하세요"
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={saveNote}
                    disabled={noteSaving}
                    className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-white font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {noteSaving ? "저장 중…" : "저장"}
                  </button>
                  <button
                    onClick={() => { setEditingNote(false); setNoteSaveResult("idle"); }}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    취소
                  </button>
                  {noteSaveResult === "error" && <span className="text-xs text-red-500">저장 실패</span>}
                </div>
              </div>
            ) : (
              <div
                onClick={() => { setEditingNote(true); setNoteSaveResult("idle"); }}
                className="group cursor-pointer rounded-lg px-3 py-2 -mx-3 hover:bg-gray-50 transition-colors min-h-[2.5rem] flex items-start gap-2"
              >
                <p className="leading-relaxed text-gray-700 flex-1 whitespace-pre-wrap">
                  {noteValue || <span className="text-gray-400 italic">클릭하여 조치 내역 입력</span>}
                </p>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  className="shrink-0 mt-0.5 opacity-0 group-hover:opacity-40 transition-opacity">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                {noteSaveResult === "done" && <span className="text-xs text-green-600 shrink-0">✓ 저장됨</span>}
              </div>
            )}
          </DetailRow>

          {ticket.repairDate && <DetailRow label="수리일정"><span>{ticket.repairDate}</span></DetailRow>}

          <DetailRow label="동의서">
            {ticket.consentGiven
              ? <span className="text-green-600 font-medium">완료</span>
              : <span className="text-gray-400">미완료</span>
            }
          </DetailRow>
        </div>

        {/* Footer */}
        {ticket.notionUrl && (
          <div className="px-7 py-4 border-t border-gray-100">
            <a href={ticket.notionUrl} target="_blank" rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              노션에서 보기
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────
export default function RepairPanel() {
  const [tickets,    setTickets]    = useState<RepairTicket[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [missingEnv, setMissingEnv] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [tab, setTab]               = useState<Tab>("overview");
  const [modalAssetId, setModalAssetId] = useState<string | null>(null);
  const [floatingTicket, setFloatingTicket] = useState<{ ticket: RepairTicket; rect: DOMRect } | null>(null);
  const [copiedRequesterId, setCopiedRequesterId] = useState<string | null>(null);

  // 실제 티켓 데이터에서 담당자 목록 추출 (중복 제거)
  const assigneeList = useMemo(() => {
    const seen = new Map<string, string>();
    tickets.forEach(t => { if (t.assigneeId && t.assignee) seen.set(t.assigneeId, t.assignee); });
    const EXCLUDED = ["이상목", "조성빈"];
    return [...seen.entries()].map(([id, name]) => ({ id, name }))
      .filter(({ name }) => !EXCLUDED.includes(name))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [tickets]);

  const handleTicketUpdated = useCallback((id: string, fields: Partial<RepairTicket>) => {
    setTickets(prev => prev.map(t => t.id === id ? { ...t, ...fields } : t));
    setFloatingTicket(prev => prev && prev.ticket.id === id
      ? { ...prev, ticket: { ...prev.ticket, ...fields } }
      : prev
    );
  }, []);

  const [listFilter, setListFilter] = useState({
    status: "all", fault: "all", company: "all", priority: "all", search: "",
  });

  const months = useMemo(() => last6Months(), []);

  const load = useCallback((force = false) => {
    if (!force) { setLoading(true); setError(null); }
    fetch(`/api/repair-tickets${force ? "?refresh=1" : ""}`)
      .then(r => r.json())
      .then(res => {
        if (res.missingEnv) { setMissingEnv(res.missingEnv); return; }
        if (res.error) { setError(res.error); return; }
        setTickets(res.data ?? []);
        setLastSynced(res.lastSynced ?? null);
      })
      .catch(e => { if (!force) setError(e.message); })
      .finally(() => { if (!force) setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const id = setInterval(() => load(true), 30_000);
    return () => clearInterval(id);
  }, [load]);

  // ── Analytics ────────────────────────────────────────────
  const total      = tickets.length;
  const notStarted = tickets.filter(t => t.status === "시작 전").length;
  const inProgress = tickets.filter(t => t.status === "진행 중").length;
  const done       = tickets.filter(t => t.status === "완료").length;
  const transferred = tickets.filter(t => t.status === "이관").length;

  const monthlyTotal = useMemo(() =>
    months.map(m => ({ month: m, count: tickets.filter(t => (t.createdAt || "").startsWith(m)).length })),
    [tickets, months]);

  const byFault = useMemo(() => {
    const m = new Map<string, number>();
    tickets.forEach(t => t.faultTypes.forEach(f => m.set(f, (m.get(f) ?? 0) + 1)));
    return [...m.entries()].sort((a, b) => b[1] - a[1])
      .map(([fault, count], i) => ({ fault, count, color: FAULT_COLORS[i % FAULT_COLORS.length] }));
  }, [tickets]);

  const byCompany = useMemo(() => {
    const m = new Map<string, number>();
    tickets.forEach(t => { if (t.company) m.set(t.company, (m.get(t.company) ?? 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [tickets]);

  const byPriority = useMemo(() => {
    const order = ["매우 급합니다.", "조금 급합니다.", "기다릴 수 있어요."];
    const m = new Map<string, number>();
    tickets.forEach(t => { if (t.priority) m.set(t.priority, (m.get(t.priority) ?? 0) + 1); });
    return order.filter(p => m.has(p)).map(p => [p, m.get(p)!] as [string, number]);
  }, [tickets]);

  const companyMonthly = useMemo(() => {
    const companies = [...new Set(tickets.map(t => t.company).filter(Boolean))].sort();
    return companies.map(company => ({
      company,
      monthlyCounts: months.map(m => tickets.filter(t => t.company === company && (t.createdAt || "").startsWith(m)).length),
      total: tickets.filter(t => t.company === company).length,
    })).sort((a, b) => b.total - a.total);
  }, [tickets, months]);

  // ── List filters ──────────────────────────────────────────
  const uniqueFaults    = [...new Set(tickets.flatMap(t => t.faultTypes))].sort();
  const uniqueCompanies = [...new Set(tickets.map(t => t.company).filter(Boolean))].sort();
  const uniquePriorities = ["매우 급합니다.", "조금 급합니다.", "기다릴 수 있어요."].filter(p => tickets.some(t => t.priority === p));

  const filteredList = useMemo(() => tickets.filter(t => {
    if (listFilter.status  !== "all" && t.status   !== listFilter.status)  return false;
    if (listFilter.company !== "all" && t.company  !== listFilter.company) return false;
    if (listFilter.priority !== "all" && t.priority !== listFilter.priority) return false;
    if (listFilter.fault   !== "all" && !t.faultTypes.includes(listFilter.fault)) return false;
    if (listFilter.search) {
      const q = listFilter.search.toLowerCase();
      return (t.title || "").toLowerCase().includes(q)
        || (t.requester || "").toLowerCase().includes(q)
        || (t.assetId || "").toLowerCase().includes(q)
        || (t.ticketNumber || "").toLowerCase().includes(q);
    }
    return true;
  }), [tickets, listFilter]);

  // ── Render ───────────────────────────────────────────────
  if (missingEnv) return <EnvVarMissing varName={missingEnv} />;
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400 text-sm gap-2">
        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25"/>
          <path d="M21 12a9 9 0 00-9-9"/>
        </svg>
        수리 접수 데이터 불러오는 중...
      </div>
    );
  }

  return (
    <div className="fade-in">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-0.5">수리 접수 현황</h2>
          <p className="text-sm text-gray-500">
            IT 기기 수리 접수 및 처리 현황 · 전체 {total}건
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
        </div>
      )}

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        <StatCard label="전체 접수" value={total}       color="#1E40AF" />
        <StatCard label="시작 전"   value={notStarted}  color="#64748B" />
        <StatCard label="진행 중"   value={inProgress}  color="#C2410C" />
        <StatCard label="완료"      value={done}        color="#059669" />
        <StatCard label="이관"      value={transferred} color="#1D4ED8" />
      </div>

      {/* ── Tab Bar ── */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit">
        {([
          ["overview",  "📈", "개요"],
          ["faults",    "🔧", "고장유형"],
          ["company",   "🏢", "법인현황"],
          ["assignee",  "👤", "담당자"],
          ["list",      "📋", "접수 현황"],
        ] as [Tab, string, string][]).map(([id, icon, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              tab === id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}>
            {icon} {label}
          </button>
        ))}
      </div>

      {/* ── 개요 ── */}
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
                {byPriority.map(([p, count]) => {
                  const c = PRIORITY_COLORS[p] ?? { bar: "#94A3B8" };
                  return <HBar key={p} label={p} count={count} total={total} color={c.bar} />;
                })}
                {byPriority.length === 0 && <p className="text-xs text-gray-300 text-center py-4">데이터 없음</p>}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-4">
                최근 접수
                <span className="text-xs font-normal text-gray-400 ml-1">최신 5건</span>
              </h3>
              <div className="space-y-1">
                {tickets.slice(0, 5).map(t => (
                  <div key={t.id} className="flex items-start gap-2 py-2 border-b border-gray-50 last:border-0">
                    <StatusBadge status={t.status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{t.title || "—"}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {[t.company, t.requester, (t.createdAt || "").slice(0, 10)].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {t.priority && <PriorityBadge priority={t.priority} />}
                  </div>
                ))}
                {tickets.length === 0 && <p className="text-xs text-gray-300 text-center py-6">데이터 없음</p>}
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4">처리 상태 현황</h3>
            <div className="space-y-3">
              {(["시작 전", "진행 중", "완료", "이관", "기타"] as const).map((s, i) => {
                const cnt = tickets.filter(t => t.status === s).length;
                return <HBar key={s} label={s} count={cnt} total={total} color={FAULT_COLORS[i]} />;
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── 고장유형 ── */}
      {tab === "faults" && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4">고장 유형별 접수 현황</h3>
            {byFault.length === 0 ? (
              <p className="text-xs text-gray-300 text-center py-6">데이터 없음</p>
            ) : (
              <div className="space-y-3">
                {byFault.map(({ fault, count, color }) => (
                  <HBar key={fault} label={fault} count={count} total={total} color={color} />
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4">유형 × 긴급도 교차 분석</h3>
            <div className="overflow-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-100">
                    <th className="text-left py-2.5 pr-5 text-gray-500 font-semibold">고장유형</th>
                    {(["매우 급합니다.", "조금 급합니다.", "기다릴 수 있어요."] as const).map(p => (
                      <th key={p} className="text-center py-2.5 px-4 text-gray-500 font-semibold whitespace-nowrap">{p}</th>
                    ))}
                    <th className="text-center py-2.5 px-4 text-gray-700 font-bold">합계</th>
                  </tr>
                </thead>
                <tbody>
                  {byFault.map(({ fault, count, color }) => (
                    <tr key={fault} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 pr-5">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: color }} />
                          <span className="font-medium text-gray-700">{fault}</span>
                        </span>
                      </td>
                      {(["매우 급합니다.", "조금 급합니다.", "기다릴 수 있어요."] as const).map(p => {
                        const n = tickets.filter(t => t.faultTypes.includes(fault) && t.priority === p).length;
                        const c = PRIORITY_COLORS[p];
                        return (
                          <td key={p} className="text-center py-2.5 px-4">
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
                    {(["매우 급합니다.", "조금 급합니다.", "기다릴 수 있어요."] as const).map(p => (
                      <td key={p} className="text-center py-2.5 px-4 text-gray-700">
                        {tickets.filter(t => t.priority === p).length || "—"}
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

      {/* ── 법인현황 ── */}
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
                                  style={{ background: `rgba(249,115,22,${intensity})` }}>
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
                <HBar key={company} label={company} count={count} total={total} color={FAULT_COLORS[i % FAULT_COLORS.length]} />
              ))}
              {byCompany.length === 0 && <p className="text-xs text-gray-300 text-center py-6">데이터 없음</p>}
            </div>
          </div>
        </div>
      )}

      {/* ── 담당자 ── */}
      {tab === "assignee" && (() => {
        const assignedTickets = tickets.filter(t => t.assignee);
        const assigneeNames = [...new Set(assignedTickets.map(t => t.assignee))].sort();

        if (assigneeNames.length === 0) return (
          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400 text-sm">
            배정된 담당자가 없습니다.<br />
            <span className="text-xs text-gray-300 mt-1 block">Notion에서 티켓에 담당자를 지정해주세요.</span>
          </div>
        );

        const assigneeStats = assigneeNames.map(name => {
          const myAll       = assignedTickets.filter(t => t.assignee === name);
          const myDone      = myAll.filter(t => t.status === "완료");
          const myInProg    = myAll.filter(t => t.status === "진행 중");
          const allCount    = myAll.length;
          const doneCount   = myDone.length;
          const inProgCount = myInProg.length;
          const notStarted  = allCount - doneCount - inProgCount;
          const completionRate = allCount > 0 ? Math.round(doneCount / allCount * 100) : 0;
          const monthlyCount = months.map(m => ({
            month: m,
            count: myAll.filter(t => (t.createdAt || "").startsWith(m)).length,
          }));
          return { name, allCount, doneCount, inProgCount, notStarted, completionRate, monthlyCount };
        }).sort((a, b) => b.allCount - a.allCount);

        const totalAssigned = assignedTickets.length;
        const totalDone     = assignedTickets.filter(t => t.status === "완료").length;
        const totalInProg   = assignedTickets.filter(t => t.status === "진행 중").length;
        const totalRate     = totalAssigned > 0 ? Math.round(totalDone / totalAssigned * 100) : 0;

        return (
          <div className="space-y-4">

            {/* 담당자별 종합 카드 */}
            <div className="grid grid-cols-1 gap-3">
              {assigneeStats.map(({ name, allCount, doneCount, inProgCount, completionRate }) => (
                <div key={name} className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-4 flex-wrap">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-orange-600">{name.slice(0, 1)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-800 text-sm">{name}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">수리 담당자</div>
                  </div>
                  <div className="flex gap-6 flex-wrap">
                    <div className="text-center">
                      <div className="text-lg font-extrabold text-gray-800">{allCount}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">총 배정</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-extrabold text-green-600">{doneCount}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">완료</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-extrabold text-orange-500">{inProgCount}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">진행 중</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-extrabold" style={{ color: completionRate >= 80 ? "#059669" : completionRate >= 50 ? "#F59E0B" : "#EF4444" }}>
                        {completionRate}%
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">완료율</div>
                    </div>
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
                      <th className="text-center py-2.5 px-3 text-gray-500 font-semibold">시작 전</th>
                      <th className="text-center py-2.5 px-3 text-gray-500 font-semibold">완료율</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assigneeStats.map(({ name, allCount, doneCount, inProgCount, notStarted, completionRate }) => (
                      <tr key={name} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-2.5 pr-4">
                          <span className="flex items-center gap-1.5">
                            <span className="w-6 h-6 rounded-full bg-orange-100 inline-flex items-center justify-center text-[10px] font-bold text-orange-600 flex-shrink-0">
                              {name.slice(0, 1)}
                            </span>
                            <span className="font-medium text-gray-700">{name}</span>
                          </span>
                        </td>
                        <td className="text-center py-2.5 px-3 font-bold text-gray-800">{allCount}</td>
                        <td className="text-center py-2.5 px-3 font-bold text-green-600">{doneCount}</td>
                        <td className="text-center py-2.5 px-3 text-orange-500 font-medium">{inProgCount}</td>
                        <td className="text-center py-2.5 px-3 text-gray-400">{notStarted > 0 ? notStarted : "—"}</td>
                        <td className="text-center py-2.5 px-3">
                          <span className="font-bold" style={{ color: completionRate >= 80 ? "#059669" : completionRate >= 50 ? "#F59E0B" : "#EF4444" }}>
                            {completionRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                      <td className="py-2.5 pr-4 text-gray-700">합계</td>
                      <td className="text-center py-2.5 px-3 text-gray-700">{totalAssigned}</td>
                      <td className="text-center py-2.5 px-3 text-green-600">{totalDone}</td>
                      <td className="text-center py-2.5 px-3 text-orange-500">{totalInProg}</td>
                      <td className="text-center py-2.5 px-3 text-gray-400">
                        {totalAssigned - totalDone - totalInProg > 0 ? totalAssigned - totalDone - totalInProg : "—"}
                      </td>
                      <td className="text-center py-2.5 px-3 text-gray-700">{totalRate}%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* 월별 처리 현황 */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-4">
                담당자별 월별 처리 현황
                <span className="text-xs font-normal text-gray-400 ml-2">최근 6개월</span>
              </h3>
              <div className="overflow-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-100">
                      <th className="text-left py-2.5 pr-6 text-gray-500 font-semibold whitespace-nowrap">담당자</th>
                      {months.map(m => (
                        <th key={m} className="text-center py-2.5 px-4 text-gray-500 font-semibold whitespace-nowrap">
                          {monthLabel(m)}
                        </th>
                      ))}
                      <th className="text-center py-2.5 px-4 text-gray-700 font-bold">합계</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assigneeStats.map(({ name, allCount, monthlyCount }) => {
                      const colMax = Math.max(...monthlyCount.map(m => m.count), 1);
                      return (
                        <tr key={name} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="py-3 pr-6 whitespace-nowrap">
                            <span className="flex items-center gap-1.5">
                              <span className="w-6 h-6 rounded-full bg-orange-100 inline-flex items-center justify-center text-[10px] font-bold text-orange-600 flex-shrink-0">
                                {name.slice(0, 1)}
                              </span>
                              <span className="font-semibold text-gray-700">{name}</span>
                            </span>
                          </td>
                          {monthlyCount.map(({ month, count }) => {
                            const intensity = count > 0 ? 0.3 + (count / colMax) * 0.7 : 0;
                            return (
                              <td key={month} className="text-center py-3 px-4">
                                {count > 0 ? (
                                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-white text-[11px] font-bold"
                                    style={{ background: `rgba(249,115,22,${intensity})` }}>
                                    {count}
                                  </span>
                                ) : <span className="text-gray-200">—</span>}
                              </td>
                            );
                          })}
                          <td className="text-center py-3 px-4 font-bold text-gray-800">{allCount}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50">
                      <td className="py-2.5 pr-6 font-bold text-gray-700">합계</td>
                      {months.map((m, mi) => {
                        const sum = assigneeStats.reduce((s, stat) => s + stat.monthlyCount[mi].count, 0);
                        return <td key={m} className="text-center py-2.5 px-4 font-bold text-gray-700">{sum || "—"}</td>;
                      })}
                      <td className="text-center py-2.5 px-4 font-bold text-gray-900">{totalAssigned}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

          </div>
        );
      })()}

      {/* ── 목록 ── */}
      {tab === "list" && (
        <div className="space-y-3">
          {/* 필터 바 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-3 items-center">
            <input
              type="text"
              placeholder="티켓번호 / 증상 / 문의자 / 자산번호 검색..."
              value={listFilter.search}
              onChange={e => setListFilter(f => ({ ...f, search: e.target.value }))}
              className="flex-1 min-w-48 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
            <select
              value={listFilter.status}
              onChange={e => setListFilter(f => ({ ...f, status: e.target.value }))}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
            >
              <option value="all">전체 상태</option>
              {(["시작 전", "진행 중", "완료", "이관", "기타"] as const).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={listFilter.fault}
              onChange={e => setListFilter(f => ({ ...f, fault: e.target.value }))}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
            >
              <option value="all">전체 고장유형</option>
              {uniqueFaults.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <select
              value={listFilter.company}
              onChange={e => setListFilter(f => ({ ...f, company: e.target.value }))}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
            >
              <option value="all">전체 법인</option>
              {uniqueCompanies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={listFilter.priority}
              onChange={e => setListFilter(f => ({ ...f, priority: e.target.value }))}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
            >
              <option value="all">전체 긴급도</option>
              {uniquePriorities.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            {(listFilter.status !== "all" || listFilter.fault !== "all" || listFilter.company !== "all" || listFilter.priority !== "all" || listFilter.search) && (
              <button
                onClick={() => setListFilter({ status: "all", fault: "all", company: "all", priority: "all", search: "" })}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
              >
                초기화
              </button>
            )}
            <span className="text-xs text-gray-400 ml-auto">{filteredList.length}건</span>
          </div>

          {/* 테이블 */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-auto">
            <table className="data-table">
              <thead>
                <tr>
                  {["티켓", "상태", "법인", "자산번호", "문의자", "고장유형", "고장증상", "담당자", "동의서", "노션"].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredList.length === 0 ? (
                  <tr><td colSpan={12} className="text-center text-gray-400 py-10">데이터 없음</td></tr>
                ) : filteredList.map(t => (
                  <tr key={t.id}>
                    <td className="text-xs text-gray-400 font-mono">{t.ticketNumber || "—"}</td>
                    <td><InlineStatusCell ticket={t} onUpdated={handleTicketUpdated} /></td>
                    <td className="text-sm text-gray-600">{t.company || "—"}</td>
                    <td className="text-sm font-mono">
                      {t.assetId ? (
                        <button
                          onClick={() => setModalAssetId(t.assetId)}
                          className="text-blue-600 hover:underline hover:text-blue-700 transition-colors"
                        >
                          {t.assetId}
                        </button>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td>
                      {t.requester ? (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(t.requester);
                            setCopiedRequesterId(t.id);
                            setTimeout(() => setCopiedRequesterId(prev => prev === t.id ? null : prev), 2000);
                          }}
                          className="text-sm text-gray-600 hover:text-blue-600 transition-colors flex items-center gap-1 group"
                          title="클릭하여 복사"
                        >
                          {t.requester}
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                            className="opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                          </svg>
                          {copiedRequesterId === t.id && (
                            <span className="text-[9px] text-green-600 font-medium">복사됨</span>
                          )}
                        </button>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {t.faultTypes.map(f => (
                          <span key={f} className="text-xs bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded font-medium">{f}</span>
                        ))}
                      </div>
                    </td>
                    <td className="font-medium text-gray-900 max-w-xs">
                      <button
                        onClick={e => { e.stopPropagation(); setFloatingTicket({ ticket: t, rect: (e.currentTarget as HTMLElement).getBoundingClientRect() }); }}
                        className="text-left w-full hover:text-orange-600 transition-colors"
                      >
                        <div className="truncate underline decoration-dotted underline-offset-2" title={t.title}>{t.title}</div>
                        {t.actionNote && (
                          <div className="text-xs text-gray-400 truncate mt-0.5" title={t.actionNote}>{t.actionNote}</div>
                        )}
                      </button>
                    </td>
                    <td><InlineAssigneeCell ticket={t} assigneeList={assigneeList} onUpdated={handleTicketUpdated} /></td>
                    <td>
                      {t.consentGiven
                        ? <span className="text-green-600 text-xs font-medium">✓</span>
                        : <span className="text-gray-300 text-xs">—</span>
                      }
                    </td>
                    <td>
                      {t.notionUrl && (
                        <a href={t.notionUrl} target="_blank" rel="noopener noreferrer"
                          className="text-blue-600 text-xs flex items-center gap-1 hover:underline">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

      {modalAssetId && (
        <AssetModalInner assetId={modalAssetId} onClose={() => setModalAssetId(null)} />
      )}

      {floatingTicket && (
        <TicketFloating
          ticket={floatingTicket.ticket}
          anchorRect={floatingTicket.rect}
          assigneeList={assigneeList}
          onClose={() => setFloatingTicket(null)}
          onUpdated={handleTicketUpdated}
        />
      )}
    </div>
  );
}
