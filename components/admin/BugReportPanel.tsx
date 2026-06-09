"use client";

import { useState, useEffect, useRef } from "react";

interface BugReport {
  id:           string;
  title:        string;
  content:      string;
  page:         string;
  feature:      string;
  type:         string;
  reporterName: string;
  reporterId:   string;
  status:       "접수됨" | "처리중" | "완료";
  createdAt:    string;
  reply:          string;
  screenshotUrls: string[];
}

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  "접수됨": { bg: "#FEF9C3", color: "#854D0E" },
  "처리중": { bg: "#DBEAFE", color: "#1E40AF" },
  "완료":   { bg: "#DCFCE7", color: "#15803D" },
};

function parseReplies(reply: string): string[] {
  if (!reply) return [];
  return reply.split("\n---\n").filter(s => s.trim());
}

export default function BugReportPanel() {
  const [reports, setReports]           = useState<BugReport[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [filterPage, setFilterPage]     = useState("전체");
  const [filterStatus, setFilterStatus] = useState("전체");

  const [selected, setSelected]         = useState<BugReport | null>(null);
  const [replyText, setReplyText]       = useState("");
  const [replyStatus, setReplyStatus]   = useState<BugReport["status"]>("처리중");
  const [sending, setSending]           = useState(false);
  const [imgPreview, setImgPreview]     = useState<string | null>(null);
  const chatBottomRef                   = useRef<HTMLDivElement>(null);

  const pages = ["전체", ...Array.from(new Set(reports.map(r => r.page)))];

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bug-report");
      if (!res.ok) { setError(`오류 ${res.status}: ${await res.text()}`); return; }
      const { data } = await res.json();
      setReports(data ?? []);
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
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selected?.reply]);

  function openDetail(r: BugReport) {
    setSelected(r);
    setReplyText("");
    setReplyStatus(r.status);
  }

  async function handleStatusChange(s: BugReport["status"]) {
    if (!selected) return;
    setReplyStatus(s);
    setSelected(prev => prev ? { ...prev, status: s } : null);
    await fetch("/api/bug-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _action: "status", id: selected.id, status: s }),
    });
    backgroundLoad();
  }

  async function handleSendMessage() {
    if (!selected || !replyText.trim() || sending) return;
    setSending(true);
    const newReply = selected.reply
      ? selected.reply + "\n---\n" + replyText.trim()
      : replyText.trim();
    try {
      await fetch("/api/bug-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _action: "reply", id: selected.id, reply: newReply, status: replyStatus }),
      });
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

  const filtered = reports.filter(r =>
    (filterPage   === "전체" || r.page   === filterPage) &&
    (filterStatus === "전체" || r.status === filterStatus)
  );

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
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: "7px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, color: "#334155", background: "#fff" }}>
          {["전체", "접수됨", "처리중", "완료"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* 리스트 */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>불러오는 중...</div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: 60, color: "#DC2626", fontSize: 13 }}>
          <div style={{ marginBottom: 8 }}>⚠️ 데이터를 불러오지 못했습니다</div>
          <div style={{ color: "#94a3b8", fontSize: 12 }}>{error}</div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>리포트가 없습니다.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
          {filtered.map(r => {
            const sc = STATUS_COLOR[r.status] ?? STATUS_COLOR["접수됨"];
            return (
              <div key={r.id}
                onClick={() => openDetail(r)}
                style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, transition: "box-shadow .15s" }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,.08)")}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                    {r.title || "(제목 없음)"}
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" as const }}>
                    <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 20, background: "#F1F5F9", color: "#334155" }}>{r.page}</span>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>›</span>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>{r.feature}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 20, background: r.type === "버그" ? "#FEE2E2" : "#E0F2FE", color: r.type === "버그" ? "#DC2626" : "#0369A1" }}>{r.type}</span>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: sc.bg, color: sc.color }}>{r.status}</span>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>{r.reporterName}</span>
                  <span style={{ fontSize: 11, color: "#cbd5e1" }}>{r.createdAt ? new Date(r.createdAt).toLocaleDateString("ko-KR") : "-"}</span>
                </div>
              </div>
            );
          })}
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
            <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid #E2E8F0", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" as const, alignItems: "center" }}>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#F1F5F9", color: "#334155" }}>{selected.page} › {selected.feature}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: selected.type === "버그" ? "#FEE2E2" : "#E0F2FE", color: selected.type === "버그" ? "#DC2626" : "#0369A1" }}>{selected.type}</span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", lineHeight: 1.4 }}>{selected.title}</div>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8", lineHeight: 1, flexShrink: 0 }}>✕</button>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {(["접수됨", "처리중", "완료"] as const).map(s => {
                  const sc = STATUS_COLOR[s];
                  return (
                    <button key={s} onClick={() => handleStatusChange(s)}
                      style={{ padding: "5px 14px", borderRadius: 20, border: `2px solid ${replyStatus === s ? sc.color : "#E2E8F0"}`, background: replyStatus === s ? sc.bg : "#fff", color: replyStatus === s ? sc.color : "#64748b", fontSize: 12, fontWeight: replyStatus === s ? 700 : 500, cursor: "pointer" }}>
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── 스크롤 본문 (채팅 영역) ── */}
            <div style={{ flex: 1, overflowY: "auto" as const, padding: "16px 20px", display: "flex", flexDirection: "column" as const, gap: 14 }}>

              {/* 제출자 메시지 */}
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#E2E8F0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#64748b", flexShrink: 0 }}>
                  {selected.reporterName?.[0] ?? "?"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{selected.reporterName}</span>
                    <span style={{ fontSize: 11, color: "#cbd5e1" }}>{selected.createdAt ? new Date(selected.createdAt).toLocaleString("ko-KR") : "-"}</span>
                  </div>
                  <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "0 10px 10px 10px", padding: "10px 14px" }}>
                    <p style={{ fontSize: 14, color: "#0f172a", margin: 0, lineHeight: 1.7, whiteSpace: "pre-wrap" as const }}>{selected.content || "(내용 없음)"}</p>
                    {selected.screenshotUrls?.length > 0 && (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, marginTop: 10 }}>
                        {selected.screenshotUrls.map((url, i) => (
                          <button key={i} onClick={() => setImgPreview(url)}
                            style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt={`screenshot-${i}`} style={{ width: 80, height: 80, objectFit: "cover" as const, borderRadius: 8, border: "1px solid #E2E8F0", display: "block" }} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 관리자 답변 버블들 */}
              {parseReplies(selected.reply).map((msg, i) => (
                <div key={i} style={{ display: "flex", gap: 10, flexDirection: "row-reverse" as const }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#1E3A8A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>관</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", marginBottom: 5, justifyContent: "flex-end" }}>
                      <span style={{ fontSize: 11, color: "#cbd5e1" }}>관리자</span>
                    </div>
                    <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "10px 0 10px 10px", padding: "10px 14px" }}>
                      <p style={{ fontSize: 14, color: "#1E3A8A", margin: 0, lineHeight: 1.7, whiteSpace: "pre-wrap" as const }}>{msg}</p>
                    </div>
                  </div>
                </div>
              ))}

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
