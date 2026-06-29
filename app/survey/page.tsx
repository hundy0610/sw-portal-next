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

/* ── 법인 목록 ── */
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
  "시지엠베이서",
  "노바메디텍",
  "에이하나",
  "애디테라",
  "클리슈어리서치",
  "페이지원",
  "IdsTrust",
  "인도네시아발리법인",
];

/* ── 사용 목적 ── */
const PURPOSE_OPTIONS = ["화상회의", "오프라인 미팅", "기타"];

/* ── 주요 사용 언어 ── */
const LANGUAGE_OPTIONS = [
  "영어", "인도네시아어", "중국어", "일본어",
  "스페인어", "프랑스어", "포르투갈어", "아랍어", "기타",
];

/* ── 사용 주기 ── */
const FREQUENCY_OPTIONS = [
  "출장 기간 중 매일",
  "출장 기간 중 주 2~3회",
  "필요 시 간헐적으로",
  "단기 집중 사용 (출장 초반)",
  "기타",
];

/* ══════════════════════════════════════════════
   드롭다운 멀티 체크박스 컴포넌트
══════════════════════════════════════════════ */
function MultiDropdown({
  label,
  options,
  selected,
  onChange,
  required,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function toggle(opt: string) {
    onChange(
      selected.includes(opt)
        ? selected.filter(s => s !== opt)
        : [...selected, opt]
    );
  }

  const displayText =
    selected.length === 0
      ? `${label} 선택`
      : selected.join(", ");

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all"
        style={{
          background: "#fff",
          border: open ? `2px solid ${C.primary}` : `1.5px solid #e5e7eb`,
          color: selected.length === 0 ? C.text4 : C.text1,
          textAlign: "left",
        }}
      >
        <span className="truncate">{displayText}</span>
        <span
          className="shrink-0 ml-2 transition-transform"
          style={{
            color: C.text3,
            transform: open ? "rotate(180deg)" : "none",
            display: "inline-block",
          }}
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          className="absolute z-50 w-full mt-1.5 rounded-xl overflow-hidden"
          style={{
            background: "#fff",
            border: `1.5px solid ${C.border}`,
            boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
          }}
        >
          {options.map(opt => {
            const checked = selected.includes(opt);
            return (
              <label
                key={opt}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors"
                style={{
                  background: checked ? C.primarySoft : "transparent",
                  borderBottom: `1px solid #f3f4f6`,
                }}
                onMouseEnter={e => { if (!checked) (e.currentTarget as HTMLElement).style.background = "#fafafa"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = checked ? C.primarySoft : "transparent"; }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(opt)}
                  className="shrink-0"
                  style={{
                    width: 16,
                    height: 16,
                    accentColor: C.primary,
                    cursor: "pointer",
                  }}
                />
                <span className="text-sm" style={{ color: checked ? C.brand : C.text2, fontWeight: checked ? 600 : 400 }}>
                  {opt}
                </span>
                {checked && (
                  <span className="ml-auto text-xs font-bold" style={{ color: C.primary }}>✓</span>
                )}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   드롭다운 단일 선택 컴포넌트
══════════════════════════════════════════════ */
function SingleDropdown({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all"
        style={{
          background: "#fff",
          border: open ? `2px solid ${C.primary}` : `1.5px solid #e5e7eb`,
          color: !value ? C.text4 : C.text1,
          textAlign: "left",
        }}
      >
        <span>{value || `${label} 선택`}</span>
        <span
          className="shrink-0 ml-2 transition-transform"
          style={{
            color: C.text3,
            transform: open ? "rotate(180deg)" : "none",
            display: "inline-block",
          }}
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          className="absolute z-50 w-full mt-1.5 rounded-xl overflow-hidden"
          style={{
            background: "#fff",
            border: `1.5px solid ${C.border}`,
            boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
          }}
        >
          {options.map(opt => {
            const selected = value === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                style={{
                  background: selected ? C.primarySoft : "transparent",
                  borderBottom: `1px solid #f3f4f6`,
                  color: selected ? C.brand : C.text2,
                  fontWeight: selected ? 600 : 400,
                  fontSize: 14,
                }}
              >
                <span
                  className="shrink-0 w-4 h-4 rounded-full border flex items-center justify-center"
                  style={{
                    borderColor: selected ? C.primary : "#d1d5db",
                    background: selected ? C.primary : "transparent",
                  }}
                >
                  {selected && <span style={{ width: 6, height: 6, background: "#fff", borderRadius: "50%", display: "block" }} />}
                </span>
                {opt}
                {selected && <span className="ml-auto text-xs font-bold" style={{ color: C.primary }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   질문 래퍼
══════════════════════════════════════════════ */
function Question({
  num, label, required, children,
}: {
  num: number;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-start gap-2 mb-2">
        <span
          className="shrink-0 w-6 h-6 rounded-full text-white flex items-center justify-center text-xs font-bold mt-0.5"
          style={{ background: C.brand }}
        >
          {num}
        </span>
        <label className="text-sm font-semibold leading-relaxed" style={{ color: C.text1 }}>
          {label}
          {required && <span className="ml-1" style={{ color: "#ef4444" }}>*</span>}
        </label>
      </div>
      <div className="ml-8">{children}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   메인 페이지
══════════════════════════════════════════════ */
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
  const [status,       setStatus]       = useState<"idle" | "loading" | "done" | "error">("idle");

  const inputStyle = {
    background: "#fff",
    border: `1.5px solid #e5e7eb`,
    borderRadius: 12,
    padding: "12px 16px",
    fontSize: 14,
    color: C.text1,
    width: "100%",
    outline: "none",
    transition: "border-color 0.15s",
  } as const;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // 필수값 검증
    if (!corp || !dept || !name || !email || purposes.length === 0 || languages.length === 0 || !frequency) {
      alert("필수 항목을 모두 입력해주세요.");
      return;
    }
    if (purposes.includes("기타") && !purposeEtc.trim()) {
      alert("사용 목적 '기타' 내용을 입력해주세요.");
      return;
    }
    if (frequency === "기타" && !frequencyEtc.trim()) {
      alert("사용 주기 '기타' 내용을 입력해주세요.");
      return;
    }

    setStatus("loading");
    try {
      const res = await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          corp, dept, name, email,
          purposes, purposeEtc,
          languages, languageEtc,
          frequency, frequencyEtc,
          note,
        }),
      });
      if (!res.ok) throw new Error();
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  /* ── 완료 화면 ── */
  if (status === "done") {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: C.bgPage }}
      >
        <div
          className="w-full max-w-md rounded-3xl p-10 text-center"
          style={{ background: "#fff", border: `1px solid ${C.border}`, boxShadow: "0 8px 32px rgba(0,0,0,0.06)" }}
        >
          <div className="text-5xl mb-5">✅</div>
          <h2 className="text-2xl font-extrabold mb-3" style={{ color: C.text1 }}>제출 완료</h2>
          <p className="text-sm leading-relaxed mb-6" style={{ color: C.text3 }}>
            수요 조사에 참여해 주셔서 감사합니다.<br />
            검토 후 계정 배분 시 입력하신 이메일로 안내 드리겠습니다.
          </p>
          <p className="text-xs" style={{ color: C.text4 }}>
            문의: IT 자산관리파트
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-10" style={{ background: C.bgPage }}>
      <div className="w-full max-w-lg mx-auto">

        {/* 헤더 */}
        <div className="mb-8 text-center">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-4"
            style={{ background: C.primarySoft, color: C.brand }}
          >
            📋 IdsTrust IT 자산관리파트
          </div>
          <h1 className="text-2xl font-extrabold mb-2" style={{ color: C.text1 }}>
            실시간 번역 툴 사용 수요 조사
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: C.text3 }}>
            사용 목적과 사용 주기를 파악하여<br />
            필요한 계정 수량을 확인하기 위한 조사입니다.
          </p>
        </div>

        {/* 폼 카드 */}
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl p-7"
          style={{ background: "#fff", border: `1px solid ${C.border}`, boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}
        >

          {/* Q1. 소속 법인 */}
          <Question num={1} label="소속 법인" required>
            <SingleDropdown
              label="소속 법인"
              options={CORPS}
              value={corp}
              onChange={setCorp}
            />
          </Question>

          {/* Q2. 부서명 */}
          <Question num={2} label="부서명" required>
            <input
              style={inputStyle}
              placeholder="부서명을 입력하세요"
              value={dept}
              onChange={e => setDept(e.target.value)}
              onFocus={e  => (e.currentTarget.style.borderColor = C.primary)}
              onBlur={e   => (e.currentTarget.style.borderColor = "#e5e7eb")}
            />
          </Question>

          {/* Q3. 성함 */}
          <Question num={3} label="성함" required>
            <input
              style={inputStyle}
              placeholder="성함을 입력하세요"
              value={name}
              onChange={e => setName(e.target.value)}
              onFocus={e  => (e.currentTarget.style.borderColor = C.primary)}
              onBlur={e   => (e.currentTarget.style.borderColor = "#e5e7eb")}
            />
          </Question>

          {/* Q4. 이메일 */}
          <Question num={4} label="이메일 주소" required>
            <input
              type="email"
              style={inputStyle}
              placeholder="계정 배분 시 연락드릴 이메일을 입력해주세요"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onFocus={e  => (e.currentTarget.style.borderColor = C.primary)}
              onBlur={e   => (e.currentTarget.style.borderColor = "#e5e7eb")}
            />
          </Question>

          {/* Q5. 사용 목적 */}
          <Question num={5} label="사용 목적 (복수 선택 가능)" required>
            <MultiDropdown
              label="사용 목적"
              options={PURPOSE_OPTIONS}
              selected={purposes}
              onChange={setPurposes}
            />
            {/* 기타 입력칸 */}
            {purposes.includes("기타") && (
              <textarea
                className="mt-2 w-full px-4 py-3 rounded-xl text-sm resize-none"
                style={{
                  border: `1.5px solid ${C.primary}`,
                  background: C.primarySoft,
                  color: C.text1,
                  outline: "none",
                  minHeight: 72,
                }}
                placeholder="기타 사용 목적을 입력해주세요"
                value={purposeEtc}
                onChange={e => setPurposeEtc(e.target.value)}
              />
            )}
          </Question>

          {/* Q6. 주요 사용 언어 */}
          <Question num={6} label="주요 사용 언어 (복수 선택 가능)" required>
            <MultiDropdown
              label="사용 언어"
              options={LANGUAGE_OPTIONS}
              selected={languages}
              onChange={setLanguages}
            />
            {/* 기타 입력칸 */}
            {languages.includes("기타") && (
              <input
                className="mt-2 w-full px-4 py-3 rounded-xl text-sm"
                style={{
                  border: `1.5px solid ${C.primary}`,
                  background: C.primarySoft,
                  color: C.text1,
                  outline: "none",
                }}
                placeholder="기타 언어를 입력해주세요"
                value={languageEtc}
                onChange={e => setLanguageEtc(e.target.value)}
              />
            )}
          </Question>

          {/* Q7. 사용 주기 */}
          <Question num={7} label="사용 주기" required>
            <SingleDropdown
              label="사용 주기"
              options={FREQUENCY_OPTIONS}
              value={frequency}
              onChange={setFrequency}
            />
            {/* 기타 입력칸 */}
            {frequency === "기타" && (
              <input
                className="mt-2 w-full px-4 py-3 rounded-xl text-sm"
                style={{
                  border: `1.5px solid ${C.primary}`,
                  background: C.primarySoft,
                  color: C.text1,
                  outline: "none",
                }}
                placeholder="사용 주기를 입력해주세요"
                value={frequencyEtc}
                onChange={e => setFrequencyEtc(e.target.value)}
              />
            )}
          </Question>

          {/* Q8. 특이사항 */}
          <Question num={8} label="특이 사항 (선택)">
            <textarea
              className="w-full px-4 py-3 rounded-xl text-sm resize-none"
              style={{
                ...inputStyle,
                minHeight: 80,
                border: `1.5px solid #e5e7eb`,
              }}
              placeholder="추가로 전달할 내용이 있으면 입력해주세요"
              value={note}
              onChange={e => setNote(e.target.value)}
              onFocus={e  => (e.currentTarget.style.borderColor = C.primary)}
              onBlur={e   => (e.currentTarget.style.borderColor = "#e5e7eb")}
            />
          </Question>

          {/* 에러 메시지 */}
          {status === "error" && (
            <div
              className="mb-4 px-4 py-3 rounded-xl text-sm"
              style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}
            >
              제출 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
            </div>
          )}

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full py-4 rounded-2xl font-bold text-white text-sm transition-all"
            style={{
              background: status === "loading" ? "#d1d5db" : C.brand,
              cursor: status === "loading" ? "not-allowed" : "pointer",
            }}
          >
            {status === "loading" ? "제출 중..." : "설문 제출하기 →"}
          </button>

          <p className="text-center text-xs mt-4" style={{ color: C.text4 }}>
            제출된 내용은 수요 조사 목적으로만 활용됩니다.
          </p>
        </form>
      </div>
    </div>
  );
}
