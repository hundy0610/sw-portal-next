"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [userId, setUserId]     = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const router = useRouter();

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
      router.push("/admin");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "아이디 또는 비밀번호가 올바르지 않습니다.");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#F5F6F8" }}>
      <div className="w-[380px]">

        {/* 로고 — 그룹웨어 스타일 */}
        <div className="flex flex-col items-center mb-7">
          <div className="w-10 h-10 rounded-[8px] flex items-center justify-center text-white font-extrabold text-[11px] mb-4"
            style={{ background: "#F47C20", boxShadow: "0 3px 10px rgba(244,124,32,0.30)" }}>
            SW
          </div>
          <h1 className="text-[18px] font-bold" style={{ color: "#1A1A1A" }}>
            SW 자산관리 — 관리자
          </h1>
          <p className="text-[12px] mt-1" style={{ color: "#AAAAAA" }}>
            담당자 계정으로 로그인하세요
          </p>
        </div>

        {/* 카드 */}
        <div className="rounded-[10px] p-6" style={{ background: "#FFFFFF", border: "1px solid #E5E5E5", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold" style={{ color: "#3D3D3D" }}>아이디</label>
              <input
                type="text"
                placeholder="아이디 입력"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                autoFocus
                autoComplete="username"
                className="form-input"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold" style={{ color: "#3D3D3D" }}>비밀번호</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="form-input"
                required
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-[12px] px-3 py-2.5 rounded-[6px]"
                style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !userId || !password}
              className="w-full py-2.5 rounded-[7px] text-[13.5px] font-bold text-white mt-1 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "#F47C20", boxShadow: "0 2px 8px rgba(244,124,32,0.25)" }}
              onMouseEnter={e => { if (!loading && userId && password) (e.currentTarget as HTMLElement).style.background = "#D9690F"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#F47C20"; }}
            >
              {loading ? "로그인 중..." : "로그인"}
            </button>
          </form>
        </div>

        <p className="text-center text-[12px] mt-4" style={{ color: "#AAAAAA" }}>
          일반 사용자라면{" "}
          <a href="/" className="font-semibold hover:underline" style={{ color: "#F47C20" }}>
            직원 포털
          </a>로 이동하세요
        </p>
      </div>
    </div>
  );
}
