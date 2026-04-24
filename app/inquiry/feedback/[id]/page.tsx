"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";

const STARS = [1, 2, 3, 4, 5];
const STAR_LABELS = ["매우 불만족", "불만족", "보통", "만족", "매우 만족"];
const STAR_EMOJI  = ["😞", "😕", "😐", "😊", "😄"];

const PLACEHOLDER = `예시)
• 처리 속도가 빠르고 친절했습니다.
• 업무 중 PC 교체 절차가 더 간소화되면 좋겠습니다.
• OA 소모품 신청 시 진행 상황을 알 수 있으면 좋겠습니다.

개선 아이디어나 불편한 점을 솔직하게 남겨주세요.
여러분의 한 마디가 더 나은 업무 환경을 만듭니다.`;

export default function FeedbackPage() {
  const params       = useParams();
  const searchParams = useSearchParams();
  const ticketId     = params.id as string;

  const [rating, setRating]   = useState(0);
  const [hover, setHover]     = useState(0);
  const [comment, setComment] = useState("");
  const [charCount, setCharCount] = useState(0);
  const [status, setStatus]   = useState<"idle" | "loading" | "done" | "already" | "error">("idle");
  const MAX_CHARS = 500;

  // URL 파라미터로 별점 미리 세팅 (이메일 별점 링크 클릭 시)
  useEffect(() => {
    const r = Number(searchParams.get("rating"));
    if (r >= 1 && r <= 5) setRating(r);
  }, [searchParams]);

  // 이미 제출 여부 확인
  useEffect(() => {
    if (!ticketId) return;
    fetch(`/api/feedback?id=${ticketId}`)
      .then(r => r.json())
      .then(res => { if (res.data) setStatus("already"); })
      .catch(() => {});
  }, [ticketId]);

  const handleComment = (v: string) => {
    if (v.length <= MAX_CHARS) { setComment(v); setCharCount(v.length); }
  };

  const submit = async () => {
    if (rating === 0) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, rating, comment }),
      });
      const json = await res.json();
      if (res.status === 409) { setStatus("already"); return; }
      if (!res.ok) throw new Error(json.error);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  if (status === "done") return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">평가해 주셔서 감사합니다!</h1>
        <p className="text-sm text-gray-500 leading-relaxed">
          소중한 의견은 즉시 검토하여<br />
          <span className="text-violet-600 font-semibold">더 나은 업무 환경</span>을 만드는 데 반영하겠습니다.
        </p>
        <div className="mt-6 flex justify-center gap-1">
          {STARS.map(s => (
            <span key={s} className="text-2xl" style={{ color: s <= rating ? "#F59E0B" : "#D1D5DB" }}>★</span>
          ))}
        </div>
        <p className="mt-2 text-xs text-violet-600 font-semibold">{STAR_LABELS[rating - 1]}</p>
        <div className="mt-6 p-4 bg-violet-50 rounded-xl text-xs text-gray-500 leading-relaxed">
          여러분의 피드백 덕분에 IDS 자산관리파트가<br />
          임직원 모두가 업무에만 집중할 수 있는<br />
          환경을 만들어 나갈 수 있습니다.
        </div>
      </div>
    </div>
  );

  if (status === "already") return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        <div className="text-4xl mb-4">✅</div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">이미 평가가 완료되었습니다</h1>
        <p className="text-sm text-gray-500">해당 문의에 대한 평가가 이미 접수되었습니다.<br />소중한 의견 감사드립니다.</p>
      </div>
    </div>
  );

  const active = hover || rating;

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-lg w-full">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-violet-100 rounded-2xl mb-3">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">서비스 만족도 평가</h1>
          <p className="text-sm text-gray-500 mt-1">IDS 자산관리파트 Help Desk</p>
        </div>

        {/* 포부 메시지 */}
        <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 mb-6 text-center">
          <p className="text-xs text-violet-700 leading-relaxed">
            여러분의 소중한 한 마디가 더 나은 업무 환경을 만듭니다.<br />
            좋은 의견과 개선 아이디어는 <span className="font-semibold">즉각 검토·반영</span>하여<br />
            임직원 모두가 업무에만 집중할 수 있도록 최선을 다하겠습니다.
          </p>
        </div>

        {/* 별점 */}
        <div className="mb-6">
          <p className="text-sm font-semibold text-gray-700 mb-3 text-center">처리 결과에 얼마나 만족하셨나요?</p>
          <div className="flex justify-center gap-3">
            {STARS.map(s => (
              <button key={s}
                onMouseEnter={() => setHover(s)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(s)}
                className="text-4xl transition-transform hover:scale-125 focus:outline-none"
                style={{ color: s <= active ? "#F59E0B" : "#D1D5DB" }}>
                ★
              </button>
            ))}
          </div>
          <div className="h-7 flex items-center justify-center mt-2">
            {active > 0 && (
              <p className="text-sm font-semibold text-violet-600">
                {STAR_EMOJI[active - 1]}&nbsp;{STAR_LABELS[active - 1]}
              </p>
            )}
          </div>
        </div>

        {/* 코멘트 */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-gray-700">
              의견 및 개선 제안&nbsp;<span className="text-gray-400 font-normal text-xs">(선택)</span>
            </label>
            <span className="text-xs text-gray-400">{charCount}/{MAX_CHARS}</span>
          </div>
          <textarea
            value={comment}
            onChange={e => handleComment(e.target.value)}
            placeholder={PLACEHOLDER}
            rows={6}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-300 transition leading-relaxed"
          />
          {/* 주의 문구 */}
          <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
            💡 업무 프로세스 개선, 자산 관리 불편사항, 서비스 제안 등 무엇이든 환영합니다.<br />
            <span className="text-red-400">욕설·비방·개인 공격</span>이 포함된 내용은 검토에서 제외될 수 있습니다.
          </p>
        </div>

        {/* 에러 */}
        {status === "error" && (
          <p className="text-xs text-red-500 text-center mb-3">오류가 발생했습니다. 다시 시도해주세요.</p>
        )}

        {/* 제출 버튼 */}
        <button
          onClick={submit}
          disabled={rating === 0 || status === "loading"}
          className="w-full py-3 rounded-xl text-sm font-bold transition-all"
          style={{
            background: rating > 0 ? "#7C3AED" : "#E5E7EB",
            color: rating > 0 ? "white" : "#9CA3AF",
            cursor: rating > 0 ? "pointer" : "not-allowed",
          }}>
          {status === "loading" ? "제출 중..." : rating === 0 ? "별점을 먼저 선택해주세요" : "평가 제출하기"}
        </button>

        <p className="text-center text-[10px] text-gray-300 mt-4">
          IDS 자산관리파트 · PC/OA 관리팀
        </p>
      </div>
    </div>
  );
}
