"use client";

import { useState, useEffect } from "react";

interface BugReport {
  id:           string;
  page:         string;
  feature:      string;
  type:         string;
  description:  string;
  reporterName: string;
  reporterId:   string;
  status:       "접수됨" | "처리중" | "완료";
  createdAt:    string;
  screenshotUrl?: string;
}

const STATUS_NEXT: Record<string, string> = {
  "접수됨": "처리중",
  "처리중": "완료",
  "완료":   "접수됨",
};

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  "접수됨": { bg: "#FEF9C3", color: "#854D0E" },
  "처리중": { bg: "#DBEAFE", color: "#1E40AF" },
  "완료":   { bg: "#DCFCE7", color: "#15803D" },
};

export default function BugReportPanel() {
  const [reports, setReports]           = useState<BugReport[]>([]);
  const [loading, setLoading]           = useState(true);
  const [filterPage, setFilterPage]     = useState("전체");
  const [filterStatus, setFilterStatus] = useState("전체");
  const [preview, setPreview]           = useState<string | null>(null);

  const pages = ["전체", ...Array.from(new Set(reports.map(r => r.page)))];

  async function load() {
    setLoading(true);
    const res = await fetch("/api/bug-report");
    const { data } = await res.json();
    setReports(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleStatus(r: BugReport) {
    const next = STATUS_NEXT[r.status] ?? "접수됨";
    await fetch("/api/bug-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _action: "status", id: r.id, status: next }),
    });
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("이 리포트를 삭제할까요?")) return;
    await fetch("/api/bug-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _action: "delete", id }),
    });
    load();
  }

  const filtered = reports.filter(r =>
    (filterPage   === "전체" || r.page   === filterPage) &&
    (filterStatus === "전체" || r.status === filterStatus)
  );

  return (
    <div>
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

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>리포트가 없습니다.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
          {filtered.map(r => {
            const sc = STATUS_COLOR[r.status] ?? STATUS_COLOR["접수됨"];
            return (
              <div key={r.id} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "16px 20px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, marginBottom: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#F1F5F9", color: "#334155" }}>{r.page}</span>
                      <span style={{ fontSize: 11, color: "#64748b" }}>›</span>
                      <span style={{ fontSize: 11, color: "#64748b" }}>{r.feature}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: r.type === "버그" ? "#FEE2E2" : "#E0F2FE", color: r.type === "버그" ? "#DC2626" : "#0369A1" }}>{r.type}</span>
                    </div>
                    <p style={{ fontSize: 14, color: "#0f172a", margin: "0 0 10px", lineHeight: 1.6, wordBreak: "break-all" as const }}>{r.description}</p>
                    {r.screenshotUrl && (
                      <button onClick={() => setPreview(r.screenshotUrl!)}
                        style={{ fontSize: 12, color: "#2563EB", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 8 }}>
                        📎 스크린샷 보기
                      </button>
                    )}
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>
                      {r.reporterName} ({r.reporterId}) · {r.createdAt ? new Date(r.createdAt).toLocaleString("ko-KR") : "-"}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" as const, gap: 6, flexShrink: 0 }}>
                    <button onClick={() => handleStatus(r)}
                      style={{ padding: "5px 12px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: sc.bg, color: sc.color }}>
                      {r.status}
                    </button>
                    <button onClick={() => handleDelete(r.id)}
                      style={{ padding: "5px 12px", borderRadius: 20, border: "1px solid #E2E8F0", background: "#fff", color: "#64748b", fontSize: 12, cursor: "pointer" }}>
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {preview && (
        <div onClick={() => setPreview(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="screenshot" style={{ maxWidth: "100%", maxHeight: "90vh", borderRadius: 8 }} />
        </div>
      )}
    </div>
  );
}
