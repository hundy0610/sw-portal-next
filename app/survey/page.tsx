"use client";

import { useState } from "react";

const COMPANY_OPTIONS = [
  "대웅이엔지", "대웅", "대웅제약", "대웅바이오",
  "디엔컴퍼니", "대웅개발", "시지바이오", "이지메디컴",
  "IdsTrust", "인도네시아발리법인",
];

const FREQUENCY_OPTIONS = [
  "출장 기간 중 매일",
  "출장 기간 중 주 2~3회",
  "필요 시 간헐적으로",
  "단기 집중 사용 (출장 초반)",
  "기타",
];

export default function SurveyDemandPage() {
  const [form, setForm] = useState({
    company: "", department: "", name: "",
    purpose: "", frequency: "", frequencyOther: "", note: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form, v: string) =>
    setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const finalFrequency =
        form.frequency === "기타" ? form.frequencyOther : form.frequency;

      const res = await fetch("/api/survey-demand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company:    form.company,
          department: form.department,
          name:       form.name,
          purpose:    form.purpose,
          frequency:  finalFrequency,
          note:       form.note,
        }),
      });
      const json = await res.json();
      if (json.ok) setDone(true);
      else setError(json.error ?? "제출 중 오류가 발생했습니다.");
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── 완료 화면 ── */
  if (done) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <span className="text-4xl">✅</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">응답이 접수되었습니다</h2>
        <p className="text-gray-500 leading-relaxed">
          수요 조사에 참여해 주셔서 감사합니다.<br/>
          결과를 취합하여 추후 안내드리겠습니다.
        </p>
        <p className="text-xs text-gray-400 mt-6">IdsTrust IT 자산관리 파트</p>
      </div>
    </div>
  );

  /* ── 설문 폼 ── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex flex-col">

      {/* 상단 헤더 */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-8 py-5">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full tracking-wide">수요조사</span>
            <span className="text-xs text-gray-400">IdsTrust IT 자산관리 파트</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight tracking-tight">
            실시간 번역 툴<br className="sm:hidden" /> 사용 수요 조사
          </h1>
          <div className="mt-3 flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <span className="text-blue-500 mt-0.5 shrink-0">📌</span>
            <p className="text-sm text-blue-800 leading-relaxed">
              수요 조사를 통해 출장 기간 <strong>(약 2주)</strong> 동안 사용할 라이선스를 확보하고,
              사용 목적·주기에 맞춰 계정을 배분하기 위함입니다.
            </p>
          </div>
        </div>
      </div>

      {/* 폼 본문 */}
      <div className="flex-1 px-4 sm:px-8 py-8">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-8">

          {/* ① 소속 법인 */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
              <h2 className="text-base font-bold text-gray-900">소속 법인
                <span className="text-red-500 ml-0.5">*</span>
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {COMPANY_OPTIONS.map(c => (
                <button type="button" key={c}
                  onClick={() => set("company", c)}
                  className={`py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all text-left ${
                    form.company === c
                      ? "bg-blue-600 text-white border-blue-600 shadow-md scale-[1.02]"
                      : "bg-white text-gray-700 border-gray-200 hover:border-blue-400 hover:text-blue-700 hover:bg-blue-50"
                  }`}>
                  {c}
                </button>
              ))}
            </div>
          </section>

          {/* ② 부서명 + ③ 성함 — 나란히 */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
                <h2 className="text-base font-bold text-gray-900">부서명<span className="text-red-500 ml-0.5">*</span></h2>
              </div>
              <input
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 transition-colors bg-white placeholder:text-gray-400"
                placeholder="예) AX팀, 콘텐츠운영팀"
                value={form.department}
                onChange={e => set("department", e.target.value)} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">3</span>
                <h2 className="text-base font-bold text-gray-900">성함<span className="text-red-500 ml-0.5">*</span></h2>
              </div>
              <input
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 transition-colors bg-white placeholder:text-gray-400"
                placeholder="이름을 입력해 주세요"
                value={form.name}
                onChange={e => set("name", e.target.value)} />
            </div>
          </section>

          {/* ④ 사용 목적 */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">4</span>
              <h2 className="text-base font-bold text-gray-900">사용 목적<span className="text-red-500 ml-0.5">*</span></h2>
            </div>
            <p className="text-xs text-gray-400 mb-2.5 ml-9">어떤 용도로 번역 툴을 사용하실 예정인지 구체적으로 작성해 주세요.</p>
            <textarea rows={4}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 transition-colors bg-white placeholder:text-gray-400 resize-none"
              placeholder="예) 현지 거래처 이메일 번역, 계약서 검토, 미팅 실시간 통역 등"
              value={form.purpose}
              onChange={e => set("purpose", e.target.value)} />
          </section>

          {/* ⑤ 사용 주기 */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">5</span>
              <h2 className="text-base font-bold text-gray-900">사용 주기<span className="text-red-500 ml-0.5">*</span></h2>
            </div>
            <div className="space-y-2.5">
              {FREQUENCY_OPTIONS.map(f => (
                <label key={f}
                  className={`flex items-center gap-4 px-4 py-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                    form.frequency === f
                      ? "bg-blue-50 border-blue-500"
                      : "bg-white border-gray-200 hover:border-blue-300"
                  }`}>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                    form.frequency === f
                      ? "border-blue-600 bg-blue-600"
                      : "border-gray-300"
                  }`}>
                    {form.frequency === f && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <input type="radio" name="frequency" className="sr-only"
                    checked={form.frequency === f}
                    onChange={() => set("frequency", f)} />
                  <span className={`text-sm font-medium ${form.frequency === f ? "text-blue-800" : "text-gray-700"}`}>{f}</span>
                </label>
              ))}
              {form.frequency === "기타" && (
                <input
                  className="w-full px-4 py-3 border-2 border-blue-300 rounded-xl text-sm focus:outline-none focus:border-blue-500 bg-white"
                  placeholder="사용 주기를 직접 입력해 주세요"
                  value={form.frequencyOther}
                  onChange={e => set("frequencyOther", e.target.value)} />
              )}
            </div>
          </section>

          {/* ⑥ 특이 사항 */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-7 h-7 rounded-full bg-gray-300 text-white text-xs font-bold flex items-center justify-center shrink-0">6</span>
              <h2 className="text-base font-bold text-gray-900">
                특이 사항
                <span className="ml-2 text-xs font-normal text-gray-400">(선택)</span>
              </h2>
            </div>
            <textarea rows={3}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 transition-colors bg-white placeholder:text-gray-400 resize-none"
              placeholder="추가로 전달하실 내용이 있으면 작성해 주세요."
              value={form.note}
              onChange={e => set("note", e.target.value)} />
          </section>

          {/* 오류 메시지 */}
          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-start gap-2">
              <span className="shrink-0">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* 제출 버튼 */}
          <button type="submit" disabled={submitting}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-base hover:bg-blue-700 active:scale-[.98] transition-all disabled:opacity-60 shadow-lg shadow-blue-200">
            {submitting ? "제출 중…" : "설문 제출하기 →"}
          </button>

          <p className="text-center text-xs text-gray-400 pb-4">
            제출된 내용은 수요 조사 목적으로만 활용됩니다.
          </p>
        </form>
      </div>
    </div>
  );
}
