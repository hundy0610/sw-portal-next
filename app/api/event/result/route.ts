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
  return NextResponse.json({
    published: true,
    teamA: cfg.teamA,
    teamB: cfg.teamB,
    answerA: cfg.answerA,
    answerB: cfg.answerB,
    totalParticipants: submissions.length,
    distributionA: distribution(submissions.map(s => s.koreaScore)),
    distributionB: distribution(submissions.map(s => s.mexicoScore)),
  });
}
