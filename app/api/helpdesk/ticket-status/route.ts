import { NextRequest, NextResponse } from "next/server";
import { kvMGet } from "@/lib/kv-store";
import type { FeedbackEntry } from "@/app/api/feedback/route";

/**
 * GET /api/helpdesk/ticket-status?ids=id1,id2,...
 *
 * 단 2번의 Redis MGET으로 모든 티켓의 피드백 + 이메일 발송 여부를 한번에 조회.
 * N+1 문제(티켓당 2번 API 호출) → 1번 호출로 대체.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("ids") ?? "";
  const ids = raw.split(",").map(s => s.trim()).filter(Boolean);

  if (ids.length === 0) {
    return NextResponse.json({ feedbacks: {}, emailSent: {} });
  }

  const feedbackKeys   = ids.map(id => `feedback:${id}`);
  const emailSentKeys  = ids.map(id => `feedback_email_sent:${id}`);

  // 2번의 MGET으로 한 번에 조회
  const [feedbackRaws, emailSentRaws] = await Promise.all([
    kvMGet<FeedbackEntry>(feedbackKeys),
    kvMGet<boolean>(emailSentKeys),
  ]);

  const feedbacks: Record<string, FeedbackEntry> = {};
  const emailSent: Record<string, boolean> = {};

  ids.forEach((id, i) => {
    if (feedbackRaws[i])  feedbacks[id] = feedbackRaws[i]!;
    if (emailSentRaws[i]) emailSent[id] = true;
  });

  return NextResponse.json({ feedbacks, emailSent });
}
