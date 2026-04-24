"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

const STARS = [1, 2, 3, 4, 5];
const STAR_LABELS = ["매우 불만족", "불만족", "보통", "만족", "매우 만족"];

export default function FeedbackPage() {
  const params = useParams();
  const ticketId = params.id as string;

  const [rating, setRating]     = useState(0);
  const [hover, setHover]       = useState(0);
  const [comment, setComment]   = useState("");
  const [status, setStatus]     = useState<"idle" | "loading" | "done" | "already" | "error">("idle");

  // 이미 제출 여부 확인
  useEffect(() => {
    if (!ticketId) return;
    fetch(`/api/feedback?id=${ticketId}`)
      .then(r => r.json())
      .then(res => { if (res.data) setStatus("already"); })
      .catch(() => {});
  }, [ticketId]);

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
        <h1 className="text-xl font-bold text-gray-800 mb-2">평가 완료</h1>
        <p className="text-sm text-gray-500">소중한 피드백 감사합니다.<br />더 나은 서비스로 보답하겠습니다.</p>
        <div className="mt-6 flex justify-center gap-1">
          {STARS.map(s => (
            <span key={s} className="text-2xl">{s <= rating ? "★" : "☆"}</span>
          ))}
        </div>
        <p className="mt-2 text-xs text-violet-600 font-semibold">{STAR_LABELS[rating - 1]}</p>
      </div>
    </div>
  );

  if (status === "already") return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        <div className="text-4xl mb-4">✅</div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">이미 평가가 완료되었습니다</h1>
        <p className="text-sm text-gray-500">해당 문의에 대한 평가가 이미 접수되었습니다.<br />감사합니다!</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-violet-100 rounded-2xl mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">서비스 만족도 평가</h1>
          <p className="text-sm text-gray-500 mt-1">IDS 자산관리파트 Help Desk</p>
        </div>

        {/* Stars */}
        <div className="mb-6">
          <p className="text-sm font-semibold text-gray-700 mb-3 text-center">처리 결과에 얼마나 만족하셨나요?</p>
          <div className="flex justify-center gap-3">
            {STARS.map(s => (
              <button key={s}
                onMouseEnter={() => setHover(s)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(s)}
                className="text-4xl transition-transform hover:scale-110 focus:outline-none"
                style={{ color: s <= (hover || rating) ? "#F59E0B" : "#D1D5DB" }}>
                ★
              </button>
            ))}
          </div>
          {(hover || rating) > 0 && (
            <p className="text-center text-sm font-medium text-violet-600 mt-2">
              {STAR_LABELS[(hover || rating) - 1]}
            </p>
          )}
        </div>

        {/* Comment */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            추가 의견 <span className="text-gray-400 font-normal">(선택)</span>
          </label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="서비스에 대한 의견을 자유롭게 남겨주세요..."
            rows={4}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-300 transition"
          />
        </div>

        {/* Submit */}
        {status === "error" && (
          <p className="text-xs text-red-500 text-center mb-3">오류가 발생했습니다. 다시 시도해주세요.</p>
        )}
        <button
          onClick={submit}
          disabled={rating === 0 || status === "loading"}
          className="w-full py-3 rounded-xl text-sm font-bold transition-all"
          style={{
            background: rating > 0 ? "#7C3AED" : "#E5E7EB",
            color: rating > 0 ? "white" : "#9CA3AF",
            cursor: rating > 0 ? "pointer" : "not-allowed",
          }}>
          {status === "loading" ? "제출 중..." : "평가 제출"}
        </button>

        <p className="text-center text-[10px] text-gray-300 mt-4">
          IDS 자산관리파트 · PC/OA 관리팀
        </p>
      </div>
    </div>
  );
}
