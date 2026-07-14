"use client";

import { useEffect, useRef, useState, useCallback, useMemo, Suspense } from "react";
import QRCode from "qrcode";
import type { Notice, Course, SwVersion, SwDoc, Manual } from "@/types/portal";
import type { AuditLog } from "@/lib/portal-store";
import type { SwItem } from "@/types";
import { safeJson } from "@/lib/fetch-json";

/* ── 색상 토큰 — 브랜드 앰버로 통일, CSS 변수 참조 (다크모드는 .portal-dark로 자동 대응) ── */
const C = {
  brand:       "var(--brand)",
  primary:     "var(--brand)",
  primarySoft: "var(--brand-soft)",
  text1:       "var(--portal-text)",
  text2:       "var(--portal-text-2)",
  text3:       "var(--portal-text-3)",
  text4:       "var(--portal-text-4)",
  border:      "var(--portal-border)",
  bg:          "var(--portal-bg)",
  danger:      "var(--state-risk)",
  dangerSoft:  "var(--state-risk-soft)",
} as const;

type ManageTab = "notices" | "courses" | "swdb" | "audit" | "swresources" | "manuals";

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
      .then(r => safeJson(r))
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
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, gap: 10 }}>
        <span className="animate-spin" style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${C.border}`, borderTopColor: C.primary, display: "inline-block" }} />
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

  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem("portal-dark");
    if (saved !== null) return saved === "1";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  function toggleDark() {
    setDarkMode(d => {
      const next = !d;
      localStorage.setItem("portal-dark", next ? "1" : "0");
      document.documentElement.classList.toggle("portal-dark", next);
      document.documentElement.classList.remove("admin-dark");
      window.dispatchEvent(new CustomEvent("portal-dark-change", { detail: next }));
      return next;
    });
  }

  const TABS: { id: ManageTab; label: string }[] = [
    { id: "notices",     label: "공지사항"   },
    { id: "courses",     label: "교육과정"   },
    { id: "swresources", label: "SW 자료실"  },
    { id: "swdb",        label: "SW 검색"    },
    { id: "manuals",     label: "매뉴얼"     },
    { id: "audit",       label: "감사 로그"  },
  ];

  async function handleLogout() {
    await fetch("/api/admin/auth", { method: "DELETE" });
    window.location.href = "/admin/login";
  }

  return (
    <div className={`flex min-h-screen${darkMode ? " portal-dark" : ""}`} style={{ background: C.bg }}>
      {/* ── 좌측 사이드바 (포털·어드민과 동일한 레이아웃 구조) ── */}
      <aside style={{ width: 240, flexShrink: 0, background: "var(--portal-surface)", borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "20px 18px" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: C.primary, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 11, flexShrink: 0 }}>SW</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: C.text1 }}>포털 관리모드</div>
            <div style={{ fontSize: 10.5, color: C.text4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{session.name} ({session.userId})</div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: "4px 12px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="transition-colors"
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", width: "100%", textAlign: "left",
                borderRadius: 0, border: "none", borderLeft: `2px solid ${tab === t.id ? C.brand : "transparent"}`,
                fontSize: 13, cursor: "pointer",
                background: tab === t.id ? C.bg : "transparent",
                color:      tab === t.id ? C.text1 : C.text3,
                fontWeight: tab === t.id ? 700 : 500,
              }}>
              {t.label}
            </button>
          ))}
        </nav>

        <div style={{ padding: 14, borderTop: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 6 }}>
          <button onClick={toggleDark}
            className="hover:brightness-95 transition-all"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 10px", borderRadius: 8, background: C.bg, color: C.text3, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            {darkMode ? "라이트 모드" : "다크 모드"}
          </button>
          <button onClick={handleLogout}
            className="hover:brightness-95 transition-all"
            style={{ padding: "8px 10px", borderRadius: 8, background: C.dangerSoft, color: C.danger, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            로그아웃
          </button>
        </div>
      </aside>

      {/* ── 메인 콘텐츠 ── */}
      <main style={{ flex: 1, minWidth: 0, padding: "32px 28px", overflowY: "auto" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto" }}>
          {tab === "notices"     && <NoticesPanel      />}
          {tab === "courses"     && <CoursesPanel      />}
          {tab === "swresources" && <SwResourcesPanel  />}
          {tab === "swdb"        && <SwPanel           />}
          {tab === "manuals"     && <ManualsPanel      />}
          {tab === "audit"       && <AuditPanel        />}
        </div>
      </main>
    </div>
  );
}

/* ── 공통 컴포넌트 ── */
function SectionHeader({ title, count, onAdd }: { title: string; count: number; onAdd: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24, paddingBottom: 20, borderBottom: `1px solid ${C.border}` }}>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: C.text1, margin: "0 0 4px", letterSpacing: "-0.01em" }}>{title}</h2>
        <p style={{ fontSize: 13, color: C.text3, margin: 0 }}>
          총 <strong style={{ color: C.text2, fontWeight: 700 }}>{count}</strong>건
        </p>
      </div>
      <button onClick={onAdd}
        className="hover:brightness-105 transition-all"
        style={{ padding: "10px 16px", borderRadius: 12, background: C.primary, color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 15, lineHeight: 1 }}>+</span> 새로 추가
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.text3, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.03em" }}>{label}</label>
      {children}
    </div>
  );
}

const iStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 13, outline: "none", background: "var(--portal-surface)", fontFamily: "inherit" };

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
    fetch("/api/notices?all=1").then(r => safeJson(r)).then(res => setItems(res.data ?? [])).finally(() => setLoading(false));
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
            <Field label="날짜"><div style={{ display: "flex", alignItems: "center", gap: 4 }}><input type="date" style={{ ...iStyle, flex: 1, width: "auto" }} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />{form.date && <button type="button" onClick={() => setForm(f => ({ ...f, date: "" }))} style={{ color: "var(--portal-text-4)", fontSize: 18, lineHeight: 1, padding: "0 2px", background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}>×</button>}</div></Field>
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
    fetch("/api/courses?all=1").then(r => safeJson(r)).then(res => setItems(res.data ?? [])).finally(() => setLoading(false));
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
            <Field label="마감일"><div style={{ display: "flex", alignItems: "center", gap: 4 }}><input type="date" style={{ ...iStyle, flex: 1, width: "auto" }} value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />{form.deadline && <button type="button" onClick={() => setForm(f => ({ ...f, deadline: "" }))} style={{ color: "var(--portal-text-4)", fontSize: 18, lineHeight: 1, padding: "0 2px", background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}>×</button>}</div></Field>
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
            title={c.title} sub={`${c.duration ? c.duration : ""}${c.deadline ? ` · 마감 ${c.deadline}` : ""}`}
            onToggle={() => toggleVisible(c)} onDelete={() => del(c.id, c.title)} />
        ))}
      </ItemList>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   SW 검색 패널
══════════════════════════════════════════════════════ */
function SwPanel() {
  const [items,     setItems]     = useState<SwItem[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [adding,    setAdding]    = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [editing,   setEditing]   = useState<SwItem | null>(null);
  const [filter,    setFilter]    = useState<"all" | SwItem["status"]>("all");

  const defaultForm = { name: "", vendor: "", category: "", status: "conditional" as SwItem["status"], description: "", alternatives: "", mandatory: false, officialUrl: "" };
  const [form, setForm] = useState(defaultForm);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/sw-db").then(r => safeJson(r)).then(res => setItems(res.data ?? [])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  function startAdd() { setForm(defaultForm); setEditing(null); setAdding(true); }
  function startEdit(item: SwItem) {
    setForm({ name: item.name, vendor: item.vendor, category: item.category, status: item.status, description: item.description, alternatives: item.alternatives.join(", "), mandatory: item.mandatory, officialUrl: item.officialUrl ?? "" });
    setEditing(item);
    setAdding(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      // officialUrl을 빈 문자열 그대로 전송해야 기존 값이 올바르게 덮어씌워짐
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
    approved:    { text: "승인",   bg: "var(--state-positive-soft)", color: "var(--state-positive)" },
    banned:      { text: "금지",   bg: "var(--state-risk-soft)", color: "var(--state-risk)" },
    conditional: { text: "조건부", bg: "var(--state-caution-soft)", color: "var(--state-caution)" },
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
            style={{ padding: "6px 14px", borderRadius: 12, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer",
              background: filter === f.key ? C.primary : "var(--portal-surface)",
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
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.text2, cursor: "pointer" }}>
            <input type="checkbox" checked={form.mandatory} onChange={e => setForm(f => ({ ...f, mandatory: e.target.checked }))} /> 필수 설치 SW
          </label>
        </FormCard>
      )}

      <ItemList loading={loading} empty="아직 등록된 SW가 없습니다.">
        {filtered.map(sw => {
          const st = STATUS_STYLE[sw.status] ?? { text: sw.status, bg: C.bg, color: C.text3 };
          return (
            <div key={sw.id} className="hover:shadow-sm transition-shadow" style={{ background: "var(--portal-surface)", borderRadius: 12, padding: 20, display: "flex", alignItems: "center", gap: 16, border: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: st.bg, color: st.color, flexShrink: 0 }}>{st.text}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: C.text1, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {sw.name}
                  {sw.mandatory && <span style={{ marginLeft: 6, fontSize: 10, padding: "2px 6px", borderRadius: 4, background: C.primarySoft, color: C.primary }}>필수</span>}
                </p>
                <p style={{ fontSize: 11, color: C.text4, margin: "4px 0 0" }}>
                  {sw.vendor}{sw.category ? ` · ${sw.category}` : ""}
                  {sw.alternatives.length ? ` · 대체: ${sw.alternatives.join(", ")}` : ""}
                  {sw.officialUrl ? " · 공식링크" : ""}
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
      .then(r => safeJson(r))
      .then(res => setLogs(res.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  const ACTION_STYLE: Record<AuditLog["action"], { label: string; bg: string; color: string }> = {
    create: { label: "등록", bg: "var(--state-positive-soft)", color: "var(--state-positive)" },
    update: { label: "수정", bg: "var(--state-caution-soft)", color: "var(--state-caution)" },
    delete: { label: "삭제", bg: C.dangerSoft, color: C.danger },
    "bulk-update": { label: "일괄수정", bg: "var(--state-caution-soft)", color: "var(--state-caution)" },
  };

  const TARGET_LABEL: Partial<Record<AuditLog["target"], string>> = {
    notices: "공지사항", courses: "교육과정", swdb: "SW 검색", swresources: "SW 자료실", manuals: "매뉴얼",
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
        <div style={{ textAlign: "center", padding: 64, background: "var(--portal-surface)", borderRadius: 12, border: `1px solid ${C.border}`, color: C.text4, fontSize: 13 }}>
          아직 기록된 활동이 없습니다.
        </div>
      ) : (
        <div style={{ background: "var(--portal-surface)", borderRadius: 12, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {["일시", "관리자", "액션", "대상", "항목", "상세"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.text4, textTransform: "uppercase", letterSpacing: ".04em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => {
                const as = ACTION_STYLE[log.action];
                return (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors" style={{ borderBottom: i < logs.length - 1 ? `1px solid var(--portal-border)` : "none" }}>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: C.text3, whiteSpace: "nowrap" }}>{formatTime(log.timestamp)}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.text1 }}>{log.adminName}</span>
                      <span style={{ fontSize: 11, color: C.text4, marginLeft: 4 }}>({log.adminId})</span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: as.bg, color: as.color }}>{as.label}</span>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: C.text3 }}>{TARGET_LABEL[log.target]}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: C.text2, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.itemTitle}</td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: C.text3, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.detail ?? "—"}</td>
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
    <div style={{ background: "var(--portal-surface)", borderRadius: 12, padding: 24, marginBottom: 24, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.primary}` }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text1, margin: "0 0 16px", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.primary, display: "inline-block" }} />
        {title}
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>{children}</div>
      <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
        <button onClick={onSave} disabled={saving || disabled}
          className="hover:brightness-105 transition-all"
          style={{ padding: "10px 20px", borderRadius: 12, background: C.primary, color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: (saving || disabled) ? "not-allowed" : "pointer", opacity: (saving || disabled) ? 0.5 : 1 }}>
          {saving ? "저장 중..." : "저장"}
        </button>
        <button onClick={onCancel}
          className="hover:brightness-95 transition-all"
          style={{ padding: "10px 20px", borderRadius: 12, background: C.bg, color: C.text3, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          취소
        </button>
      </div>
    </div>
  );
}

function ItemList({ loading, empty, children }: { loading: boolean; empty: string; children: React.ReactNode }) {
  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 56, color: C.text4, fontSize: 13, gap: 10 }}>
      <span className="animate-spin" style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${C.border}`, borderTopColor: C.primary, display: "inline-block" }} />
      불러오는 중...
    </div>
  );
  const count = Array.isArray(children) ? children.length : (children ? 1 : 0);
  if (!count) return (
    <div style={{ textAlign: "center", padding: 64, background: "var(--portal-surface)", borderRadius: 12, border: `1px dashed ${C.border}` }}>
      <div style={{ width: 40, height: 40, borderRadius: "50%", background: C.primarySoft, color: C.primary, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontSize: 18 }}>—</div>
      <p style={{ color: C.text3, fontSize: 13, margin: 0 }}>{empty}</p>
    </div>
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
    <div className="hover:shadow-sm transition-shadow"
      style={{ background: "var(--portal-surface)", borderRadius: 12, padding: 20, display: "flex", alignItems: "center", gap: 16, border: `1px solid ${C.border}`, opacity: visible ? 1 : 0.55 }}>
      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: badge.bg, color: badge.color, flexShrink: 0 }}>{badge.text}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: C.text1, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</p>
        {sub && <p style={{ fontSize: 11, color: C.text4, margin: "4px 0 0" }}>{sub}</p>}
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button onClick={onToggle}
          className="hover:brightness-95 transition-all"
          style={{ padding: "6px 12px", borderRadius: 8, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", background: visible ? "var(--state-positive-soft)" : C.bg, color: visible ? "var(--state-positive)" : C.text3 }}>
          {visible ? "공개중" : "숨김"}
        </button>
        <button onClick={onDelete}
          className="hover:brightness-95 transition-all"
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
  const [lastCreatedDocId, setLastCreatedDocId] = useState<string | null>(null);

  const [verSearch,    setVerSearch]    = useState("");
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  const BLANK_VER = { name: "", version: "", category: "", tier: "업무용" as SwVersion["tier"], os: "", description: "", visible: true, order: 0 };
  const BLANK_DOC = { name: "", type: "설치파일", description: "", visible: true, order: 0, externalFileUrl: "" };
  const [verForm, setVerForm] = useState(BLANK_VER);
  const [docForm, setDocForm] = useState(BLANK_DOC);

  const loadVersions = useCallback(() => {
    setLoading(true);
    fetch("/api/sw-versions?all=1").then(r => safeJson(r))
      .then(res => setVersions(res.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadVersions(); }, [loadVersions]);

  const loadDocs = useCallback((verId: string) => {
    fetch(`/api/sw-docs?versionId=${verId}&all=1`).then(r => safeJson(r))
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

        const fd = new FormData();
        fd.append("file", uploadFile, uploadFile.name);

        const res = await fetch("/api/sw-docs/upload", { method: "POST", body: fd });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(errData.error || "업로드 실패");
        }
        const data = await res.json();
        fileUploadId = data.fileUploadId;
        setUploading(false);
      }

      const externalFileUrl = docForm.externalFileUrl?.trim() || undefined;

      let createdId: string | undefined;
      if (editDoc) {
        await fetch("/api/sw-docs", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ _action: "update", id: editDoc.id, data: { ...docForm, fileUploadId, externalFileUrl } }) });
      } else {
        const createRes = await fetch("/api/sw-docs", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...docForm, versionId: selVersion.id, fileUploadId, externalFileUrl }) });
        const createData = await createRes.json();
        createdId = createData.id;
      }

      if (createdId && !fileUploadId && !externalFileUrl) {
        setLastCreatedDocId(createdId);
      }
    } catch (e) {
      alert(`저장 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false); setUploading(false);
    }
    setAddingDoc(false); setEditDoc(null); setDocForm(BLANK_DOC); setUploadFile(null);
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

  const verQuery = verSearch.trim().toLowerCase();
  const filteredVersions = verQuery
    ? versions.filter(v => `${v.name} ${v.version} ${v.category} ${v.os.join(" ")}`.toLowerCase().includes(verQuery))
    : versions;
  const groupedVersions = useMemo(() => {
    const map = new Map<string, SwVersion[]>();
    for (const v of filteredVersions) {
      const cat = v.category || "기타";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(v);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "ko"));
  }, [filteredVersions]);

  function toggleCat(cat: string) {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24, alignItems: "start" }}>

      {/* ── 왼쪽: SW 버전 목록 ── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: C.text1, margin: "0 0 2px" }}>SW 버전</h2>
            <p style={{ fontSize: 12, color: C.text3, margin: 0 }}>총 {verQuery ? `${filteredVersions.length} / ${versions.length}` : versions.length}개</p>
          </div>
          <button onClick={() => { setAddingVer(true); setEditVer(null); setVerForm(BLANK_VER); }}
            style={{ padding: "7px 12px", borderRadius: 10, background: C.primary, color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            + 추가
          </button>
        </div>

        <input type="text" value={verSearch} onChange={e => setVerSearch(e.target.value)}
          placeholder="SW명, 버전, 카테고리 검색..." style={{ ...iStyle, marginBottom: 12 }} />

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
            <div style={grid2}>
              <Field label="구분">
                <select style={iStyle} value={verForm.tier} onChange={e => setVerForm(f => ({ ...f, tier: e.target.value as SwVersion["tier"] }))}>
                  <option value="업무용">업무용</option>
                  <option value="무료프로그램">무료프로그램 (신청 없이 바로 다운로드)</option>
                </select>
              </Field>
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
        ) : filteredVersions.length === 0 ? (
          <div style={{ textAlign: "center", padding: 32, color: C.text4, fontSize: 13 }}>검색 결과가 없습니다.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {groupedVersions.map(([cat, items]) => {
              const expanded = !!verQuery || expandedCats.has(cat) || items.some(v => v.id === selVersion?.id);
              return (
                <div key={cat}>
                  <div onClick={() => toggleCat(cat)}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderRadius: 8, cursor: "pointer", userSelect: "none" }}>
                    <span style={{ fontSize: 11, color: C.text4, width: 12 }}>{expanded ? "▾" : "▸"}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: C.text2 }}>{cat}</span>
                    <span style={{ fontSize: 11, color: C.text4 }}>({items.length})</span>
                  </div>
                  {expanded && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 8, marginBottom: 6 }}>
                      {items.map(ver => (
                        <div key={ver.id} onClick={() => setSelVersion(selVersion?.id === ver.id ? null : ver)}
                          style={{ padding: "10px 14px", borderRadius: 12, border: `2px solid ${selVersion?.id === ver.id ? C.primary : C.border}`, background: selVersion?.id === ver.id ? C.primarySoft : "var(--portal-surface)", cursor: "pointer", transition: "all .15s" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 13, color: C.text1 }}>{ver.name}</div>
                              <div style={{ fontSize: 11, color: C.text3 }}>v{ver.version} · {ver.category}</div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                                <span style={{ fontSize: 11, color: ver.visible ? "var(--state-positive)" : C.text4 }}>{ver.visible ? "공개" : "숨김"}</span>
                                {ver.tier === "무료프로그램" && (
                                  <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 999, background: "var(--state-positive-soft)", color: "var(--state-positive)" }}>무료</span>
                                )}
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                              <button onClick={() => { setEditVer(ver); setAddingVer(false); setVerForm({ name: ver.name, version: ver.version, category: ver.category, tier: ver.tier, os: ver.os.join(", "), description: ver.description, visible: ver.visible, order: ver.order }); }}
                                style={{ padding: "3px 8px", borderRadius: 6, border: "none", fontSize: 10, fontWeight: 700, cursor: "pointer", background: "var(--state-progress-soft)", color: "var(--state-progress)" }}>수정</button>
                              <button onClick={() => delVer(ver)}
                                style={{ padding: "3px 8px", borderRadius: 6, border: "none", fontSize: 10, fontWeight: 700, cursor: "pointer", background: C.dangerSoft, color: C.danger }}>삭제</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 오른쪽: 파일/문서 목록 ── */}
      <div>
        {!selVersion ? (
          <div style={{ textAlign: "center", padding: 64, color: C.text4, fontSize: 13, background: "var(--portal-bg)", borderRadius: 12, border: `1px dashed ${C.border}` }}>
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
                  총 {docs.length}개 · 대용량 파일은 각 문서의 Notion 페이지에서 직접 첨부
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
                <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 16, background: "var(--portal-bg)", display: "flex", flexDirection: "column", gap: 14 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: C.text2, margin: 0 }}>파일 첨부</p>

                  {/* 현재 첨부 파일 표시 (수정 시) */}
                  {editDoc?.fileUrl && !uploadFile && !docForm.externalFileUrl && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.text3 }}>
                      <span style={{ padding: "2px 8px", borderRadius: 6, background: "var(--state-positive-soft)", color: "var(--state-positive)", fontWeight: 700, fontSize: 11 }}>현재 파일</span>
                      <span>{editDoc.fileName || editDoc.name}</span>
                      <a href={`/api/sw-docs/${editDoc.id}/file`} target="_blank" rel="noopener noreferrer"
                        style={{ color: C.primary, fontSize: 11 }}>미리보기</a>
                    </div>
                  )}

                  {/* A. 소용량 직접 업로드 (≤4MB) */}
                  <div>
                    <p style={{ fontSize: 11, color: C.text4, margin: "0 0 6px" }}>A. 직접 업로드 (PDF, 문서 등 4MB 이하)</p>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: docForm.externalFileUrl ? "var(--portal-bg)" : "var(--portal-surface)", cursor: docForm.externalFileUrl ? "not-allowed" : "pointer", fontSize: 12, color: C.text2, fontWeight: 600, opacity: docForm.externalFileUrl ? 0.5 : 1 }}>
                      파일 선택
                      <input type="file" style={{ display: "none" }} disabled={!!docForm.externalFileUrl} onChange={e => {
                        const f = e.target.files?.[0] ?? null;
                        if (!f) return;
                        const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
                        const BLOCKED = ["exe", "pkg", "dmg", "msi", "bat", "sh", "app", "cmd", "com", "scr"];
                        if (BLOCKED.includes(ext)) {
                          alert(`실행파일(.${ext})은 직접 업로드할 수 없습니다.\n\nZIP으로 압축 후 업로드하거나, Notion에서 직접 첨부하세요.`);
                          e.target.value = ""; return;
                        }
                        if (f.size > 4 * 1024 * 1024) {
                          alert(`4MB를 초과하는 파일은 직접 업로드할 수 없습니다. (${(f.size / 1024 / 1024).toFixed(1)}MB)\n\n아래 "Notion에서 직접 첨부" 또는 "외부 URL"을 사용하세요.`);
                          e.target.value = ""; return;
                        }
                        setUploadFile(f);
                        setDocForm(form => ({ ...form, externalFileUrl: "" }));
                      }} />
                    </label>
                    {uploadFile && !uploading && (
                      <span style={{ marginLeft: 10, fontSize: 12, color: "var(--state-positive)", fontWeight: 600 }}>
                        {uploadFile.name} ({(uploadFile.size / 1024 / 1024).toFixed(1)} MB)
                        <button type="button" onClick={() => setUploadFile(null)}
                          style={{ marginLeft: 6, color: C.danger, background: "none", border: "none", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>×</button>
                      </span>
                    )}
                    {uploading && (
                      <div style={{ marginTop: 8, fontSize: 11, color: C.primary, fontWeight: 600 }}>
                        Notion에 업로드 중... {uploadFile?.name}
                      </div>
                    )}
                  </div>

                  {/* B. Notion에서 직접 첨부 (대용량 권장) */}
                  <div style={{ padding: "10px 14px", borderRadius: 10, background: "var(--state-progress-soft)", border: `1px solid var(--state-progress)` }}>
                    <p style={{ fontSize: 11, color: C.brand, margin: "0 0 4px", fontWeight: 700 }}>B. 대용량 파일 — Notion에서 직접 첨부 (권장)</p>
                    <p style={{ fontSize: 11, color: C.text3, margin: 0 }}>
                      먼저 이 폼을 저장하면, 목록에서 해당 문서의 Notion 페이지 링크가 표시됩니다.
                      {editDoc && (
                        <>
                          {" "}→{" "}
                          <a href={notionUrl(editDoc.id)} target="_blank" rel="noopener noreferrer"
                            style={{ color: C.primary, fontWeight: 700 }}>이 문서의 Notion 페이지 열기 ↗</a>
                        </>
                      )}
                    </p>
                    <p style={{ fontSize: 10, color: C.text4, margin: "4px 0 0" }}>
                      설치파일(.exe, .msi 등), 4MB 초과 파일은 Notion 페이지에서 "파일과 미디어" 속성에 직접 첨부하세요.
                    </p>
                  </div>

                  {/* C. 외부 URL */}
                  <div>
                    <p style={{ fontSize: 11, color: C.text4, margin: "0 0 6px" }}>C. 외부 URL (사내 파일 서버, 대용량 다운로드 링크 등)</p>
                    <input
                      style={{ ...iStyle, background: uploadFile ? "var(--portal-bg)" : "var(--portal-surface)" }}
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

            {/* 방금 파일 없이 생성된 문서 → Notion 첨부 안내 */}
            {lastCreatedDocId && (
              <div style={{ padding: "10px 16px", borderRadius: 12, background: "var(--state-progress-soft)", border: `1px solid var(--state-progress)`, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: C.brand }}>
                  문서가 생성되었습니다. 파일을 첨부하려면 →
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <a href={notionUrl(lastCreatedDocId)} target="_blank" rel="noopener noreferrer"
                    style={{ padding: "5px 12px", borderRadius: 8, background: C.primary, color: "#fff", fontSize: 11, fontWeight: 700, textDecoration: "none" }}>
                    Notion에서 파일 첨부 ↗
                  </a>
                  <button onClick={() => setLastCreatedDocId(null)}
                    style={{ padding: "5px 8px", borderRadius: 8, background: "transparent", border: "none", color: C.text4, fontSize: 14, cursor: "pointer" }}>×</button>
                </div>
              </div>
            )}

            {docs.length === 0 ? (
              <div style={{ textAlign: "center", padding: 48, color: C.text4, fontSize: 13, background: "var(--portal-bg)", borderRadius: 12 }}>
                등록된 파일이 없습니다.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {docs.map(doc => (
                  <div key={doc.id} style={{ padding: "12px 16px", borderRadius: 12, border: `1px solid ${C.border}`, background: "var(--portal-surface)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: doc.type === "설치파일" ? "var(--state-caution-soft)" : "var(--state-progress-soft)", color: doc.type === "설치파일" ? "var(--state-caution)" : C.brand }}>
                          {doc.type}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: 13, color: C.text1 }}>{doc.name}</span>
                        {doc.fileUrl ? (
                          <a href={`/api/sw-docs/${doc.id}/file`} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "var(--state-positive-soft)", color: "var(--state-positive)", fontWeight: 700, textDecoration: "none" }}>
                            파일 ↗
                          </a>
                        ) : (
                          <a href={notionUrl(doc.id)} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "var(--state-caution-soft)", color: "var(--state-caution)", fontWeight: 700, textDecoration: "none" }}>
                            미첨부 — Notion에서 첨부 ↗
                          </a>
                        )}
                      </div>
                      {doc.description && <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>{doc.description}</div>}
                    </div>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      <button onClick={() => { setEditDoc(doc); setAddingDoc(false); setUploadFile(null); setDocForm({ name: doc.name, type: doc.type, description: doc.description, visible: doc.visible, order: doc.order, externalFileUrl: "" }); }}
                        style={{ padding: "4px 10px", borderRadius: 6, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", background: "var(--state-progress-soft)", color: "var(--state-progress)" }}>수정</button>
                      <button onClick={() => toggleDocVisible(doc)}
                        style={{ padding: "4px 10px", borderRadius: 6, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", background: doc.visible ? "var(--state-positive-soft)" : "var(--portal-bg)", color: doc.visible ? "var(--state-positive)" : C.text3 }}>
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

/* ══════════════════════════════════════════════════════
   매뉴얼 패널
══════════════════════════════════════════════════════ */
function ManualsPanel() {
  const [items,      setItems]      = useState<Manual[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [adding,     setAdding]     = useState(false);
  const [editing,    setEditing]    = useState<Manual | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading,  setUploading]  = useState(false);

  const BLANK = { title: "", slug: "", category: "", description: "", visible: true, order: 0 };
  const [form, setForm] = useState(BLANK);

  const [qrItem, setQrItem] = useState<Manual | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!qrItem || !qrCanvasRef.current) return;
    const url = `${window.location.origin}/manual/${qrItem.slug}`;
    QRCode.toCanvas(qrCanvasRef.current, url, { width: 220, margin: 2 });
  }, [qrItem]);

  function downloadQrPng() {
    if (!qrItem || !qrCanvasRef.current) return;
    const link = document.createElement("a");
    link.download = `${qrItem.title}-QR.png`;
    link.href = qrCanvasRef.current.toDataURL("image/png");
    link.click();
  }

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/manuals?all=1").then(r => safeJson(r)).then(res => setItems(res.data ?? [])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  function startAdd() { setForm(BLANK); setEditing(null); setUploadFile(null); setAdding(true); }
  function startEdit(item: Manual) {
    setForm({ title: item.title, slug: item.slug, category: item.category, description: item.description, visible: item.visible, order: item.order });
    setEditing(item); setUploadFile(null); setAdding(true);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.slug.trim()) return;
    setSaving(true);
    try {
      let fileUploadId: string | undefined;
      if (uploadFile) {
        setUploading(true);
        const fd = new FormData();
        fd.append("file", uploadFile, uploadFile.name);
        const res = await fetch("/api/manuals/upload", { method: "POST", body: fd });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(errData.error || "업로드 실패");
        }
        const data = await res.json();
        fileUploadId = data.fileUploadId;
        setUploading(false);
      }

      const body = editing
        ? { _action: "update", id: editing.id, data: { ...form, fileUploadId } }
        : { ...form, fileUploadId };
      const res = await fetch("/api/manuals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(errData.error || "저장 실패");
      }

      setAdding(false); setEditing(null); setForm(BLANK); setUploadFile(null);
      load();
    } catch (e) {
      alert(`저장 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false); setUploading(false);
    }
  }

  async function del(item: Manual) {
    if (!confirm(`"${item.title}" 을(를) 삭제하시겠습니까?`)) return;
    await fetch("/api/manuals", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _action: "delete", id: item.id }) });
    load();
  }

  async function toggleVisible(item: Manual) {
    await fetch("/api/manuals", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _action: "update", id: item.id, data: { visible: !item.visible } }) });
    load();
  }

  function copyLink(slug: string) {
    const url = `${window.location.origin}/manual/${slug}`;
    navigator.clipboard.writeText(url);
    alert(`링크가 복사되었습니다.\n${url}`);
  }

  return (
    <div>
      <SectionHeader title="매뉴얼 관리" count={items.length} onAdd={startAdd} />

      {(adding || editing) && (
        <FormCard title={editing ? "매뉴얼 수정" : "새 매뉴얼"} onCancel={() => { setAdding(false); setEditing(null); setUploadFile(null); }} onSave={handleSave} saving={saving || uploading} disabled={!form.title.trim() || !form.slug.trim()}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="제목 *"><input style={iStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="예: 설치 가이드" /></Field>
            <Field label="슬러그 (링크 주소) *">
              <input style={iStyle} value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
                placeholder="예: install-guide" />
            </Field>
          </div>
          <p style={{ fontSize: 11, color: C.text4, margin: "-8px 0 0" }}>
            링크: {typeof window !== "undefined" ? window.location.origin : ""}/manual/{form.slug || "..."}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="카테고리"><input style={iStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="예: 설치, 운영" /></Field>
            <Field label="순서"><input type="number" style={iStyle} value={form.order} onChange={e => setForm(f => ({ ...f, order: +e.target.value }))} /></Field>
          </div>
          <Field label="설명 (관리자 목록용)"><input style={iStyle} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="간단한 설명" /></Field>

          <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 16, background: "var(--portal-bg)", display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: C.text2, margin: 0 }}>HTML 파일 업로드 (4MB 이하)</p>

            {editing?.fileUrl && !uploadFile && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.text3 }}>
                <span style={{ padding: "2px 8px", borderRadius: 6, background: "var(--state-positive-soft)", color: "var(--state-positive)", fontWeight: 700, fontSize: 11 }}>현재 파일</span>
                <span>{editing.fileName || editing.title}</span>
                <a href={`/manual/${editing.slug}`} target="_blank" rel="noopener noreferrer" style={{ color: C.primary, fontSize: 11 }}>미리보기</a>
              </div>
            )}

            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: "var(--portal-surface)", cursor: "pointer", fontSize: 12, color: C.text2, fontWeight: 600, width: "fit-content" }}>
              HTML 파일 선택
              <input type="file" accept=".html,.htm" style={{ display: "none" }} onChange={e => {
                const f = e.target.files?.[0] ?? null;
                if (!f) return;
                const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
                if (ext !== "html" && ext !== "htm") {
                  alert("HTML 파일(.html, .htm)만 업로드할 수 있습니다.");
                  e.target.value = ""; return;
                }
                if (f.size > 4 * 1024 * 1024) {
                  alert(`4MB를 초과하는 파일은 업로드할 수 없습니다. (${(f.size / 1024 / 1024).toFixed(1)}MB)`);
                  e.target.value = ""; return;
                }
                setUploadFile(f);
              }} />
            </label>
            {uploadFile && !uploading && (
              <span style={{ fontSize: 12, color: "var(--state-positive)", fontWeight: 600 }}>
                {uploadFile.name} ({(uploadFile.size / 1024 / 1024).toFixed(1)} MB)
                <button type="button" onClick={() => setUploadFile(null)}
                  style={{ marginLeft: 6, color: C.danger, background: "none", border: "none", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>×</button>
              </span>
            )}
            {uploading && <div style={{ fontSize: 11, color: C.primary, fontWeight: 600 }}>업로드 중... {uploadFile?.name}</div>}
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.text2, cursor: "pointer" }}>
            <input type="checkbox" checked={form.visible} onChange={e => setForm(f => ({ ...f, visible: e.target.checked }))} /> 즉시 공개
          </label>
        </FormCard>
      )}

      <ItemList loading={loading} empty="아직 등록된 매뉴얼이 없습니다.">
        {items.map(item => (
          <div key={item.id} style={{ background: "var(--portal-surface)", borderRadius: 12, padding: 20, display: "flex", alignItems: "center", gap: 16, border: `1px solid ${C.border}`, opacity: item.visible ? 1 : 0.5 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {item.category && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: C.primarySoft, color: C.primary }}>{item.category}</span>
                )}
                <span style={{ fontWeight: 700, fontSize: 13, color: C.text1 }}>{item.title}</span>
                {!item.fileUrl && (
                  <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "var(--state-caution-soft)", color: "var(--state-caution)", fontWeight: 700 }}>파일 미첨부</span>
                )}
              </div>
              <p style={{ fontSize: 11, color: C.text4, margin: "4px 0 0", fontFamily: "monospace" }}>/manual/{item.slug}</p>
              {item.description && <p style={{ fontSize: 11, color: C.text3, margin: "2px 0 0" }}>{item.description}</p>}
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button onClick={() => copyLink(item.slug)}
                style={{ padding: "6px 12px", borderRadius: 8, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", background: "var(--portal-bg)", color: C.text2 }}>
                링크 복사
              </button>
              <button onClick={() => setQrItem(item)}
                style={{ padding: "6px 12px", borderRadius: 8, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", background: "var(--portal-bg)", color: C.text2 }}>
                QR 코드
              </button>
              <button onClick={() => startEdit(item)}
                style={{ padding: "6px 12px", borderRadius: 8, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", background: "var(--state-progress-soft)", color: "var(--state-progress)" }}>
                수정
              </button>
              <button onClick={() => toggleVisible(item)}
                style={{ padding: "6px 12px", borderRadius: 8, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", background: item.visible ? "var(--state-positive-soft)" : C.bg, color: item.visible ? "var(--state-positive)" : C.text3 }}>
                {item.visible ? "공개중" : "숨김"}
              </button>
              <button onClick={() => del(item)}
                style={{ padding: "6px 12px", borderRadius: 8, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", background: C.dangerSoft, color: C.danger }}>
                삭제
              </button>
            </div>
          </div>
        ))}
      </ItemList>

      {qrItem && (
        <div onClick={() => setQrItem(null)}
          style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)" }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: 300, background: "var(--portal-surface)", borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text1 }}>{qrItem.title}</span>
              <button onClick={() => setQrItem(null)}
                style={{ border: "none", background: "none", cursor: "pointer", fontSize: 16, color: C.text4, lineHeight: 1 }}>×</button>
            </div>
            <canvas ref={qrCanvasRef} />
            <button onClick={downloadQrPng}
              style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", background: C.brand, color: "#fff" }}>
              PNG로 다운로드
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

