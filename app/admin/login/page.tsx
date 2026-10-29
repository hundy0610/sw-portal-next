"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { safeJson } from "@/lib/fetch-json";

// 포털 공개 자료 관리(/manage) 로그인 — v2 전환 뒤엔 환경변수 슈퍼어드민 하나로만 들어온다(10-29 결정).
// 관리자 계정 목록(sw:accounts)이 암호문이라 포털이 읽을 수 없다 — 계정 로그인·비밀번호 초기화·변경은 없앴다.
function LoginForm() {
  const [userId,   setUserId]   = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const router = useRouter();
  const redirect = useSearchParams().get("redirect");

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
      // 관리 화면은 /manage 하나뿐이다. 다른 곳으로 보내지 않는다(열린 리다이렉트 방지).
      router.push(redirect?.startsWith("/manage") ? redirect : "/manage");
      router.refresh();
    } else {
      const data = await safeJson(res);
      setError(data.error || "아이디 또는 비밀번호가 올바르지 않습니다.");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#FAFAFA" }}>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 w-[380px]">
        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-7">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center">
            <span className="text-white font-extrabold text-sm">AD</span>
          </div>
          <div>
            <div className="font-bold text-gray-900 text-sm">관리자 전용 공간</div>
            <div className="text-xs text-gray-400 mt-0.5">포털 공개 자료 관리(슈퍼어드민)</div>
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
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
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
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              required
            />
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
            className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 active:bg-indigo-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed mt-1"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-4">
          일반 사용자라면{" "}
          <a href="/" className="text-indigo-600 hover:underline font-medium">
            직원 포털
          </a>
          로 이동하세요
        </p>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
