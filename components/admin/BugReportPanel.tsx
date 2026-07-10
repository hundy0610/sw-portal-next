"use client";

import { useState, useEffect, useRef } from "react";
import type { BugStage } from "@/types/bug-report";
import { DEFAULT_BUG_STAGES, UNASSIGNED_BUG_STAGE } from "@/types/bug-report";
import { safeJson } from "@/lib/fetch-json";
import { useAdminDarkMode } from "@/lib/use-admin-dark-mode";

interface BugReport {
  id:           string;
  title:        string;
  content:      string;
  page:         string;
  feature:      string;
  type:         string;
  reporterName: string;
  reporterId:   string;
  status:       string;
  createdAt:    string;
  reply:        string;
  screenshotUrls: string[];
  handler:    string;
  handlerId:  string;
  parentId:   string;
}

interface ParsedMessage {
  senderId:   string;
  senderName: string;
  text:       string;
}

function parseMessage(raw: string): ParsedMessage {
  const match = raw.match(/^\[([^|]+)\|([^\]]+)\]\n([\s\S]*)$/);
  if (match) return { senderId: match[1], senderName: match[2], text: match[3] };
  return { senderId: "admin", senderName: "관리자", text: raw };
}

function parseReplies(reply: string): ParsedMessage[] {
  if (!reply) return [];
  return reply.split("\n---\n").filter(s => s.trim()).map(parseMessage);
}

// ── 페이지별 기능 목록 (신규 리포트 작성 시 선택) ───────────
const PAGE_FEATURES: Record<string, string[]> = {
  "메인":        ["공지사항", "검색", "배너", "SW 현황", "기타"],
  "SW 문서":     ["문서 목록", "버전 정보", "다운로드", "검색", "기타"],
  "문의/FAQ":    ["문의 접수", "FAQ 조회", "피드백", "기타"],
  "자료실":      ["자료 검색", "다운로드", "카테고리", "기타"],
  "Admin":       ["대시보드", "자산관리", "계정관리", "티켓", "기타"],
  "Declaration": ["신고서 작성", "기타"],
  "Manage":      ["공지관리", "교육관리", "자료관리", "SW DB", "기타"],
};

// ── 하위 작업 추가 모달 ────────────────────────────────────
const FIELD_LABEL_STYLE = { fontSize: 12, fontWeight: 700, color: "#52525B", marginBottom: 6, display: "block" as const };
const FIELD_INPUT_STYLE = { width: "100%", padding: "10px 12px", border: "1px solid #E4E4E7", borderRadius: 8, fontSize: 13, color: "#0f172a", boxSizing: "border-box" as const, background: "#fff" };

function SubTaskFormModal({ title, form, setForm, onCancel, onSubmit, submitting }: {
  title: string;
  form: { title: string; content: string };
  setForm: (updater: (f: { title: string; content: string } | null) => { title: string; content: string } | null) => void;
  onCancel: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <div style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 480, boxShadow: "0 24px 70px rgba(0,0,0,.25)", overflow: "hidden" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid #F4F4F5", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", margin: 0 }}>{title}</h3>
          <button onClick={onCancel} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#A1A1AA", lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ padding: 22, display: "flex", flexDirection: "column" as const, gap: 16 }}>
          <div>
            <label style={FIELD_LABEL_STYLE}>제목</label>
            <input value={form.title} onChange={e => setForm(f => f ? { ...f, title: e.target.value } : f)}
              placeholder="작업 제목을 입력하세요" autoFocus
              style={FIELD_INPUT_STYLE} />
          </div>
          <div>
            <label style={FIELD_LABEL_STYLE}>내용</label>
            <textarea value={form.content} onChange={e => setForm(f => f ? { ...f, content: e.target.value } : f)}
              placeholder="내용 (선택)" rows={5}
              style={{ ...FIELD_INPUT_STYLE, resize: "vertical" as const, fontFamily: "inherit" }} />
          </div>
        </div>
        <div style={{ padding: "14px 22px", borderTop: "1px solid #F4F4F5", display: "flex", gap: 8, justifyContent: "flex-end", background: "#FAFBFC" }}>
          <button onClick={onCancel}
            style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E4E4E7", background: "#fff", color: "#71717A", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            취소
          </button>
          <button onClick={onSubmit} disabled={!form.title.trim() || submitting}
            style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: !form.title.trim() || submitting ? "#E4E4E7" : "#4F46E5", color: !form.title.trim() || submitting ? "#A1A1AA" : "#fff", fontSize: 12, fontWeight: 700, cursor: !form.title.trim() || submitting ? "not-allowed" : "pointer" }}>
            {submitting ? "추가 중..." : "추가"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 신규 리포트 작성 모달 ──────────────────────────────────
function ComposeReportModal({
  type, setType, page, setPage, feature, setFeature, title, setTitle, content, setContent,
  files, previews, fileInputRef, onFilesChange, onRemoveFile, onCancel, onSubmit, submitting,
}: {
  type: "버그" | "개선요청"; setType: (t: "버그" | "개선요청") => void;
  page: string; setPage: (p: string) => void;
  feature: string; setFeature: (f: string) => void;
  title: string; setTitle: (t: string) => void;
  content: string; setContent: (c: string) => void;
  files: File[]; previews: string[];
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFilesChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (idx: number) => void;
  onCancel: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <div style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" as const, boxShadow: "0 24px 70px rgba(0,0,0,.25)" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid #F4F4F5", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", margin: 0 }}>새 버그 / 개선 리포트</h3>
          <button onClick={onCancel} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#A1A1AA", lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ padding: 22, display: "flex", flexDirection: "column" as const, gap: 16 }}>
          <div>
            <label style={FIELD_LABEL_STYLE}>유형</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["버그", "개선요청"] as const).map(t => (
                <button key={t} onClick={() => setType(t)}
                  style={{ flex: 1, padding: "8px 0", border: `1.5px solid ${type === t ? "#4F46E5" : "#E4E4E7"}`, borderRadius: 8, background: type === t ? "#EEF2FF" : "#fff", color: type === t ? "#4F46E5" : "#71717A", fontWeight: type === t ? 700 : 500, fontSize: 14, cursor: "pointer" }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={FIELD_LABEL_STYLE}>페이지</label>
            <select value={page} onChange={e => setPage(e.target.value)} style={FIELD_INPUT_STYLE}>
              {Object.keys(PAGE_FEATURES).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={FIELD_LABEL_STYLE}>기능</label>
            <select value={feature} onChange={e => setFeature(e.target.value)} style={FIELD_INPUT_STYLE}>
              {(PAGE_FEATURES[page] ?? ["기타"]).map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label style={FIELD_LABEL_STYLE}>제목</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={type === "버그" ? "발생한 버그를 한 줄로 요약해주세요." : "개선 요청 내용을 한 줄로 요약해주세요."}
              style={FIELD_INPUT_STYLE}
            />
          </div>
          <div>
            <label style={FIELD_LABEL_STYLE}>내용</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={type === "버그" ? "어떤 오류가 발생했나요? 재현 방법도 알려주세요." : "어떤 부분을 개선하면 좋을까요?"}
              rows={5}
              style={{ ...FIELD_INPUT_STYLE, resize: "vertical" as const, fontFamily: "inherit" }}
            />
          </div>
          <div>
            <label style={FIELD_LABEL_STYLE}>첨부파일 <span style={{ color: "#A1A1AA", fontWeight: 400 }}>(최대 5개)</span></label>
            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={onFilesChange} style={{ display: "none" }} />
            {files.length < 5 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{ width: "100%", padding: 10, border: "1.5px dashed #CBD5E1", borderRadius: 8, background: "#FAFAFA", color: "#71717A", fontSize: 13, cursor: "pointer", textAlign: "center" as const }}
              >
                📎 클릭하여 이미지 추가 {files.length > 0 ? `(${files.length}/5)` : ""}
              </button>
            )}
            {previews.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, marginTop: 8 }}>
                {previews.map((src, i) => (
                  <div key={i} style={{ position: "relative", display: "inline-block" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`preview-${i}`} style={{ width: 72, height: 72, objectFit: "cover" as const, borderRadius: 8, border: "1px solid #E4E4E7", display: "block" }} />
                    <button
                      onClick={() => onRemoveFile(i)}
                      style={{ position: "absolute", top: 2, right: 2, background: "rgba(0,0,0,.55)", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, cursor: "pointer", fontSize: 10, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ padding: "14px 22px", borderTop: "1px solid #F4F4F5", display: "flex", gap: 8, justifyContent: "flex-end", background: "#FAFBFC" }}>
          <button onClick={onCancel}
            style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #E4E4E7", background: "#fff", color: "#71717A", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            취소
          </button>
          <button onClick={onSubmit} disabled={!title.trim() || !content.trim() || submitting}
            style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: !title.trim() || !content.trim() || submitting ? "#E4E4E7" : "#4F46E5", color: !title.trim() || !content.trim() || submitting ? "#A1A1AA" : "#fff", fontSize: 12, fontWeight: 700, cursor: !title.trim() || !content.trim() || submitting ? "not-allowed" : "pointer" }}>
            {submitting ? "제출 중..." : "제출"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 버그 카드 ─────────────────────────────────────────────
function BugCard({ r, dragging, parentTitle, childTotal, childDone, onClick, onDragStart, onDragEnd }: {
  r: BugReport;
  dragging: boolean;
  parentTitle?: string;
  childTotal: number;
  childDone: number;
  onClick: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const dark = useAdminDarkMode();
  return (
    <div
      draggable
      onClick={onClick}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{
        background: dragging ? (dark ? "#1a2840" : "#F0F4FF") : (dark ? "#171717" : "#fff"),
        opacity: dragging ? 0.6 : 1,
        border: `1px solid ${dark ? "#333333" : "#E4E4E7"}`, borderRadius: 10, padding: "10px 12px",
        marginBottom: 8, cursor: "grab",
      }}
    >
      {parentTitle && (
        <div style={{ fontSize: 10, color: dark ? "#737373" : "#A1A1AA", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
          ↳ {parentTitle}
        </div>
      )}
      <div style={{
        fontSize: 13, fontWeight: 600, color: dark ? "#e5e5e5" : "#0f172a", marginBottom: 6, lineHeight: 1.4,
        overflow: "hidden", display: "-webkit-box",
        WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
      }}>
        {r.title || "(제목 없음)"}
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" as const, marginBottom: 6 }}>
        <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 20, background: dark ? "#1f1f1f" : "#F4F4F5", color: dark ? "#a3a3a3" : "#334155" }}>{r.page}</span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 20, background: dark ? "#18181B" : (r.type === "버그" ? "#FEE2E2" : "#E0F2FE"), color: r.type === "버그" ? (dark ? "#fca5a5" : "#DC2626") : (dark ? "#7dd3fc" : "#0369A1") }}>{r.type}</span>
        {childTotal > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 20, background: dark ? "#18181B" : (childDone === childTotal ? "#DCFCE7" : "#EEF2FF"), color: childDone === childTotal ? (dark ? "#86efac" : "#15803D") : (dark ? "#A5B4FC" : "#4F46E5") }}>
            하위 {childDone}/{childTotal}
          </span>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 11, color: dark ? "#737373" : "#A1A1AA", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{r.reporterName}</span>
        {r.handler && <span style={{ fontSize: 11, color: dark ? "#A5B4FC" : "#4F46E5", flexShrink: 0 }}>담당:{r.handler}</span>}
      </div>
    </div>
  );
}

// ── 칸반 컬럼 ─────────────────────────────────────────────
function KanbanColumn({ stage, reports, allReports, lastStageName, isDragTarget, dragId, onDragOver, onDragLeave, onDrop, onDeleteStage, onAddClick, addLabel, onCardClick, onCardDragStart, onCardDragEnd }: {
  stage: BugStage;
  reports: BugReport[];
  allReports: BugReport[];
  lastStageName: string;
  isDragTarget: boolean;
  dragId: string | null;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onDeleteStage?: () => void;
  onAddClick?: () => void;
  addLabel?: string;
  onCardClick: (r: BugReport) => void;
  onCardDragStart: (id: string) => void;
  onCardDragEnd: () => void;
}) {
  const dark = useAdminDarkMode();
  return (
    <div
      style={{
        flex: "0 0 240px", minWidth: 240, marginRight: 10, minHeight: 360,
        display: "flex", flexDirection: "column" as const, borderRadius: 12,
        background: isDragTarget ? stage.color : (dark ? "#141414" : "#FAFAFA"),
        border: `2px solid ${isDragTarget ? stage.border : (dark ? "#262626" : "#E4E4E7")}`,
        transition: "all .15s",
      }}
      onDragOver={e => { e.preventDefault(); onDragOver(); }}
      onDragLeave={onDragLeave}
      onDrop={e => { e.preventDefault(); onDrop(); }}
    >
      <div style={{
        padding: "10px 12px", borderRadius: "10px 10px 0 0", background: stage.color,
        borderBottom: `2px solid ${stage.border}30`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: stage.tc, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{stage.name}</span>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 20, background: stage.border + "20", color: stage.tc, flexShrink: 0 }}>{reports.length}</span>
        </div>
        {onDeleteStage && (
          <button onClick={onDeleteStage} title="단계 삭제"
            style={{ background: "none", border: "none", cursor: "pointer", color: stage.tc, opacity: .5, fontSize: 13, lineHeight: 1, padding: 2, flexShrink: 0 }}>
            ✕
          </button>
        )}
      </div>
      <div style={{ flex: 1, padding: 10, overflowY: "auto" as const }}>
        {onAddClick && (
          <div onClick={onAddClick}
            style={{
              border: `1px dashed ${dark ? "#3a3a3a" : "#CBD5E1"}`, borderRadius: 8, padding: "6px 10px",
              marginBottom: 8, textAlign: "center" as const, fontSize: 12,
              color: dark ? "#737373" : "#A1A1AA", cursor: "pointer", background: dark ? "#1a1a1a" : "#FAFBFC", fontWeight: 600,
            }}>
            {addLabel ?? "+ 추가"}
          </div>
        )}
        {reports.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0", fontSize: 11, color: dark ? "#525252" : "#cbd5e1" }}>
            {isDragTarget ? "여기에 놓기" : "없음"}
          </div>
        ) : reports.map(r => {
          const children = allReports.filter(c => c.parentId === r.id);
          const parent = r.parentId ? allReports.find(p => p.id === r.parentId) : undefined;
          return (
            <BugCard key={r.id} r={r} dragging={dragId === r.id}
              parentTitle={parent?.title}
              childTotal={children.length}
              childDone={children.filter(c => c.status === lastStageName).length}
              onClick={() => onCardClick(r)}
              onDragStart={() => onCardDragStart(r.id)}
              onDragEnd={onCardDragEnd} />
          );
        })}
      </div>
    </div>
  );
}

export default function BugReportPanel() {
  const dark = useAdminDarkMode();
  const [reports, setReports]       = useState<BugReport[]>([]);
  const [stages, setStages]         = useState<BugStage[]>(DEFAULT_BUG_STAGES);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [filterPage, setFilterPage] = useState("전체");
  const [search, setSearch]         = useState("");

  const [selected, setSelected]       = useState<BugReport | null>(null);
  const [replyText, setReplyText]     = useState("");
  const [replyStatus, setReplyStatus] = useState("");
  const [sending, setSending]         = useState(false);
  const [imgPreview, setImgPreview]   = useState<string | null>(null);
  const chatBottomRef                 = useRef<HTMLDivElement>(null);

  const [dragId, setDragId]     = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const [subTaskForm, setSubTaskForm]     = useState<{ title: string; content: string } | null>(null);
  const [creatingSubtask, setCreatingSubtask] = useState(false);

  // ── 신규 리포트 작성 ──────────────────────────────────────
  const [composeOpen, setComposeOpen]         = useState(false);
  const [composeSubmitting, setComposeSubmitting] = useState(false);
  const [composeType, setComposeType]         = useState<"버그" | "개선요청">("버그");
  const [composePage, setComposePage]         = useState("Admin");
  const [composeFeature, setComposeFeature]   = useState(PAGE_FEATURES["Admin"]?.[0] ?? "기타");
  const [composeTitle, setComposeTitle]       = useState("");
  const [composeContent, setComposeContent]   = useState("");
  const [composeFiles, setComposeFiles]       = useState<File[]>([]);
  const [composePreviews, setComposePreviews] = useState<string[]>([]);
  const composeFileInputRef = useRef<HTMLInputElement>(null);

  const [modalTab, setModalTab]         = useState<"subtasks" | "reply">("subtasks");
  const [modalDragId, setModalDragId]   = useState<string | null>(null);
  const [modalDragOver, setModalDragOver] = useState<string | null>(null);

  const pages = ["전체", ...Array.from(new Set(reports.map(r => r.page)))];

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [reportsRes, stagesRes] = await Promise.all([
        fetch("/api/bug-report"),
        fetch("/api/bug-report/stages"),
      ]);
      if (!reportsRes.ok) { setError(`오류 ${reportsRes.status}: ${await reportsRes.text()}`); return; }
      const { data } = await safeJson(reportsRes);
      setReports(data ?? []);
      if (stagesRes.ok) {
        const { data: stageData } = await safeJson(stagesRes);
        if (Array.isArray(stageData) && stageData.length > 0) setStages(stageData);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function backgroundLoad() {
    try {
      const res = await fetch("/api/bug-report");
      if (!res.ok) return;
      const { data } = await safeJson(res);
      setReports(data ?? []);
    } catch {}
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    setComposeFeature(PAGE_FEATURES[composePage]?.[0] ?? "기타");
  }, [composePage]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selected?.reply]);

  function openDetail(r: BugReport) {
    setSelected(r);
    setReplyText("");
    setReplyStatus(r.status);
    setSubTaskForm(null);
    setModalDragId(null);
    setModalDragOver(null);
    const hasChildren = reports.some(c => c.parentId === r.id);
    setModalTab(hasChildren || !r.parentId ? "subtasks" : "reply");
  }

  function childrenOf(id: string) {
    return reports.filter(r => r.parentId === id);
  }

  function resetComposeForm() {
    setComposeType("버그");
    setComposePage("Admin");
    setComposeFeature(PAGE_FEATURES["Admin"]?.[0] ?? "기타");
    setComposeTitle("");
    setComposeContent("");
    setComposeFiles([]);
    setComposePreviews([]);
    if (composeFileInputRef.current) composeFileInputRef.current.value = "";
  }

  function handleComposeFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    setComposeFiles(prev => {
      const merged = [...prev, ...selected].slice(0, 5); // 최대 5개
      setComposePreviews(merged.map(f => URL.createObjectURL(f)));
      return merged;
    });
    if (composeFileInputRef.current) composeFileInputRef.current.value = "";
  }

  function removeComposeFile(idx: number) {
    setComposeFiles(prev => {
      const next = prev.filter((_, i) => i !== idx);
      setComposePreviews(next.map(f => URL.createObjectURL(f)));
      return next;
    });
  }

  async function uploadComposeFile(file: File): Promise<string> {
    const initRes = await fetch("/api/bug-report/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }),
    });
    const { fileUploadId } = await safeJson(initRes);
    const fd = new FormData();
    fd.append("file", file, file.name);
    fd.append("fileUploadId", fileUploadId);
    await fetch("/api/bug-report/upload", { method: "POST", body: fd });
    return fileUploadId as string;
  }

  async function handleComposeSubmit() {
    if (!composeTitle.trim() || !composeContent.trim() || composeSubmitting) return;
    setComposeSubmitting(true);
    try {
      const fileUploadIds = composeFiles.length > 0
        ? await Promise.all(composeFiles.map(uploadComposeFile))
        : [];
      await fetch("/api/bug-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page: composePage, feature: composeFeature, type: composeType,
          title: composeTitle.trim(), content: composeContent.trim(), fileUploadIds,
        }),
      });
      setComposeOpen(false);
      resetComposeForm();
      backgroundLoad();
    } catch {
      alert("제출 중 오류가 발생했습니다.");
    } finally {
      setComposeSubmitting(false);
    }
  }

  async function handleCreateSubtask() {
    if (!selected || !subTaskForm || !subTaskForm.title.trim() || creatingSubtask) return;
    setCreatingSubtask(true);
    try {
      await fetch("/api/bug-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: subTaskForm.title.trim(),
          content: subTaskForm.content.trim(),
          page: selected.page,
          feature: selected.feature,
          type: selected.type,
          status: stages[0]?.name ?? "접수됨",
          parentId: selected.id,
        }),
      });
      setSubTaskForm(null);
      backgroundLoad();
    } finally {
      setCreatingSubtask(false);
    }
  }

  async function handleStatusChange(id: string, status: string) {
    setReports(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    setSelected(prev => prev && prev.id === id ? { ...prev, status } : prev);
    if (selected?.id === id) setReplyStatus(status);
    await fetch("/api/bug-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _action: "status", id, status }),
    });
    backgroundLoad();
  }

  async function handleAssignHandler() {
    if (!selected) return;
    const res = await fetch("/api/bug-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _action: "handler", id: selected.id }),
    });
    const { handler, handlerId } = await safeJson(res);
    setSelected(prev => prev ? { ...prev, handler, handlerId } : null);
    backgroundLoad();
  }

  async function handleSendMessage() {
    if (!selected || !replyText.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/bug-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _action: "reply",
          id: selected.id,
          text: replyText.trim(),
          currentReply: selected.reply,
          status: replyStatus,
        }),
      });
      const { message } = await safeJson(res);
      const newReply = selected.reply ? selected.reply + "\n---\n" + message : message;
      setSelected(prev => prev ? { ...prev, reply: newReply } : null);
      setReplyText("");
      backgroundLoad();
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("이 리포트를 삭제할까요?")) return;
    await fetch("/api/bug-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _action: "delete", id }),
    });
    setSelected(null);
    load();
  }

  async function saveStages(next: BugStage[]) {
    setStages(next);
    await fetch("/api/bug-report/stages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stages: next }),
    });
  }

  function deleteStage(name: string) {
    const count = reports.filter(r => r.status === name).length;
    if (count > 0) { alert(`"${name}" 단계에 리포트가 ${count}건 있어 삭제할 수 없습니다.`); return; }
    if (!confirm(`"${name}" 단계를 삭제할까요?`)) return;
    saveStages(stages.filter(s => s.name !== name));
  }

  const filtered = reports.filter(r =>
    !r.parentId &&
    (filterPage === "전체" || r.page === filterPage) &&
    (!search.trim() || r.title.includes(search.trim()) || r.content.includes(search.trim()))
  );

  const unassigned = filtered.filter(r => !stages.some(s => s.name === r.status));
  const lastStageName = stages[stages.length - 1]?.name ?? "";

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: dark ? "#e5e5e5" : "#0f172a", margin: "0 0 4px" }}>버그리포트</h2>
          <p style={{ fontSize: 13, color: dark ? "#a3a3a3" : "#71717A", margin: 0 }}>총 {filtered.length}건</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { resetComposeForm(); setComposeOpen(true); }}
            style={{ padding: "8px 14px", borderRadius: 8, background: dark ? "#1a2840" : "#1E3A8A", color: dark ? "#A5B4FC" : "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            🐛 새 리포트
          </button>
          <button onClick={load}
            style={{ padding: "8px 14px", borderRadius: 8, background: dark ? "#18181B" : "#EEF2FF", color: dark ? "#A5B4FC" : "#4F46E5", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            새로고침
          </button>
        </div>
      </div>

      {/* 필터 */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" as const }}>
        <select value={filterPage} onChange={e => setFilterPage(e.target.value)}
          style={{ padding: "7px 12px", border: `1px solid ${dark ? "#333333" : "#E4E4E7"}`, borderRadius: 8, fontSize: 13, color: dark ? "#d4d4d4" : "#334155", background: dark ? "#171717" : "#fff" }}>
          {pages.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="제목/내용 검색"
          style={{ padding: "7px 12px", border: `1px solid ${dark ? "#333333" : "#E4E4E7"}`, borderRadius: 8, fontSize: 13, color: dark ? "#d4d4d4" : "#334155", background: dark ? "#171717" : "#fff", minWidth: 180 }} />
      </div>

      {/* 칸반 보드 */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#A1A1AA" }}>불러오는 중...</div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: 60, color: "#DC2626", fontSize: 13 }}>
          <div style={{ marginBottom: 8 }}>⚠️ 데이터를 불러오지 못했습니다</div>
          <div style={{ color: "#A1A1AA", fontSize: 12 }}>{error}</div>
        </div>
      ) : (
        <div style={{ display: "flex", overflowX: "auto" as const, paddingBottom: 12 }}>
          {stages.map((stage) => (
            <KanbanColumn
              key={stage.name}
              stage={stage}
              reports={filtered.filter(r => r.status === stage.name)}
              allReports={reports}
              lastStageName={lastStageName}
              isDragTarget={dragOver === stage.name}
              dragId={dragId}
              onDragOver={() => setDragOver(stage.name)}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => {
                setDragOver(null);
                const dragged = reports.find(r => r.id === dragId);
                if (dragId && dragged && dragged.status !== stage.name) {
                  handleStatusChange(dragId, stage.name);
                }
                setDragId(null);
              }}
              onDeleteStage={() => deleteStage(stage.name)}
              onCardClick={openDetail}
              onCardDragStart={setDragId}
              onCardDragEnd={() => { setDragId(null); setDragOver(null); }}
            />
          ))}
          {unassigned.length > 0 && (
            <KanbanColumn
              stage={UNASSIGNED_BUG_STAGE}
              reports={unassigned}
              allReports={reports}
              lastStageName={lastStageName}
              isDragTarget={false}
              dragId={dragId}
              onDragOver={() => {}}
              onDragLeave={() => {}}
              onDrop={() => {}}
              onCardClick={openDetail}
              onCardDragStart={setDragId}
              onCardDragEnd={() => { setDragId(null); setDragOver(null); }}
            />
          )}
        </div>
      )}

      {/* ── 상세 모달 ── */}
      {selected && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
        >
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 1200, height: "min(90vh, 820px)", boxShadow: "0 20px 60px rgba(0,0,0,.2)", display: "flex", flexDirection: "column" as const, overflow: "hidden" }}>

            {/* ── 고정 헤더 ── */}
            <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #E4E4E7", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 6, marginBottom: 5, flexWrap: "wrap" as const, alignItems: "center" }}>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#F4F4F5", color: "#334155" }}>{selected.page} › {selected.feature}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: selected.type === "버그" ? "#FEE2E2" : "#E0F2FE", color: selected.type === "버그" ? "#DC2626" : "#0369A1" }}>{selected.type}</span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", lineHeight: 1.4 }}>{selected.title}</div>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#A1A1AA", lineHeight: 1, flexShrink: 0 }}>✕</button>
              </div>

              {/* 단계 버튼 */}
              <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" as const }}>
                {stages.map(s => {
                  const active = replyStatus === s.name;
                  return (
                    <button key={s.name} onClick={() => handleStatusChange(selected.id, s.name)}
                      style={{ padding: "4px 13px", borderRadius: 20, border: `2px solid ${active ? s.tc : "#E4E4E7"}`, background: active ? s.color : "#fff", color: active ? s.tc : "#71717A", fontSize: 12, fontWeight: active ? 700 : 500, cursor: "pointer" }}>
                      {s.name}
                    </button>
                  );
                })}
              </div>

              {/* 담당자 */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "#71717A" }}>담당자:</span>
                {selected.handler ? (
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#1E3A8A", background: "#EEF2FF", padding: "2px 10px", borderRadius: 20 }}>{selected.handler}</span>
                ) : (
                  <span style={{ fontSize: 12, color: "#A1A1AA" }}>미지정</span>
                )}
                <button onClick={handleAssignHandler}
                  style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, border: "1px solid #BFDBFE", background: "#EEF2FF", color: "#4F46E5", cursor: "pointer", fontWeight: 600 }}>
                  내가 담당
                </button>
              </div>

              {/* 상위 작업 */}
              {selected.parentId && (() => {
                const parent = reports.find(r => r.id === selected.parentId);
                return parent ? (
                  <div style={{ marginTop: 8, fontSize: 12, color: "#71717A" }}>
                    상위 작업:{" "}
                    <button onClick={() => openDetail(parent)}
                      style={{ background: "none", border: "none", color: "#4F46E5", cursor: "pointer", fontWeight: 600, padding: 0, fontSize: 12 }}>
                      {parent.title}
                    </button>
                  </div>
                ) : null;
              })()}

            </div>

            {/* ── 탭 ── */}
            <div style={{ display: "flex", gap: 4, padding: "0 20px", borderBottom: "1px solid #E4E4E7", flexShrink: 0 }}>
              {([["subtasks", `하위 작업 (${childrenOf(selected.id).length})`], ["reply", "답변"]] as const).map(([key, label]) => (
                <button key={key} onClick={() => setModalTab(key)}
                  style={{
                    padding: "10px 14px", border: "none", borderBottom: `2px solid ${modalTab === key ? "#4F46E5" : "transparent"}`,
                    background: "none", color: modalTab === key ? "#4F46E5" : "#A1A1AA",
                    fontSize: 13, fontWeight: modalTab === key ? 700 : 500, cursor: "pointer",
                  }}>
                  {label}
                </button>
              ))}
            </div>

            {modalTab === "subtasks" ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column" as const, overflow: "hidden" }}>
                {/* 하위 작업 칸반 */}
                <div style={{ flex: 1, overflow: "auto" as const, display: "flex", alignItems: "flex-start", padding: 16 }}>
                  {stages.map((stage, i) => {
                    const subTasks = childrenOf(selected.id);
                    return (
                      <KanbanColumn
                        key={stage.name}
                        stage={stage}
                        reports={subTasks.filter(c => c.status === stage.name)}
                        allReports={reports}
                        lastStageName={lastStageName}
                        isDragTarget={modalDragOver === stage.name}
                        dragId={modalDragId}
                        onDragOver={() => setModalDragOver(stage.name)}
                        onDragLeave={() => setModalDragOver(null)}
                        onDrop={() => {
                          setModalDragOver(null);
                          const dragged = subTasks.find(c => c.id === modalDragId);
                          if (modalDragId && dragged && dragged.status !== stage.name) {
                            handleStatusChange(modalDragId, stage.name);
                          }
                          setModalDragId(null);
                        }}
                        onAddClick={i === 0 ? () => setSubTaskForm({ title: "", content: "" }) : undefined}
                        addLabel="+ 하위 작업 추가"
                        onCardClick={openDetail}
                        onCardDragStart={setModalDragId}
                        onCardDragEnd={() => { setModalDragId(null); setModalDragOver(null); }}
                      />
                    );
                  })}
                  {(() => {
                    const subUnassigned = childrenOf(selected.id).filter(c => !stages.some(s => s.name === c.status));
                    return subUnassigned.length > 0 ? (
                      <KanbanColumn
                        stage={UNASSIGNED_BUG_STAGE}
                        reports={subUnassigned}
                        allReports={reports}
                        lastStageName={lastStageName}
                        isDragTarget={false}
                        dragId={modalDragId}
                        onDragOver={() => {}}
                        onDragLeave={() => {}}
                        onDrop={() => {}}
                        onCardClick={openDetail}
                        onCardDragStart={setModalDragId}
                        onCardDragEnd={() => { setModalDragId(null); setModalDragOver(null); }}
                      />
                    ) : null;
                  })()}
                </div>
              </div>
            ) : (
              <>
                {/* ── 스크롤 채팅 영역 ── */}
                <div style={{ flex: 1, overflowY: "auto" as const, padding: "16px 20px", display: "flex", flexDirection: "column" as const, gap: 14 }}>

                  {/* 접수자 메시지 */}
                  <div style={{ display: "flex", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#E4E4E7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#71717A", flexShrink: 0 }}>
                      {selected.reporterName?.[0] ?? "?"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{selected.reporterName}</span>
                        <span style={{ fontSize: 11, color: "#A1A1AA" }}>접수자</span>
                        <span style={{ fontSize: 11, color: "#cbd5e1" }}>{selected.createdAt ? new Date(selected.createdAt).toLocaleString("ko-KR") : "-"}</span>
                      </div>
                      <div style={{ background: "#FAFAFA", border: "1px solid #E4E4E7", borderRadius: "0 10px 10px 10px", padding: "10px 14px" }}>
                        <p style={{ fontSize: 14, color: "#0f172a", margin: 0, lineHeight: 1.7, whiteSpace: "pre-wrap" as const }}>{selected.content || "(내용 없음)"}</p>
                        {selected.screenshotUrls?.length > 0 && (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, marginTop: 10 }}>
                            {selected.screenshotUrls.map((url, i) => (
                              <button key={i} onClick={() => setImgPreview(url)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={url} alt={`screenshot-${i}`} style={{ width: 80, height: 80, objectFit: "cover" as const, borderRadius: 8, border: "1px solid #E4E4E7", display: "block" }} />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 답변 버블들 — 발신자별 좌/우 구분 */}
                  {parseReplies(selected.reply).map((msg, i) => {
                    const isReporter = msg.senderId === selected.reporterId;
                    return (
                      <div key={i} style={{ display: "flex", gap: 10, flexDirection: isReporter ? "row" : "row-reverse" as const }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: isReporter ? "#E4E4E7" : "#1E3A8A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: isReporter ? "#71717A" : "#fff", flexShrink: 0 }}>
                          {msg.senderName?.[0] ?? "?"}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", gap: 6, alignItems: "baseline", marginBottom: 4, justifyContent: isReporter ? "flex-start" : "flex-end" }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{msg.senderName}</span>
                            {!isReporter && <span style={{ fontSize: 11, color: "#A1A1AA" }}>담당자</span>}
                          </div>
                          <div style={{ background: isReporter ? "#FAFAFA" : "#EEF2FF", border: `1px solid ${isReporter ? "#E4E4E7" : "#BFDBFE"}`, borderRadius: isReporter ? "0 10px 10px 10px" : "10px 0 10px 10px", padding: "10px 14px" }}>
                            <p style={{ fontSize: 14, color: isReporter ? "#0f172a" : "#1E3A8A", margin: 0, lineHeight: 1.7, whiteSpace: "pre-wrap" as const }}>{msg.text}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div ref={chatBottomRef} />
                </div>

                {/* ── 채팅 입력 바 ── */}
                <div style={{ padding: "10px 16px", borderTop: "1px solid #E4E4E7", background: "#FAFAFA", flexShrink: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                    <textarea
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="답변 입력... (Enter: 전송 / Shift+Enter: 줄바꿈)"
                      rows={2}
                      style={{ flex: 1, padding: "10px 12px", border: "1px solid #E4E4E7", borderRadius: 10, fontSize: 14, color: "#0f172a", resize: "none" as const, outline: "none", fontFamily: "inherit", background: "#fff", lineHeight: 1.5, boxSizing: "border-box" as const }}
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={sending || !replyText.trim()}
                      style={{ padding: "10px 18px", borderRadius: 10, background: sending || !replyText.trim() ? "#E4E4E7" : "#4F46E5", color: sending || !replyText.trim() ? "#A1A1AA" : "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: sending || !replyText.trim() ? "not-allowed" : "pointer", flexShrink: 0, alignSelf: "flex-end" }}>
                      {sending ? "..." : "전송"}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ── 하단 버튼 ── */}
            <div style={{ padding: "10px 20px", borderTop: "1px solid #F4F4F5", display: "flex", justifyContent: "space-between", flexShrink: 0, background: "#fff" }}>
              <button onClick={() => handleDelete(selected.id)}
                style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #FEE2E2", background: "#FFF5F5", color: "#DC2626", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                삭제
              </button>
              <button onClick={() => setSelected(null)}
                style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid #E4E4E7", background: "#fff", color: "#71717A", fontSize: 12, cursor: "pointer" }}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 신규 리포트 작성 모달 ── */}
      {composeOpen && (
        <ComposeReportModal
          type={composeType} setType={setComposeType}
          page={composePage} setPage={setComposePage}
          feature={composeFeature} setFeature={setComposeFeature}
          title={composeTitle} setTitle={setComposeTitle}
          content={composeContent} setContent={setComposeContent}
          files={composeFiles} previews={composePreviews}
          fileInputRef={composeFileInputRef}
          onFilesChange={handleComposeFilesChange}
          onRemoveFile={removeComposeFile}
          onCancel={() => { setComposeOpen(false); resetComposeForm(); }}
          onSubmit={handleComposeSubmit}
          submitting={composeSubmitting}
        />
      )}

      {/* ── 하위 작업 추가 모달 ── */}
      {subTaskForm && (
        <SubTaskFormModal
          title="하위 작업 추가"
          form={subTaskForm}
          setForm={setSubTaskForm}
          onCancel={() => setSubTaskForm(null)}
          onSubmit={handleCreateSubtask}
          submitting={creatingSubtask}
        />
      )}

      {/* 스크린샷 풀스크린 */}
      {imgPreview && (
        <div onClick={() => setImgPreview(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgPreview} alt="screenshot" style={{ maxWidth: "100%", maxHeight: "90vh", borderRadius: 8 }} />
        </div>
      )}
    </div>
  );
}
