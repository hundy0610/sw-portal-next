"use client";

import { useState } from "react";

const DEPARTMENTS = ["재무팀", "인사팀", "계약관리팀"];
const TOOLS = ["Excel", "SAP", "GroupWare", "이메일", "ERP", "기타"];
const CYCLES = ["매일", "매주", "매월", "비정기"];
const HOURS = ["1시간 미만", "1~3시간", "3~5시간", "5시간 이상"];
const URGENCY_OPTIONS = [
  { value: "매우 급합니다",     emoji: "🔴", desc: "빠른 처리가 필요합니다"  },
  { value: "조금 급합니다",    emoji: "🟡", desc: "가능하면 빨리 해결됐으면 합니다" },
  { value: "여유 있습니다",    emoji: "🟢", desc: "시간적 여유가 있습니다"   },
];

type Status = "idle" | "loading" | "done" | "error";

export default function AutomationPage() {
  const [form, setForm] = useState({
    requester:    "",
    email:        "",
    department:   "",
    taskName:     "",
    tools:        [] as string[],
    cycle:        "",
    weeklyHours:  "",
    currentFlow:  "",
    desiredFlow:  "",
    extra:        "",
    urgency:      "여유 있습니다",
  });
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const set = (key: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm(f => ({ ...f, [key]: e.target.value }));

  const toggleTool = (tool: string) => {
    setForm(f => ({
      ...f,
      tools: f.tools.includes(tool)
        ? f.tools.filter(t => t !== tool)
        : [...f.tools, tool],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.requester || !form.email || !form.department ||
        !form.taskName || !form.currentFlow || !form.desiredFlow) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "등록 실패");
      setStatus("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "오류가 발생했습니다.");
      setStatus("error");
    }
  };

  if (status === "done") return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center border border-indigo-100">
        <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2.5">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">접수 완료!</h2>
        <p className="text-sm text-gray-500 mb-1">
          <span className="font-semibold text-indigo-600">{form.requester}</span>님의 자동화 과제가 접수되었습니다.
        </p>
        <p className="text-sm text-gray-400 mb-6">담당자 확인 후 개별 연락드리겠습니다.</p>
        <button
          onClick={() => {
            setForm({ requester:"", email:"", department:"", taskName:"", tools:[], cycle:"", weeklyHours:"", currentFlow:"", desiredFlow:"", extra:"", urgency:"여유 있습니다" });
            setStatus("idle");
          }}
          className="text-sm text-indigo-600 hover:text-indigo-800 underline underline-offset-2"
        >
          추가 과제 접수하기
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-white py-10 px-4">
      <div className="max-w-2xl mx-auto">

        {/* 헤더 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 mb-4 shadow-lg">
            <span className="text-2xl">⚙️</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">업무 자동화 과제 접수</h1>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            반복적이고 시간이 많이 걸리는 업무를 알려주세요.<br/>
            개발팀에서 검토 후 자동화 방안을 제안해 드립니다.
          </p>
          <div className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-50 rounded-full">
            <span className="text-xs text-indigo-600 font-medium">재무팀 · 인사팀 · 계약관리팀 대상</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* 신청자 정보 */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center font-bold">1</span>
              신청자 정보
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">이름 <span className="text-red-400">*</span></label>
                <input value={form.requester} onChange={set("requester")} required
                  placeholder="홍길동"
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-shadow"/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">이메일 <span className="text-red-400">*</span></label>
                <input value={form.email} onChange={set("email")} required type="email"
                  placeholder="hong@company.com"
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-shadow"/>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">소속 부서 <span className="text-red-400">*</span></label>
                <div className="flex gap-3 flex-wrap">
                  {DEPARTMENTS.map(d => (
                    <button type="button" key={d}
                      onClick={() => setForm(f => ({ ...f, department: d }))}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                        form.department === d
                          ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                          : "border-gray-200 text-gray-500 hover:border-gray-300"
                      }`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 자동화 대상 업무 */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center font-bold">2</span>
              자동화 대상 업무
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">업무명 <span className="text-red-400">*</span></label>
                <input value={form.taskName} onChange={set("taskName")} required
                  placeholder="예: 월말 경비 정산 취합, 입사자 시스템 계정 생성 등"
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-shadow"/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">현재 사용 도구</label>
                <div className="flex gap-2 flex-wrap">
                  {TOOLS.map(t => (
                    <button type="button" key={t}
                      onClick={() => toggleTool(t)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${
                        form.tools.includes(t)
                          ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                          : "border-gray-200 text-gray-500 hover:border-gray-300"
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">반복 주기</label>
                  <div className="grid grid-cols-2 gap-2">
                    {CYCLES.map(c => (
                      <button type="button" key={c}
                        onClick={() => setForm(f => ({ ...f, cycle: c }))}
                        className={`py-2 rounded-lg text-xs font-semibold border-2 transition-all ${
                          form.cycle === c
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                            : "border-gray-200 text-gray-500 hover:border-gray-300"
                        }`}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">주간 소요 시간</label>
                  <div className="grid grid-cols-2 gap-2">
                    {HOURS.map(h => (
                      <button type="button" key={h}
                        onClick={() => setForm(f => ({ ...f, weeklyHours: h }))}
                        className={`py-2 rounded-lg text-[11px] font-semibold border-2 transition-all ${
                          form.weeklyHours === h
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                            : "border-gray-200 text-gray-500 hover:border-gray-300"
                        }`}>
                        {h}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 현재 방식 및 목표 */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center font-bold">3</span>
              현재 방식 및 자동화 목표
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  현재 어떻게 처리하고 있나요? <span className="text-red-400">*</span>
                </label>
                <textarea value={form.currentFlow} onChange={set("currentFlow")} required rows={4}
                  placeholder="예: 매월 말일 각 팀에서 경비 내역을 이메일로 받아 Excel에 수동으로 취합한 뒤 SAP에 입력합니다. 약 3시간 소요됩니다."
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-shadow"/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  자동화 후 어떻게 바뀌었으면 하나요? <span className="text-red-400">*</span>
                </label>
                <textarea value={form.desiredFlow} onChange={set("desiredFlow")} required rows={4}
                  placeholder="예: 각 팀 데이터가 자동으로 취합되어 SAP에 직접 입력되고, 담당자에게 완료 알림이 오면 좋겠습니다."
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-shadow"/>
              </div>
            </div>
          </div>

          {/* 긴급도 및 추가 요청 */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center font-bold">4</span>
              긴급도 및 추가 사항
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2">처리 긴급도</label>
                <div className="flex gap-3 flex-wrap">
                  {URGENCY_OPTIONS.map(u => (
                    <button type="button" key={u.value}
                      onClick={() => setForm(f => ({ ...f, urgency: u.value }))}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                        form.urgency === u.value
                          ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                          : "border-gray-200 text-gray-500 hover:border-gray-300"
                      }`}>
                      <span>{u.emoji}</span>
                      <span>{u.value}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">추가 요청사항 (선택)</label>
                <textarea value={form.extra} onChange={set("extra")} rows={3}
                  placeholder="기타 참고사항이 있으면 자유롭게 작성해 주세요."
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-shadow"/>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              ⚠️ {errorMsg}
            </div>
          )}

          <button type="submit" disabled={status === "loading" ||
            !form.requester || !form.email || !form.department ||
            !form.taskName || !form.currentFlow || !form.desiredFlow}
            className="w-full py-4 rounded-2xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-200">
            {status === "loading" ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                접수 중…
              </span>
            ) : "⚙️ 자동화 과제 접수하기"}
          </button>
          <p className="text-center text-xs text-gray-400 pb-4">
            * 표시 항목은 필수입니다 · 접수 후 담당자가 이메일로 연락드립니다
          </p>
        </form>
      </div>
    </div>
  );
}
