"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import type { Notice, Course, Resource, ResourceCategory } from "@/types/portal";
import type { AuditLog } from "@/lib/portal-store";

/* ── 색상 토큰 ── */
const C = {
  brand:       "#1E3A8A",
  primary:     "#2563EB",
  primarySoft: "#EFF6FF",
  text1:       "#0f172a",
  text2:       "#334155",
  text3:       "#64748b",
  text4:       "#94a3b8",
  border:      "#E2E8F0",
  bg:          "#f0f4f8",
  danger:      "#DC2626",
  dangerSoft:  "#FEE2E2",
} as const;

type ManageTab = "notices" | "courses" | "resources" | "audit";

interface SessionInfo {
  name: string;
  userId: string;
  role: string;
}

/* ══════════════════════════════════════════════════════
   메인 페이지 (세션 체크)
══════════════════════════════════════════════════════ */
export default function ManagePage() {
  return (
    <Suspense>
      <ManagePageInner />
    </Suspense>
  );
}

function ManagePageInner() {
  const [session,  setSession]  = useState<SessionInfo | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/admin/auth")
      .then(r => r.json())
      .then(data => {
        if (data.ok && data.role === "super") {
          setSession({ name: data.name, userId: data.userId, role: data.role });
        } else {
          // 슈퍼어드민이 아니거나 미로그인 → 어드민 로그인 페이지로
          window.location.href = "/admin/login?redirect=/manage";
        }
      })
      .catch(() => {
        window.location.href = "/admin/login?redirect=/manage";
      })
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
        <div style={{ color: C.text4, fontSize: 14 }}>인증 확인 중...</div>
      </div>
    );
  }

  if (!session) return null;

  return <ManageDashboard session={session} />;
}

/* ══════════════════════════════════════════════════════
   관리 대시보드
══════════════════════════════════════════════════════ */
function ManageDashboard({ session }: { session: SessionInfo }) {
  const [tab, setTab] = useState<ManageTab>("notices");

  const TABS: { id: ManageTab; label: string; icon: string }[] = [
    { id: "notices",   label: "공지사항", icon: "🔔" },
    { id: "courses",   label: "교육과정", icon: "🎓" },
    { id: "resources", label: "자료실",   icon: "📁" },
    { id: "audit",     label: "감사 로그", icon: "🕵️" },
  ];

  async function handleLogout() {
    await fetch("/api/admin/auth", { method: "DELETE" });
    window.location.href = "/admin/login";
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      {/* 헤더 */}
      <header style={{ background: "#fff", position: "sticky", top: 0, zIndex: 40, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1040, margin: "0 auto", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: C.primary, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 11 }}>SW</div>
            <div>
              <span style={{ fontWeight: 800, fontSize: 13, color: C.text1 }}>포털 관리모드</span>
              <span style={{ fontSize: 11, color: C.text4, marginLeft: 8 }}>슈퍼어드민: {session.name} ({session.userId})</span>
            </div>
          </div>

          <div style={{ display: "flex", background: C.bg, padding: 6, borderRadius: 12, gap: 2 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{
                  padding: "8px 14px", borderRadius: 8, border: "none", fontSize: 12, cursor: "pointer",
                  background: tab === t.id ? "#fff" : "transparent",
                  color:      tab === t.id ? C.brand  : C.text3,
                  fontWeight: tab === t.id ? 700 : 500,
                  boxShadow:  tab === t.id ? "0 1px 3px rgba(0,0,0,.08)" : "none",
                }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          <button onClick={handleLogout}
            style={{ padding: "6px 14px", borderRadius: 8, background: C.dangerSoft, color: C.danger, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            로그아웃
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1040, margin: "0 auto", padding: "32px 24px" }}>
        {tab === "notices"   && <NoticesPanel   />}
        {tab === "courses"   && <CoursesPanel   />}
        {tab === "resources" && <ResourcesPanel />}
        {tab === "audit"     && <AuditPanel     />}
      </main>
    </div>
  );
}

/* ── 공통 컴포넌트 ── */
function SectionHeader({ title, count, onAdd }: { title: string; count: number; onAdd: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text1, margin: "0 0 4px" }}>{title}</h2>
        <p style={{ fontSize: 13, color: C.text3, margin: 0 }}>총 {count}건</p>
      </div>
      <button onClick={onAdd}
        style={{ padding: "10px 16px", borderRadius: 12, background: C.primary, color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
        + 새로 추가
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.text3, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

const iStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 13, outline: "none", background: "#fff", fontFamily: "inherit" };

/* ══════════════════════════════════════════════════════
   공지사항 패널
══════════════════════════════════════════════════════ */
function NoticesPanel() {
  const [items,  setItems]  = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding,  setAdding]  = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [form, setForm] = useState({ title: "", content: "", date: "", urgent: false, imageUrl: "", visible: true });

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/notices?all=1").then(r => r.json()).then(res => setItems(res.data ?? [])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    await fetch("/api/notices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, date: form.date || new Date().toISOString().slice(0, 10) }) });
    setSaving(false); setAdding(false);
    setForm({ title: "", content: "", date: "", urgent: false, imageUrl: "", visible: true });
    load();
  }

  async function del(id: string, title: string) {
    if (!confirm(`"${title}" 을(를) 삭제하시겠습니까?`)) return;
    await fetch("/api/notices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ _action: "delete", id }) });
    load();
  }

  async function toggleVisible(item: Notice) {
    await fetch("/api/notices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ _action: "update", id: item.id, data: { visible: !item.visible } }) });
    load();
  }

  return (
    <div>
      <SectionHeader title="공지사항 관리" count={items.length} onAdd={() => setAdding(true)} />
      {adding && (
        <FormCard title="새 공지사항" onCancel={() => setAdding(false)} onSave={handleSave} saving={saving} disabled={!form.title.trim()}>
          <Field label="제목 *"><input style={iStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="공지 제목" /></Field>
          <Field label="내용"><textarea style={{ ...iStyle, minHeight: 90, resize: "vertical" }} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="공지 내용" /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="날짜"><input type="date" style={iStyle} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></Field>
            <Field label="이미지 URL (Notion 첨부파일 URL)"><input style={iStyle} value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} placeholder="https://..." /></Field>
          </div>
          <div style={{ display: "flex", gap: 24 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.text2, cursor: "pointer" }}><input type="checkbox" checked={form.urgent} onChange={e => setForm(f => ({ ...f, urgent: e.target.checked }))} /> 긴급 공지</label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.text2, cursor: "pointer" }}><input type="checkbox" checked={form.visible} onChange={e => setForm(f => ({ ...f, visible: e.target.checked }))} /> 즉시 공개</label>
          </div>
        </FormCard>
      )}
      <ItemList loading={loading} empty="아직 공지사항이 없습니다.">
        {items.map(n => (
          <ItemRow key={n.id} visible={n.visible}
            badge={n.urgent ? { text: "긴급", bg: C.dangerSoft, color: C.danger } : { text: "안내", bg: C.bg, color: C.text3 }}
            title={n.title} sub={n.date}
            onToggle={() => toggleVisible(n)} onDelete={() => del(n.id, n.title)} />
        ))}
      </ItemList>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   교육과정 패널
══════════════════════════════════════════════════════ */
function CoursesPanel() {
  const [items,   setItems]   = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding,  setAdding]  = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [form, setForm] = useState({ title: "", description: "", deadline: "", duration: "", courseUrl: "", category: "required" as Course["category"], thumbnailUrl: "", order: 0, visible: true });

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/courses?all=1").then(r => r.json()).then(res => setItems(res.data ?? [])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    await fetch("/api/courses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, order: form.order || items.length }) });
    setSaving(false); setAdding(false);
    setForm({ title: "", description: "", deadline: "", duration: "", courseUrl: "", category: "required", thumbnailUrl: "", order: 0, visible: true });
    load();
  }

  async function del(id: string, title: string) {
    if (!confirm(`"${title}" 을(를) 삭제하시겠습니까?`)) return;
    await fetch("/api/courses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ _action: "delete", id }) });
    load();
  }

  async function toggleVisible(item: Course) {
    await fetch("/api/courses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ _action: "update", id: item.id, data: { visible: !item.visible } }) });
    load();
  }

  const CAT: Record<Course["category"], string> = { required: "필수교육", material: "SW활용자료", policy: "IT정책교육" };

  return (
    <div>
      <SectionHeader title="교육과정 관리" count={items.length} onAdd={() => setAdding(true)} />
      {adding && (
        <FormCard title="새 교육과정" onCancel={() => setAdding(false)} onSave={handleSave} saving={saving} disabled={!form.title.trim()}>
          <Field label="제목 *"><input style={iStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="과정명" /></Field>
          <Field label="설명"><textarea style={{ ...iStyle, minHeight: 80, resize: "vertical" }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="과정 설명" /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="카테고리">
              <select style={iStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as Course["category"] }))}>
                <option value="required">필수교육</option>
                <option value="material">SW활용자료</option>
                <option value="policy">IT정책교육</option>
              </select>
            </Field>
            <Field label="소요시간"><input style={iStyle} value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} placeholder="예: 45분" /></Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="마감일"><input type="date" style={iStyle} value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} /></Field>
            <Field label="순서"><input type="number" style={iStyle} value={form.order} onChange={e => setForm(f => ({ ...f, order: Number(e.target.value) }))} /></Field>
          </div>
          <Field label="교육 URL"><input style={iStyle} value={form.courseUrl} onChange={e => setForm(f => ({ ...f, courseUrl: e.target.value }))} placeholder="https://..." /></Field>
          <Field label="썸네일 URL (Notion 첨부파일 URL)"><input style={iStyle} value={form.thumbnailUrl} onChange={e => setForm(f => ({ ...f, thumbnailUrl: e.target.value }))} placeholder="https://..." /></Field>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.text2, cursor: "pointer" }}><input type="checkbox" checked={form.visible} onChange={e => setForm(f => ({ ...f, visible: e.target.checked }))} /> 즉시 공개</label>
        </FormCard>
      )}
      <ItemList loading={loading} empty="아직 등록된 교육과정이 없습니다.">
        {items.map(c => (
          <ItemRow key={c.id} visible={c.visible}
            badge={{ text: CAT[c.category], bg: C.primarySoft, color: C.primary }}
            title={c.title} sub={`${c.duration ? `⏱ ${c.duration}` : ""}${c.deadline ? ` · 마감 ${c.deadline}` : ""}`}
            onToggle={() => toggleVisible(c)} onDelete={() => del(c.id, c.title)} />
        ))}
      </ItemList>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   자료실 패널
══════════════════════════════════════════════════════ */
function ResourcesPanel() {
  const [items,   setItems]   = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding,  setAdding]  = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [form, setForm] = useState({ title: "", category: "install" as ResourceCategory, fileUrl: "", fileType: "PDF", fileSize: "", description: "", updatedAt: "", order: 0, visible: true });

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/resources?all=1").then(r => r.json()).then(res => setItems(res.data ?? [])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    await fetch("/api/resources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, updatedAt: form.updatedAt || new Date().toISOString().slice(0, 10), order: form.order || items.length }) });
    setSaving(false); setAdding(false);
    setForm({ title: "", category: "install", fileUrl: "", fileType: "PDF", fileSize: "", description: "", updatedAt: "", order: 0, visible: true });
    load();
  }

  async function del(id: string, title: string) {
    if (!confirm(`"${title}" 을(를) 삭제하시겠습니까?`)) return;
    await fetch("/api/resources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ _action: "delete", id }) });
    load();
  }

  async function toggleVisible(item: Resource) {
    await fetch("/api/resources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ _action: "update", id: item.id, data: { visible: !item.visible } }) });
    load();
  }

  const CAT: Record<ResourceCategory, string> = { install: "설치가이드", policy: "정책문서", forms: "양식서식" };
  const FT: Record<string, { bg: string; color: string }> = { PDF: { bg: "#FEE2E2", color: "#B91C1C" }, XLSX: { bg: "#D1FAE5", color: "#065F46" }, DOCX: { bg: "#DBEAFE", color: "#1E40AF" } };

  return (
    <div>
      <SectionHeader title="자료실 관리" count={items.length} onAdd={() => setAdding(true)} />
      {adding && (
        <FormCard title="새 자료 등록" onCancel={() => setAdding(false)} onSave={handleSave} saving={saving} disabled={!form.title.trim()}>
          <Field label="파일명 *"><input style={iStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="파일명" /></Field>
          <Field label="설명"><input style={iStyle} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="파일 설명" /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <Field label="분류">
              <select style={iStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as ResourceCategory }))}>
                <option value="install">설치가이드</option><option value="policy">정책문서</option><option value="forms">양식서식</option>
              </select>
            </Field>
            <Field label="파일 형식">
              <select style={iStyle} value={form.fileType} onChange={e => setForm(f => ({ ...f, fileType: e.target.value }))}>
                <option>PDF</option><option>XLSX</option><option>DOCX</option><option>ZIP</option><option>EXE</option>
              </select>
            </Field>
            <Field label="파일 크기"><input style={iStyle} value={form.fileSize} onChange={e => setForm(f => ({ ...f, fileSize: e.target.value }))} placeholder="예: 2.1 MB" /></Field>
          </div>
          <Field label="파일 URL (Notion 첨부파일 URL 또는 공유 링크)"><input style={iStyle} value={form.fileUrl} onChange={e => setForm(f => ({ ...f, fileUrl: e.target.value }))} placeholder="https://..." /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="업데이트 날짜"><input type="date" style={iStyle} value={form.updatedAt} onChange={e => setForm(f => ({ ...f, updatedAt: e.target.value }))} /></Field>
            <Field label="순서"><input type="number" style={iStyle} value={form.order} onChange={e => setForm(f => ({ ...f, order: Number(e.target.value) }))} /></Field>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.text2, cursor: "pointer" }}><input type="checkbox" checked={form.visible} onChange={e => setForm(f => ({ ...f, visible: e.target.checked }))} /> 즉시 공개</label>
        </FormCard>
      )}
      <ItemList loading={loading} empty="아직 등록된 자료가 없습니다.">
        {items.map(r => {
          const ft = FT[r.fileType] ?? { bg: C.bg, color: C.text3 };
          return (
            <ItemRow key={r.id} visible={r.visible}
              badge={{ text: r.fileType, bg: ft.bg, color: ft.color }}
              title={r.title} sub={`${CAT[r.category]} · ${r.fileSize} · ${r.updatedAt}`}
              onToggle={() => toggleVisible(r)} onDelete={() => del(r.id, r.title)} />
          );
        })}
      </ItemList>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   감사 로그 패널
══════════════════════════════════════════════════════ */
function AuditPanel() {
  const [logs,    setLogs]    = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/manage/audit-log")
      .then(r => r.json())
      .then(res => setLogs(res.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  const ACTION_STYLE: Record<AuditLog["action"], { label: string; bg: string; color: string }> = {
    create: { label: "등록", bg: "#D1FAE5", color: "#065F46" },
    update: { label: "수정", bg: "#FEF3C7", color: "#92400E" },
    delete: { label: "삭제", bg: C.dangerSoft, color: C.danger },
  };

  const TARGET_LABEL: Record<AuditLog["target"], string> = {
    notices: "공지사항", courses: "교육과정", resources: "자료실",
  };

  function formatTime(iso: string) {
    return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text1, margin: "0 0 4px" }}>감사 로그</h2>
        <p style={{ fontSize: 13, color: C.text3, margin: 0 }}>슈퍼어드민의 포털 콘텐츠 변경 이력 (최근 {logs.length}건)</p>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: C.text4 }}>불러오는 중...</div>
      ) : logs.length === 0 ? (
        <div style={{ textAlign: "center", padding: 64, background: "#fff", borderRadius: 20, border: `1px solid ${C.border}`, color: C.text4, fontSize: 13 }}>
          아직 기록된 활동이 없습니다.
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 20, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {["일시", "관리자", "액션", "대상", "항목"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.text4, textTransform: "uppercase", letterSpacing: ".04em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => {
                const as = ACTION_STYLE[log.action];
                return (
                  <tr key={log.id} style={{ borderBottom: i < logs.length - 1 ? `1px solid #f8fafc` : "none" }}>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: C.text3, whiteSpace: "nowrap" }}>{formatTime(log.timestamp)}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.text1 }}>{log.adminName}</span>
                      <span style={{ fontSize: 11, color: C.text4, marginLeft: 4 }}>({log.adminId})</span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: as.bg, color: as.color }}>{as.label}</span>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: C.text3 }}>{TARGET_LABEL[log.target]}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: C.text2, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.itemTitle}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   공통 UI 컴포넌트
══════════════════════════════════════════════════════ */
function FormCard({ title, children, onCancel, onSave, saving, disabled }: {
  title: string; children: React.ReactNode;
  onCancel: () => void; onSave: () => void; saving: boolean; disabled: boolean;
}) {
  return (
    <div style={{ background: "#fff", borderRadius: 20, padding: 24, marginBottom: 24, border: `1px solid ${C.border}` }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text1, margin: "0 0 16px" }}>{title}</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>{children}</div>
      <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
        <button onClick={onSave} disabled={saving || disabled}
          style={{ padding: "10px 20px", borderRadius: 12, background: C.primary, color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: (saving || disabled) ? 0.5 : 1 }}>
          {saving ? "저장 중..." : "저장"}
        </button>
        <button onClick={onCancel}
          style={{ padding: "10px 20px", borderRadius: 12, background: C.bg, color: C.text3, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          취소
        </button>
      </div>
    </div>
  );
}

function ItemList({ loading, empty, children }: { loading: boolean; empty: string; children: React.ReactNode }) {
  if (loading) return <div style={{ textAlign: "center", padding: 48, color: C.text4 }}>불러오는 중...</div>;
  const count = Array.isArray(children) ? children.length : (children ? 1 : 0);
  if (!count) return (
    <div style={{ textAlign: "center", padding: 64, background: "#fff", borderRadius: 20, border: `1px solid ${C.border}`, color: C.text4, fontSize: 13 }}>{empty}</div>
  );
  return <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>;
}

function ItemRow({ visible, badge, title, sub, onToggle, onDelete }: {
  visible: boolean;
  badge: { text: string; bg: string; color: string };
  title: string; sub: string;
  onToggle: () => void; onDelete: () => void;
}) {
  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 20, display: "flex", alignItems: "center", gap: 16, border: `1px solid ${C.border}`, opacity: visible ? 1 : 0.5 }}>
      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: badge.bg, color: badge.color, flexShrink: 0 }}>{badge.text}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: C.text1, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</p>
        {sub && <p style={{ fontSize: 11, color: C.text4, margin: "4px 0 0" }}>{sub}</p>}
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button onClick={onToggle}
          style={{ padding: "6px 12px", borderRadius: 8, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", background: visible ? "#D1FAE5" : C.bg, color: visible ? "#065F46" : C.text3 }}>
          {visible ? "공개중" : "숨김"}
        </button>
        <button onClick={onDelete}
          style={{ padding: "6px 12px", borderRadius: 8, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", background: C.dangerSoft, color: C.danger }}>
          삭제
        </button>
      </div>
    </div>
  );
}
