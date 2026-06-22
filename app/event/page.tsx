"use client";

import { useEffect, useState } from "react";

const C = {
  brand:   "#16a34a",
  primary: "#22c55e",
  soft:    "#f0fdf4",
  border:  "#bbf7d0",
  text1:   "#14532d",
  text2:   "#166534",
  text3:   "#4b5563",
  text4:   "#9ca3af",
  bg:      "#f0fdf4",
  bgPage:  "#f9fafb",
} as const;

type Step = "verify" | "predict" | "done";

const DEFAULT_CORPS = ["대웅", "대웅제약", "엠서클", "힐리언스", "IdsTrust", "기타"];
const DEFAULT_DEPTS = ["재경팀", "인사팀", "페이롤", "마케팅", "자산관리파트", "회계팀", "기타"];

interface EventPublicConfig {
  teamA: string;
  teamB: string;
  title: string;
  description: string;
  matchDate: string;
  open: boolean;
}

const DEFAULT_CONFIG: EventPublicConfig = {
  teamA: "한국",
  teamB: "멕시코",
  title: "한국 vs 멕시코 토토",
  description: "정확한 점수를 맞추면 좋은 일이 생깁니다!",
  matchDate: "",
  open: true,
};

export default function EventPage() {
  const [step, setStep]             = useState<Step>("verify");
  const [corporations, setCorporations] = useState<string[]>(DEFAULT_CORPS);
  const [departments, setDepartments]   = useState<Record<string, string[]>>(
    Object.fromEntries(DEFAULT_CORPS.map(c => [c, DEFAULT_DEPTS]))
  );
  const [cfg, setCfg] = useState<EventPublicConfig>(DEFAULT_CONFIG);

  const [corporation, setCorporation] = useState("");
  const [department, setDepartment]   = useState("");
  const [name, setName]               = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [verifying, setVerifying]     = useState(false);

  const [koreaScore, setKoreaScore]   = useState<number | "">("");
  const [mexicoScore, setMexicoScore] = useState<number | "">("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting]   = useState(false);

  useEffect(() => {
    fetch("/api/event/employees")
      .then(r => r.json())
      .then(d => {
        if (d.corporations?.length > 0) {
          setCorporations(d.corporations);
          setDepartments(d.departments ?? {});
        }
        // 노션 DB가 비어있으면 하드코딩 기본값 유지
      })
      .catch(() => { /* 기본값 유지 */ });
    fetch("/api/event/config", { cache: "no-store" })
      .then(r => r.json())
      .then(d => setCfg(prev => ({ ...prev, ...d })))
      .catch(() => { /* 기본값 유지 */ });
  }, []);

  const availableDepts = corporation ? (departments[corporation] ?? []) : [];

  async function handleVerify() {
    if (!corporation || !department || !name.trim()) {
      setVerifyError("모든 항목을 입력해 주세요.");
      return;
    }
    setVerifyError("");
    setVerifying(true);
    try {
      const res = await fetch("/api/event/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), corporation, department,
          koreaScore: 0, mexicoScore: 0,
          _checkOnly: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setVerifyError(json.error ?? "확인 중 오류가 발생했습니다.");
        return;
      }
      setStep("predict");
    } finally {
      setVerifying(false);
    }
  }

  async function handleSubmit() {
    if (koreaScore === "" || mexicoScore === "") {
      setSubmitError("한국과 멕시코 점수를 모두 입력해 주세요.");
      return;
    }
    setSubmitError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/event/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), corporation, department,
          koreaScore: Number(koreaScore),
          mexicoScore: Number(mexicoScore),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json.error ?? "제출 중 오류가 발생했습니다.");
        return;
      }
      setStep("done");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: C.bgPage }}>
      <div className="w-full max-w-md">

        {/* 헤더 */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">⚽</div>
          <h1 className="text-2xl font-extrabold mb-1" style={{ color: C.text1 }}>
            {cfg.title}
          </h1>
          <p className="text-sm" style={{ color: C.text3 }}>
            {cfg.matchDate && `${cfg.matchDate} `}{cfg.description}
          </p>
        </div>

        {/* 이벤트 마감 배너 */}
        {!cfg.open && (
          <div className="mb-6 p-4 rounded-2xl text-center font-bold"
            style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
            이벤트가 마감되었습니다.
          </div>
        )}

        {/* Step 1: 본인 확인 */}
        {step === "verify" && (
          <div className="bg-white rounded-3xl p-8 shadow-sm"
            style={{ border: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-2 mb-6">
              <span className="w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center"
                style={{ background: C.brand }}>1</span>
              <span className="font-bold text-sm" style={{ color: C.text1 }}>본인 확인</span>
            </div>

            {/* 법인 */}
            <div className="mb-4">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: C.text2 }}>
                법인
              </label>
              <select
                value={corporation}
                onChange={e => { setCorporation(e.target.value); setDepartment(""); }}
                className="w-full h-11 px-3.5 rounded-xl text-sm focus:outline-none"
                style={{ border: `1.5px solid ${C.border}`, background: "#fff", color: C.text1 }}>
                <option value="">법인 선택</option>
                {corporations.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* 부서 */}
            <div className="mb-4">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: C.text2 }}>
                부서
              </label>
              <select
                value={department}
                onChange={e => setDepartment(e.target.value)}
                disabled={!corporation}
                className="w-full h-11 px-3.5 rounded-xl text-sm focus:outline-none disabled:opacity-50"
                style={{ border: `1.5px solid ${C.border}`, background: "#fff", color: C.text1 }}>
                <option value="">부서 선택</option>
                {availableDepts.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {/* 이름 */}
            <div className="mb-6">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: C.text2 }}>
                이름
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleVerify()}
                placeholder="이름을 입력하세요"
                className="w-full h-11 px-3.5 rounded-xl text-sm focus:outline-none"
                style={{ border: `1.5px solid ${C.border}`, background: "#fff", color: C.text1 }}
              />
            </div>

            {verifyError && (
              <div className="mb-4 p-3 rounded-xl text-xs font-medium"
                style={{ background: "#fef2f2", color: "#dc2626" }}>
                {verifyError}
              </div>
            )}

            <button
              onClick={handleVerify}
              disabled={verifying || !cfg.open}
              className="w-full h-12 rounded-xl font-bold text-sm text-white transition-opacity disabled:opacity-50"
              style={{ background: C.brand }}>
              {verifying ? "확인 중..." : "확인"}
            </button>
          </div>
        )}

        {/* Step 2: 점수 예측 */}
        {step === "predict" && (
          <div className="bg-white rounded-3xl p-8 shadow-sm"
            style={{ border: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center"
                style={{ background: C.brand }}>2</span>
              <span className="font-bold text-sm" style={{ color: C.text1 }}>점수 예측</span>
            </div>
            <p className="text-xs mb-6" style={{ color: C.text3 }}>
              <strong style={{ color: C.text2 }}>{name}</strong>님, 최종 점수를 예측해 주세요.
            </p>

            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* 팀 A */}
              <div className="p-5 rounded-2xl text-center"
                style={{ background: "#eff6ff", border: "1px solid #bfdbfe" }}>
                <div className="font-bold text-sm mb-3" style={{ color: "#1e40af" }}>{cfg.teamA}</div>
                <input
                  type="number" min={0} max={20}
                  value={koreaScore}
                  onChange={e => setKoreaScore(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="0"
                  className="w-full h-12 text-center text-2xl font-extrabold rounded-xl focus:outline-none"
                  style={{ border: "2px solid #93c5fd", color: "#1e40af", background: "#fff" }}
                />
              </div>

              {/* 팀 B */}
              <div className="p-5 rounded-2xl text-center"
                style={{ background: "#fefce8", border: "1px solid #fde047" }}>
                <div className="font-bold text-sm mb-3" style={{ color: "#78350f" }}>{cfg.teamB}</div>
                <input
                  type="number" min={0} max={20}
                  value={mexicoScore}
                  onChange={e => setMexicoScore(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="0"
                  className="w-full h-12 text-center text-2xl font-extrabold rounded-xl focus:outline-none"
                  style={{ border: "2px solid #fde047", color: "#78350f", background: "#fff" }}
                />
              </div>
            </div>

            {submitError && (
              <div className="mb-4 p-3 rounded-xl text-xs font-medium"
                style={{ background: "#fef2f2", color: "#dc2626" }}>
                {submitError}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full h-12 rounded-xl font-bold text-sm text-white transition-opacity disabled:opacity-50"
              style={{ background: C.brand }}>
              {submitting ? "제출 중..." : "최종 제출"}
            </button>

            <button
              onClick={() => setStep("verify")}
              className="w-full mt-3 h-10 rounded-xl text-sm font-medium"
              style={{ color: C.text4 }}>
              ← 이전으로
            </button>
          </div>
        )}

        {/* Step 3: 완료 */}
        {step === "done" && (
          <div className="bg-white rounded-3xl p-10 shadow-sm text-center"
            style={{ border: `1px solid ${C.border}` }}>
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-xl font-extrabold mb-2" style={{ color: C.text1 }}>
              참여 완료!
            </h2>
            <p className="text-sm mb-6" style={{ color: C.text3 }}>
              <strong style={{ color: C.text2 }}>{name}</strong>님의 예측이 등록되었습니다.
            </p>
            <div className="flex justify-center gap-6 mb-6">
              <div className="text-center">
                <div className="text-3xl font-black" style={{ color: "#1e40af" }}>{koreaScore}</div>
                <div className="text-xs mt-1" style={{ color: C.text4 }}>{cfg.teamA}</div>
              </div>
              <div className="text-3xl font-black self-center" style={{ color: C.text3 }}>:</div>
              <div className="text-center">
                <div className="text-3xl font-black" style={{ color: "#78350f" }}>{mexicoScore}</div>
                <div className="text-xs mt-1" style={{ color: C.text4 }}>{cfg.teamB}</div>
              </div>
            </div>
            <p className="text-xs" style={{ color: C.text4 }}>
              경기 결과 발표 후 정답자에게 개별 연락드립니다.
            </p>
            <p className="text-xs mt-2" style={{ color: C.text4 }}>
              경기 결과 발표 후{" "}
              <a href="https://sw-portal-next.vercel.app/event/result" target="_blank" rel="noopener noreferrer"
                className="underline" style={{ color: C.brand }}>
                https://sw-portal-next.vercel.app/event/result
              </a>
              {" "}에서 경기 결과를 확인할 수 있습니다.
            </p>
          </div>
        )}

        <div className="mt-6 text-center">
          <a href="/" className="text-xs" style={{ color: C.text4 }}>← 포털로 돌아가기</a>
        </div>
      </div>
    </div>
  );
}
