"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import type { HwRepairRecord } from "@/types";
import EnvVarMissing from "@/components/ui/EnvVarMissing";

// ── 상수 ────────────────────────────────────────────────────
const STAGES = ["수리접수", "수리센터입고", "수리완료", "수리동의서수령", "기기발송", "세금계산서기안", "법인청구요청", "사용자과실분청구", "완료"] as const;
type Stage = typeof STAGES[number];

const FAULT_TYPES = ["사용자과실", "과실없음", "기타"] as const;

const COMPANIES = ["대웅", "대웅제약", "대웅바이오", "대웅개발", "대웅펫", "시지바이오", "클리슈어리서치", "IDS", "유와이즈원", "페이지원", "엠서클"];

const STAGE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  "수리접수":         { bg: "#F8FAFC", text: "#64748B", dot: "#94A3B8" },
  "수리센터입고":     { bg: "#EFF6FF", text: "#1D4ED8", dot: "#3B82F6" },
  "수리완료":         { bg: "#F0FDF4", text: "#15803D", dot: "#22C55E" },
  "수리동의서수령":   { bg: "#FFF7ED", text: "#C2410C", dot: "#F97316" },
  "기기발송":         { bg: "#FEFCE8", text: "#A16207", dot: "#EAB308" },
  "세금계산서기안":   { bg: "#FDF4FF", text: "#9333EA", dot: "#A855F7" },
  "법인청구요청":     { bg: "#FFF1F2", text: "#BE123C", dot: "#F43F5E" },
  "사용자과실분청구": { bg: "#FEF2F2", text: "#DC2626", dot: "#EF4444" },
  "완료":             { bg: "#F5F3FF", text: "#6D28D9", dot: "#8B5CF6" },
};

const FAULT_COLORS: Record<string, { bg: string; text: string }> = {
  "사용자과실": { bg: "#FEF2F2", text: "#DC2626" },
  "과실없음":   { bg: "#F0FDF4", text: "#059669" },
  "기타":       { bg: "#F8FAFC", text: "#64748B" },
};

// Notion 필드명 매핑
const FILE_FIELD_MAP: Record<keyof Pick<HwRepairRecord, "receiptUrl" | "consentUrl" | "taxInvoiceUrl" | "approvalUrl">, string> = {
  receiptUrl:    "수리영수증",
  consentUrl:    "진행동의서",
  taxInvoiceUrl: "세금계산서결재",
  approvalUrl:   "내부결재내용",
};

// ── Helpers ──────────────────────────────────────────────────
function agingDays(receivedAt: string, completedAt: string, stage: string): number {
  if (!receivedAt) return 0;
  const start = new Date(receivedAt);
  const end = stage === "완료" && completedAt ? new Date(completedAt) : new Date();
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000);
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

function fmtDateKo(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${y}.${m}.${d}`;
}

function isImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|svg)/i.test(url) || url.includes("image");
}

function isPdfUrl(url: string): boolean {
  return /\.pdf/i.test(url) || url.includes("pdf");
}

// ── Sub-components ───────────────────────────────────────────
function StageBadge({ stage }: { stage: string }) {
  const c = STAGE_COLORS[stage] ?? { bg: "#F1F5F9", text: "#64748B" };
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
      style={{ background: c.bg, color: c.text }}>
      {stage || "—"}
    </span>
  );
}

function FaultBadge({ fault }: { fault: string }) {
  if (!fault) return <span className="text-xs text-gray-300">—</span>;
  const c = FAULT_COLORS[fault] ?? { bg: "#F1F5F9", text: "#64748B" };
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
      style={{ background: c.bg, color: c.text }}>
      {fault}
    </span>
  );
}

function AgingChip({ days, stage }: { days: number; stage: string }) {
  if (stage === "완료") return <span className="text-xs text-gray-400">{days}일 소요</span>;
  const color = days >= 7 ? "#DC2626" : days >= 3 ? "#D97706" : "#6B7280";
  return <span className="text-xs font-semibold" style={{ color }}>D+{days}</span>;
}

// 미니 진행 점
function MiniStageBar({ stage }: { stage: string }) {
  const idx = STAGES.indexOf(stage as Stage);
  return (
    <div className="flex items-center gap-0.5">
      {STAGES.map((s, i) => {
        const c = STAGE_COLORS[s];
        const active = i === idx;
        const done = i < idx;
        return (
          <div key={s} title={s} className="rounded-full transition-all"
            style={{
              width: active ? 10 : 6, height: active ? 10 : 6,
              background: done ? "#22C55E" : active ? c.dot : "#E2E8F0",
              border: active ? `2px solid ${c.dot}` : "none",
            }}
          />
        );
      })}
    </div>
  );
}

// 대형 진행 바 (모달용)
function BigStageBar({ stage }: { stage: string }) {
  const idx = STAGES.indexOf(stage as Stage);
  return (
    <div className="flex items-start gap-0">
      {STAGES.map((s, i) => {
        const c = STAGE_COLORS[s];
        const active = i === idx;
        const done = i < idx;
        const isLast = i === STAGES.length - 1;
        return (
          <div key={s} className="flex flex-col items-center" style={{ flex: 1 }}>
            <div className="flex items-center w-full">
              <div className="flex-1 h-0.5" style={{ background: i === 0 ? "transparent" : done || active ? "#22C55E" : "#E2E8F0" }} />
              <div className="rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                style={{
                  width: active ? 22 : 14, height: active ? 22 : 14,
                  background: done ? "#22C55E" : active ? c.dot : "#E2E8F0",
                  border: active ? `3px solid ${c.dot}` : done ? "none" : "2px solid #CBD5E1",
                }}>
                {done && (
                  <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <div className="flex-1 h-0.5" style={{ background: isLast ? "transparent" : done ? "#22C55E" : "#E2E8F0" }} />
            </div>
            <div className="mt-1.5 text-center whitespace-pre-line leading-tight"
              style={{ fontSize: 8, color: active ? c.text : done ? "#22C55E" : "#94A3B8", fontWeight: active ? 700 : done ? 600 : 400 }}>
              {s.replace("수리센터", "수리\n센터").replace("과실분", "과실\n분")}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 파일 미리보기 모달 ────────────────────────────────────────
function FilePreviewModal({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isImg = isImageUrl(url);
  const isPdf = isPdfUrl(url);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col mx-4"
        style={{ width: "min(860px, 95vw)", maxHeight: "90vh" }}
        onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 shrink-0">
          <span className="text-sm font-bold text-gray-800 truncate max-w-xs">{name}</span>
          <div className="flex items-center gap-2">
            <a href={url} download target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-white hover:bg-gray-700 transition-colors font-medium">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              다운로드
            </a>
            <button onClick={onClose}
              className="text-gray-400 hover:text-gray-700 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-xl">
              ×
            </button>
          </div>
        </div>
        {/* 본문 */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-gray-50" style={{ minHeight: 300 }}>
          {isImg ? (
            <img src={url} alt={name} className="max-w-full max-h-full object-contain rounded-lg shadow" />
          ) : isPdf ? (
            <iframe src={url} className="w-full rounded-lg border border-gray-200" style={{ height: "70vh" }} title={name} />
          ) : (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">📄</div>
              <p className="text-sm text-gray-600 mb-4">{name}</p>
              <a href={url} download target="_blank" rel="noopener noreferrer"
                className="text-xs px-4 py-2 rounded-lg bg-gray-800 text-white hover:bg-gray-700 transition-colors">
                파일 다운로드
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getShortFileName(url: string): string {
  try {
    const path = url.split("?")[0];
    const raw = path.split("/").pop() ?? "";
    const decoded = decodeURIComponent(raw);
    const dotIdx = decoded.lastIndexOf(".");
    const ext = dotIdx >= 0 ? decoded.slice(dotIdx) : "";
    const base = dotIdx >= 0 ? decoded.slice(0, dotIdx) : decoded;
    return base.length > 5 ? `${base.slice(0, 5)}...${ext}` : `${base}${ext}`;
  } catch {
    return "파일";
  }
}

// ── 파일 셀 ───────────────────────────────────────────────────
function FileCell({
  urls, label, pageId, notionField, onUploaded, onPreview,
}: {
  urls: string[];
  label: string;
  pageId: string;
  notionField: string;
  onUploaded: (urls: string[]) => void;
  onPreview: (url: string, name: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingIdx, setDeletingIdx] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDelete = async (idx: number) => {
    setDeletingIdx(idx);
    const remainingUrls = urls.filter((_, i) => i !== idx);
    try {
      const res = await fetch("/api/hw-repair/delete-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, fieldName: notionField, remainingUrls }),
      });
      const json = await res.json();
      if (json.ok) onUploaded(remainingUrls);
    } finally {
      setDeletingIdx(null);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    const inputEl = e.target;
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("pageId", pageId);
      fd.append("fieldName", notionField);
      // 현재 URLs를 서버로 전달해 기존 파일 참조에 사용
      fd.append("existingUrls", JSON.stringify(urls));

      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 30_000);
      let res: Response;
      try {
        res = await fetch("/api/hw-repair/upload", { method: "POST", body: fd, signal: controller.signal });
      } finally {
        clearTimeout(tid);
      }
      const json = await res.json();
      if (json.ok && json.urls) {
        onUploaded(json.urls);
      } else {
        setUploadError(json.error ?? "업로드 실패");
      }
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === "AbortError";
      setUploadError(isTimeout ? "업로드 시간 초과 (30s)" : "업로드 중 오류 발생");
    } finally {
      setUploading(false);
      inputEl.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex flex-wrap gap-0.5">
        {urls.length === 0 && <span className="text-[10px] text-gray-300">미첨부</span>}
        {urls.map((url, i) => (
          <span key={i} className="flex items-center gap-0.5 bg-blue-50 rounded px-1 py-0.5">
            <button
              onClick={() => onPreview(url, urls.length > 1 ? `${label} ${i + 1}` : label)}
              className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:text-blue-800 transition-colors whitespace-nowrap"
              title={decodeURIComponent(url.split("?")[0].split("/").pop() ?? "")}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              {getShortFileName(url)}
            </button>
            <button
              onClick={() => handleDelete(i)}
              disabled={deletingIdx === i}
              title="삭제"
              className="text-gray-300 hover:text-red-400 transition-colors disabled:opacity-40 leading-none"
            >
              {deletingIdx === i ? (
                <svg className="animate-spin w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25"/><path d="M21 12a9 9 0 00-9-9"/>
                </svg>
              ) : (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              )}
            </button>
          </span>
        ))}
      </div>
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        title="파일 추가 업로드"
        className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40 w-fit"
      >
        {uploading ? (
          <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25"/><path d="M21 12a9 9 0 00-9-9"/>
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        )}
        {uploading ? "업로드 중…" : urls.length > 0 ? "추가" : "첨부"}
      </button>
      {uploadError && (
        <p className="text-[9px] text-red-500 leading-tight max-w-[120px]">{uploadError}</p>
      )}
      <input ref={inputRef} type="file" className="hidden" onChange={handleUpload} />
    </div>
  );
}

// ── 상세 모달 ─────────────────────────────────────────────────
function DetailModal({
  record, assigneeList, onClose, onUpdated, onPreview,
}: {
  record: HwRepairRecord;
  assigneeList: { id: string; name: string }[];
  onClose: () => void;
  onUpdated: (id: string, fields: Partial<HwRepairRecord>) => void;
  onPreview: (url: string, name: string) => void;
}) {
  const [stage, setStage] = useState(record.stage);
  const [faultType, setFaultType] = useState(record.faultType);
  const [note, setNote] = useState(record.note);
  const [company, setCompany] = useState(record.company ?? "");
  const [department, setDepartment] = useState(record.department ?? "");
  const [user, setUser] = useState(record.user ?? "");
  const [vendor, setVendor] = useState(record.vendor ?? "");
  const [assigneeName, setAssigneeName] = useState(record.assignee ?? "");
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async (field: string, value: Record<string, unknown>) => {
    setSaving(field);
    try {
      const res = await fetch("/api/hw-repair/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: record.id, fields: value }),
      });
      const json = await res.json();
      if (json.ok) {
        onUpdated(record.id, value as Partial<HwRepairRecord>);
        setSaved(p => ({ ...p, [field]: true }));
        setTimeout(() => setSaved(p => ({ ...p, [field]: false })), 2000);
      }
    } finally {
      setSaving(null);
    }
  };

  const days = agingDays(record.receivedAt, record.completedAt, record.stage);

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-start gap-4 py-3 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 w-24 shrink-0 pt-0.5">{label}</span>
      <div className="flex-1 text-sm text-gray-800">{children}</div>
    </div>
  );

  const SaveRow = ({ label, field, children }: { label: string; field: string; children: React.ReactNode }) => (
    <Row label={label}>
      <div className="flex items-center gap-2 flex-wrap">
        {children}
        {saved[field] && <span className="text-xs text-green-600">✓ 변경됨</span>}
      </div>
    </Row>
  );

  const selectCls = "text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200";
  const saveBtnCls = (field: string, cur: string, orig: string) =>
    `text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-white font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed ${saving === field || cur === orig ? "opacity-40 cursor-not-allowed" : ""}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden"
        style={{ maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="px-7 py-5 border-b border-gray-100 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono text-sm font-bold text-gray-900">{record.assetId || "자산번호 없음"}</span>
              <FaultBadge fault={record.faultType} />
              {record.stage !== "완료" && <AgingChip days={days} stage={record.stage} />}
            </div>
            <p className="text-xs text-gray-400">{record.vendor || "수리 업체 미입력"} · {record.company || ""} {record.user || ""} · 접수 {fmtDateKo(record.receivedAt)}</p>
          </div>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 shrink-0">×
          </button>
        </div>

        {/* 단계 진행 바 */}
        <div className="px-7 py-5 border-b border-gray-100 bg-gray-50">
          <BigStageBar stage={stage} />
        </div>

        <div className="px-7 py-1">
          {/* 현재 단계 */}
          <SaveRow label="현재 단계" field="stage">
            <select value={stage} onChange={e => setStage(e.target.value)} className={selectCls}>
              {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={() => save("stage", { stage })} disabled={saving === "stage" || stage === record.stage} className={saveBtnCls("stage", stage, record.stage)}>
              {saving === "stage" ? "저장 중…" : "저장"}
            </button>
          </SaveRow>

          {/* 법인 */}
          <SaveRow label="법인" field="company">
            <select value={company} onChange={e => setCompany(e.target.value)} className={selectCls}>
              <option value="">—</option>
              {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={() => save("company", { company })} disabled={saving === "company" || company === record.company} className={saveBtnCls("company", company, record.company)}>
              {saving === "company" ? "저장 중…" : "저장"}
            </button>
          </SaveRow>

          {/* 부서 */}
          <SaveRow label="부서" field="department">
            <input value={department} onChange={e => setDepartment(e.target.value)} className={selectCls + " w-32"} placeholder="부서명" />
            <button onClick={() => save("department", { department })} disabled={saving === "department" || department === record.department} className={saveBtnCls("department", department, record.department)}>
              {saving === "department" ? "저장 중…" : "저장"}
            </button>
          </SaveRow>

          {/* 사용자 */}
          <SaveRow label="사용자" field="user">
            <input value={user} onChange={e => setUser(e.target.value)} className={selectCls + " w-32"} placeholder="이름" />
            <button onClick={() => save("user", { user })} disabled={saving === "user" || user === record.user} className={saveBtnCls("user", user, record.user)}>
              {saving === "user" ? "저장 중…" : "저장"}
            </button>
          </SaveRow>

          {/* 접수일 */}
          <Row label="접수일">{fmtDateKo(record.receivedAt)}</Row>

          {/* 과실 여부 */}
          <SaveRow label="과실 여부" field="faultType">
            <select value={faultType} onChange={e => setFaultType(e.target.value)} className={selectCls}>
              <option value="">—</option>
              {FAULT_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <button onClick={() => save("faultType", { faultType })} disabled={saving === "faultType" || faultType === record.faultType} className={saveBtnCls("faultType", faultType, record.faultType)}>
              {saving === "faultType" ? "저장 중…" : "저장"}
            </button>
          </SaveRow>

          {/* 수리 업체 */}
          <SaveRow label="수리 업체" field="vendor">
            <input value={vendor} onChange={e => setVendor(e.target.value)} className={selectCls + " w-40"} placeholder="업체명" />
            <button onClick={() => save("vendor", { vendor })} disabled={saving === "vendor" || vendor === record.vendor} className={saveBtnCls("vendor", vendor, record.vendor)}>
              {saving === "vendor" ? "저장 중…" : "저장"}
            </button>
          </SaveRow>

          {/* 담당자 */}
          <SaveRow label="담당자" field="assignee">
            <select value={assigneeName} onChange={e => setAssigneeName(e.target.value)} className={selectCls}>
              <option value="">미배정</option>
              {assigneeList.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
            </select>
            <button onClick={() => { const found = assigneeList.find(u => u.name === assigneeName); save("assignee", { assigneeId: found?.id ?? "" }); }}
              disabled={saving === "assignee" || assigneeName === (record.assignee ?? "")} className={saveBtnCls("assignee", assigneeName, record.assignee ?? "")}>
              {saving === "assignee" ? "저장 중…" : "저장"}
            </button>
          </SaveRow>

          {/* 수리 내용 */}
          <Row label="수리 내용">
            <div className="flex flex-col gap-2">
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
                placeholder="수리 내용 입력" />
              <div className="flex items-center gap-2">
                <button onClick={() => save("note", { note })} disabled={saving === "note" || note === record.note}
                  className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-white font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">
                  {saving === "note" ? "저장 중…" : "저장"}
                </button>
                {saved.note && <span className="text-xs text-green-600">✓ 저장됨</span>}
              </div>
            </div>
          </Row>

          {/* 파일 필드 */}
          {(["receiptUrl", "consentUrl", "taxInvoiceUrl", "approvalUrl"] as const).map(key => {
            const labels: Record<string, string> = {
              receiptUrl: "영수증", consentUrl: "진행동의서", taxInvoiceUrl: "세금계산서결재", approvalUrl: "내부결재내용",
            };
            return (
              <Row key={key} label={labels[key]}>
                <FileCell
                  urls={record[key]}
                  label={labels[key]}
                  pageId={record.id}
                  notionField={FILE_FIELD_MAP[key]}
                  onUploaded={urls => onUpdated(record.id, { [key]: urls })}
                  onPreview={onPreview}
                />
              </Row>
            );
          })}

          {/* 완료일 / 소요일 */}
          {record.completedAt && <Row label="완료일">{fmtDateKo(record.completedAt)}</Row>}
          {record.stage === "완료" && record.completedAt && (
            <Row label="총 소요일"><span className="font-semibold text-gray-700">{days}일</span></Row>
          )}

          <Row label="최근 업데이트">
            <span className="text-xs text-gray-400">
              {record.lastEditedAt ? new Date(record.lastEditedAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "—"}
            </span>
          </Row>
        </div>

        {record.notionUrl && (
          <div className="px-7 py-4 border-t border-gray-100">
            <a href={record.notionUrl} target="_blank" rel="noopener noreferrer"
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

// ── 담당자 인라인 드롭다운 셀 ─────────────────────────────────
function AssigneeCell({
  recordId, assigneeId, assigneeName, allUsers, onUpdated,
}: {
  recordId: string;
  assigneeId: string;
  assigneeName: string;
  allUsers: { id: string; name: string }[];
  onUpdated: (id: string, fields: Partial<HwRepairRecord>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleOpen = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen(o => !o);
  };

  const select = async (user: { id: string; name: string } | null) => {
    setOpen(false);
    setSaving(true);
    try {
      const res = await fetch("/api/hw-repair/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: recordId, fields: { assigneeId: user?.id ?? "" } }),
      });
      const json = await res.json();
      if (json.ok) onUpdated(recordId, { assigneeId: user?.id ?? "", assignee: user?.name ?? "" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div ref={ref}>
      <button
        ref={btnRef}
        onClick={handleOpen}
        disabled={saving}
        className="flex items-center gap-1 text-xs text-gray-700 hover:text-blue-600 hover:underline transition-colors disabled:opacity-40 whitespace-nowrap"
      >
        {saving ? (
          <svg className="animate-spin w-3 h-3 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25"/><path d="M21 12a9 9 0 00-9-9"/>
          </svg>
        ) : assigneeName ? (
          assigneeName
        ) : (
          <span className="text-gray-300">미배정</span>
        )}
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-300 shrink-0">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {open && (
        <div
          className="fixed z-[200] bg-white border border-gray-200 rounded-xl shadow-xl py-1 min-w-[140px] max-h-52 overflow-y-auto"
          style={{ top: dropdownPos.top, left: dropdownPos.left }}
        >
          <button
            onClick={() => select(null)}
            className="w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-50"
          >
            미배정
          </button>
          {allUsers.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-400">사용자 없음</p>
          )}
          {allUsers.map(u => (
            <button
              key={u.id}
              onClick={() => select(u)}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 hover:text-blue-700 transition-colors ${u.id === assigneeId ? "font-bold text-blue-600" : "text-gray-700"}`}
            >
              {u.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 자산 정보 모달 ────────────────────────────────────────────
type HwAsset = {
  id: string; notionUrl: string;
  assetNo: string; model: string; serial: string; maker: string;
  cpu: string; ram: string; company: string; dept: string;
  location: string; status: string; user: string;
  purchaseDate: string; useDate: string; returnDue: string;
  price: number; residualValue: number; note: string;
};

function AssetDetailModal({ assetId, onClose }: { assetId: string; onClose: () => void }) {
  const [asset, setAsset] = useState<HwAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!assetId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/hw?search=${encodeURIComponent(assetId)}`)
      .then(r => r.json())
      .then(data => {
        const records: HwAsset[] = data.records ?? data.data ?? [];
        const found = records.find(r => r.assetNo === assetId) ?? records[0] ?? null;
        if (found) setAsset(found);
        else setError("자산관리 DB에서 해당 자산번호를 찾을 수 없습니다.");
      })
      .catch(() => setError("조회 중 오류가 발생했습니다."))
      .finally(() => setLoading(false));
  }, [assetId]);

  const row = (label: string, value: string | number | undefined) =>
    value ? (
      <div className="flex gap-2 py-1.5 border-b border-gray-50 last:border-0">
        <span className="w-24 shrink-0 text-xs text-gray-400">{label}</span>
        <span className="text-xs text-gray-800 break-all">{value}</span>
      </div>
    ) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-[10px] text-gray-400 mb-0.5">자산관리 DB</p>
            <h2 className="text-base font-bold text-gray-900 font-mono">{assetId}</h2>
          </div>
          <div className="flex items-center gap-2">
            {asset?.notionUrl && (
              <a href={asset.notionUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:underline">Notion ↗</a>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg leading-none">×</button>
          </div>
        </div>
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
          {loading && <p className="text-xs text-gray-400 text-center py-8">조회 중…</p>}
          {error && <p className="text-xs text-red-500 text-center py-8">{error}</p>}
          {asset && (
            <div>
              {row("모델명", asset.model)}
              {row("제조사", asset.maker)}
              {row("시리얼번호", asset.serial)}
              {row("CPU", asset.cpu)}
              {row("RAM", asset.ram)}
              {row("상태", asset.status)}
              {row("사용자", asset.user)}
              {row("법인", asset.company)}
              {row("부서", asset.dept)}
              {row("위치", asset.location)}
              {row("구매일", asset.purchaseDate)}
              {row("사용일", asset.useDate)}
              {row("반납예정일", asset.returnDue)}
              {row("단가", asset.price ? `${asset.price.toLocaleString()}원` : "")}
              {row("잔존가치", asset.residualValue ? `${asset.residualValue.toLocaleString()}원` : "")}
              {row("기타", asset.note)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 신규 등록 모달 ────────────────────────────────────────────
type CreateForm = {
  assetId: string; stage: string; company: string; department: string;
  user: string; vendor: string; receivedAt: string; faultType: string; note: string;
};

const EMPTY_FORM: CreateForm = {
  assetId: "", stage: "수리접수", company: "", department: "", user: "",
  vendor: "", receivedAt: "", faultType: "", note: "",
};

const VENDORS = ["삼성공식수리(출장)", "다정씨엔씨", "기타"];

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [autoFilling, setAutoFilling] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);

  useEffect(() => {
    const id = form.assetId.trim();
    if (id.length < 4) { setAutoFilled(false); return; }
    const timer = setTimeout(async () => {
      setAutoFilling(true);
      try {
        const res = await fetch(`/api/hw?search=${encodeURIComponent(id)}`);
        const data = await res.json();
        const records: { assetNo: string; user: string; dept: string; company: string }[] = data.records ?? [];
        const found = records.find(r => r.assetNo === id) ?? (records.length === 1 ? records[0] : null);
        if (found) {
          setForm(p => ({
            ...p,
            user: found.user || p.user,
            department: found.dept || p.department,
            company: found.company || p.company,
          }));
          setAutoFilled(true);
        } else {
          setAutoFilled(false);
        }
      } catch { /* 무시 */ } finally {
        setAutoFilling(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [form.assetId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (k: keyof CreateForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.assetId.trim()) { setErr("자산번호를 입력해주세요."); return; }
    setSaving(true); setErr(null);
    try {
      const res = await fetch("/api/hw-repair/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.ok) { setErr(json.error ?? "등록 실패"); return; }
      onCreated();
      onClose();
    } catch (e) {
      setErr(String(e));
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white";
  const labelCls = "text-xs text-gray-400 mb-1 block";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        style={{ maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>

        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-base">수리 건 등록</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">×</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={labelCls} style={{ margin: 0 }}>자산번호 <span className="text-red-500">*</span></label>
              {autoFilling && <span className="text-[10px] text-gray-400 flex items-center gap-1"><svg className="animate-spin w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25"/><path d="M21 12a9 9 0 00-9-9"/></svg>조회 중…</span>}
              {!autoFilling && autoFilled && <span className="text-[10px] text-green-500">✓ 자동입력 완료</span>}
            </div>
            <input className={inputCls} placeholder="예) DW-NB-0123" value={form.assetId} onChange={set("assetId")} autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>현재단계</label>
              <select className={inputCls} value={form.stage} onChange={set("stage")}>
                {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>과실여부</label>
              <select className={inputCls} value={form.faultType} onChange={set("faultType")}>
                <option value="">선택 안 함</option>
                {FAULT_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>법인</label>
              <select className={inputCls} value={form.company} onChange={set("company")}>
                <option value="">선택 안 함</option>
                {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>수리업체</label>
              <select className={inputCls} value={form.vendor} onChange={set("vendor")}>
                <option value="">선택 안 함</option>
                {VENDORS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>부서</label>
              <input className={inputCls} placeholder="부서명" value={form.department} onChange={set("department")} />
            </div>
            <div>
              <label className={labelCls}>사용자</label>
              <input className={inputCls} placeholder="사용자 이름" value={form.user} onChange={set("user")} />
            </div>
          </div>

          <div>
            <label className={labelCls}>접수일</label>
            <div className="flex items-center gap-1">
              <input type="date" className={`${inputCls} flex-1`} value={form.receivedAt} onChange={set("receivedAt")} />
              {form.receivedAt && <button type="button" onClick={() => setForm(p => ({ ...p, receivedAt: "" }))} className="text-gray-400 hover:text-gray-600 text-lg leading-none shrink-0 px-0.5">×</button>}
            </div>
          </div>

          <div>
            <label className={labelCls}>수리내용</label>
            <textarea className={inputCls} rows={3} placeholder="수리 내용 메모..." value={form.note}
              onChange={set("note")} style={{ resize: "vertical" }} />
          </div>

          {err && <p className="text-xs text-red-600">{err}</p>}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">취소</button>
          <button onClick={handleSubmit} disabled={saving}
            className="text-sm px-5 py-2 rounded-lg bg-gray-900 text-white font-semibold hover:bg-gray-700 disabled:opacity-40 transition-colors">
            {saving ? "등록 중..." : "등록"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 메인 패널 ─────────────────────────────────────────────────
export default function HwRepairPanel() {
  const [records, setRecords] = useState<HwRepairRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missingEnv, setMissingEnv] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [caseTab, setCaseTab] = useState<"open" | "closed">("open");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<HwRepairRecord | null>(null);
  const [assetModal, setAssetModal] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const [blockMsg, setBlockMsg] = useState<{ id: string; msg: string } | null>(null);
  const [allUsers, setAllUsers] = useState<{ id: string; name: string }[]>([]);

  const assigneeList = useMemo(() => {
    const seen = new Map<string, string>();
    records.forEach(r => { if (r.assigneeId && r.assignee) seen.set(r.assigneeId, r.assignee); });
    return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [records]);

  const STATIC_USERS = [
    { id: "335d872b-594c-811b-8c49-000297d936e0", name: "이동경" },
    { id: "a4a74b12-760f-46d4-bb10-2a1dcc1317ab", name: "자산관리파트_권정훈" },
  ];

  // API 결과 + 기존 레코드 + 고정 담당자 병합
  const mergedUsers = useMemo(() => {
    const map = new Map<string, string>();
    allUsers.forEach(u => map.set(u.id, u.name));
    assigneeList.forEach(u => map.set(u.id, u.name));
    STATIC_USERS.forEach(u => { if (!map.has(u.id)) map.set(u.id, u.name); });
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [allUsers, assigneeList]);

  const handleUpdated = useCallback((id: string, fields: Partial<HwRepairRecord>) => {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, ...fields } : r));
    setSelected(prev => prev?.id === id ? { ...prev, ...fields } : prev);
  }, []);

  const handleToggleClose = useCallback(async (r: HwRepairRecord) => {
    setAdvancingId(r.id);
    try {
      const res = await fetch("/api/hw-repair/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id, fields: { isClosed: !r.isClosed } }),
      });
      const json = await res.json();
      if (json.ok) handleUpdated(r.id, { isClosed: !r.isClosed });
    } finally {
      setAdvancingId(null);
    }
  }, [handleUpdated]);

  const handleAdvanceStage = useCallback(async (r: HwRepairRecord) => {
    const idx = STAGES.indexOf(r.stage as typeof STAGES[number]);
    if (idx === -1 || idx === STAGES.length - 1) return; // 마지막 단계거나 알 수 없는 단계

    // 수리완료 → 다음 단계 이동 시: 사용자과실이면 진행동의서 필수
    if (r.stage === "수리완료" && r.faultType === "사용자과실" && r.consentUrl.length === 0) {
      setBlockMsg({ id: r.id, msg: "사용자과실 건은 진행동의서 첨부 후 다음 단계로 이동할 수 있습니다." });
      setTimeout(() => setBlockMsg(null), 4000);
      return;
    }

    const nextStage = STAGES[idx + 1];
    setAdvancingId(r.id);
    try {
      const res = await fetch("/api/hw-repair/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id, fields: { stage: nextStage } }),
      });
      const json = await res.json();
      if (json.ok) handleUpdated(r.id, { stage: nextStage });
    } finally {
      setAdvancingId(null);
    }
  }, [handleUpdated]);

  const load = useCallback((force = false) => {
    if (!force) { setLoading(true); setError(null); }
    fetch(`/api/hw-repair${force ? "?refresh=1" : ""}`)
      .then(r => r.json())
      .then(res => {
        if (res.missingEnv) { setMissingEnv(res.missingEnv); return; }
        if (res.error) { setError(res.error); return; }
        setRecords(res.data ?? []);
        setLastSynced(res.lastSynced ?? null);
      })
      .catch(e => { if (!force) setError(e.message); })
      .finally(() => { if (!force) setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch("/api/hw-repair/assignees")
      .then(r => r.json())
      .then(res => { if (res.ok) setAllUsers(res.users); });
  }, []);
  useEffect(() => {
    const id = setInterval(() => load(true), 30_000);
    return () => clearInterval(id);
  }, [load]);

  const openRecords   = useMemo(() => records.filter(r => !r.isClosed), [records]);
  const closedRecords = useMemo(() => records.filter(r =>  r.isClosed), [records]);
  const tabRecords    = caseTab === "open" ? openRecords : closedRecords;

  const total      = tabRecords.length;
  const inProgress = tabRecords.filter(r => r.stage !== "완료").length;
  const completed  = tabRecords.filter(r => r.stage === "완료").length;
  const userFault  = tabRecords.filter(r => r.faultType === "사용자과실").length;

  const stageCounts = useMemo(() =>
    Object.fromEntries(STAGES.map(s => [s, tabRecords.filter(r => r.stage === s).length])),
    [tabRecords]
  );

  const filtered = useMemo(() => tabRecords.filter(r => {
    if (stageFilter !== "all" && r.stage !== stageFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return [r.assetId, r.vendor, r.assignee, r.note, r.company, r.department, r.user]
        .some(v => (v || "").toLowerCase().includes(q));
    }
    return true;
  }), [tabRecords, stageFilter, search]);

  if (missingEnv) return <EnvVarMissing varName={missingEnv} />;
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400 text-sm gap-2">
        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25"/>
          <path d="M21 12a9 9 0 00-9-9"/>
        </svg>
        수리/과실청구 내역 불러오는 중...
      </div>
    );
  }

  return (
    <div className="fade-in">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-0.5">수리/과실청구 트래커</h2>
          <p className="text-sm text-gray-500">
            외부 수리 · 과실 청구 관리 · 전체 {total}건
            {lastSynced && (
              <span className="ml-2 text-gray-300 text-[10px]">
                {new Date(lastSynced).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 동기화
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCreateOpen(true)}
            className="text-xs font-semibold px-3 py-1.5 rounded bg-gray-900 text-white hover:bg-gray-700 flex items-center gap-1.5 transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            신규 등록
          </button>
          <button onClick={() => load(true)}
            className="text-xs font-medium px-3 py-1.5 rounded border bg-white text-gray-600 border-gray-300 hover:border-gray-400 flex items-center gap-1 transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
            새로고침
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">⚠️ {error}</div>
      )}

      {/* 열린/닫힌 케이스 탭 */}
      <div className="flex items-center gap-1 mb-5 p-1 bg-gray-100 rounded-xl w-fit">
        <button onClick={() => { setCaseTab("open"); setStageFilter("all"); }}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${caseTab === "open" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          Open Cases
          <span className="text-xs font-normal text-gray-400 ml-0.5">{openRecords.length}</span>
        </button>
        <button onClick={() => { setCaseTab("closed"); setStageFilter("all"); }}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${caseTab === "closed" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
          Closed Cases
          <span className="text-xs font-normal text-gray-400 ml-0.5">{closedRecords.length}</span>
        </button>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "전체",       value: total,      color: "#1E40AF" },
          { label: "진행 중",    value: inProgress,  color: "#C2410C" },
          { label: "완료",       value: completed,   color: "#059669" },
          { label: "사용자 과실", value: userFault,  color: "#DC2626" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-1">
            <div className="text-2xl font-extrabold" style={{ color }}>{value}</div>
            <div className="text-xs font-medium text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      {/* 단계 필터 탭 — 닫힌 케이스는 모두 "완료"이므로 숨김 */}
      {caseTab === "open" && <div className="flex flex-wrap gap-1.5 mb-4">
        <button onClick={() => setStageFilter("all")}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${stageFilter === "all" ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
          전체 {total}
        </button>
        {STAGES.map(s => {
          const cnt = stageCounts[s] ?? 0;
          const c = STAGE_COLORS[s];
          const active = stageFilter === s;
          return (
            <button key={s} onClick={() => setStageFilter(s)}
              className="px-3 py-1 rounded-full text-xs font-semibold transition-colors"
              style={{ background: active ? c.dot : cnt > 0 ? c.bg : "#F8FAFC", color: active ? "white" : cnt > 0 ? c.text : "#CBD5E1" }}>
              {s} {cnt}
            </button>
          );
        })}
      </div>}

      {/* 검색 */}
      <div className="mb-4 flex items-center gap-2">
        <input type="text" placeholder="자산번호 / 법인 / 부서 / 사용자 / 수리업체 검색..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 max-w-md text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        {search && <button onClick={() => setSearch("")} className="text-xs text-gray-400 hover:text-gray-600 underline">초기화</button>}
        <span className="text-xs text-gray-400 ml-1">{filtered.length}건</span>
      </div>

      {/* 테이블 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-auto">
        <table className="data-table">
          <thead>
            <tr>
              {["진행단계", "자산번호", "법인", "부서", "사용자", "접수일", "과실여부", "수리업체", "담당자", "수리내용", "영수증", "진행동의서", "세금계산서결재", "내부결재내용"].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={14} className="text-center text-gray-400 py-10">데이터 없음</td></tr>
            ) : filtered.map(r => {
              const days = agingDays(r.receivedAt, r.completedAt, r.stage);
              return (
                <tr key={r.id}>
                  {/* 진행단계 */}
                  <td>
                    <div className="flex flex-col gap-1">
                      <div className="cursor-pointer" onClick={() => setSelected(r)}>
                        <MiniStageBar stage={r.stage} />
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="cursor-pointer" onClick={() => setSelected(r)}>
                          <StageBadge stage={r.stage} />
                        </span>
                        <AgingChip days={days} stage={r.stage} />
                        {r.stage !== "완료" && (
                          <button
                            onClick={() => handleAdvanceStage(r)}
                            disabled={advancingId === r.id}
                            title="다음 단계로 이동"
                            className="flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 hover:bg-gray-800 hover:text-white transition-colors disabled:opacity-40"
                          >
                            {advancingId === r.id ? (
                              <svg className="animate-spin w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25"/><path d="M21 12a9 9 0 00-9-9"/>
                              </svg>
                            ) : (
                              <>다음 <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg></>
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleClose(r)}
                          disabled={advancingId === r.id}
                          title={r.isClosed ? "케이스 다시 열기" : "케이스 닫기"}
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded transition-colors disabled:opacity-40 ${r.isClosed ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100" : "bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500"}`}
                        >
                          {r.isClosed ? "열기" : "닫기"}
                        </button>
                      </div>
                      {blockMsg?.id === r.id && (
                        <p className="text-[10px] text-red-500 leading-tight max-w-[160px]">{blockMsg.msg}</p>
                      )}
                    </div>
                  </td>
                  {/* 자산번호 */}
                  <td>
                    <button className="font-mono text-sm font-semibold text-blue-600 hover:underline" onClick={() => r.assetId && setAssetModal(r.assetId)}>
                      {r.assetId || "—"}
                    </button>
                  </td>
                  {/* 법인 */}
                  <td className="text-xs text-gray-600">{r.company || "—"}</td>
                  {/* 부서 */}
                  <td className="text-xs text-gray-600">{r.department || "—"}</td>
                  {/* 사용자 */}
                  <td className="text-xs text-gray-700">{r.user || "—"}</td>
                  {/* 접수일 */}
                  <td className="text-xs text-gray-500">{fmtDate(r.receivedAt)}</td>
                  {/* 과실여부 */}
                  <td><FaultBadge fault={r.faultType} /></td>
                  {/* 수리업체 */}
                  <td className="text-xs text-gray-600">{r.vendor || "—"}</td>
                  {/* 담당자 */}
                  <td>
                    <AssigneeCell
                      recordId={r.id}
                      assigneeId={r.assigneeId}
                      assigneeName={r.assignee}
                      allUsers={mergedUsers}
                      onUpdated={handleUpdated}
                    />
                  </td>
                  {/* 수리내용 */}
                  <td className="max-w-[120px]">
                    <p className="text-xs text-gray-700 truncate" title={r.note}>{r.note || "—"}</p>
                  </td>
                  {/* 파일 4개 */}
                  {(["receiptUrl", "consentUrl", "taxInvoiceUrl", "approvalUrl"] as const).map(key => {
                    const labels: Record<string, string> = {
                      receiptUrl: "영수증", consentUrl: "진행동의서", taxInvoiceUrl: "세금계산서결재", approvalUrl: "내부결재내용",
                    };
                    return (
                      <td key={key}>
                        <FileCell
                          urls={r[key]}
                          label={labels[key]}
                          pageId={r.id}
                          notionField={FILE_FIELD_MAP[key]}
                          onUploaded={urls => handleUpdated(r.id, { [key]: urls })}
                          onPreview={(url, name) => setPreview({ url, name })}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 상세 모달 */}
      {selected && (
        <DetailModal
          record={selected}
          assigneeList={assigneeList}
          onClose={() => setSelected(null)}
          onUpdated={handleUpdated}
          onPreview={(url, name) => setPreview({ url, name })}
        />
      )}

      {/* 파일 미리보기 모달 */}
      {preview && (
        <FilePreviewModal
          url={preview.url}
          name={preview.name}
          onClose={() => setPreview(null)}
        />
      )}

      {createOpen && (
        <CreateModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => { setCreateOpen(false); load(true); }}
        />
      )}

      {/* 자산 정보 모달 */}
      {assetModal && (
        <AssetDetailModal
          assetId={assetModal}
          onClose={() => setAssetModal(null)}
        />
      )}
    </div>
  );
}
