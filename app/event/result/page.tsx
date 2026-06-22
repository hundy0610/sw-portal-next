"use client";

import { useEffect, useState } from "react";

const C = {
  brand:   "#16a34a",
  soft:    "#f0fdf4",
  border:  "#bbf7d0",
  text1:   "#14532d",
  text2:   "#166534",
  text3:   "#4b5563",
  text4:   "#9ca3af",
  bgPage:  "#f9fafb",
} as const;

interface ScoreDist { score: number; count: number }

interface Participant {
  name: string;
  corporation: string;
  koreaScore: number;
  mexicoScore: number;
  correct: boolean;
}

interface EventResult {
  published: boolean;
  teamA?: string;
  teamB?: string;
  answerA?: number | null;
  answerB?: number | null;
  totalParticipants?: number;
  distributionA?: ScoreDist[];
  distributionB?: ScoreDist[];
  participants?: Participant[];
}

function DistributionBars({ items, color }: { items: ScoreDist[]; color: string }) {
  const max = Math.max(...items.map(d => d.count), 1);
  if (items.length === 0) {
    return <div className="text-sm text-center py-4" style={{ color: C.text4 }}>데이터 없음</div>;
  }
  return (
    <div className="space-y-2">
      {items.map(({ score, count }) => (
        <div key={score} className="flex items-center gap-3">
          <span className="w-6 text-right text-xs font-bold" style={{ color: C.text2 }}>{score}</span>
          <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
            <div
              className="h-full rounded-full flex items-center justify-end pr-2 transition-all"
              style={{ width: `${Math.max((count / max) * 100, 8)}%`, background: color }}>
              <span className="text-white text-[10px] font-bold">{count}</span>
            </div>
          </div>
          <span className="text-xs w-5 text-right" style={{ color: C.text4 }}>{count}명</span>
        </div>
      ))}
    </div>
  );
}

export default function EventResultPage() {
  const [result, setResult]   = useState<EventResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/event/result", { cache: "no-store" })
      .then(r => r.json())
      .then(setResult)
      .finally(() => setLoading(false));
  }, []);

  const winners = (result?.participants ?? []).filter(p => p.correct);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={{ background: C.bgPage }}>
      <div className={`w-full ${result?.published ? "max-w-xl" : "max-w-md"}`}>
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🏆</div>
          <h1 className="text-2xl font-extrabold mb-1" style={{ color: C.text1 }}>토토 결과 발표</h1>
        </div>

        {loading ? (
          <div className="text-center py-12 text-sm" style={{ color: C.text4 }}>불러오는 중...</div>
        ) : !result?.published ? (
          <div className="bg-white rounded-3xl p-10 shadow-sm text-center" style={{ border: `1px solid ${C.border}` }}>
            <div className="text-4xl mb-4">⏳</div>
            <p className="text-sm font-semibold" style={{ color: C.text2 }}>
              아직 결과가 공개되지 않았습니다.
            </p>
            <p className="text-xs mt-2" style={{ color: C.text4 }}>
              경기 결과 발표 후 다시 확인해 주세요.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-8 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
            <div className="flex justify-center gap-6 mb-8">
              <div className="text-center">
                <div className="text-3xl font-black" style={{ color: "#1e40af" }}>{result.answerA}</div>
                <div className="text-xs mt-1" style={{ color: C.text4 }}>{result.teamA}</div>
              </div>
              <div className="text-3xl font-black self-center" style={{ color: C.text3 }}>:</div>
              <div className="text-center">
                <div className="text-3xl font-black" style={{ color: "#78350f" }}>{result.answerB}</div>
                <div className="text-xs mt-1" style={{ color: C.text4 }}>{result.teamB}</div>
              </div>
            </div>

            {winners.length > 0 ? (
              <div className="mb-6 p-4 rounded-2xl text-center" style={{ background: "#fef9c3", border: "1px solid #fde047" }}>
                <div className="text-2xl mb-1">🎉</div>
                <p className="text-sm font-bold" style={{ color: "#854d0e" }}>
                  정답자: {winners.map(w => w.name).join(", ")}
                </p>
              </div>
            ) : (
              <div className="mb-6 p-4 rounded-2xl text-center text-sm font-medium"
                style={{ background: C.soft, color: C.text3, border: `1px solid ${C.border}` }}>
                정확히 맞춘 참여자가 없습니다.
              </div>
            )}

            <p className="text-xs text-center mb-6" style={{ color: C.text4 }}>
              총 {result.totalParticipants}명 참여
            </p>

            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-bold text-sm" style={{ color: C.text1 }}>{result.teamA} 예측 분포</span>
                </div>
                <DistributionBars items={result.distributionA ?? []} color="#3b82f6" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-bold text-sm" style={{ color: C.text1 }}>{result.teamB} 예측 분포</span>
                </div>
                <DistributionBars items={result.distributionB ?? []} color="#eab308" />
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="font-bold text-sm" style={{ color: C.text1 }}>참여자별 예측</span>
              </div>
              <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                {(result.participants ?? []).map((p, i) => (
                  <div key={`${p.name}-${i}`}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm"
                    style={{
                      background: p.correct ? "#fef9c3" : i % 2 === 1 ? "#fafafa" : "#fff",
                      border: p.correct ? "1px solid #fde047" : "1px solid #f1f5f9",
                    }}>
                    <div className="flex items-center gap-2 min-w-0">
                      {p.correct && <span>🎉</span>}
                      <span className="font-semibold truncate" style={{ color: C.text1 }}>{p.name}</span>
                      <span className="text-xs truncate" style={{ color: C.text4 }}>{p.corporation}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 font-bold">
                      <span style={{ color: "#1e40af" }}>{p.koreaScore}</span>
                      <span style={{ color: C.text4 }}>:</span>
                      <span style={{ color: "#78350f" }}>{p.mexicoScore}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 text-center">
          <a href="/" className="text-xs" style={{ color: C.text4 }}>← 포털로 돌아가기</a>
        </div>
      </div>
    </div>
  );
}
