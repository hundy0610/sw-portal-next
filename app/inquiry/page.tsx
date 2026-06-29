"use client";

import { useState } from "react";
import { safeJson } from "@/lib/fetch-json";

const COMPANIES = ["IDS", "IDS로지스틱스", "IDS물류", "기타"];
const INQUIRY_TYPES = ["SW", "HW", "기타"];
const URGENCY_OPTIONS = [
  { value: "매우 급합니다",    label: "매우 급합니다",    color: "#DC2626" },
  { value: "조금 급합니다",   label: "조금 급합니다",   color: "#B45309" },
  { value: "기다릴 수 있어요", label: "기다릴 수 있어요", color: "#059669" },
];

type Status = "idle" | "loading" | "done" | "error";

export default function InquiryPage() {
  const [form, setForm] = useState({
    requester:      "",
    requesterEmail: "",
    company:        "",
    department:     "",
    inquiryType:    "SW",
    urgency:        "기다릴 수 있어요",
    assetNo:        "",
    content:        "",
  });
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const set = (key: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.requester || !form.requesterEmail || !form.content) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await safeJson(res);
      if (!res.ok) throw new Error(json.error || "등록 실패");
      setStatus("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "오류가 발생했습니다.");
      setStatus("error");
    }
  };

  if (status === "done") return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2.5">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">문의가 접수되었습니다</h1>
        <p className="text-sm text-gray-500 leading-relaxed">
          담당자 검토 후 처리가 완료되면<br />
          입력하신 이메일(<span className="text-violet-600 font-medium">{form.requesterEmail}</span>)로<br />
          만족도 평가 링크를 보내드립니다.
        </p>
        <button
          onClick={() => { setStatus("idle"); setForm({ requester: "", requesterEmail: "", company: "", department: "", inquiryType: "SW", urgency: "기다릴 수 있어요", assetNo: "", content: "" }); }}
          className="mt-7 px-6 py-2.5 rounded-xl text-sm font-bold text-white"
          style={{ background: "#7C3AED" }}>
          추가 문의 접수
        </button>
        <p className="text-[10px] text-gray-300 mt-5">IDS 자산관리파트 · PC/OA 관리팀</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-xl">

        {/* Header */}
        <div className="bg-violet-600 rounded-t-2xl px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">IT 문의 접수</h1>
              <p className="text-violet-200 text-xs mt-0.5">IDS 자산관리파트 Help Desk</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 py-7 space-y-5">

          {/* 이름 + 이메일 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                이름 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.requester}
                onChange={set("requester")}
                placeholder="홍길동"
                required
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                이메일 <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                value={form.requesterEmail}
                onChange={set("requesterEmail")}
                placeholder="hong@company.com"
                required
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 transition"
              />
            </div>
          </div>

          {/* 법인 + 부서 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">법인</label>
              <select
                value={form.company}
                onChange={set("company")}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 transition">
                <option value="">선택</option>
                {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">부서</label>
              <input
                type="text"
                value={form.department}
                onChange={set("department")}
                placeholder="경영지원팀"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 transition"
              />
            </div>
          </div>

          {/* 문의유형 + 긴급도 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">문의유형</label>
              <div className="flex gap-2">
                {INQUIRY_TYPES.map(t => (
                  <button key={t} type="button"
                    onClick={() => setForm(f => ({ ...f, inquiryType: t }))}
                    className="flex-1 py-2 rounded-xl text-xs font-bold border transition-all"
                    style={{
                      background: form.inquiryType === t ? "#7C3AED" : "white",
                      color:      form.inquiryType === t ? "white"    : "#6B7280",
                      borderColor: form.inquiryType === t ? "#7C3AED" : "#E5E7EB",
                    }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">긴급도</label>
              <select
                value={form.urgency}
                onChange={set("urgency")}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 transition">
                {URGENCY_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 자산번호 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              자산번호 <span className="text-gray-400 font-normal">(선택 · PC/모니터 등 자산 문의 시)</span>
            </label>
            <input
              type="text"
              value={form.assetNo}
              onChange={set("assetNo")}
              placeholder="A-2024-0001"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 transition"
            />
          </div>

          {/* 문의내용 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              문의내용 <span className="text-red-400">*</span>
            </label>
            <textarea
              value={form.content}
              onChange={set("content")}
              placeholder="증상, 언제부터 발생했는지, 이미 시도해본 조치 등을 자세히 적어주세요."
              rows={5}
              required
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-300 transition"
            />
          </div>

          {/* 안내 문구 */}
          <div className="bg-violet-50 rounded-xl p-3 flex gap-2.5">
            <svg className="flex-shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p className="text-xs text-violet-700 leading-relaxed">
              문의 처리가 완료되면 입력하신 이메일로 처리 결과 및 만족도 평가 링크를 보내드립니다.
            </p>
          </div>

          {/* Error */}
          {status === "error" && (
            <p className="text-xs text-red-500 text-center">{errorMsg}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={status === "loading" || !form.requester || !form.requesterEmail || !form.content}
            className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "#7C3AED" }}>
            {status === "loading" ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
                접수 중...
              </span>
            ) : "문의 접수하기"}
          </button>

          <p className="text-center text-[10px] text-gray-300">IDS 자산관리파트 · PC/OA 관리팀</p>
        </form>
      </div>
    </div>
  );
}
