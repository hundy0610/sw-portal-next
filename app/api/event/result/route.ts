import { NextResponse } from "next/server";
import { fetchEventSubmissions } from "@/lib/notion";
import { getEventConfig, isResultRevealed } from "@/lib/event-config";

export const dynamic = "force-dynamic";

function distribution(values: number[]) {
  const map: Record<number, number> = {};
  values.forEach(v => { map[v] = (map[v] ?? 0) + 1; });
  return Object.entries(map)
    .map(([score, count]) => ({ score: Number(score), count }))
    .sort((a, b) => a.score - b.score);
}

export async function GET() {
  const cfg = await getEventConfig();
  if (!isResultRevealed(cfg)) {
    return NextResponse.json({ published: false });
  }

  const submissions = await fetchEventSubmissions(cfg.roundStartedAt);
  const isCorrect = (koreaScore: number, mexicoScore: number) =>
    cfg.answerA !== null && cfg.answerB !== null &&
    koreaScore === cfg.answerA && mexicoScore === cfg.answerB;

  const participants = submissions
    .map(s => ({
      name: s.name,
      corporation: s.corporation,
      koreaScore: s.koreaScore,
      mexicoScore: s.mexicoScore,
      correct: isCorrect(s.koreaScore, s.mexicoScore),
    }))
    .sort((a, b) => Number(b.correct) - Number(a.correct));

  return NextResponse.json({
    published: true,
    teamA: cfg.teamA,
    teamB: cfg.teamB,
    answerA: cfg.answerA,
    answerB: cfg.answerB,
    totalParticipants: submissions.length,
    distributionA: distribution(submissions.map(s => s.koreaScore)),
    distributionB: distribution(submissions.map(s => s.mexicoScore)),
    participants,
  });
}
