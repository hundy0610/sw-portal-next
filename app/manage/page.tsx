"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import type { Notice, Course, Resource, ResourceCategory, SwVersion, SwDoc } from "@/types/portal";
import type { AuditLog } from "@/lib/portal-store";
import type { SwItem } from "@/types";

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

type ManageTab = "notices" | "courses" | "resources" | "swdb" | "audit" | "swresources";

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
    { id: "notices",     label: "공지사항",   icon: "🔔" },
    { id: "courses",     label: "교육과정",   icon: "🎓" },
    { id: "resources",   label: "자료실",     icon: "📁" },
    { id: "swresources", label: "SW 자료실",  icon: "💿" },
    { id: "swdb",        label: "SW 검색",    icon: "🔍" },
    { id: "audit",       label: "감사 로그",  icon: "🕵️" },
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
        {tab === "notices"     && <NoticesPanel      />}
        {tab === "courses"     && <CoursesPanel      />}
        {tab === "resources"   && <ResourcesPanel    />}
        {tab === "swresources" && <SwResourcesPanel  />}
        {tab === "swdb"        && <SwPanel           />}
        {tab === "audit"       && <AuditPanel        />}
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
            <Field label="날짜"><div style={{ display: "flex", alignItems: "center", gap: 4 }}><input type="date" style={{ ...iStyle, flex: 1, width: "auto" }} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />{form.date && <button type="button" onClick={() => setForm(f => ({ ...f, date: "" }))} style={{ color: "#9ca3af", fontSize: 18, lineHeight: 1, padding: "0 2px", background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}>×</button>}</div></Field>
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
            <Field label="마감일"><div style={{ display: "flex", alignItems: "center", gap: 4 }}><input type="date" style={{ ...iStyle, flex: 1, width: "auto" }} value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />{form.deadline && <button type="button" onClick={() => setForm(f => ({ ...f, deadline: "" }))} style={{ color: "#9ca3af", fontSize: 18, lineHeight: 1, padding: "0 2px", background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}>×</button>}</div></Field>
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
  const [items,       setItems]       = useState<Resource[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [adding,      setAdding]      = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [detecting,   setDetecting]   = useState(false);
  const [form, setForm] = useState({ title: "", category: "install" as ResourceCategory, fileUrl: "", fileType: "PDF", fileSize: "", description: "", updatedAt: "", order: 0, visible: true });

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/resources?all=1").then(r => r.json()).then(res => setItems(res.data ?? [])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  // URL 입력 완료 시 파일 크기·형식 자동 감지
  async function handleUrlBlur() {
    const url = form.fileUrl.trim();
    if (!url.startsWith("http")) return;
    setDetecting(true);
    try {
      const res = await fetch(`/api/manage/file-info?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      setForm(f => ({
        ...f,
        fileSize: data.fileSize || f.fileSize,
        fileType: data.fileType || f.fileType,
      }));
    } catch {/* 무시 */}
    setDetecting(false);
  }

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

  const CAT: Record<ResourceCategory, string> = { install: "설치가이드", policy: "정책문서", forms: "양식서식", other: "기타" };
  const FT: Record<string, { bg: string; color: string }> = { PDF: { bg: "#FEE2E2", color: "#B91C1C" }, XLSX: { bg: "#D1FAE5", color: "#065F46" }, DOCX: { bg: "#DBEAFE", color: "#1E40AF" }, ZIP: { bg: "#FEF3C7", color: "#92400E" }, EXE: { bg: "#F3E8FF", color: "#7C3AED" } };

  return (
    <div>
      <SectionHeader title="자료실 관리" count={items.length} onAdd={() => setAdding(true)} />
      {adding && (
        <FormCard title="새 자료 등록" onCancel={() => setAdding(false)} onSave={handleSave} saving={saving} disabled={!form.title.trim()}>
          <Field label="파일명 *"><input style={iStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="파일명" /></Field>
          <Field label="설명"><input style={iStyle} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="파일 설명" /></Field>

          {/* URL 먼저 — 자동감지 후 아래 필드 채워짐 */}
          <Field label="파일 URL (Notion 첨부파일 URL 또는 공유 링크)">
            <div style={{ position: "relative" }}>
              <input
                style={{ ...iStyle, paddingRight: detecting ? 110 : undefined }}
                value={form.fileUrl}
                onChange={e => setForm(f => ({ ...f, fileUrl: e.target.value }))}
                onBlur={handleUrlBlur}
                placeholder="https://... (입력 후 포커스 이동 시 크기·형식 자동 입력)"
              />
              {detecting && (
                <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "#2563EB", fontWeight: 600 }}>
                  감지 중...
                </span>
              )}
            </div>
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <Field label="분류">
              <select style={iStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as ResourceCategory }))}>
                <option value="install">설치가이드</option>
                <option value="policy">정책문서</option>
                <option value="forms">양식서식</option>
                <option value="other">기타</option>
              </select>
            </Field>
            <Field label="파일 형식">
              <select style={iStyle} value={form.fileType} onChange={e => setForm(f => ({ ...f, fileType: e.target.value }))}>
                <option>PDF</option>
                <option>XLSX</option>
                <option>DOCX</option>
                <option>ZIP</option>
                <option>EXE</option>
                <option>PPT</option>
                <option>PPTX</option>
                <option>HWP</option>
                <option>CSV</option>
                <option value="other">기타</option>
              </select>
            </Field>
            <Field label={`파일 크기${detecting ? " ⏳" : ""}`}>
              <input
                style={{ ...iStyle, background: detecting ? "#f8fafc" : "#fff" }}
                value={form.fileSize}
                onChange={e => setForm(f => ({ ...f, fileSize: e.target.value }))}
                placeholder={detecting ? "감지 중..." : "자동 입력 또는 직접 입력"}
                readOnly={detecting}
              />
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="업데이트 날짜"><div style={{ display: "flex", alignItems: "center", gap: 4 }}><input type="date" style={{ ...iStyle, flex: 1, width: "auto" }} value={form.updatedAt} onChange={e => setForm(f => ({ ...f, updatedAt: e.target.value }))} />{form.updatedAt && <button type="button" onClick={() => setForm(f => ({ ...f, updatedAt: "" }))} style={{ color: "#9ca3af", fontSize: 18, lineHeight: 1, padding: "0 2px", background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}>×</button>}</div></Field>
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
   SW 검색 패널
══════════════════════════════════════════════════════ */
function SwPanel() {
  const [items,     setItems]     = useState<SwItem[]>([]);
  const [resources, setResources] = useState<{ id: string; title: string }[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [adding,    setAdding]    = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [editing,   setEditing]   = useState<SwItem | null>(null);
  const [filter,    setFilter]    = useState<"all" | SwItem["status"]>("all");

  const defaultForm = { name: "", vendor: "", category: "", status: "conditional" as SwItem["status"], description: "", alternatives: "", mandatory: false, officialUrl: "", resourceId: "" };
  const [form, setForm] = useState(defaultForm);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/sw-db").then(r => r.json()),
      fetch("/api/resources?all=1").then(r => r.json()),
    ]).then(([sw, res]) => {
      setItems(sw.data ?? []);
      setResources((res.data ?? []).map((r: { id: string; title: string }) => ({ id: r.id, title: r.title })));
    }).catch(() => {
      setItems([]);
    }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  function startAdd() { setForm(defaultForm); setEditing(null); setAdding(true); }
  function startEdit(item: SwItem) {
    setForm({ name: item.name, vendor: item.vendor, category: item.category, status: item.status, description: item.description, alternatives: item.alternatives.join(", "), mandatory: item.mandatory, officialUrl: item.officialUrl ?? "", resourceId: item.resourceId ?? "" });
    setEditing(item);
    setAdding(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      // officialUrl/resourceId를 빈 문자열 그대로 전송해야 기존 값이 올바르게 덮어씌워짐
      // (undefined로 변환하면 JSON에서 키가 제거되어 기존 값이 유지되는 버그 발생)
      const payload = {
        ...form,
        alternatives: form.alternatives.split(",").map(s => s.trim()).filter(Boolean),
      };
      if (editing) {
        const res = await fetch("/api/sw-db", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ _action: "update", id: editing.id, data: payload }) });
        if (!res.ok) throw new Error(await res.text());
      } else {
        const res = await fetch("/api/sw-db", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error(await res.text());
      }
      setAdding(false); setEditing(null);
      setForm(defaultForm);
      load();
    } catch (e) {
      alert(`저장 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  async function del(id: string, name: string) {
    if (!confirm(`"${name}" 을(를) 삭제하시겠습니까?`)) return;
    try {
      const res = await fetch("/api/sw-db", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ _action: "delete", id }) });
      if (!res.ok) throw new Error(await res.text());
      load();
    } catch (e) {
      alert(`삭제 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const STATUS_STYLE: Record<SwItem["status"], { text: string; bg: string; color: string }> = {
    approved:    { text: "승인",   bg: "#D1FAE5", color: "#065F46" },
    banned:      { text: "금지",   bg: "#FEE2E2", color: "#B91C1C" },
    conditional: { text: "조건부", bg: "#FEF3C7", color: "#92400E" },
  };

  const FILTERS: { key: "all" | SwItem["status"]; label: string }[] = [
    { key: "all",         label: `전체 (${items.length})` },
    { key: "approved",    label: `승인 (${items.filter(i => i.status === "approved").length})` },
    { key: "conditional", label: `조건부 (${items.filter(i => i.status === "conditional").length})` },
    { key: "banned",      label: `금지 (${items.filter(i => i.status === "banned").length})` },
  ];

  const filtered = filter === "all" ? items : items.filter(i => i.status === filter);

  return (
    <div>
      <SectionHeader title="SW 검색 관리" count={items.length} onAdd={startAdd} />

      {/* 상태 필터 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            style={{ padding: "6px 14px", borderRadius: 20, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer",
              background: filter === f.key ? C.primary : "#fff",
              color:      filter === f.key ? "#fff"     : C.text3,
              boxShadow:  filter === f.key ? "none" : `0 0 0 1px ${C.border}`,
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {adding && (
        <FormCard title={editing ? `수정: ${editing.name}` : "새 SW 등록"} onCancel={() => { setAdding(false); setEditing(null); }} onSave={handleSave} saving={saving} disabled={!form.name.trim()}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="SW 이름 *"><input style={iStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="예: Microsoft Teams" /></Field>
            <Field label="제조사"><input style={iStyle} value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} placeholder="예: Microsoft" /></Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="카테고리"><input style={iStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="예: 협업, 개발, 보안" /></Field>
            <Field label="상태">
              <select style={iStyle} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as SwItem["status"] }))}>
                <option value="approved">승인</option>
                <option value="conditional">조건부</option>
                <option value="banned">금지</option>
              </select>
            </Field>
          </div>
          <Field label="설명"><textarea style={{ ...iStyle, minHeight: 80, resize: "vertical" }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="SW 설명 및 사용 조건" /></Field>
          <Field label="대체 SW (쉼표로 구분)"><input style={iStyle} value={form.alternatives} onChange={e => setForm(f => ({ ...f, alternatives: e.target.value }))} placeholder="예: Slack, Zoom, Google Meet" /></Field>
          <Field label="공식 다운로드 링크"><input style={iStyle} value={form.officialUrl} onChange={e => setForm(f => ({ ...f, officialUrl: e.target.value }))} placeholder="https://..." /></Field>
          <Field label="자료실 설치파일 연동">
            <select style={iStyle} value={form.resourceId} onChange={e => setForm(f => ({ ...f, resourceId: e.target.value }))}>
              <option value="">연동 안 함</option>
              {resources.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
          </Field>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.text2, cursor: "pointer" }}>
            <input type="checkbox" checked={form.mandatory} onChange={e => setForm(f => ({ ...f, mandatory: e.target.checked }))} /> 필수 설치 SW
          </label>
        </FormCard>
      )}

      <ItemList loading={loading} empty="아직 등록된 SW가 없습니다.">
        {filtered.map(sw => {
          const st = STATUS_STYLE[sw.status];
          const linkedRes = resources.find(r => r.id === sw.resourceId);
          return (
            <div key={sw.id} style={{ background: "#fff", borderRadius: 16, padding: 20, display: "flex", alignItems: "center", gap: 16, border: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: st.bg, color: st.color, flexShrink: 0 }}>{st.text}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: C.text1, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {sw.name}
                  {sw.mandatory && <span style={{ marginLeft: 6, fontSize: 10, padding: "2px 6px", borderRadius: 4, background: C.primarySoft, color: C.primary }}>필수</span>}
                </p>
                <p style={{ fontSize: 11, color: C.text4, margin: "4px 0 0" }}>
                  {sw.vendor}{sw.category ? ` · ${sw.category}` : ""}
                  {sw.alternatives.length ? ` · 대체: ${sw.alternatives.join(", ")}` : ""}
                  {sw.officialUrl ? " · 🔗 공식링크" : ""}
                  {linkedRes ? ` · 📦 ${linkedRes.title}` : ""}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button onClick={() => startEdit(sw)}
                  style={{ padding: "6px 12px", borderRadius: 8, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", background: C.primarySoft, color: C.primary }}>
                  수정
                </button>
                <button onClick={() => del(sw.id, sw.name)}
                  style={{ padding: "6px 12px", borderRadius: 8, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", background: C.dangerSoft, color: C.danger }}>
                  삭제
                </button>
              </div>
            </div>
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
    notices: "공지사항", courses: "교육과정", resources: "자료실", swdb: "SW 검색",
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

/* ══════════════════════════════════════════════════════
   SW 자료실 패널 (Notion 기반)
══════════════════════════════════════════════════════ */
function SwResourcesPanel() {
  const [versions,   setVersions]   = useState<SwVersion[]>([]);
  const [docs,       setDocs]       = useState<SwDoc[]>([]);
  const [selVersion, setSelVersion] = useState<SwVersion | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);

  const [addingVer,  setAddingVer]  = useState(false);
  const [addingDoc,  setAddingDoc]  = useState(false);
  const [editVer,    setEditVer]    = useState<SwVersion | null>(null);
  const [editDoc,    setEditDoc]    = useState<SwDoc | null>(null);
  const [uploadFile,     setUploadFile]     = useState<File | null>(null);
  const [uploading,      setUploading]      = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const BLANK_VER = { name: "", version: "", category: "", os: "", description: "", visible: true, order: 0 };
  const BLANK_DOC = { name: "", type: "설치파일", description: "", visible: true, order: 0, externalFileUrl: "" };
  const [verForm, setVerForm] = useState(BLANK_VER);
  const [docForm, setDocForm] = useState(BLANK_DOC);

  const loadVersions = useCallback(() => {
    setLoading(true);
    fetch("/api/sw-versions?all=1").then(r => r.json())
      .then(res => setVersions(res.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadVersions(); }, [loadVersions]);

  const loadDocs = useCallback((verId: string) => {
    fetch(`/api/sw-docs?versionId=${verId}&all=1`).then(r => r.json())
      .then(res => setDocs(res.data ?? []));
  }, []);

  useEffect(() => {
    if (selVersion) loadDocs(selVersion.id);
    else setDocs([]);
  }, [selVersion, loadDocs]);

  async function saveVer() {
    setSaving(true);
    const osArr = verForm.os.split(",").map(s => s.trim()).filter(Boolean);
    if (editVer) {
      await fetch("/api/sw-versions", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _action: "update", id: editVer.id, data: { ...verForm, os: osArr } }) });
    } else {
      await fetch("/api/sw-versions", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...verForm, os: osArr }) });
    }
    setSaving(false); setAddingVer(false); setEditVer(null); setVerForm(BLANK_VER);
    loadVersions();
  }

  async function delVer(ver: SwVersion) {
    if (!confirm(`"${ver.name} ${ver.version}" 을(를) 삭제하시겠습니까?`)) return;
    await fetch("/api/sw-versions", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _action: "delete", id: ver.id }) });
    if (selVersion?.id === ver.id) setSelVersion(null);
    loadVersions();
  }

  async function saveDoc() {
    if (!selVersion) return;
    setSaving(true);
    try {
      let fileUploadId: string | undefined;

      if (uploadFile) {
        setUploading(true);
        setUploadProgress(0);

        const CHUNK = 6 * 1024 * 1024; // 6 MB — Notion 최소 파트 크기 5 MiB 초과
        const size  = uploadFile.size;

        // Step 1: 업로드 세션 초기화
        const numberOfParts = Math.ceil(size / CHUNK);
        const initRes = await fetch("/api/sw-docs/upload", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ filename: uploadFile.name, contentType: uploadFile.type, size, numberOfParts }),
        });
        if (!initRes.ok) throw new Error(await initRes.text());
        const { fileUploadId: uploadId, mode } = await initRes.json();
        fileUploadId = uploadId;

        const isMultiPart = mode === "multi_part";
        let start = 0;
        let partNumber = 1;

        // Step 2: 청크 단위로 전송 (single_part는 1회, multi_part는 여러 번)
        while (start < size) {
          const end   = Math.min(start + CHUNK - 1, size - 1);
          const chunk = uploadFile.slice(start, end + 1);

          const fd = new FormData();
          fd.append("file", chunk, uploadFile.name);
          fd.append("fileUploadId", fileUploadId!);
          fd.append("start",       String(start));
          fd.append("end",         String(end));
          fd.append("total",       String(size));
          fd.append("multiPart",   isMultiPart ? "1" : "0");
          fd.append("partNumber",  String(partNumber));

          const partRes = await fetch("/api/sw-docs/upload", { method: "POST", body: fd });
          if (!partRes.ok) throw new Error(await partRes.text());

          start = end + 1;
          partNumber += 1;
          setUploadProgress(Math.round((start / size) * 100));
        }

        setUploading(false);
        setUploadProgress(100);
      }

      const externalFileUrl = docForm.externalFileUrl?.trim() || undefined;

      if (editDoc) {
        await fetch("/api/sw-docs", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ _action: "update", id: editDoc.id, data: { ...docForm, fileUploadId, externalFileUrl } }) });
      } else {
        await fetch("/api/sw-docs", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...docForm, versionId: selVersion.id, fileUploadId, externalFileUrl }) });
      }
    } catch (e) {
      alert(`저장 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false); setUploading(false);
    }
    setAddingDoc(false); setEditDoc(null); setDocForm(BLANK_DOC); setUploadFile(null); setUploadProgress(0);
    loadDocs(selVersion.id);
  }

  async function delDoc(doc: SwDoc) {
    if (!confirm(`"${doc.name}" 을(를) 삭제하시겠습니까?`)) return;
    await fetch("/api/sw-docs", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _action: "delete", id: doc.id }) });
    if (selVersion) loadDocs(selVersion.id);
  }

  async function toggleDocVisible(doc: SwDoc) {
    await fetch("/api/sw-docs", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _action: "update", id: doc.id, data: { visible: !doc.visible } }) });
    if (selVersion) loadDocs(selVersion.id);
  }

  const grid2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 };
  const notionUrl = (id: string) => `https://notion.so/${id.replace(/-/g, "")}`;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24, alignItems: "start" }}>

      {/* ── 왼쪽: SW 버전 목록 ── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: C.text1, margin: "0 0 2px" }}>SW 버전</h2>
            <p style={{ fontSize: 12, color: C.text3, margin: 0 }}>총 {versions.length}개</p>
          </div>
          <button onClick={() => { setAddingVer(true); setEditVer(null); setVerForm(BLANK_VER); }}
            style={{ padding: "7px 12px", borderRadius: 10, background: C.primary, color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            + 추가
          </button>
        </div>

        {(addingVer || editVer) && (
          <FormCard title={editVer ? "버전 수정" : "새 SW 버전"} onCancel={() => { setAddingVer(false); setEditVer(null); }} onSave={saveVer} saving={saving} disabled={!verForm.name.trim() || !verForm.version.trim()}>
            <div style={grid2}>
              <Field label="SW명 *"><input style={iStyle} value={verForm.name} onChange={e => setVerForm(f => ({ ...f, name: e.target.value }))} placeholder="예: 한컴오피스" /></Field>
              <Field label="버전 *"><input style={iStyle} value={verForm.version} onChange={e => setVerForm(f => ({ ...f, version: e.target.value }))} placeholder="예: 2024" /></Field>
            </div>
            <div style={grid2}>
              <Field label="카테고리"><input style={iStyle} value={verForm.category} onChange={e => setVerForm(f => ({ ...f, category: e.target.value }))} placeholder="예: 오피스" /></Field>
              <Field label="OS (쉼표 구분)"><input style={iStyle} value={verForm.os} onChange={e => setVerForm(f => ({ ...f, os: e.target.value }))} placeholder="예: Windows, macOS" /></Field>
            </div>
            <Field label="설명"><input style={iStyle} value={verForm.description} onChange={e => setVerForm(f => ({ ...f, description: e.target.value }))} placeholder="간단한 설명" /></Field>
            <div style={{ display: "flex", gap: 20 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.text2, cursor: "pointer" }}>
                <input type="checkbox" checked={verForm.visible} onChange={e => setVerForm(f => ({ ...f, visible: e.target.checked }))} /> 즉시 공개
              </label>
              <Field label="순서"><input type="number" style={{ ...iStyle, width: 72 }} value={verForm.order} onChange={e => setVerForm(f => ({ ...f, order: +e.target.value }))} /></Field>
            </div>
          </FormCard>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: 32, color: C.text4 }}>불러오는 중...</div>
        ) : versions.length === 0 ? (
          <div style={{ textAlign: "center", padding: 32, color: C.text4, fontSize: 13 }}>등록된 SW가 없습니다.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {versions.map(ver => (
              <div key={ver.id} onClick={() => setSelVersion(selVersion?.id === ver.id ? null : ver)}
                style={{ padding: "10px 14px", borderRadius: 12, border: `2px solid ${selVersion?.id === ver.id ? C.primary : C.border}`, background: selVersion?.id === ver.id ? C.primarySoft : "#fff", cursor: "pointer", transition: "all .15s" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: C.text1 }}>{ver.name}</div>
                    <div style={{ fontSize: 11, color: C.text3 }}>v{ver.version} · {ver.category}</div>
                    <div style={{ fontSize: 11, color: ver.visible ? "#16a34a" : C.text4, marginTop: 2 }}>{ver.visible ? "공개" : "숨김"}</div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setEditVer(ver); setAddingVer(false); setVerForm({ name: ver.name, version: ver.version, category: ver.category, os: ver.os.join(", "), description: ver.description, visible: ver.visible, order: ver.order }); }}
                      style={{ padding: "3px 8px", borderRadius: 6, border: "none", fontSize: 10, fontWeight: 700, cursor: "pointer", background: "#e0f2fe", color: "#0369a1" }}>수정</button>
                    <button onClick={() => delVer(ver)}
                      style={{ padding: "3px 8px", borderRadius: 6, border: "none", fontSize: 10, fontWeight: 700, cursor: "pointer", background: C.dangerSoft, color: C.danger }}>삭제</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 오른쪽: 파일/문서 목록 ── */}
      <div>
        {!selVersion ? (
          <div style={{ textAlign: "center", padding: 64, color: C.text4, fontSize: 13, background: "#f8fafc", borderRadius: 16, border: `1px dashed ${C.border}` }}>
            왼쪽에서 SW 버전을 선택하면<br />파일/문서 목록이 표시됩니다.
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: C.text1, margin: "0 0 2px" }}>
                  {selVersion.name} v{selVersion.version} — 파일/문서
                </h2>
                <p style={{ fontSize: 12, color: C.text3, margin: 0 }}>
                  총 {docs.length}개 · 실제 파일은&nbsp;
                  <a href={notionUrl(selVersion.id)} target="_blank" rel="noopener noreferrer"
                    style={{ color: C.primary }}>Notion에서 첨부</a>
                </p>
              </div>
              <button onClick={() => { setAddingDoc(true); setEditDoc(null); setDocForm(BLANK_DOC); }}
                style={{ padding: "7px 12px", borderRadius: 10, background: C.primary, color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                + 파일 추가
              </button>
            </div>

            {(addingDoc || editDoc) && (
              <FormCard title={editDoc ? "파일 수정" : "새 파일/문서"} onCancel={() => { setAddingDoc(false); setEditDoc(null); setUploadFile(null); }} onSave={saveDoc} saving={saving || uploading} disabled={!docForm.name.trim()}>
                <div style={grid2}>
                  <Field label="파일명 *"><input style={iStyle} value={docForm.name} onChange={e => setDocForm(f => ({ ...f, name: e.target.value }))} placeholder="예: 한컴오피스2024_Setup.exe" /></Field>
                  <Field label="종류">
                    <select style={iStyle} value={docForm.type} onChange={e => setDocForm(f => ({ ...f, type: e.target.value }))}>
                      <option>설치파일</option>
                      <option>설치안내</option>
                      <option>규정</option>
                      <option>기타</option>
                    </select>
                  </Field>
                </div>
                <Field label="설명 (크기, 비고 등)"><input style={iStyle} value={docForm.description} onChange={e => setDocForm(f => ({ ...f, description: e.target.value }))} placeholder="예: 약 850MB" /></Field>

                {/* 파일 첨부 영역 */}
                <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 16, background: "#f8fafc", display: "flex", flexDirection: "column", gap: 12 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: C.text2, margin: 0 }}>파일 첨부</p>

                  {/* 현재 첨부 파일 표시 (수정 시) */}
                  {editDoc?.fileUrl && !uploadFile && !docForm.externalFileUrl && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.text3 }}>
                      <span style={{ padding: "2px 8px", borderRadius: 6, background: "#D1FAE5", color: "#065F46", fontWeight: 700, fontSize: 11 }}>현재 파일</span>
                      <span>{editDoc.fileName || editDoc.name}</span>
                      <a href={`/api/sw-docs/${editDoc.id}/file`} target="_blank" rel="noopener noreferrer"
                        style={{ color: C.primary, fontSize: 11 }}>미리보기</a>
                    </div>
                  )}

                  {/* 방법 1: 직접 업로드 (소용량, ~4MB) */}
                  <div>
                    <p style={{ fontSize: 11, color: C.text4, margin: "0 0 6px" }}>방법 1 — 직접 업로드 (PDF, 문서 등 ~4MB 이하)</p>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: "#fff", cursor: "pointer", fontSize: 12, color: C.text2, fontWeight: 600 }}>
                      📎 파일 선택
                      <input type="file" style={{ display: "none" }} onChange={e => {
                        const f = e.target.files?.[0] ?? null;
                        if (!f) return;
                        const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
                        const BLOCKED = ["exe", "pkg", "dmg", "msi", "bat", "sh", "app", "cmd", "com", "scr"];
                        if (BLOCKED.includes(ext)) {
                          alert(`⚠️ .${ext} 파일은 Notion에 직접 업로드할 수 없습니다.\n\nZIP으로 압축한 후 업로드하거나, 아래 "외부 URL"을 사용하세요.`);
                          e.target.value = ""; return;
                        }
                        if (f.size > 100 * 1024 * 1024) {
                          alert(`⚠️ 100MB를 초과하는 파일은 직접 업로드할 수 없습니다. (${(f.size / 1024 / 1024).toFixed(0)}MB)\n\n아래 Notion 링크에서 직접 첨부하거나, 외부 URL을 사용하세요.`);
                          e.target.value = ""; return;
                        }
                        setUploadFile(f);
                        setUploadProgress(0);
                        setDocForm(form => ({ ...form, externalFileUrl: "" }));
                      }} />
                    </label>
                    {uploadFile && !uploading && (
                      <span style={{ marginLeft: 10, fontSize: 12, color: "#065F46", fontWeight: 600 }}>
                        {uploadFile.name} ({(uploadFile.size / 1024 / 1024).toFixed(1)} MB)
                        <button type="button" onClick={() => { setUploadFile(null); setUploadProgress(0); }}
                          style={{ marginLeft: 6, color: C.danger, background: "none", border: "none", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>×</button>
                      </span>
                    )}
                    {uploading && (
                      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.text3 }}>
                          <span>Notion에 업로드 중... {uploadFile?.name}</span>
                          <span style={{ fontWeight: 700, color: C.primary }}>{uploadProgress}%</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 4, background: C.border, overflow: "hidden" }}>
                          <div style={{ height: "100%", borderRadius: 4, background: C.primary, width: `${uploadProgress}%`, transition: "width 0.2s" }} />
                        </div>
                      </div>
                    )}
                    <p style={{ fontSize: 10, color: "#92400E", margin: "6px 0 0", background: "#FEF3C7", borderRadius: 6, padding: "4px 8px", display: "inline-block" }}>
                      ⚠️ 100MB 초과 또는 .exe .pkg .dmg .msi .bat .app 등 실행파일은 업로드 불가 →{" "}
                      <a href={selVersion ? notionUrl(selVersion.id) : "#"} target="_blank" rel="noopener noreferrer"
                        style={{ color: "#92400E", fontWeight: 700 }}>Notion에서 직접 첨부</a>
                      {" "}또는 외부 URL 사용
                    </p>
                  </div>

                  {/* 방법 2: 외부 URL */}
                  <div>
                    <p style={{ fontSize: 11, color: C.text4, margin: "0 0 6px" }}>방법 2 — 외부 URL 붙여넣기 (대용량 설치파일, 사내 파일 서버 등)</p>
                    <input
                      style={{ ...iStyle, background: uploadFile ? "#f1f5f9" : "#fff" }}
                      value={docForm.externalFileUrl}
                      onChange={e => {
                        setDocForm(f => ({ ...f, externalFileUrl: e.target.value }));
                        if (e.target.value) setUploadFile(null);
                      }}
                      placeholder="https://... 또는 \\\\서버\공유폴더\파일.exe"
                      disabled={!!uploadFile}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.text2, cursor: "pointer" }}>
                    <input type="checkbox" checked={docForm.visible} onChange={e => setDocForm(f => ({ ...f, visible: e.target.checked }))} /> 즉시 공개
                  </label>
                  <Field label="순서"><input type="number" style={{ ...iStyle, width: 72 }} value={docForm.order} onChange={e => setDocForm(f => ({ ...f, order: +e.target.value }))} /></Field>
                </div>
              </FormCard>
            )}

            {docs.length === 0 ? (
              <div style={{ textAlign: "center", padding: 48, color: C.text4, fontSize: 13, background: "#f8fafc", borderRadius: 16 }}>
                등록된 파일이 없습니다.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {docs.map(doc => (
                  <div key={doc.id} style={{ padding: "12px 16px", borderRadius: 12, border: `1px solid ${C.border}`, background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: doc.type === "설치파일" ? "#FEF3C7" : "#EFF6FF", color: doc.type === "설치파일" ? "#92400E" : C.brand }}>
                          {doc.type}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: 13, color: C.text1 }}>{doc.name}</span>
                        {doc.fileUrl ? (
                          <a href={`/api/sw-docs/${doc.id}/file`} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "#D1FAE5", color: "#065F46", fontWeight: 700, textDecoration: "none" }}>
                            파일 ↗
                          </a>
                        ) : (
                          <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "#FEF3C7", color: "#92400E", fontWeight: 700 }}>미첨부</span>
                        )}
                      </div>
                      {doc.description && <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>{doc.description}</div>}
                    </div>
                    <div style={{ display: "flex", gap: 4, shrink: 0 } as React.CSSProperties}>
                      <button onClick={() => { setEditDoc(doc); setAddingDoc(false); setUploadFile(null); setDocForm({ name: doc.name, type: doc.type, description: doc.description, visible: doc.visible, order: doc.order, externalFileUrl: "" }); }}
                        style={{ padding: "4px 10px", borderRadius: 6, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", background: "#e0f2fe", color: "#0369a1" }}>수정</button>
                      <button onClick={() => toggleDocVisible(doc)}
                        style={{ padding: "4px 10px", borderRadius: 6, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", background: doc.visible ? "#d1fae5" : "#f1f5f9", color: doc.visible ? "#065f46" : C.text3 }}>
                        {doc.visible ? "공개" : "숨김"}
                      </button>
                      <button onClick={() => delDoc(doc)}
                        style={{ padding: "4px 10px", borderRadius: 6, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", background: C.dangerSoft, color: C.danger }}>삭제</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
