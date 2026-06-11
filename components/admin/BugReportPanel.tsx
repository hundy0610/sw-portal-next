"use client";

import { Fragment, useState, useEffect, useRef } from "react";
import type { BugStage } from "@/types/bug-report";
import { DEFAULT_BUG_STAGES, UNASSIGNED_BUG_STAGE, BUG_STAGE_PALETTE } from "@/types/bug-report";

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

// ── 버그 카드 ─────────────────────────────────────────────
function BugCard({ r, dragging, onClick, onDragStart, onDragEnd }: {
  r: BugReport;
  dragging: boolean;
  onClick: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      draggable
      onClick={onClick}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{
        background: dragging ? "#F0F4FF" : "#fff",
        opacity: dragging ? 0.6 : 1,
        border: "1px solid #E2E8F0", borderRadius: 10, padding: "10px 12px",
        marginBottom: 8, cursor: "grab",
      }}
    >
      <div style={{
        fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 6, lineHeight: 1.4,
        overflow: "hidden", display: "-webkit-box",
        WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
      }}>
        {r.title || "(제목 없음)"}
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" as const, marginBottom: 6 }}>
        <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 20, background: "#F1F5F9", color: "#334155" }}>{r.page}</span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 20, background: r.type === "버그" ? "#FEE2E2" : "#E0F2FE", color: r.type === "버그" ? "#DC2626" : "#0369A1" }}>{r.type}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 11, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{r.reporterName}</span>
        {r.handler && <span style={{ fontSize: 11, color: "#2563EB", flexShrink: 0 }}>담당:{r.handler}</span>}
      </div>
    </div>
  );
}

// ── 칸반 컬럼 ─────────────────────────────────────────────
function KanbanColumn({ stage, reports, isDragTarget, dragId, onDragOver, onDragLeave, onDrop, onDeleteStage, onCardClick, onCardDragStart, onCardDragEnd }: {
  stage: BugStage;
  reports: BugReport[];
  isDragTarget: boolean;
  dragId: string | null;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onDeleteStage?: () => void;
  onCardClick: (r: BugReport) => void;
  onCardDragStart: (id: string) => void;
  onCardDragEnd: () => void;
}) {
  return (
    <div
      style={{
        flex: "0 0 240px", minWidth: 240, marginRight: 10, minHeight: 360,
        display: "flex", flexDirection: "column" as const, borderRadius: 12,
        background: isDragTarget ? stage.color : "#F8FAFC",
        border: `2px solid ${isDragTarget ? stage.border : "#E2E8F0"}`,
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
        {reports.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0", fontSize: 11, color: "#cbd5e1" }}>
            {isDragTarget ? "여기에 놓기" : "없음"}
          </div>
        ) : reports.map(r => (
          <BugCard key={r.id} r={r} dragging={dragId === r.id}
            onClick={() => onCardClick(r)}
            onDragStart={() => onCardDragStart(r.id)}
            onDragEnd={onCardDragEnd} />
        ))}
      </div>
    </div>
  );
}

// ── 단계 추가 버튼(컬럼 사이 갭) ───────────────────────────
function InsertGap({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title="단계 추가"
      style={{
        flex: "0 0 18px", minWidth: 18, marginRight: 10, minHeight: 360, borderRadius: 8,
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        background: hover ? "#EFF6FF" : "transparent",
        border: `1px dashed ${hover ? "#BFDBFE" : "transparent"}`,
        color: hover ? "#2563EB" : "#cbd5e1", fontSize: 16, fontWeight: 700,
        transition: "all .15s",
      }}
    >
      +
    </div>
  );
}

export default function BugReportPanel() {
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
      const { data } = await reportsRes.json();
      setReports(data ?? []);
      if (stagesRes.ok) {
        const { data: stageData } = await stagesRes.json();
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
      const { data } = await res.json();
      setReports(data ?? []);
    } catch {}
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const handler = () => backgroundLoad();
    window.addEventListener("bug-report-submitted", handler);
    return () => window.removeEventListener("bug-report-submitted", handler);
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selected?.reply]);

  function openDetail(r: BugReport) {
    setSelected(r);
    setReplyText("");
    setReplyStatus(r.status);
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
    const { handler, handlerId } = await res.json();
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
      const { message } = await res.json();
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

  function addStage(atIndex: number) {
    const name = window.prompt("새 단계 이름을 입력하세요");
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    if (stages.some(s => s.name === trimmed) || trimmed === UNASSIGNED_BUG_STAGE.name) {
      alert("이미 존재하는 단계 이름입니다.");
      return;
    }
    const palette = BUG_STAGE_PALETTE[stages.length % BUG_STAGE_PALETTE.length];
    const next = [...stages.slice(0, atIndex), { name: trimmed, ...palette }, ...stages.slice(atIndex)];
    saveStages(next);
  }

  function deleteStage(name: string) {
    const count = reports.filter(r => r.status === name).length;
    if (count > 0) { alert(`"${name}" 단계에 리포트가 ${count}건 있어 삭제할 수 없습니다.`); return; }
    if (!confirm(`"${name}" 단계를 삭제할까요?`)) return;
    saveStages(stages.filter(s => s.name !== name));
  }

  const filtered = reports.filter(r =>
    (filterPage === "전체" || r.page === filterPage) &&
    (!search.trim() || r.title.includes(search.trim()) || r.content.includes(search.trim()))
  );

  const unassigned = filtered.filter(r => !stages.some(s => s.name === r.status));

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", margin: "0 0 4px" }}>버그리포트</h2>
          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>총 {filtered.length}건</p>
        </div>
        <button onClick={load}
          style={{ padding: "8px 14px", borderRadius: 8, background: "#EFF6FF", color: "#2563EB", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          새로고침
        </button>
      </div>

      {/* 필터 */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" as const }}>
        <select value={filterPage} onChange={e => setFilterPage(e.target.value)}
          style={{ padding: "7px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, color: "#334155", background: "#fff" }}>
          {pages.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="제목/내용 검색"
          style={{ padding: "7px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, color: "#334155", background: "#fff", minWidth: 180 }} />
      </div>

      {/* 칸반 보드 */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>불러오는 중...</div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: 60, color: "#DC2626", fontSize: 13 }}>
          <div style={{ marginBottom: 8 }}>⚠️ 데이터를 불러오지 못했습니다</div>
          <div style={{ color: "#94a3b8", fontSize: 12 }}>{error}</div>
        </div>
      ) : (
        <div style={{ display: "flex", overflowX: "auto" as const, paddingBottom: 12 }}>
          {stages.map((stage, i) => (
            <Fragment key={stage.name}>
              <InsertGap onClick={() => addStage(i)} />
              <KanbanColumn
                stage={stage}
                reports={filtered.filter(r => r.status === stage.name)}
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
            </Fragment>
          ))}
          <InsertGap onClick={() => addStage(stages.length)} />
          {unassigned.length > 0 && (
            <KanbanColumn
              stage={UNASSIGNED_BUG_STAGE}
              reports={unassigned}
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
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 600, height: "min(90vh, 720px)", boxShadow: "0 20px 60px rgba(0,0,0,.2)", display: "flex", flexDirection: "column" as const, overflow: "hidden" }}>

            {/* ── 고정 헤더 ── */}
            <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #E2E8F0", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 6, marginBottom: 5, flexWrap: "wrap" as const, alignItems: "center" }}>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#F1F5F9", color: "#334155" }}>{selected.page} › {selected.feature}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: selected.type === "버그" ? "#FEE2E2" : "#E0F2FE", color: selected.type === "버그" ? "#DC2626" : "#0369A1" }}>{selected.type}</span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", lineHeight: 1.4 }}>{selected.title}</div>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8", lineHeight: 1, flexShrink: 0 }}>✕</button>
              </div>

              {/* 단계 버튼 */}
              <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" as const }}>
                {stages.map(s => {
                  const active = replyStatus === s.name;
                  return (
                    <button key={s.name} onClick={() => handleStatusChange(selected.id, s.name)}
                      style={{ padding: "4px 13px", borderRadius: 20, border: `2px solid ${active ? s.tc : "#E2E8F0"}`, background: active ? s.color : "#fff", color: active ? s.tc : "#64748b", fontSize: 12, fontWeight: active ? 700 : 500, cursor: "pointer" }}>
                      {s.name}
                    </button>
                  );
                })}
              </div>

              {/* 담당자 */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "#64748b" }}>담당자:</span>
                {selected.handler ? (
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#1E3A8A", background: "#EFF6FF", padding: "2px 10px", borderRadius: 20 }}>{selected.handler}</span>
                ) : (
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>미지정</span>
                )}
                <button onClick={handleAssignHandler}
                  style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, border: "1px solid #BFDBFE", background: "#EFF6FF", color: "#2563EB", cursor: "pointer", fontWeight: 600 }}>
                  내가 담당
                </button>
              </div>
            </div>

            {/* ── 스크롤 채팅 영역 ── */}
            <div style={{ flex: 1, overflowY: "auto" as const, padding: "16px 20px", display: "flex", flexDirection: "column" as const, gap: 14 }}>

              {/* 접수자 메시지 */}
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#E2E8F0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#64748b", flexShrink: 0 }}>
                  {selected.reporterName?.[0] ?? "?"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{selected.reporterName}</span>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>접수자</span>
                    <span style={{ fontSize: 11, color: "#cbd5e1" }}>{selected.createdAt ? new Date(selected.createdAt).toLocaleString("ko-KR") : "-"}</span>
                  </div>
                  <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "0 10px 10px 10px", padding: "10px 14px" }}>
                    <p style={{ fontSize: 14, color: "#0f172a", margin: 0, lineHeight: 1.7, whiteSpace: "pre-wrap" as const }}>{selected.content || "(내용 없음)"}</p>
                    {selected.screenshotUrls?.length > 0 && (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, marginTop: 10 }}>
                        {selected.screenshotUrls.map((url, i) => (
                          <button key={i} onClick={() => setImgPreview(url)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt={`screenshot-${i}`} style={{ width: 80, height: 80, objectFit: "cover" as const, borderRadius: 8, border: "1px solid #E2E8F0", display: "block" }} />
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
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: isReporter ? "#E2E8F0" : "#1E3A8A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: isReporter ? "#64748b" : "#fff", flexShrink: 0 }}>
                      {msg.senderName?.[0] ?? "?"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "baseline", marginBottom: 4, justifyContent: isReporter ? "flex-start" : "flex-end" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{msg.senderName}</span>
                        {!isReporter && <span style={{ fontSize: 11, color: "#94a3b8" }}>담당자</span>}
                      </div>
                      <div style={{ background: isReporter ? "#F8FAFC" : "#EFF6FF", border: `1px solid ${isReporter ? "#E2E8F0" : "#BFDBFE"}`, borderRadius: isReporter ? "0 10px 10px 10px" : "10px 0 10px 10px", padding: "10px 14px" }}>
                        <p style={{ fontSize: 14, color: isReporter ? "#0f172a" : "#1E3A8A", margin: 0, lineHeight: 1.7, whiteSpace: "pre-wrap" as const }}>{msg.text}</p>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div ref={chatBottomRef} />
            </div>

            {/* ── 채팅 입력 바 ── */}
            <div style={{ padding: "10px 16px", borderTop: "1px solid #E2E8F0", background: "#F8FAFC", flexShrink: 0 }}>
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
                  style={{ flex: 1, padding: "10px 12px", border: "1px solid #E2E8F0", borderRadius: 10, fontSize: 14, color: "#0f172a", resize: "none" as const, outline: "none", fontFamily: "inherit", background: "#fff", lineHeight: 1.5, boxSizing: "border-box" as const }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={sending || !replyText.trim()}
                  style={{ padding: "10px 18px", borderRadius: 10, background: sending || !replyText.trim() ? "#E2E8F0" : "#2563EB", color: sending || !replyText.trim() ? "#94a3b8" : "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: sending || !replyText.trim() ? "not-allowed" : "pointer", flexShrink: 0, alignSelf: "flex-end" }}>
                  {sending ? "..." : "전송"}
                </button>
              </div>
            </div>

            {/* ── 하단 버튼 ── */}
            <div style={{ padding: "10px 20px", borderTop: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", flexShrink: 0, background: "#fff" }}>
              <button onClick={() => handleDelete(selected.id)}
                style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #FEE2E2", background: "#FFF5F5", color: "#DC2626", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                삭제
              </button>
              <button onClick={() => setSelected(null)}
                style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", color: "#64748b", fontSize: 12, cursor: "pointer" }}>
                닫기
              </button>
            </div>
          </div>
        </div>
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
