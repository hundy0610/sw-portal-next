"use client";

import { useState, useEffect, useCallback } from "react";

// ── 타입 ────────────────────────────────────────────────────────────────────
interface Account {
  id: string;
  name: string;
  userId: string;
  email: string;
  department: string;
  company: string;
  role: "super" | "company" | "general";
  active: boolean;
}

type RoleType = "super" | "company" | "general";

const EMPTY_FORM: Omit<Account, "id"> = {
  name: "", userId: "", email: "", department: "",
  company: "", role: "company", active: true,
};

const COMPANIES = [
  "대웅제약","대웅바이오","대웅","대웅개발","대웅이엔지","대웅펫",
  "한올바이오파마","시지바이오","시지메드텍","IdsTrust","디엔컴퍼니",
  "디엔코스메틱스","더편한샵","페이지원","엠서클","애디테라","노바메디텍",
  "에이하나","다나아데이터","클리슈어리서치","유와이즈원","DNC",
  "석천나눔재단","HR코리아","힐코","블루넷",
];

const ROLE_LABELS: Record<RoleType, string> = {
  super:   "슈퍼어드민",
  company: "법인담당자",
  general: "총무관리자",
};

// ── 역할 뱃지 ───────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: RoleType }) {
  if (role === "super")
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">슈퍼어드민</span>;
  if (role === "general")
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">총무관리자</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">법인담당자</span>;
}

// ── 모달: 계정 추가/수정 ────────────────────────────────────────────────────
function AccountFormModal({
  initial, onSave, onClose, isSuperAdmin,
}: {
  initial?: Account;
  onSave: (data: Omit<Account, "id"> & { resetPassword?: string }) => Promise<void>;
  onClose: () => void;
  isSuperAdmin: boolean;
}) {
  const [form, setForm] = useState<Omit<Account, "id">>(
    initial
      ? { name: initial.name, userId: initial.userId, email: initial.email,
          department: initial.department, company: initial.company,
          role: initial.role, active: initial.active }
      : { ...EMPTY_FORM }
  );
  const [resetPassword, setResetPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave({ ...form, ...(resetPassword ? { resetPassword } : {}) });
    setSaving(false);
  }

  const needsCompany = form.role === "company";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-[460px] p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-900">{initial ? "계정 수정" : "계정 추가"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* 담당자 이름 */}
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
              placeholder="login_id" required
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
          </div>

          {/* 이메일 */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">메일 주소 *</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="user@company.com" required
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
          </div>

          {/* 권한 */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">권한 *</label>
            <div className="flex gap-3 flex-wrap">
              {(["company", "general", "super"] as RoleType[]).map(r => (
                <label key={r} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" value={r} checked={form.role === r}
                    onChange={() => setForm({ ...form, role: r, company: r === "super" ? "" : form.company })}
                    className="accent-purple-600" />
                  <span className="text-sm">{ROLE_LABELS[r]}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 법인명 (법인담당자만) */}
          {needsCompany && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">법인명 *</label>
              <select value={form.company} onChange={e => setForm({ ...form, company: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
                <option value="">선택</option>
                {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          {/* 부서명 */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">부서명</label>
            <input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}
              placeholder="자산관리파트"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
          </div>

          {/* 비밀번호 직접 설정 (수정 시 슈퍼어드민만, 신규 계정은 불필요) */}
          {initial && isSuperAdmin && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                비밀번호 재설정 <span className="font-normal text-gray-400">(입력 시만 변경)</span>
              </label>
              <div className="relative">
                <input value={resetPassword}
                  onChange={e => setResetPassword(e.target.value)}
                  type={showPw ? "text" : "password"}
                  placeholder="새 비밀번호 (선택)"
                  className="w-full px-3 py-2 pr-10 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">
                  {showPw ? "숨김" : "표시"}
                </button>
              </div>
            </div>
          )}

          {/* 신규 계정 안내 */}
          {!initial && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
              계정 생성 시 <strong>임시 비밀번호가 등록된 이메일로 자동 발송</strong>됩니다.<br />
              담당자는 임시 비밀번호로 첫 로그인 후 비밀번호를 변경해야 합니다.
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
export default function AccountsPanel({ isSuperAdmin = true }: { isSuperAdmin?: boolean }) {
  const [accounts,    setAccounts]    = useState<Account[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [showModal,   setShowModal]   = useState(false);
  const [editTarget,  setEditTarget]  = useState<Account | undefined>(undefined);
  const [savingGm,    setSavingGm]    = useState<string | null>(null);  // userId of currently toggling
  const [sendingTemp, setSendingTemp] = useState<string | null>(null); // id of account sending temp pw

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/admin/accounts");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "불러오기 실패");
      setAccounts(json.accounts);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave(data: Omit<Account, "id"> & { resetPassword?: string }) {
    const { resetPassword, ...rest } = data;
    if (editTarget) {
      const body: Record<string, unknown> = {
        id: editTarget.id,
        name: rest.name,
        userId: rest.userId,
        email: rest.email,
        department: rest.department,
        company: rest.company,
        role: rest.role,
        active: rest.active,
      };
      if (resetPassword) body.password = resetPassword;
      await fetch("/api/admin/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      await fetch("/api/admin/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rest),
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

  async function handleActivate(account: Account) {
    if (!confirm(`"${account.name}" 계정을 활성화하겠습니까?`)) return;
    await fetch("/api/admin/accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: account.id, active: true }),
    });
    load();
  }

  // 임시 비밀번호 재발송
  async function handleSendTemp(acc: Account) {
    if (!confirm(`"${acc.name}" 계정에 임시 비밀번호를 재발급하고 ${acc.email}로 발송하겠습니까?`)) return;
    setSendingTemp(acc.id);
    try {
      const res = await fetch("/api/admin/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: acc.id, resendTemp: true }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "실패");
      alert(`✅ ${acc.email}로 임시 비밀번호를 발송했습니다.`);
      load();
    } catch (e) {
      alert(`❌ 발송 실패: ${String(e)}`);
    } finally {
      setSendingTemp(null);
    }
  }

  // 총무관리자 역할 인라인 토글
  async function toggleGmRole(account: Account) {
    const newRole: RoleType = account.role === "general" ? "company" : "general";
    setSavingGm(account.userId);
    await fetch("/api/admin/accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: account.id, role: newRole }),
    });
    setSavingGm(null);
    load();
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
          <h2 className="text-xl font-bold text-gray-900">계정 권한 설정</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            법인·담당자별 계정과 권한을 관리합니다. 총무관리자 열의 체크박스로 총무 권한을 즉시 변경할 수 있습니다.
          </p>
        </div>
        {isSuperAdmin && (
          <div className="flex items-center gap-2">
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
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">⚠️ {error}</div>
      )}

      {/* 통합 계정 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">이름 / 아이디</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">이메일</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">법인 / 부서</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">권한</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 whitespace-nowrap">총무관리자</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">상태</th>
                {isSuperAdmin && (
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">관리</th>
                )}
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 7 : 6} className="px-4 py-10 text-center text-gray-400 text-sm">
                    등록된 계정이 없습니다
                  </td>
                </tr>
              ) : (
                accounts.map(acc => (
                  <tr key={acc.id}
                    className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${!acc.active ? "opacity-50" : ""}`}>

                    {/* 이름 / 아이디 */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{acc.name}</div>
                      <div className="text-xs text-gray-400 font-mono mt-0.5">{acc.userId}</div>
                    </td>

                    {/* 이메일 */}
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {acc.email || <span className="text-gray-300">—</span>}
                    </td>

                    {/* 법인 / 부서 */}
                    <td className="px-4 py-3">
                      {acc.company && <div className="text-sm text-gray-700">{acc.company}</div>}
                      {acc.department && <div className="text-xs text-gray-400 mt-0.5">{acc.department}</div>}
                      {!acc.company && !acc.department && <span className="text-gray-300">—</span>}
                    </td>

                    {/* 권한 뱃지 */}
                    <td className="px-4 py-3">
                      <RoleBadge role={acc.role} />
                    </td>

                    {/* 총무관리자 토글 (슈퍼어드민은 토글 불가) */}
                    <td className="px-4 py-3 text-center">
                      {acc.role === "super" ? (
                        <span className="text-gray-200 text-xs">—</span>
                      ) : (
                        <button
                          onClick={() => acc.active && isSuperAdmin && toggleGmRole(acc)}
                          disabled={!acc.active || !isSuperAdmin || savingGm === acc.userId}
                          title={acc.role === "general" ? "총무관리자 해제" : "총무관리자로 지정"}
                          className={`w-9 h-5 rounded-full transition-colors relative ${
                            acc.role === "general" ? "bg-emerald-500" : "bg-gray-200"
                          } ${(!acc.active || !isSuperAdmin) ? "cursor-default" : "cursor-pointer"}`}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                            acc.role === "general" ? "translate-x-4" : "translate-x-0.5"
                          }`} />
                        </button>
                      )}
                    </td>

                    {/* 상태 */}
                    <td className="px-4 py-3">
                      {acc.active
                        ? <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">활성</span>
                        : <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">비활성</span>}
                    </td>

                    {/* 관리 버튼 */}
                    {isSuperAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => { setEditTarget(acc); setShowModal(true); }}
                            className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                          >수정</button>
                          {acc.active && acc.email && (
                            <button
                              onClick={() => handleSendTemp(acc)}
                              disabled={sendingTemp === acc.id}
                              className="text-xs text-amber-600 hover:text-amber-800 hover:underline disabled:opacity-40"
                              title="임시 비밀번호 재발급 후 이메일 발송"
                            >
                              {sendingTemp === acc.id ? "발송 중..." : "임시PW"}
                            </button>
                          )}
                          {acc.active ? (
                            <button
                              onClick={() => handleDeactivate(acc)}
                              className="text-xs text-red-500 hover:text-red-700 hover:underline"
                            >비활성화</button>
                          ) : (
                            <button
                              onClick={() => handleActivate(acc)}
                              className="text-xs text-emerald-600 hover:text-emerald-800 hover:underline"
                            >활성화</button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 요약 */}
      <div className="text-xs text-gray-400 flex items-center gap-3 flex-wrap">
        <span>총 {accounts.length}개 계정</span>
        <span>·</span>
        <span>활성 {accounts.filter(a => a.active).length}개</span>
        <span>·</span>
        <span className="text-emerald-600 font-medium">총무관리자 {accounts.filter(a => a.role === "general" && a.active).length}명</span>
      </div>

      {/* 빈 상태 안내 */}
      {accounts.length === 0 && !error && isSuperAdmin && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
          <div className="font-semibold mb-1">👤 등록된 계정이 없습니다</div>
          <p>오른쪽 상단의 <strong>+ 계정 추가</strong> 버튼으로 첫 번째 계정을 등록하세요.</p>
        </div>
      )}

      {/* 모달 */}
      {showModal && (
        <AccountFormModal
          initial={editTarget}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditTarget(undefined); }}
          isSuperAdmin={isSuperAdmin}
        />
      )}
    </div>
  );
}
