import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookieHeader } from "@/lib/session";
import { fetchEventSubmissions } from "@/lib/notion";
import {
  getEventConfig,
  setEventConfig,
  isEffectivelyOpen,
  getPreviousParticipants,
  snapshotPreviousParticipants,
  type EventConfig,
} from "@/lib/event-config";

export const dynamic = "force-dynamic";

function isSuper(req: NextRequest): boolean {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  return session?.role === "super";
}

export async function GET(req: NextRequest) {
  const cfg = await getEventConfig();
  const publicView = {
    teamA: cfg.teamA,
    teamB: cfg.teamB,
    title: cfg.title,
    description: cfg.description,
    matchDate: cfg.matchDate,
    open: isEffectivelyOpen(cfg),
    participationMode: cfg.participationMode,
  };

  if (!isSuper(req)) {
    return NextResponse.json(publicView);
  }
  const previousParticipantsCount = (await getPreviousParticipants()).length;
  return NextResponse.json({
    ...publicView,
    ...cfg,
    open: cfg.open,
    effectiveOpen: isEffectivelyOpen(cfg),
    previousParticipantsCount,
  });
}

// 일반 설정 변경(부분 patch) 또는 { action: "snapshot_previous" }로
// 현재 토토 참여자 명단을 "이전 참여자" 명단으로 스냅샷.
export async function POST(req: NextRequest) {
  if (!isSuper(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const body = await req.json();

  if (body.action === "snapshot_previous") {
    const submissions = await fetchEventSubmissions();
    await snapshotPreviousParticipants(submissions.map(s => s.name));
    return NextResponse.json({ ok: true, previousParticipantsCount: submissions.length });
  }

  // 새 회차 시작: 이전 회차 참여 기록은 Notion에 남기되 이후 중복확인/현황/결과 집계에서 제외하고,
  // 직전 회차의 정답·결과공개 상태를 초기화한다.
  if (body.action === "start_new_round") {
    const next = await setEventConfig({
      roundStartedAt: new Date().toISOString(),
      resultPublished: false,
      resultRevealAt: null,
      answerA: null,
      answerB: null,
    });
    return NextResponse.json({ ok: true, config: next });
  }

  const patch: Partial<EventConfig> = body;
  const next = await setEventConfig(patch);
  return NextResponse.json({ ok: true, config: next });
}
