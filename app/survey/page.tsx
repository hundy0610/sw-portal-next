"use client";

import { useState } from "react";

const COMPANY_OPTIONS = ["엠서클", "IdsTrust", "대웅개발", "대웅", "페이지원", "웰다", "기타"];
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
    purpose: "", frequency: "", note: "",
    companyOther: "", frequencyOther: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const finalCompany   = form.company === "기타" ? form.companyOther : form.company;
      const finalFrequency = form.frequency === "기타" ? form.frequencyOther : form.frequency;

      const res = await fetch("/api/survey-demand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company:    finalCompany,
          department: form.department,
          name:       form.name,
          purpose:    form.purpose,
          frequency:  finalFrequency,
          note:       form.note,
        }),
      });
      const json = await res.json();
      if (json.ok) { setDone(true); }
      else { setError(json.error ?? "제출 중 오류가 발생했습니다."); }
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── 제출 완료 화면 ── */
  if (done) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 text-center max-w-sm w-full">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">응답이 접수되었습니다</h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          수요 조사에 참여해 주셔서 감사합니다.<br/>
          결과를 취합하여 추후 안내드리겠습니다.
        </p>
      </div>
    </div>
  );

  /* ── 설문 폼 ── */
  const inputCls = "w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white placeholder:text-gray-400";
  const labelCls = "block text-sm font-semibold text-gray-700 mb-1.5";
  const reqStar  = <span className="text-red-500 ml-0.5">*</span>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-10 px-4">
      <div className="max-w-lg mx-auto">

        {/* 헤더 카드 */}
        <div className="bg-white rounded-2xl shadow-sm border border-blue-100 p-7 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">수요조사</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 leading-snug mb-3">
            실시간 번역 툴 사용에 대한<br/>수요 조사
          </h1>
          <div className="bg-slate-50 rounded-xl p-4 text-sm text-gray-600 leading-relaxed border border-slate-100">
            <p className="font-semibold text-gray-800 mb-1">📌 목적 및 취지</p>
            <p>
              수요 조사를 통해 출장 기간 <span className="font-medium text-gray-900">(약 2주)</span> 동안 사용할 수 있는
              라이선스를 확보하고, 사용 목적·주기에 맞춰 계정을 배분하기 위함입니다.
            </p>
          </div>
        </div>

        {/* 설문 폼 카드 */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-7 space-y-5">

          {/* 1. 소속 법인 */}
          <div>
            <label className={labelCls}>1. 소속 법인{reqStar}</label>
            <div className="grid grid-cols-3 gap-2">
              {COMPANY_OPTIONS.map(c => (
                <button type="button" key={c}
                  onClick={() => set("company", c)}
                  className={`py-2 px-3 rounded-xl border text-sm font-medium transition-all ${
                    form.company === c
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                  }`}>
                  {c}
                </button>
              ))}
            </div>
            {form.company === "기타" && (
              <input className={`${inputCls} mt-2`} placeholder="법인명 직접 입력"
                value={form.companyOther} onChange={e => set("companyOther", e.target.value)} />
            )}
          </div>

          {/* 2. 부서명 */}
          <div>
            <label className={labelCls}>2. 부서명{reqStar}</label>
            <input className={inputCls} placeholder="예) AX팀, 콘텐츠운영팀"
              value={form.department} onChange={e => set("department", e.target.value)} />
          </div>

          {/* 3. 성함 */}
          <div>
            <label className={labelCls}>3. 성함{reqStar}</label>
            <input className={inputCls} placeholder="이름을 입력해 주세요"
              value={form.name} onChange={e => set("name", e.target.value)} />
          </div>

          <div className="border-t border-gray-100 pt-1" />

          {/* 4. 사용 목적 */}
          <div>
            <label className={labelCls}>4. 사용 목적{reqStar}</label>
            <p className="text-xs text-gray-400 mb-2">어떤 용도로 번역 툴을 사용하실 예정인지 구체적으로 작성해 주세요.</p>
            <textarea rows={3} className={inputCls} placeholder="예) 현지 거래처 이메일 번역, 계약서 검토, 미팅 실시간 통역 등"
              value={form.purpose} onChange={e => set("purpose", e.target.value)} />
          </div>

          {/* 5. 사용 주기 */}
          <div>
            <label className={labelCls}>5. 사용 주기{reqStar}</label>
            <div className="space-y-2">
              {FREQUENCY_OPTIONS.map(f => (
                <label key={f}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border cursor-pointer transition-all ${
                    form.frequency === f
                      ? "bg-blue-50 border-blue-400 text-blue-800"
                      : "border-gray-200 text-gray-700 hover:border-blue-200 hover:bg-slate-50"
                  }`}>
                  <input type="radio" name="frequency" className="accent-blue-600"
                    checked={form.frequency === f}
                    onChange={() => set("frequency", f)} />
                  <span className="text-sm font-medium">{f}</span>
                </label>
              ))}
              {form.frequency === "기타" && (
                <input className={`${inputCls} mt-1`} placeholder="사용 주기를 직접 입력해 주세요"
                  value={form.frequencyOther} onChange={e => set("frequencyOther", e.target.value)} />
              )}
            </div>
          </div>

          {/* 6. 특이 사항 */}
          <div>
            <label className={labelCls}>
              6. 특이 사항
              <span className="ml-1 text-xs font-normal text-gray-400">(선택)</span>
            </label>
            <textarea rows={3} className={inputCls} placeholder="추가로 전달하실 내용이 있으면 작성해 주세요."
              value={form.note} onChange={e => set("note", e.target.value)} />
          </div>

          {/* 오류 메시지 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              ⚠️ {error}
            </div>
          )}

          {/* 제출 버튼 */}
          <button type="submit" disabled={submitting}
            className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 active:scale-[.98] transition-all disabled:opacity-60 shadow-sm">
            {submitting ? "제출 중…" : "설문 제출하기"}
          </button>

          <p className="text-center text-xs text-gray-400">
            제출된 내용은 수요 조사 목적으로만 활용됩니다.
          </p>
        </form>

        <p className="text-center text-xs text-gray-400 mt-4">IdsTrust IT 자산관리 파트</p>
      </div>
    </div>
  );
}
