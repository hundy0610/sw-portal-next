"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });

    if (res.ok) {
      router.push("/admin");
      router.refresh();
    } else {
      setError("올바르지 않은 관리자 키입니다.");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#F4F5F7" }}>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 w-[360px]">
        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-7">
          <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center">
            <span className="text-white font-extrabold text-sm">AD</span>
          </div>
          <div>
            <div className="font-bold text-gray-900 text-sm">관리자 전용 공간</div>
            <div className="text-xs text-gray-400 mt-0.5">관리자 키를 입력해야 접속 가능합니다</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="text-xs font-semibold text-gray-600">관리자 비밀 키</label>
          <input
            type="password"
            placeholder="••••••••"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoFocus
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
            required
          />
          {error && (
            <div className="flex items-center gap-1.5 text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || !key}
            className="w-full bg-purple-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-purple-700 active:bg-purple-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed mt-1"
          >
            {loading ? "확인 중..." : "관리자 대시보드 접속"}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-5">
          일반 사용자라면{" "}
          <a href="/" className="text-purple-600 hover:underline font-medium">
            직원 포털
          </a>
          로 이동하세요
        </p>
      </div>
    </div>
  );
}
