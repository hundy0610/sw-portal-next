"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { safeJson } from "@/lib/fetch-json";

export default function ChangePasswordPage() {
  const [newPassword,     setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew,         setShowNew]         = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [error,           setError]           = useState("");
  const [loading,         setLoading]         = useState(false);
  const router = useRouter();

  // 비밀번호 강도 체크
  const strength = (() => {
    if (newPassword.length === 0) return 0;
    let score = 0;
    if (newPassword.length >= 6)  score++;
    if (newPassword.length >= 10) score++;
    if (/[A-Z]/.test(newPassword)) score++;
    if (/[0-9]/.test(newPassword)) score++;
    if (/[^A-Za-z0-9]/.test(newPassword)) score++;
    return score;
  })();

  const strengthLabel  = ["", "약함", "보통", "좋음", "강함", "매우 강함"][strength] ?? "";
  const strengthColor  = ["", "bg-red-400", "bg-orange-400", "bg-yellow-400", "bg-green-400", "bg-emerald-500"][strength] ?? "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) { setError("비밀번호는 6자 이상이어야 합니다"); return; }
    if (newPassword !== confirmPassword) { setError("비밀번호 확인이 일치하지 않습니다"); return; }

    setLoading(true); setError("");
    const res = await fetch("/api/admin/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword, confirmPassword }),
    });

    if (res.ok) {
      router.replace("/admin");
      router.refresh();
    } else {
      const data = await safeJson(res);
      setError(data.error || "비밀번호 변경에 실패했습니다");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#FAFAFA" }}>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-[400px]">
        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center">
            <span className="text-white text-lg">🔑</span>
          </div>
          <div>
            <div className="font-bold text-gray-900">비밀번호 변경 필요</div>
            <div className="text-xs text-gray-400 mt-0.5">초기 비밀번호를 새 비밀번호로 변경해주세요</div>
          </div>
        </div>

        {/* 안내 */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 text-sm text-amber-700">
          보안을 위해 처음 로그인 시 비밀번호를 변경해야 합니다. 변경 후에는 새 비밀번호로 로그인하세요.
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* 새 비밀번호 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">새 비밀번호</label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setError(""); }}
                placeholder="6자 이상 입력"
                autoFocus
                className="w-full px-3 py-2.5 pr-16 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                required
              />
              <button type="button" onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600">
                {showNew ? "숨김" : "표시"}
              </button>
            </div>
            {/* 비밀번호 강도 표시 */}
            {newPassword.length > 0 && (
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className={`h-1 w-8 rounded-full transition-colors ${i <= strength ? strengthColor : "bg-gray-200"}`} />
                  ))}
                </div>
                <span className="text-xs text-gray-500">{strengthLabel}</span>
              </div>
            )}
          </div>

          {/* 비밀번호 확인 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">비밀번호 확인</label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setError(""); }}
                placeholder="비밀번호 재입력"
                className={`w-full px-3 py-2.5 pr-16 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-all
                  ${confirmPassword.length > 0 && confirmPassword !== newPassword
                    ? "border-red-300 focus:ring-red-400"
                    : confirmPassword.length > 0 && confirmPassword === newPassword
                    ? "border-green-300 focus:ring-green-400"
                    : "border-gray-200 focus:ring-indigo-500"}`}
                required
              />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600">
                {showConfirm ? "숨김" : "표시"}
              </button>
            </div>
            {confirmPassword.length > 0 && confirmPassword !== newPassword && (
              <p className="text-xs text-red-500 mt-1">비밀번호가 일치하지 않습니다</p>
            )}
            {confirmPassword.length > 0 && confirmPassword === newPassword && (
              <p className="text-xs text-green-600 mt-1">비밀번호가 일치합니다</p>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-1.5 text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !newPassword || !confirmPassword || newPassword !== confirmPassword || newPassword.length < 6}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors mt-1"
          >
            {loading ? "변경 중..." : "비밀번호 변경 및 로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}
