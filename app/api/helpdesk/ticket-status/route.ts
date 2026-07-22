import { NextRequest, NextResponse } from "next/server";
import { kvMGet } from "@/lib/kv-store";
import type { FeedbackEntry } from "@/app/api/feedback/route";

/**
 * GET /api/helpdesk/ticket-status?ids=id1,id2,...
 *
 * 단 1번의 Redis MGET으로 모든 티켓의 피드백을 한번에 조회.
 * N+1 문제(티켓당 1번 API 호출) → 1번 호출로 대체.
 * (이메일 발송 여부는 더 이상 여기서 조회하지 않음 — 티켓 목록(/api/helpdesk)의
 * feedbackEmailSent 필드가 Notion 체크박스를 직접 반영해 항상 정확함)
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("ids") ?? "";
  const ids = raw.split(",").map(s => s.trim()).filter(Boolean);

  if (ids.length === 0) {
    return NextResponse.json({ feedbacks: {} });
  }

  const feedbackKeys = ids.map(id => `feedback:${id}`);
  const feedbackRaws = await kvMGet<FeedbackEntry>(feedbackKeys);

  const feedbacks: Record<string, FeedbackEntry> = {};
  ids.forEach((id, i) => {
    if (feedbackRaws[i]) feedbacks[id] = feedbackRaws[i]!;
  });

  return NextResponse.json({ feedbacks });
}
