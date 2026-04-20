"use client";

import { useState, useEffect, useCallback } from "react";

// ── 타입 ────────────────────────────────────────────────────────────────────
interface Account {
  id: string;
  name: string;
  userId: string;
  password: string;
  company: string;
  role: "super" | "company";
  active: boolean;
}

const EMPTY_FORM: Omit<Account, "id"> = {
  name: "", userId: "", password: "",
  company: "", role: "company", active: true,
};

const COMPANIES = [
  "대웅제약","대웅바이오","대웅","대웅개발","대웅이엔지","대웅펫",
  "한올바이오파마","시지바이오","시지메드텍","IdsTrust","디엔컴퍼니",
  "디엔코스메틱스","더편한샵","페이지원","엠서클","애디테라","노바메디텍",
  "에이하나","다나아데이터","클리슈어리서치","유와이즈원","DNC",
  "석천나눔재단","HR코리아","힐코","블루넷",
];

// ── 역할 뱃지 ───────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  return role === "super"
    ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">슈퍼어드민</span>
    : <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">법인 담당자</span>;
}

// ── 모달: 계정 추가/수정 ────────────────────────────────────────────────────
function AccountFormModal({
  initial, onSave, onClose,
}: {
  initial?: Account;
  onSave: (data: Omit<Account, "id">) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Omit<Account, "id">>(
    initial ? { name: initial.name, userId: initial.userId, password: initial.password,
                company: initial.company, role: initial.role, active: initial.active }
             : { ...EMPTY_FORM }
  );
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-[440px] p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-900">{initial ? "계정 수정" : "계정 추가"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* 이름 */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">담당자 이름 *</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="홍길동" required
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
          </div>

          {/* 아이디 */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">아이디 *</label>
            <input value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })}
              placeholder="loign_id" required
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
          </div>

          {/* 비밀번호 */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              비밀번호 {initial ? "(변경 시만 입력)" : "*"}
            </label>
            <div className="relative">
              <input value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                type={showPw ? "text" : "password"}
                placeholder="비밀번호 입력"
                required={!initial}
                className="w-full px-3 py-2 pr-10 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">
                {showPw ? "숨김" : "표시"}
              </button>
            </div>
          </div>

          {/* 역할 */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">역할 *</label>
            <div className="flex gap-3">
              {(["company", "super"] as const).map(r => (
                <label key={r} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" value={r} checked={form.role === r}
                    onChange={() => setForm({ ...form, role: r, company: r === "super" ? "" : form.company })}
                    className="accent-purple-600" />
                  <span className="text-sm">{r === "super" ? "슈퍼어드민" : "법인 담당자"}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 법인명 (법인 담당자만) */}
          {form.role === "company" && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">법인명 *</label>
              <select value={form.company} onChange={e => setForm({ ...form, company: e.target.value })}
                required={form.role === "company"}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
                <option value="">선택</option>
                {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          {/* 활성화 */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.active}
              onChange={e => setForm({ ...form, active: e.target.checked })}
              className="accent-purple-600 w-4 h-4" />
            <span className="text-sm text-gray-700">계정 활성화</span>
          </label>

          <div className="flex gap-3 mt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
              취소
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 disabled:opacity-50">
              {saving ? "저장 중..." : (initial ? "수정 저장" : "계정 추가")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── 메인: AccountsPanel ─────────────────────────────────────────────────────
export default function AccountsPanel() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Account | undefined>(undefined);
  const [showPw, setShowPw] = useState<string | null>(null);

  // 총무 관리자 지정 상태
  const [gmList, setGmList]     = useState<string[]>([]);   // userId 목록
  const [gmSaving, setGmSaving] = useState(false);
  const [gmMsg, setGmMsg]       = useState<string | null>(null);

  const hasDb = true; // ACCOUNTS_DB_ID 환경변수 필요

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [accRes, gmRes] = await Promise.all([
        fetch("/api/admin/accounts"),
        fetch("/api/general-managers"),
      ]);
      const accJson = await accRes.json();
      if (!accJson.ok) throw new Error(accJson.error || "불러오기 실패");
      setAccounts(accJson.accounts);

      const gmJson = await gmRes.json();
      if (gmJson.ok) setGmList(gmJson.managers ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave(data: Omit<Account, "id">) {
    if (editTarget) {
      // 수정 (비밀번호 빈 경우 기존 유지)
      const body: Record<string, unknown> = {
        id: editTarget.id,
        name: data.name,
        userId: data.userId,
        company: data.company,
        role: data.role,
        active: data.active,
      };
      if (data.password) body.password = data.password;
      await fetch("/api/admin/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      // 추가
      await fetch("/api/admin/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    }
    setShowModal(false);
    setEditTarget(undefined);
    load();
  }

  async function handleDeactivate(account: Account) {
    if (!confirm(`"${account.name}" 계정을 비활성화하겠습니까?`)) return;
    await fetch("/api/admin/accounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: account.id }),
    });
    load();
  }

  function toggleGm(userId: string) {
    setGmList(prev =>
      prev.includes(userId) ? prev.filter(u => u !== userId) : [...prev, userId]
    );
    setGmMsg(null);
  }

  async function saveGmList() {
    setGmSaving(true); setGmMsg(null);
    try {
      const res = await fetch("/api/general-managers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ managers: gmList }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "저장 실패");
      setGmMsg("✓ 저장 완료");
    } catch (e) {
      setGmMsg(`⚠ ${String(e)}`);
    } finally {
      setGmSaving(false);
      setTimeout(() => setGmMsg(null), 3000);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mr-2" />
        <span className="text-gray-500 text-sm">불러오는 중...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">계정 설정</h2>
          <p className="text-sm text-gray-500 mt-0.5">법인별 담당자 계정을 관리합니다</p>
        </div>
        <button
          onClick={() => { setEditTarget(undefined); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          계정 추가
        </button>
      </div>

      {/* ACCOUNTS_DB_ID 안내 */}
      {!process.env.NEXT_PUBLIC_ACCOUNTS_DB_READY && accounts.length === 0 && !error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
          <div className="font-semibold mb-1">⚙️ Notion 계정 DB 설정 필요</div>
          <p>Notion에 계정 관리 DB를 생성하고, 아래 컬럼을 추가한 뒤 환경변수 <code className="bg-amber-100 px-1 rounded">ACCOUNTS_DB_ID</code>에 DB ID를 설정하세요:</p>
          <ul className="mt-2 space-y-0.5 list-disc list-inside text-xs">
            <li><code>이름</code> (제목/Title)</li>
            <li><code>아이디</code> (텍스트)</li>
            <li><code>비밀번호</code> (텍스트)</li>
            <li><code>법인명</code> (선택/Select)</li>
            <li><code>역할</code> (선택/Select: <code>super</code> / <code>company</code>)</li>
            <li><code>활성화</code> (체크박스)</li>
          </ul>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {/* 계정 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">이름</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">아이디</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">비밀번호</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">법인명</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">역할</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">상태</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">관리</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-sm">
                    등록된 계정이 없습니다
                  </td>
                </tr>
              ) : (
                accounts.map(acc => (
                  <tr key={acc.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${!acc.active ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3 font-medium text-gray-900">{acc.name}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{acc.userId}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs text-gray-600">
                          {showPw === acc.id ? acc.password : "••••••••"}
                        </span>
                        <button
                          onClick={() => setShowPw(showPw === acc.id ? null : acc.id)}
                          className="text-xs text-gray-400 hover:text-gray-600 px-1"
                        >
                          {showPw === acc.id ? "숨김" : "표시"}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {acc.role === "super" ? <span className="text-gray-400">—</span> : acc.company}
                    </td>
                    <td className="px-4 py-3"><RoleBadge role={acc.role} /></td>
                    <td className="px-4 py-3">
                      {acc.active
                        ? <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">활성</span>
                        : <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">비활성</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setEditTarget(acc); setShowModal(true); }}
                          className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                        >수정</button>
                        {acc.active && (
                          <button
                            onClick={() => handleDeactivate(acc)}
                            className="text-xs text-red-500 hover:text-red-700 hover:underline"
                          >비활성화</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-xs text-gray-400">
        총 {accounts.length}개 계정 · Notion DB 연동
        {accounts.length > 0 && ` · 활성 ${accounts.filter(a => a.active).length}개`}
      </div>

      {/* ── 총무 관리자 지정 섹션 ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">🔧 총무 관리자 지정</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              지정된 담당자는 모니터 교체·수리 요청을 확인·처리할 수 있습니다
            </p>
          </div>
          <div className="flex items-center gap-3">
            {gmMsg && (
              <span className={`text-xs font-medium ${gmMsg.startsWith("✓") ? "text-emerald-600" : "text-red-600"}`}>
                {gmMsg}
              </span>
            )}
            <button
              onClick={saveGmList}
              disabled={gmSaving}
              className="px-3 py-1.5 bg-purple-600 text-white text-xs font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {gmSaving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>

        {accounts.filter(a => a.active).length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-400 text-sm">활성 계정이 없습니다</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {accounts.filter(a => a.active).map(acc => {
              const isGm = gmList.includes(acc.userId);
              return (
                <label
                  key={acc.id}
                  className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors hover:bg-gray-50 ${isGm ? "bg-purple-50/50" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={isGm}
                    onChange={() => toggleGm(acc.userId)}
                    className="accent-purple-600 w-4 h-4"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm text-gray-900">{acc.name}</span>
                    <span className="text-xs text-gray-400 ml-2 font-mono">{acc.userId}</span>
                    {acc.role === "super" && (
                      <span className="ml-2 text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-semibold">슈퍼어드민</span>
                    )}
                  </div>
                  {acc.company && (
                    <span className="text-xs text-gray-400 shrink-0">{acc.company}</span>
                  )}
                  {isGm && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold shrink-0">총무 관리자</span>
                  )}
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* 모달 */}
      {showModal && (
        <AccountFormModal
          initial={editTarget}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditTarget(undefined); }}
        />
      )}
    </div>
  );
}
