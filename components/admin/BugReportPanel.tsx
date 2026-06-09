"use client";

import { useState, useEffect } from "react";

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
  reply:        string;
  screenshotUrl?: string;
}

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  "접수됨": { bg: "#FEF9C3", color: "#854D0E" },
  "처리중": { bg: "#DBEAFE", color: "#1E40AF" },
  "완료":   { bg: "#DCFCE7", color: "#15803D" },
};

export default function BugReportPanel() {
  const [reports, setReports]           = useState<BugReport[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [filterPage, setFilterPage]     = useState("전체");
  const [filterStatus, setFilterStatus] = useState("전체");

  // 상세 모달
  const [selected, setSelected]   = useState<BugReport | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyStatus, setReplyStatus] = useState<BugReport["status"]>("처리중");
  const [saving, setSaving]       = useState(false);
  const [imgPreview, setImgPreview] = useState<string | null>(null);

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

  useEffect(() => { load(); }, []);

  function openDetail(r: BugReport) {
    setSelected(r);
    setReplyText(r.reply ?? "");
    setReplyStatus(r.status === "완료" ? "완료" : r.status === "처리중" ? "처리중" : "접수됨");
  }

  async function handleSaveReply() {
    if (!selected) return;
    setSaving(true);
    await fetch("/api/bug-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _action: "reply", id: selected.id, reply: replyText, status: replyStatus }),
    });
    setSaving(false);
    setSelected(null);
    load();
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
                {/* 제목 + 메타 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                    {r.title || "(제목 없음)"}
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" as const }}>
                    <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 20, background: "#F1F5F9", color: "#334155" }}>{r.page}</span>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>›</span>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>{r.feature}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 20, background: r.type === "버그" ? "#FEE2E2" : "#E0F2FE", color: r.type === "버그" ? "#DC2626" : "#0369A1" }}>{r.type}</span>
                    {r.reply && <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 20, background: "#F0FDF4", color: "#15803D" }}>답변완료</span>}
                  </div>
                </div>
                {/* 우측 */}
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
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto" as const, boxShadow: "0 20px 60px rgba(0,0,0,.2)", display: "flex", flexDirection: "column" as const }}>

            {/* 모달 헤더 */}
            <div style={{ padding: "22px 24px 16px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" as const, alignItems: "center" }}>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#F1F5F9", color: "#334155" }}>{selected.page} › {selected.feature}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: selected.type === "버그" ? "#FEE2E2" : "#E0F2FE", color: selected.type === "버그" ? "#DC2626" : "#0369A1" }}>{selected.type}</span>
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", lineHeight: 1.4 }}>{selected.title}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8", lineHeight: 1, flexShrink: 0 }}>✕</button>
            </div>

            {/* 모달 본문 */}
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column" as const, gap: 20 }}>

              {/* 내용 */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 6 }}>내용</div>
                <p style={{ fontSize: 14, color: "#0f172a", margin: 0, lineHeight: 1.7, whiteSpace: "pre-wrap" as const }}>{selected.content}</p>
              </div>

              {/* 스크린샷 */}
              {selected.screenshotUrl && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 6 }}>스크린샷</div>
                  <button onClick={() => setImgPreview(selected.screenshotUrl!)}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selected.screenshotUrl} alt="screenshot" style={{ maxWidth: "100%", maxHeight: 220, borderRadius: 8, border: "1px solid #E2E8F0", display: "block" }} />
                  </button>
                </div>
              )}

              {/* 제출 정보 */}
              <div style={{ fontSize: 12, color: "#94a3b8", display: "flex", gap: 12 }}>
                <span>제출자: {selected.reporterName} ({selected.reporterId})</span>
                <span>·</span>
                <span>{selected.createdAt ? new Date(selected.createdAt).toLocaleString("ko-KR") : "-"}</span>
              </div>

              {/* 구분선 */}
              <div style={{ borderTop: "1px solid #E2E8F0" }} />

              {/* 답변 + 상태 변경 */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 8 }}>답변 및 처리 상태</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  {(["접수됨", "처리중", "완료"] as const).map(s => {
                    const sc = STATUS_COLOR[s];
                    return (
                      <button key={s} onClick={() => setReplyStatus(s)}
                        style={{ padding: "6px 14px", borderRadius: 20, border: `2px solid ${replyStatus === s ? sc.color : "#E2E8F0"}`, background: replyStatus === s ? sc.bg : "#fff", color: replyStatus === s ? sc.color : "#64748b", fontSize: 12, fontWeight: replyStatus === s ? 700 : 500, cursor: "pointer" }}>
                        {s}
                      </button>
                    );
                  })}
                </div>
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="처리 내용이나 답변을 입력하세요."
                  style={{ width: "100%", minHeight: 100, padding: "10px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 14, color: "#0f172a", resize: "vertical" as const, outline: "none", fontFamily: "inherit", boxSizing: "border-box" as const }}
                />
              </div>

              {/* 버튼 */}
              <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
                <button onClick={() => handleDelete(selected.id)}
                  style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #FEE2E2", background: "#FFF5F5", color: "#DC2626", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  삭제
                </button>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setSelected(null)}
                    style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", color: "#64748b", fontSize: 13, cursor: "pointer" }}>
                    취소
                  </button>
                  <button onClick={handleSaveReply} disabled={saving}
                    style={{ padding: "9px 20px", borderRadius: 8, background: saving ? "#cbd5e1" : "#2563EB", color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>
                    {saving ? "저장 중..." : "저장"}
                  </button>
                </div>
              </div>
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
