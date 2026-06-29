"use client";

import { useState, useRef, useEffect } from "react";

const C = {
  brand:       "#D97706",
  primary:     "#F59E0B",
  primarySoft: "#FFFBEB",
  text1:       "#1c1006",
  text2:       "#44403c",
  text3:       "#64748b",
  text4:       "#94a3b8",
  border:      "#fde68a",
  bg:          "#fef3d0",
  bgPage:      "#fffdf8",
} as const;

const CORPS = [
  "대웅",
  "대웅제약",
  "대웅바이오",
  "대웅이엔지",
  "대웅개발",
  "대웅펫",
  "한올바이오파마",
  "디엔컴퍼니",
  "디엔코스메틱스",
  "시지바이오",
  "시지엠베이스",
  "노바메디텍",
  "에이하나",
  "애디테라",
  "클리슈어리서치",
  "페이지원",
  "IdsTrust",
  "인도네시아발리법인",
];

const PURPOSE_OPTIONS   = ["화상회의", "오프라인 미팅", "기타"];
const LANGUAGE_OPTIONS  = ["영어", "인도네시아어", "중국어", "일본어", "스페인어", "프랑스어", "포르투갈어", "아랍어", "기타"];
const FREQUENCY_OPTIONS = ["출장 기간 중 매일", "출장 기간 중 주 2~3회", "필요 시 간헐적으로", "단기 집중 사용 (출장 초반)", "기타"];

/* ══════════════════════════════════════════
   드롭다운 — 멀티 체크박스
══════════════════════════════════════════ */
function MultiDropdown({ label, options, selected, onChange }: {
  label: string; options: string[];
  selected: string[]; onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const toggle = (opt: string) =>
    onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);

  return (
    <div ref={ref} className="relative w-full">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all text-left"
        style={{ background: "#fff", border: open ? `2px solid ${C.primary}` : "1.5px solid #e5e7eb", color: selected.length === 0 ? C.text4 : C.text1 }}>
        <span className="truncate pr-2">
          {selected.length === 0 ? `${label} 선택` : selected.join(", ")}
        </span>
        <span style={{ color: C.text3, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", display: "inline-block", flexShrink: 0 }}>▾</span>
      </button>
      {open && (
        <div className="absolute z-50 w-full mt-1 rounded-xl overflow-auto"
          style={{ background: "#fff", border: `1.5px solid ${C.border}`, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", maxHeight: 240 }}>
          {options.map(opt => {
            const checked = selected.includes(opt);
            return (
              <label key={opt}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                style={{ background: checked ? C.primarySoft : "transparent", borderBottom: "1px solid #f3f4f6" }}>
                <input type="checkbox" checked={checked} onChange={() => toggle(opt)}
                  style={{ width: 16, height: 16, accentColor: C.primary, cursor: "pointer", flexShrink: 0 }} />
                <span className="text-sm select-none" style={{ color: checked ? C.brand : C.text2, fontWeight: checked ? 600 : 400 }}>{opt}</span>
                {checked && <span className="ml-auto text-xs font-bold" style={{ color: C.primary }}>✓</span>}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════
   드롭다운 — 단일 선택
══════════════════════════════════════════ */
function SingleDropdown({ label, options, value, onChange }: {
  label: string; options: string[]; value: string; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} className="relative w-full">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all text-left"
        style={{ background: "#fff", border: open ? `2px solid ${C.primary}` : "1.5px solid #e5e7eb", color: !value ? C.text4 : C.text1 }}>
        <span className="truncate pr-2">{value || `${label} 선택`}</span>
        <span style={{ color: C.text3, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", display: "inline-block", flexShrink: 0 }}>▾</span>
      </button>
      {open && (
        <div className="absolute z-50 w-full mt-1 rounded-xl overflow-auto"
          style={{ background: "#fff", border: `1.5px solid ${C.border}`, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", maxHeight: 240 }}>
          {options.map(opt => {
            const sel = value === opt;
            return (
              <button key={opt} type="button"
                onClick={() => { onChange(opt); setOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                style={{ background: sel ? C.primarySoft : "transparent", borderBottom: "1px solid #f3f4f6", color: sel ? C.brand : C.text2, fontWeight: sel ? 600 : 400, fontSize: 14 }}>
                <span className="shrink-0 w-4 h-4 rounded-full border flex items-center justify-center"
                  style={{ borderColor: sel ? C.primary : "#d1d5db", background: sel ? C.primary : "transparent" }}>
                  {sel && <span style={{ width: 6, height: 6, background: "#fff", borderRadius: "50%", display: "block" }} />}
                </span>
                <span className="flex-1">{opt}</span>
                {sel && <span className="text-xs font-bold" style={{ color: C.primary }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════
   질문 래퍼
══════════════════════════════════════════ */
function Q({ num, label, required, children }: { num: number; label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="shrink-0 w-7 h-7 rounded-full text-white flex items-center justify-center text-xs font-bold mt-0.5"
        style={{ background: C.brand }}>{num}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold mb-2" style={{ color: C.text1 }}>
          {label}{required && <span className="ml-1 text-red-500">*</span>}
        </p>
        {children}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   텍스트 입력 공통 스타일
══════════════════════════════════════════ */
const inputBase: React.CSSProperties = {
  width: "100%", background: "#fff",
  border: "1.5px solid #e5e7eb", borderRadius: 12,
  padding: "12px 16px", fontSize: 14, color: "#1c1006", outline: "none",
};

/* ══════════════════════════════════════════
   메인
══════════════════════════════════════════ */
export default function SurveyPage() {
  const [corp,         setCorp]         = useState("");
  const [dept,         setDept]         = useState("");
  const [name,         setName]         = useState("");
  const [email,        setEmail]        = useState("");
  const [purposes,     setPurposes]     = useState<string[]>([]);
  const [purposeEtc,   setPurposeEtc]   = useState("");
  const [languages,    setLanguages]    = useState<string[]>([]);
  const [languageEtc,  setLanguageEtc]  = useState("");
  const [frequency,    setFrequency]    = useState("");
  const [frequencyEtc, setFrequencyEtc] = useState("");
  const [note,         setNote]         = useState("");
  const [status,       setStatus]       = useState<"idle"|"loading"|"done"|"error">("idle");

  function focusBorder(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    e.currentTarget.style.borderColor = C.primary;
  }
  function blurBorder(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    e.currentTarget.style.borderColor = "#e5e7eb";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!corp || !dept || !name || !email || !purposes.length || !languages.length || !frequency) {
      alert("필수 항목을 모두 입력해주세요."); return;
    }
    if (purposes.includes("기타") && !purposeEtc.trim()) {
      alert("사용 목적 '기타' 내용을 입력해주세요."); return;
    }
    if (frequency === "기타" && !frequencyEtc.trim()) {
      alert("사용 주기 '기타' 내용을 입력해주세요."); return;
    }
    setStatus("loading");
    try {
      const res = await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ corp, dept, name, email, purposes, purposeEtc, languages, languageEtc, frequency, frequencyEtc, note }),
      });
      if (!res.ok) throw new Error();
      setStatus("done");
    } catch { setStatus("error"); }
  }

  /* 완료 화면 */
  if (status === "done") return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: C.bgPage }}>
      <div className="w-full max-w-md rounded-3xl p-10 text-center"
        style={{ background: "#fff", border: `1px solid ${C.border}`, boxShadow: "0 8px 32px rgba(0,0,0,0.06)" }}>
        <div className="text-5xl mb-5">✅</div>
        <h2 className="text-2xl font-extrabold mb-3" style={{ color: C.text1 }}>제출 완료</h2>
        <p className="text-sm leading-relaxed mb-6" style={{ color: C.text3 }}>
          수요 조사에 참여해 주셔서 감사합니다.<br />
          검토 후 계정 배분 시 입력하신 이메일로 안내 드리겠습니다.
        </p>
        <p className="text-xs" style={{ color: C.text4 }}>문의 : IT 자산관리파트</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: C.bgPage }}>

      {/* ── 헤더 ── */}
      <div className="w-full px-4 pt-8 pb-4 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-3"
          style={{ background: C.primarySoft, color: C.brand }}>
          📋 IdsTrust IT 자산관리파트
        </div>
        <h1 className="font-extrabold mb-2" style={{ color: C.text1, fontSize: "clamp(1.25rem, 4vw, 1.75rem)" }}>
          실시간 번역 툴 사용 수요 조사
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: C.text3 }}>
          사용 목적과 사용 주기를 파악하여 필요한 계정 수량을 확인하기 위한 조사입니다.
        </p>
      </div>

      {/* ── 폼 ── */}
      <div className="w-full px-3 sm:px-6 lg:px-8 pb-10">
        <form onSubmit={submit}
          className="w-full mx-auto rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8"
          style={{
            maxWidth: 860,
            background: "#fff",
            border: `1px solid ${C.border}`,
            boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
          }}>

          {/* 2열 그리드 (데스크톱) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">

            {/* Q1 소속 법인 */}
            <Q num={1} label="소속 법인" required>
              <SingleDropdown label="소속 법인" options={CORPS} value={corp} onChange={setCorp} />
            </Q>

            {/* Q2 부서명 */}
            <Q num={2} label="부서명" required>
              <input style={inputBase} placeholder="부서명을 입력하세요"
                value={dept} onChange={e => setDept(e.target.value)}
                onFocus={focusBorder} onBlur={blurBorder} />
            </Q>

            {/* Q3 성함 */}
            <Q num={3} label="성함" required>
              <input style={inputBase} placeholder="성함을 입력하세요"
                value={name} onChange={e => setName(e.target.value)}
                onFocus={focusBorder} onBlur={blurBorder} />
            </Q>

            {/* Q4 이메일 */}
            <Q num={4} label="이메일 주소" required>
              <input type="email" style={inputBase} placeholder="계정 배분 시 연락드릴 이메일"
                value={email} onChange={e => setEmail(e.target.value)}
                onFocus={focusBorder} onBlur={blurBorder} />
            </Q>

          </div>

          {/* 구분선 */}
          <div className="mb-5" style={{ borderTop: `1px dashed ${C.border}` }} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">

            {/* Q5 사용 목적 */}
            <div className="flex flex-col gap-2">
              <Q num={5} label="사용 목적 (복수 선택 가능)" required>
                <MultiDropdown label="사용 목적" options={PURPOSE_OPTIONS} selected={purposes} onChange={setPurposes} />
              </Q>
              {purposes.includes("기타") && (
                <div className="ml-10">
                  <textarea style={{ ...inputBase, minHeight: 72, resize: "none" }}
                    placeholder="기타 사용 목적을 입력해주세요"
                    value={purposeEtc} onChange={e => setPurposeEtc(e.target.value)}
                    onFocus={e => { e.currentTarget.style.borderColor = C.primary; }}
                    onBlur={e  => { e.currentTarget.style.borderColor = "#e5e7eb"; }} />
                </div>
              )}
            </div>

            {/* Q6 주요 사용 언어 */}
            <div className="flex flex-col gap-2">
              <Q num={6} label="주요 사용 언어 (복수 선택 가능)" required>
                <MultiDropdown label="사용 언어" options={LANGUAGE_OPTIONS} selected={languages} onChange={setLanguages} />
              </Q>
              {languages.includes("기타") && (
                <div className="ml-10">
                  <input style={inputBase} placeholder="기타 언어를 입력해주세요"
                    value={languageEtc} onChange={e => setLanguageEtc(e.target.value)}
                    onFocus={focusBorder} onBlur={blurBorder} />
                </div>
              )}
            </div>

            {/* Q7 사용 주기 */}
            <div className="flex flex-col gap-2">
              <Q num={7} label="사용 주기" required>
                <SingleDropdown label="사용 주기" options={FREQUENCY_OPTIONS} value={frequency} onChange={setFrequency} />
              </Q>
              {frequency === "기타" && (
                <div className="ml-10">
                  <input style={inputBase} placeholder="사용 주기를 입력해주세요"
                    value={frequencyEtc} onChange={e => setFrequencyEtc(e.target.value)}
                    onFocus={focusBorder} onBlur={blurBorder} />
                </div>
              )}
            </div>

            {/* Q8 특이사항 */}
            <Q num={8} label="특이 사항 (선택)">
              <textarea style={{ ...inputBase, minHeight: 80, resize: "none" }}
                placeholder="추가로 전달할 내용이 있으면 입력해주세요"
                value={note} onChange={e => setNote(e.target.value)}
                onFocus={e => { e.currentTarget.style.borderColor = C.primary; }}
                onBlur={e  => { e.currentTarget.style.borderColor = "#e5e7eb"; }} />
            </Q>

          </div>

          {/* 에러 */}
          {status === "error" && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm"
              style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
              제출 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
            </div>
          )}

          {/* 제출 버튼 */}
          <button type="submit" disabled={status === "loading"}
            className="w-full py-4 rounded-2xl font-bold text-white text-sm transition-all mt-2"
            style={{ background: status === "loading" ? "#d1d5db" : C.brand, cursor: status === "loading" ? "not-allowed" : "pointer" }}>
            {status === "loading" ? "제출 중..." : "설문 제출하기 →"}
          </button>

          <p className="text-center text-xs mt-3" style={{ color: C.text4 }}>
            제출된 내용은 수요 조사 목적으로만 활용됩니다.
          </p>

        </form>
      </div>
    </div>
  );
}
