"use client";

import { useState } from "react";

const COMPANY_OPTIONS = [
  "대웅이엔지", "대웅", "대웅제약", "대웅바이오",
  "디엔컴퍼니", "대웅개발", "시지바이오", "이지메디컴",
  "IdsTrust", "인도네시아발리법인",
];

const PURPOSE_OPTIONS = ["화상회의", "오프라인 미팅", "기타"];

const LANGUAGE_OPTIONS = [
  "영어", "인도네시아어", "중국어", "일본어",
  "스페인어", "프랑스어", "포르투갈어", "아랍어", "기타",
];

const FREQUENCY_OPTIONS = [
  "출장 기간 중 매일",
  "출장 기간 중 주 2~3회",
  "필요 시 간헐적으로",
  "단기 집중 사용 (출장 초반)",
  "기타",
];

function CheckGroup({
  options, selected, onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (opt: string) => {
    onChange(
      selected.includes(opt)
        ? selected.filter(v => v !== opt)
        : [...selected, opt]
    );
  };
  return (
    <div className="flex flex-wrap gap-2.5">
      {options.map(opt => {
        const active = selected.includes(opt);
        return (
          <button
            type="button"
            key={opt}
            onClick={() => toggle(opt)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
              active
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "bg-white text-gray-700 border-gray-200 hover:border-blue-400 hover:text-blue-700"
            }`}
          >
            <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
              active ? "border-white bg-white/20" : "border-current"
            }`}>
              {active && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
              </svg>}
            </span>
            {opt}
          </button>
        );
      })}
    </div>
  );
}

export default function SurveyDemandPage() {
  const [form, setForm] = useState({
    company: "", department: "", name: "", email: "",
    purpose: [] as string[],
    language: [] as string[],
    frequency: "", frequencyOther: "",
    note: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [done,       setDone]       = useState(false);
  const [error,      setError]      = useState("");

  const set = (k: keyof typeof form, v: any) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.company)          { setError("소속 법인을 선택해 주세요."); return; }
    if (!form.department.trim()){ setError("부서명을 입력해 주세요."); return; }
    if (!form.name.trim())      { setError("성함을 입력해 주세요."); return; }
    if (!form.email.trim())     { setError("이메일을 입력해 주세요."); return; }
    if (form.purpose.length === 0)  { setError("사용 목적을 하나 이상 선택해 주세요."); return; }
    if (form.language.length === 0) { setError("주요 언어를 하나 이상 선택해 주세요."); return; }
    if (!form.frequency)        { setError("사용 주기를 선택해 주세요."); return; }

    const finalFrequency = form.frequency === "기타" ? form.frequencyOther : form.frequency;

    setSubmitting(true);
    try {
      const res  = await fetch("/api/survey-demand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company:    form.company,
          department: form.department,
          name:       form.name,
          email:      form.email,
          purpose:    form.purpose,
          language:   form.language,
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

  const inputCls = "w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 transition-colors bg-white placeholder:text-gray-400";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex flex-col">

      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-8 py-5">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full">수요조사</span>
            <span className="text-xs text-gray-400">IdsTrust IT 자산관리 파트</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">
            실시간 번역 툴 사용 수요 조사
          </h1>
          <div className="mt-3 flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <span className="text-blue-500 mt-0.5 shrink-0">📌</span>
            <p className="text-sm text-blue-800 leading-relaxed">
              수요 조사를 통해 사용목적과 사용주기를 파악하고 필요한 계정에 대한 수량을 확인하기 위함입니다.
            </p>
          </div>
        </div>
      </div>

      {/* 폼 */}
      <div className="flex-1 px-4 sm:px-8 py-8">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-8">

          {/* ① 소속 법인 */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
              <h2 className="text-base font-bold text-gray-900">소속 법인<span className="text-red-500 ml-0.5">*</span></h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {COMPANY_OPTIONS.map(c => (
                <button type="button" key={c}
                  onClick={() => set("company", c)}
                  className={`py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all text-left ${
                    form.company === c
                      ? "bg-blue-600 text-white border-blue-600 shadow-md"
                      : "bg-white text-gray-700 border-gray-200 hover:border-blue-400 hover:text-blue-700"
                  }`}>
                  {c}
                </button>
              ))}
            </div>
          </section>

          {/* ② 부서명 + ③ 성함 */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
                <h2 className="text-base font-bold text-gray-900">부서명<span className="text-red-500 ml-0.5">*</span></h2>
              </div>
              <input className={inputCls} placeholder="예) AX팀, 콘텐츠운영팀"
                value={form.department} onChange={e => set("department", e.target.value)} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">3</span>
                <h2 className="text-base font-bold text-gray-900">성함<span className="text-red-500 ml-0.5">*</span></h2>
              </div>
              <input className={inputCls} placeholder="이름을 입력해 주세요"
                value={form.name} onChange={e => set("name", e.target.value)} />
            </div>
          </section>

          {/* ④ 이메일 */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">4</span>
              <h2 className="text-base font-bold text-gray-900">이메일 주소<span className="text-red-500 ml-0.5">*</span></h2>
            </div>
            <p className="text-xs text-gray-400 mb-2.5 ml-9">계정 배분 시 연락드릴 이메일을 입력해 주세요.</p>
            <input type="email" className={inputCls} placeholder="예) yourname@company.com"
              value={form.email} onChange={e => set("email", e.target.value)} />
          </section>

          {/* ⑤ 사용 목적 (체크박스) */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">5</span>
              <h2 className="text-base font-bold text-gray-900">
                사용 목적<span className="text-red-500 ml-0.5">*</span>
                <span className="ml-2 text-xs font-normal text-gray-400">복수 선택 가능</span>
              </h2>
            </div>
            <CheckGroup
              options={PURPOSE_OPTIONS}
              selected={form.purpose}
              onChange={v => set("purpose", v)}
            />
          </section>

          {/* ⑥ 주요 언어 (체크박스) */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">6</span>
              <h2 className="text-base font-bold text-gray-900">
                주요 사용 언어<span className="text-red-500 ml-0.5">*</span>
                <span className="ml-2 text-xs font-normal text-gray-400">복수 선택 가능</span>
              </h2>
            </div>
            <CheckGroup
              options={LANGUAGE_OPTIONS}
              selected={form.language}
              onChange={v => set("language", v)}
            />
          </section>

          {/* ⑦ 사용 주기 */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">7</span>
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
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    form.frequency === f ? "border-blue-600 bg-blue-600" : "border-gray-300"
                  }`}>
                    {form.frequency === f && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <input type="radio" name="frequency" className="sr-only"
                    checked={form.frequency === f} onChange={() => set("frequency", f)} />
                  <span className={`text-sm font-medium ${form.frequency === f ? "text-blue-800" : "text-gray-700"}`}>{f}</span>
                </label>
              ))}
              {form.frequency === "기타" && (
                <input className={`${inputCls} mt-1`} placeholder="사용 주기를 직접 입력해 주세요"
                  value={form.frequencyOther} onChange={e => set("frequencyOther", e.target.value)} />
              )}
            </div>
          </section>

          {/* ⑧ 특이 사항 */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-7 h-7 rounded-full bg-gray-300 text-white text-xs font-bold flex items-center justify-center shrink-0">8</span>
              <h2 className="text-base font-bold text-gray-900">
                특이 사항
                <span className="ml-2 text-xs font-normal text-gray-400">(선택)</span>
              </h2>
            </div>
            <textarea rows={3} className={`${inputCls} resize-none`}
              placeholder="추가로 전달하실 내용이 있으면 작성해 주세요."
              value={form.note} onChange={e => set("note", e.target.value)} />
          </section>

          {/* 오류 */}
          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-start gap-2">
              <span className="shrink-0">⚠️</span><span>{error}</span>
            </div>
          )}

          {/* 제출 */}
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
