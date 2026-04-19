"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { Notice, Course, Resource, ResourceCategory } from "@/types/portal";

/* ── 색상 (사용자 포털과 동일) ── */
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

type ManageTab = "notices" | "courses" | "resources";

/* ── 인증 세션 키 ── */
const SESSION_KEY = "portal_manage_auth";

function getManageKey(urlKey: string | null) {
  if (urlKey) sessionStorage.setItem("manage_url_key", urlKey);
  return sessionStorage.getItem("manage_url_key") ?? "";
}

/* ══════════════════════════════════════════════════════
   인증 화면
══════════════════════════════════════════════════════ */
function AuthScreen({ onAuth }: { onAuth: () => void }) {
  const [pw, setPw]     = useState("");
  const [err, setErr]   = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr("");
    const res = await fetch("/api/manage/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw, key: getManageKey(null) }),
    });
    setLoading(false);
    if (res.ok) {
      sessionStorage.setItem(SESSION_KEY, "true");
      onAuth();
    } else {
      setErr("비밀번호가 올바르지 않습니다.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
      <div className="bg-white rounded-[24px] p-10 w-full max-w-sm shadow-lg" style={{ border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-center mb-6">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-sm"
            style={{ background: C.primary }}>SW</div>
        </div>
        <h1 className="text-xl font-extrabold text-center mb-1" style={{ color: C.text1 }}>포털 관리모드</h1>
        <p className="text-sm text-center mb-8" style={{ color: C.text3 }}>비밀번호를 입력하세요</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            placeholder="관리 비밀번호"
            className="w-full px-4 py-3 rounded-xl border text-sm mb-3 outline-none focus:border-blue-500"
            style={{ borderColor: C.border }}
            autoFocus
          />
          {err && <p className="text-xs mb-3" style={{ color: C.danger }}>{err}</p>}
          <button type="submit" disabled={loading || !pw}
            className="w-full py-3 rounded-xl text-white font-bold text-sm transition-opacity disabled:opacity-50"
            style={{ background: C.primary }}>
            {loading ? "확인 중..." : "입장하기"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   메인 관리 페이지
══════════════════════════════════════════════════════ */
export default function ManagePage() {
  return (
    <Suspense>
      <ManagePageInner />
    </Suspense>
  );
}

function ManagePageInner() {
  const params = useSearchParams();
  const urlKey = params.get("key");

  const [authed,  setAuthed]  = useState(false);
  const [checked, setChecked] = useState(false);
  const [tab,     setTab]     = useState<ManageTab>("notices");

  useEffect(() => {
    if (urlKey) sessionStorage.setItem("manage_url_key", urlKey);
    const ok = sessionStorage.getItem(SESSION_KEY) === "true";
    setAuthed(ok);
    setChecked(true);
  }, [urlKey]);

  if (!checked) return null;
  if (!authed)  return <AuthScreen onAuth={() => setAuthed(true)} />;

  const TABS: { id: ManageTab; label: string }[] = [
    { id: "notices",   label: "공지사항" },
    { id: "courses",   label: "교육과정" },
    { id: "resources", label: "자료실"   },
  ];

  return (
    <div className="min-h-screen" style={{ background: C.bg }}>
      {/* 헤더 */}
      <header className="bg-white sticky top-0 z-40" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-xs"
              style={{ background: C.primary }}>SW</div>
            <span className="font-extrabold text-sm" style={{ color: C.text1 }}>포털 관리모드</span>
          </div>
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: C.bg }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="px-4 py-2 rounded-lg text-sm transition-all"
                style={{
                  background: tab === t.id ? "#fff" : "transparent",
                  color:      tab === t.id ? C.brand : C.text3,
                  fontWeight: tab === t.id ? 700 : 500,
                  boxShadow:  tab === t.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}>
                {t.label}
              </button>
            ))}
          </div>
          <button onClick={() => { sessionStorage.removeItem(SESSION_KEY); window.location.reload(); }}
            className="text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: C.dangerSoft, color: C.danger }}>
            로그아웃
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {tab === "notices"   && <NoticesPanel   />}
        {tab === "courses"   && <CoursesPanel   />}
        {tab === "resources" && <ResourcesPanel />}
      </main>
    </div>
  );
}

/* ── 공통 유틸 ── */
function manageKey() { return sessionStorage.getItem("manage_url_key") ?? ""; }

async function apiFetch(url: string, body: object) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-manage-key": manageKey() },
    body: JSON.stringify(body),
  });
}

function SectionHeader({ title, count, onAdd }: { title: string; count: number; onAdd: () => void }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-xl font-extrabold" style={{ color: C.text1 }}>{title}</h2>
        <p className="text-sm mt-0.5" style={{ color: C.text3 }}>총 {count}건</p>
      </div>
      <button onClick={onAdd}
        className="px-4 py-2.5 rounded-xl text-white text-sm font-bold transition-opacity hover:opacity-90"
        style={{ background: C.primary }}>
        + 새로 추가
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold mb-1.5" style={{ color: C.text3 }}>{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:border-blue-500 bg-white";
const inputStyle = { borderColor: C.border };

/* ══════════════════════════════════════════════════════
   공지사항 패널
══════════════════════════════════════════════════════ */
function NoticesPanel() {
  const [items,   setItems]   = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding,  setAdding]  = useState(false);
  const [form,    setForm]    = useState({ title: "", content: "", date: "", urgent: false, imageUrl: "", visible: true });
  const [saving,  setSaving]  = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/notices?all=1", { headers: { "x-manage-key": manageKey() } })
      .then(r => r.json())
      .then(res => setItems(res.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    await apiFetch("/api/notices", { ...form, date: form.date || new Date().toISOString().slice(0, 10) });
    setSaving(false);
    setAdding(false);
    setForm({ title: "", content: "", date: "", urgent: false, imageUrl: "", visible: true });
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("삭제하시겠습니까?")) return;
    await apiFetch("/api/notices", { _action: "delete", id });
    load();
  }

  async function toggleVisible(item: Notice) {
    await apiFetch("/api/notices", { _action: "update", id: item.id, data: { visible: !item.visible } });
    load();
  }

  return (
    <div>
      <SectionHeader title="공지사항 관리" count={items.length} onAdd={() => setAdding(true)} />

      {adding && (
        <div className="bg-white rounded-[20px] p-6 mb-6" style={{ border: `1px solid ${C.border}` }}>
          <h3 className="font-bold text-sm mb-4" style={{ color: C.text1 }}>새 공지사항</h3>
          <div className="space-y-4">
            <Field label="제목 *">
              <input className={inputCls} style={inputStyle} value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="공지 제목" />
            </Field>
            <Field label="내용">
              <textarea className={inputCls} style={{ ...inputStyle, minHeight: 100, resize: "vertical" }}
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="공지 내용" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="날짜">
                <input type="date" className={inputCls} style={inputStyle} value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </Field>
              <Field label="이미지 URL (Notion 첨부파일 URL)">
                <input className={inputCls} style={inputStyle} value={form.imageUrl}
                  onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} placeholder="https://..." />
              </Field>
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: C.text2 }}>
                <input type="checkbox" checked={form.urgent}
                  onChange={e => setForm(f => ({ ...f, urgent: e.target.checked }))} />
                긴급 공지
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: C.text2 }}>
                <input type="checkbox" checked={form.visible}
                  onChange={e => setForm(f => ({ ...f, visible: e.target.checked }))} />
                즉시 공개
              </label>
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button onClick={handleSave} disabled={saving || !form.title.trim()}
              className="px-5 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50"
              style={{ background: C.primary }}>
              {saving ? "저장 중..." : "저장"}
            </button>
            <button onClick={() => setAdding(false)}
              className="px-5 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: C.bg, color: C.text3 }}>
              취소
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12" style={{ color: C.text4 }}>불러오는 중...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 rounded-[20px]" style={{ background: "#fff", border: `1px solid ${C.border}`, color: C.text4 }}>
          아직 공지사항이 없습니다. 새로 추가해보세요.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(n => (
            <div key={n.id} className="bg-white rounded-[16px] p-5 flex items-center gap-4"
              style={{ border: `1px solid ${C.border}`, opacity: n.visible ? 1 : 0.5 }}>
              <span className="text-xs font-bold px-2 py-0.5 rounded-md shrink-0"
                style={n.urgent ? { background: C.dangerSoft, color: C.danger } : { background: C.bg, color: C.text3 }}>
                {n.urgent ? "긴급" : "안내"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: C.text1 }}>{n.title}</p>
                <p className="text-xs mt-0.5" style={{ color: C.text4 }}>{n.date}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => toggleVisible(n)}
                  className="text-xs px-3 py-1.5 rounded-lg font-bold transition-colors"
                  style={n.visible
                    ? { background: "#D1FAE5", color: "#065F46" }
                    : { background: C.bg,      color: C.text3 }}>
                  {n.visible ? "공개중" : "숨김"}
                </button>
                <button onClick={() => handleDelete(n.id)}
                  className="text-xs px-3 py-1.5 rounded-lg font-bold"
                  style={{ background: C.dangerSoft, color: C.danger }}>
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
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
  const [form,    setForm]    = useState({
    title: "", description: "", deadline: "", duration: "",
    courseUrl: "", category: "required" as Course["category"],
    thumbnailUrl: "", order: 0, visible: true,
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/courses?all=1", { headers: { "x-manage-key": manageKey() } })
      .then(r => r.json())
      .then(res => setItems(res.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    await apiFetch("/api/courses", { ...form, order: form.order || items.length });
    setSaving(false);
    setAdding(false);
    setForm({ title: "", description: "", deadline: "", duration: "", courseUrl: "", category: "required", thumbnailUrl: "", order: 0, visible: true });
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("삭제하시겠습니까?")) return;
    await apiFetch("/api/courses", { _action: "delete", id });
    load();
  }

  async function toggleVisible(item: Course) {
    await apiFetch("/api/courses", { _action: "update", id: item.id, data: { visible: !item.visible } });
    load();
  }

  const CAT_LABEL: Record<Course["category"], string> = {
    required: "필수교육", material: "SW활용자료", policy: "IT정책교육",
  };

  return (
    <div>
      <SectionHeader title="교육과정 관리" count={items.length} onAdd={() => setAdding(true)} />

      {adding && (
        <div className="bg-white rounded-[20px] p-6 mb-6" style={{ border: `1px solid ${C.border}` }}>
          <h3 className="font-bold text-sm mb-4" style={{ color: C.text1 }}>새 교육과정</h3>
          <div className="space-y-4">
            <Field label="제목 *">
              <input className={inputCls} style={inputStyle} value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="과정명" />
            </Field>
            <Field label="설명">
              <textarea className={inputCls} style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="과정 설명" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="카테고리">
                <select className={inputCls} style={inputStyle} value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value as Course["category"] }))}>
                  <option value="required">필수교육</option>
                  <option value="material">SW활용자료</option>
                  <option value="policy">IT정책교육</option>
                </select>
              </Field>
              <Field label="소요시간">
                <input className={inputCls} style={inputStyle} value={form.duration}
                  onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} placeholder="예: 45분" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="마감일">
                <input type="date" className={inputCls} style={inputStyle} value={form.deadline}
                  onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
              </Field>
              <Field label="순서">
                <input type="number" className={inputCls} style={inputStyle} value={form.order}
                  onChange={e => setForm(f => ({ ...f, order: Number(e.target.value) }))} />
              </Field>
            </div>
            <Field label="교육 URL">
              <input className={inputCls} style={inputStyle} value={form.courseUrl}
                onChange={e => setForm(f => ({ ...f, courseUrl: e.target.value }))} placeholder="https://..." />
            </Field>
            <Field label="썸네일 URL (Notion 첨부파일 URL)">
              <input className={inputCls} style={inputStyle} value={form.thumbnailUrl}
                onChange={e => setForm(f => ({ ...f, thumbnailUrl: e.target.value }))} placeholder="https://..." />
            </Field>
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: C.text2 }}>
              <input type="checkbox" checked={form.visible}
                onChange={e => setForm(f => ({ ...f, visible: e.target.checked }))} />
              즉시 공개
            </label>
          </div>
          <div className="flex gap-3 mt-5">
            <button onClick={handleSave} disabled={saving || !form.title.trim()}
              className="px-5 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50"
              style={{ background: C.primary }}>
              {saving ? "저장 중..." : "저장"}
            </button>
            <button onClick={() => setAdding(false)}
              className="px-5 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: C.bg, color: C.text3 }}>
              취소
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12" style={{ color: C.text4 }}>불러오는 중...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 rounded-[20px]" style={{ background: "#fff", border: `1px solid ${C.border}`, color: C.text4 }}>
          아직 등록된 교육과정이 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(c => (
            <div key={c.id} className="bg-white rounded-[16px] p-5 flex items-center gap-4"
              style={{ border: `1px solid ${C.border}`, opacity: c.visible ? 1 : 0.5 }}>
              <span className="text-xs font-bold px-2 py-0.5 rounded-md shrink-0"
                style={{ background: C.primarySoft, color: C.primary }}>{CAT_LABEL[c.category]}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: C.text1 }}>{c.title}</p>
                <p className="text-xs mt-0.5" style={{ color: C.text4 }}>
                  {c.duration && `⏱ ${c.duration}`}{c.deadline && ` · 마감 ${c.deadline}`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => toggleVisible(c)}
                  className="text-xs px-3 py-1.5 rounded-lg font-bold"
                  style={c.visible ? { background: "#D1FAE5", color: "#065F46" } : { background: C.bg, color: C.text3 }}>
                  {c.visible ? "공개중" : "숨김"}
                </button>
                <button onClick={() => handleDelete(c.id)}
                  className="text-xs px-3 py-1.5 rounded-lg font-bold"
                  style={{ background: C.dangerSoft, color: C.danger }}>
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
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
  const [form,    setForm]    = useState({
    title: "", category: "install" as ResourceCategory,
    fileUrl: "", fileType: "PDF", fileSize: "", description: "",
    updatedAt: "", order: 0, visible: true,
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/resources?all=1", { headers: { "x-manage-key": manageKey() } })
      .then(r => r.json())
      .then(res => setItems(res.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    await apiFetch("/api/resources", {
      ...form,
      updatedAt: form.updatedAt || new Date().toISOString().slice(0, 10),
      order: form.order || items.length,
    });
    setSaving(false);
    setAdding(false);
    setForm({ title: "", category: "install", fileUrl: "", fileType: "PDF", fileSize: "", description: "", updatedAt: "", order: 0, visible: true });
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("삭제하시겠습니까?")) return;
    await apiFetch("/api/resources", { _action: "delete", id });
    load();
  }

  async function toggleVisible(item: Resource) {
    await apiFetch("/api/resources", { _action: "update", id: item.id, data: { visible: !item.visible } });
    load();
  }

  const CAT_LABEL: Record<ResourceCategory, string> = {
    install: "설치가이드", policy: "정책문서", forms: "양식서식",
  };

  const FILE_TYPE_STYLE: Record<string, { bg: string; color: string }> = {
    PDF:  { bg: "#FEE2E2", color: "#B91C1C" },
    XLSX: { bg: "#D1FAE5", color: "#065F46" },
    DOCX: { bg: "#DBEAFE", color: "#1E40AF" },
  };

  return (
    <div>
      <SectionHeader title="자료실 관리" count={items.length} onAdd={() => setAdding(true)} />

      {adding && (
        <div className="bg-white rounded-[20px] p-6 mb-6" style={{ border: `1px solid ${C.border}` }}>
          <h3 className="font-bold text-sm mb-4" style={{ color: C.text1 }}>새 자료 등록</h3>
          <div className="space-y-4">
            <Field label="파일명 *">
              <input className={inputCls} style={inputStyle} value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="파일명" />
            </Field>
            <Field label="설명">
              <input className={inputCls} style={inputStyle} value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="파일 설명" />
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="분류">
                <select className={inputCls} style={inputStyle} value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value as ResourceCategory }))}>
                  <option value="install">설치가이드</option>
                  <option value="policy">정책문서</option>
                  <option value="forms">양식서식</option>
                </select>
              </Field>
              <Field label="파일 형식">
                <select className={inputCls} style={inputStyle} value={form.fileType}
                  onChange={e => setForm(f => ({ ...f, fileType: e.target.value }))}>
                  <option value="PDF">PDF</option>
                  <option value="XLSX">XLSX</option>
                  <option value="DOCX">DOCX</option>
                  <option value="ZIP">ZIP</option>
                  <option value="EXE">EXE</option>
                </select>
              </Field>
              <Field label="파일 크기">
                <input className={inputCls} style={inputStyle} value={form.fileSize}
                  onChange={e => setForm(f => ({ ...f, fileSize: e.target.value }))} placeholder="예: 2.1 MB" />
              </Field>
            </div>
            <Field label="파일 URL (Notion 첨부파일 URL 또는 공유 링크)">
              <input className={inputCls} style={inputStyle} value={form.fileUrl}
                onChange={e => setForm(f => ({ ...f, fileUrl: e.target.value }))} placeholder="https://..." />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="업데이트 날짜">
                <input type="date" className={inputCls} style={inputStyle} value={form.updatedAt}
                  onChange={e => setForm(f => ({ ...f, updatedAt: e.target.value }))} />
              </Field>
              <Field label="순서">
                <input type="number" className={inputCls} style={inputStyle} value={form.order}
                  onChange={e => setForm(f => ({ ...f, order: Number(e.target.value) }))} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: C.text2 }}>
              <input type="checkbox" checked={form.visible}
                onChange={e => setForm(f => ({ ...f, visible: e.target.checked }))} />
              즉시 공개
            </label>
          </div>
          <div className="flex gap-3 mt-5">
            <button onClick={handleSave} disabled={saving || !form.title.trim()}
              className="px-5 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50"
              style={{ background: C.primary }}>
              {saving ? "저장 중..." : "저장"}
            </button>
            <button onClick={() => setAdding(false)}
              className="px-5 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: C.bg, color: C.text3 }}>
              취소
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12" style={{ color: C.text4 }}>불러오는 중...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 rounded-[20px]" style={{ background: "#fff", border: `1px solid ${C.border}`, color: C.text4 }}>
          아직 등록된 자료가 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(r => {
            const ft = FILE_TYPE_STYLE[r.fileType] ?? { bg: C.bg, color: C.text3 };
            return (
              <div key={r.id} className="bg-white rounded-[16px] p-5 flex items-center gap-4"
                style={{ border: `1px solid ${C.border}`, opacity: r.visible ? 1 : 0.5 }}>
                <span className="text-xs font-bold px-2 py-0.5 rounded-md shrink-0"
                  style={{ background: ft.bg, color: ft.color }}>{r.fileType}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: C.text1 }}>{r.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: C.text4 }}>
                    {CAT_LABEL[r.category]} · {r.fileSize} · {r.updatedAt}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => toggleVisible(r)}
                    className="text-xs px-3 py-1.5 rounded-lg font-bold"
                    style={r.visible ? { background: "#D1FAE5", color: "#065F46" } : { background: C.bg, color: C.text3 }}>
                    {r.visible ? "공개중" : "숨김"}
                  </button>
                  <button onClick={() => handleDelete(r.id)}
                    className="text-xs px-3 py-1.5 rounded-lg font-bold"
                    style={{ background: C.dangerSoft, color: C.danger }}>
                    삭제
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
