"use client";

import { useEffect, useState, useMemo } from "react";

// ────────────────────────────────────────────────────────────
// 타입
// ────────────────────────────────────────────────────────────
export interface SwCredential {
  id: string;
  swName: string;
  siteUrl: string;
  accountId: string;
  password: string;
  memo: string;
}

type FormData = Omit<SwCredential, "id">;
const EMPTY_FORM: FormData = { swName: "", siteUrl: "", accountId: "", password: "", memo: "" };

// ────────────────────────────────────────────────────────────
// SW 아이콘 매핑
// ────────────────────────────────────────────────────────────
const SW_ICON_MAP: { keywords: string[]; icon: string }[] = [
  { keywords: ["office","365","microsoft","ms "], icon: "🪟" },
  { keywords: ["adobe","photoshop","illustrator","premiere","acrobat"], icon: "🎨" },
  { keywords: ["github","gitlab","git"], icon: "🐙" },
  { keywords: ["notion"], icon: "📓" },
  { keywords: ["slack"], icon: "💬" },
  { keywords: ["zoom"], icon: "📹" },
  { keywords: ["figma"], icon: "🎯" },
  { keywords: ["jetbrains","intellij","pycharm","webstorm","datagrip","rider"], icon: "🧠" },
  { keywords: ["aws","amazon"], icon: "☁️" },
  { keywords: ["google"], icon: "🔵" },
  { keywords: ["apple","mac"], icon: "🍎" },
  { keywords: ["한컴","hwp","한글"], icon: "🇰🇷" },
  { keywords: ["autocad","autodesk"], icon: "📐" },
  { keywords: ["vpn","보안","security"], icon: "🛡️" },
];
function getSwIcon(name: string): string {
  const lower = name.toLowerCase();
  for (const { keywords, icon } of SW_ICON_MAP) {
    if (keywords.some(k => lower.includes(k))) return icon;
  }
  return "💾";
}

// ────────────────────────────────────────────────────────────
// 클립보드 복사 버튼
// ────────────────────────────────────────────────────────────
function CopyBtn({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }
  if (!text) return <span className="text-xs text-gray-300">—</span>;
  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all select-none ${
        copied
          ? "bg-green-50 border-green-300 text-green-700"
          : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
      }`}
      title={`${label} 복사`}
    >
      {copied ? "✓ 복사됨" : `📋 ${label}`}
    </button>
  );
}

// ────────────────────────────────────────────────────────────
// 추가/수정 모달
// ────────────────────────────────────────────────────────────
function CredentialModal({
  initial,
  onSave,
  onClose,
  saving,
}: {
  initial?: SwCredential;
  onSave: (form: FormData) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<FormData>(
    initial
      ? { swName: initial.swName, siteUrl: initial.siteUrl, accountId: initial.accountId, password: initial.password, memo: initial.memo }
      : EMPTY_FORM
  );
  const [showPw, setShowPw] = useState(false);
  const isEdit = !!initial;

  function set(k: keyof FormData, v: string) {
    setForm(p => ({ ...p, [k]: v }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 배경 */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* 모달 */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-base text-gray-900">
            {isEdit ? "✏️ 계정 수정" : "➕ 새 계정 추가"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="flex flex-col gap-3">
          {/* SW명 */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">SW명 *</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예: Microsoft 365, Adobe CC..."
              value={form.swName}
              onChange={e => set("swName", e.target.value)}
              autoFocus
            />
          </div>

          {/* 사이트 URL */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">사이트 URL</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://admin.microsoft.com"
              value={form.siteUrl}
              onChange={e => set("siteUrl", e.target.value)}
            />
          </div>

          {/* 아이디 */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">아이디 / 계정 *</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="admin@company.com"
              value={form.accountId}
              onChange={e => set("accountId", e.target.value)}
            />
          </div>

          {/* 비밀번호 */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">비밀번호</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
                value={form.password}
                onChange={e => set("password", e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPw(p => !p)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-base"
              >
                {showPw ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          {/* 비고 */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">비고</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="담당자, 용도 등 메모"
              value={form.memo}
              onChange={e => set("memo", e.target.value)}
            />
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.swName.trim() || !form.accountId.trim()}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            {saving ? "저장 중..." : isEdit ? "수정 완료" : "추가"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 삭제 확인 모달
// ────────────────────────────────────────────────────────────
function DeleteConfirmModal({
  cred,
  onConfirm,
  onClose,
  deleting,
}: {
  cred: SwCredential;
  onConfirm: () => void;
  onClose: () => void;
  deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 z-10 text-center">
        <div className="text-3xl mb-3">🗑️</div>
        <h3 className="font-bold text-base text-gray-900 mb-1">계정 삭제</h3>
        <p className="text-sm text-gray-500 mb-5">
          <span className="font-semibold text-gray-800">{cred.swName}</span>의 계정을 삭제하시겠습니까?<br />
          <span className="text-xs text-red-500">이 작업은 되돌릴 수 없습니다.</span>
        </p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            {deleting ? "삭제 중..." : "삭제"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ────────────────────────────────────────────────────────────
export default function CredentialsPanel() {
  const [creds,   setCreds]   = useState<SwCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [search,  setSearch]  = useState("");
  const [revealId, setRevealId] = useState<string | null>(null);

  // 모달 상태
  const [showAdd,     setShowAdd]     = useState(false);
  const [editTarget,  setEditTarget]  = useState<SwCredential | null>(null);
  const [deleteTarget,setDeleteTarget]= useState<SwCredential | null>(null);
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast,    setToast]    = useState<{ msg: string; type: "success"|"error" } | null>(null);

  function showToast(msg: string, type: "success"|"error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  function loadCreds() {
    setLoading(true);
    fetch("/api/credentials?t=" + Date.now())
      .then(r => r.json())
      .then(res => {
        if (res.error) setError(res.error);
        else setCreds(res.data ?? []);
      })
      .catch(() => setError("데이터를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadCreds(); }, []);

  // ── 추가 ──
  async function handleAdd(form: FormData) {
    setSaving(true);
    try {
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "추가 실패");
      setCreds(p => [...p, json.data]);
      setShowAdd(false);
      showToast("✅ 계정이 추가되었습니다.");
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  // ── 수정 ──
  async function handleEdit(form: FormData) {
    if (!editTarget) return;
    setSaving(true);
    try {
      const res = await fetch("/api/credentials", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editTarget.id, ...form }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "수정 실패");
      setCreds(p => p.map(c => c.id === editTarget.id ? { ...c, ...form } : c));
      setEditTarget(null);
      showToast("✅ 계정이 수정되었습니다.");
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  // ── 삭제 ──
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/credentials", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteTarget.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "삭제 실패");
      setCreds(p => p.filter(c => c.id !== deleteTarget.id));
      setDeleteTarget(null);
      showToast("🗑️ 계정이 삭제되었습니다.");
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally {
      setDeleting(false);
    }
  }

  const filtered = useMemo(() => {
    if (!search) return creds;
    const q = search.toLowerCase();
    return creds.filter(c =>
      c.swName.toLowerCase().includes(q) ||
      c.accountId.toLowerCase().includes(q) ||
      c.memo.toLowerCase().includes(q)
    );
  }, [creds, search]);

  // ── 렌더링 ──
  return (
    <div className="fade-in">
      {/* ── 토스트 ── */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
          toast.type === "error" ? "bg-red-600 text-white" : "bg-gray-900 text-white"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* ── 모달 ── */}
      {showAdd && (
        <CredentialModal onSave={handleAdd} onClose={() => setShowAdd(false)} saving={saving} />
      )}
      {editTarget && (
        <CredentialModal initial={editTarget} onSave={handleEdit} onClose={() => setEditTarget(null)} saving={saving} />
      )}
      {deleteTarget && (
        <DeleteConfirmModal cred={deleteTarget} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} deleting={deleting} />
      )}

      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-0.5">계정 관리 (ID/PW)</h2>
          <p className="text-sm text-gray-500">SW 관리 포털 계정 목록</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          계정 추가
        </button>
      </div>

      {/* ── 보안 배너 ── */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 flex items-start gap-3">
        <span className="text-lg shrink-0">🔒</span>
        <div className="text-xs text-amber-800">
          <strong>관리자 전용 페이지입니다.</strong> 이 화면의 계정 정보는 로그인된 관리자에게만 표시됩니다.
          비밀번호는 클릭 시 잠깐만 표시되며, 복사 후 바로 가려집니다.
        </div>
      </div>

      {loading && (
        <div className="text-center py-20 text-gray-400">계정 목록 불러오는 중...</div>
      )}

      {!loading && error && (
        <div className="text-center py-20">
          <div className="text-3xl mb-3">⚠️</div>
          <div className="text-sm text-red-600 font-semibold mb-2">{error}</div>
          <button onClick={loadCreds} className="text-xs text-blue-600 underline">다시 시도</button>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* ── 검색 ── */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="SW명, 계정ID, 비고 검색..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-base leading-none">×</button>
              )}
            </div>
            <div className="text-right text-xs text-gray-400 mt-1.5">{filtered.length}개 계정</div>
          </div>

          {/* ── 빈 상태 ── */}
          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <div className="text-3xl mb-2">{search ? "🔍" : "🔐"}</div>
              <div className="text-sm mb-3">
                {search ? "검색 결과가 없습니다." : "등록된 계정이 없습니다."}
              </div>
              {!search && (
                <button
                  onClick={() => setShowAdd(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  + 첫 계정 추가하기
                </button>
              )}
            </div>
          )}

          {/* ── 계정 카드 목록 ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(c => {
              const icon = getSwIcon(c.swName);
              const isRevealed = revealId === c.id;
              return (
                <div
                  key={c.id}
                  className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all hover:border-blue-200 flex flex-col gap-3"
                >
                  {/* SW명 + 수정/삭제 */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-xl shrink-0">
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-gray-900 truncate">{c.swName}</div>
                      {c.memo && <div className="text-xs text-gray-400 truncate mt-0.5">{c.memo}</div>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => setEditTarget(c)}
                        className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-600 transition-all"
                        title="수정">✏️</button>
                      <button onClick={() => setDeleteTarget(c)}
                        className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-red-50 hover:border-red-300 hover:text-red-500 transition-all"
                        title="삭제">🗑️</button>
                    </div>
                  </div>

                  <div className="border-t border-gray-100" />

                  {/* 계정 ID */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-14 shrink-0">아이디</span>
                    <span className="flex-1 font-mono text-xs text-gray-800 truncate bg-gray-50 px-2 py-1 rounded border border-gray-100">
                      {c.accountId || "—"}
                    </span>
                    {c.accountId && <CopyBtn text={c.accountId} label="ID" />}
                  </div>

                  {/* 비밀번호 */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-14 shrink-0">비밀번호</span>
                    <div className="flex-1 flex items-center gap-1.5 min-w-0">
                      <span
                        className={`font-mono text-xs px-2 py-1 rounded border flex-1 truncate select-none cursor-pointer transition-all ${
                          isRevealed
                            ? "bg-yellow-50 border-yellow-200 text-gray-800"
                            : "bg-gray-50 border-gray-100 text-gray-300 tracking-widest"
                        }`}
                        onClick={() => setRevealId(isRevealed ? null : c.id)}
                        title={isRevealed ? "클릭하여 숨기기" : "클릭하여 표시"}
                      >
                        {c.password ? (isRevealed ? c.password : "••••••••••") : "—"}
                      </span>
                      {c.password && (
                        <button
                          onClick={() => setRevealId(isRevealed ? null : c.id)}
                          className={`shrink-0 p-1.5 rounded-lg border text-xs transition-all ${
                            isRevealed
                              ? "bg-yellow-50 border-yellow-200 text-yellow-700"
                              : "bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100"
                          }`}
                          title={isRevealed ? "숨기기" : "보기"}
                        >{isRevealed ? "🙈" : "👁"}</button>
                      )}
                    </div>
                    {c.password && <CopyBtn text={c.password} label="PW" />}
                  </div>

                  {/* 사이트 링크 – 하단 전체 너비 버튼 */}
                  {c.siteUrl && (
                    <a
                      href={c.siteUrl.startsWith("http") ? c.siteUrl : `https://${c.siteUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
                      title={`${c.swName} 사이트 열기`}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                        <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
                      <span className="truncate max-w-[180px]">{c.siteUrl.replace(/^https?:\/\//, "")}</span>
                    </a>
                  )}
                </div>
              );
            })}
          </div>

          {creds.length > 0 && (
            <div className="mt-6 text-center text-xs text-gray-400">
              총 {creds.length}개 계정 · 변경사항은 자동 저장됩니다.
            </div>
          )}
        </>
      )}
    </div>
  );
}
