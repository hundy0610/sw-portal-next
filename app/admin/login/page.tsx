"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { safeJson } from "@/lib/fetch-json";

type ResetStep = "idle" | "request" | "verify" | "done";

export default function AdminLoginPage() {
  const [userId,   setUserId]   = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const router = useRouter();

  // 비밀번호 초기화 상태
  const [resetStep,    setResetStep]    = useState<ResetStep>("idle");
  const [resetUserId,  setResetUserId]  = useState("");
  const [resetEmail,   setResetEmail]   = useState("");
  const [resetCode,    setResetCode]    = useState("");
  const [resetPw,      setResetPw]      = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetError,   setResetError]   = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, password }),
    });

    if (res.ok) {
      const data = await safeJson(res);
      if (data.mustChangePassword) {
        router.push("/admin/change-password");
      } else {
        router.push("/admin");
      }
      router.refresh();
    } else {
      const data = await safeJson(res);
      setError(data.error || "아이디 또는 비밀번호가 올바르지 않습니다.");
    }
    setLoading(false);
  }

  async function handleResetRequest(e: React.FormEvent) {
    e.preventDefault();
    setResetLoading(true);
    setResetError("");
    try {
      await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: resetUserId, email: resetEmail }),
      });
      setResetStep("verify");
    } catch {
      setResetError("요청 중 오류가 발생했습니다.");
    }
    setResetLoading(false);
  }

  async function handleResetVerify(e: React.FormEvent) {
    e.preventDefault();
    if (resetPw.length < 6) { setResetError("비밀번호는 6자 이상이어야 합니다"); return; }
    if (resetPw !== resetConfirm) { setResetError("비밀번호 확인이 일치하지 않습니다"); return; }
    setResetLoading(true);
    setResetError("");
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: resetUserId,
          code: resetCode,
          newPassword: resetPw,
          confirmPassword: resetConfirm,
        }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        setResetError(data.error || "인증 실패");
      } else {
        setResetStep("done");
      }
    } catch {
      setResetError("처리 중 오류가 발생했습니다.");
    }
    setResetLoading(false);
  }

  function closeReset() {
    setResetStep("idle");
    setResetUserId(""); setResetEmail(""); setResetCode("");
    setResetPw(""); setResetConfirm(""); setResetError("");
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#F4F5F7" }}>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 w-[380px]">
        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-7">
          <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center">
            <span className="text-white font-extrabold text-sm">AD</span>
          </div>
          <div>
            <div className="font-bold text-gray-900 text-sm">관리자 전용 공간</div>
            <div className="text-xs text-gray-400 mt-0.5">담당자 계정으로 로그인하세요</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-600">아이디</label>
            <input
              type="text"
              placeholder="아이디 입력"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              autoFocus
              autoComplete="username"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-600">비밀번호</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
              required
            />
            <p className="text-xs text-gray-400 mt-0.5">
              처음 로그인하신다면 이메일로 발송된 임시 비밀번호를 입력하세요
            </p>
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
            disabled={loading || !userId || !password}
            className="w-full bg-purple-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-purple-700 active:bg-purple-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed mt-1"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        {/* 비밀번호 초기화 링크 */}
        <div className="mt-4 pt-4 border-t border-gray-100 text-center">
          <button
            onClick={() => setResetStep("request")}
            className="text-xs text-purple-600 hover:text-purple-800 hover:underline font-medium"
          >
            비밀번호를 잊으셨나요? 초기화하기
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-3">
          일반 사용자라면{" "}
          <a href="/" className="text-purple-600 hover:underline font-medium">
            직원 포털
          </a>
          로 이동하세요
        </p>
      </div>

      {/* ── 비밀번호 초기화 모달 ── */}
      {resetStep !== "idle" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl w-[400px] p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
                  <span className="text-white text-sm">🔑</span>
                </div>
                <h3 className="font-bold text-gray-900">
                  {resetStep === "done" ? "비밀번호 초기화 완료" : "비밀번호 초기화"}
                </h3>
              </div>
              <button onClick={closeReset} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            {resetStep === "request" && (
              <form onSubmit={handleResetRequest} className="flex flex-col gap-3">
                <p className="text-sm text-gray-500">
                  계정 아이디와 등록된 이메일을 입력하시면 인증코드를 보내드립니다.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">아이디 *</label>
                  <input
                    value={resetUserId} onChange={e => setResetUserId(e.target.value)}
                    placeholder="로그인 아이디" required
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">등록 이메일 *</label>
                  <input
                    type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                    placeholder="registered@email.com" required
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>
                {resetError && <p className="text-xs text-red-500">{resetError}</p>}
                <div className="flex gap-3 mt-1">
                  <button type="button" onClick={closeReset}
                    className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
                    취소
                  </button>
                  <button type="submit" disabled={resetLoading}
                    className="flex-1 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 disabled:opacity-50">
                    {resetLoading ? "전송 중..." : "인증코드 발송"}
                  </button>
                </div>
              </form>
            )}

            {resetStep === "verify" && (
              <form onSubmit={handleResetVerify} className="flex flex-col gap-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
                  <strong>{resetEmail}</strong>로 인증코드가 발송되었습니다. 10분 내에 입력해주세요.
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">인증코드 *</label>
                  <input
                    value={resetCode} onChange={e => setResetCode(e.target.value)}
                    placeholder="6자리 코드 입력" maxLength={6} required
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">새 비밀번호 *</label>
                  <input
                    type="password" value={resetPw} onChange={e => setResetPw(e.target.value)}
                    placeholder="6자 이상 입력" required
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">비밀번호 확인 *</label>
                  <input
                    type="password" value={resetConfirm} onChange={e => setResetConfirm(e.target.value)}
                    placeholder="비밀번호 재입력" required
                    className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 transition-all
                      ${resetConfirm && resetConfirm !== resetPw ? "border-red-300 focus:ring-red-400" :
                        resetConfirm && resetConfirm === resetPw ? "border-green-300 focus:ring-green-400" :
                        "border-gray-200 focus:ring-purple-400"}`}
                  />
                </div>
                {resetError && <p className="text-xs text-red-500">{resetError}</p>}
                <div className="flex gap-3 mt-1">
                  <button type="button" onClick={() => setResetStep("request")}
                    className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
                    이전
                  </button>
                  <button type="submit" disabled={resetLoading}
                    className="flex-1 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 disabled:opacity-50">
                    {resetLoading ? "처리 중..." : "비밀번호 변경"}
                  </button>
                </div>
              </form>
            )}

            {resetStep === "done" && (
              <div className="text-center py-4">
                <div className="text-4xl mb-3">✅</div>
                <p className="text-sm text-gray-700 mb-5">
                  비밀번호가 성공적으로 변경되었습니다.<br />새 비밀번호로 로그인해주세요.
                </p>
                <button
                  onClick={closeReset}
                  className="w-full py-2.5 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700"
                >
                  로그인으로 돌아가기
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
