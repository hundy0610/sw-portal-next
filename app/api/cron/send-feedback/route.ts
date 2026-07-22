import { NextRequest, NextResponse } from "next/server";
import { fetchHelpDeskTickets } from "@/lib/notion";
import { errorMessage } from "@/lib/api-error";

/**
 * GET /api/cron/send-feedback
 *
 * GitHub Actions에서 1시간마다 호출.
 * "완료" 상태이면서 이메일이 있고 아직 발송되지 않은 티켓을 찾아
 * 만족도 평가 이메일을 자동 발송한다.
 *
 * 중복 발송 방지: Notion 티켓의 "평가메일발송" 체크박스로 관리 (Redis 캐시 장애와
 * 무관하게 항상 정확한 값 — 예전엔 Redis 키에만 의존해 Redis 쓰기가 조용히 실패하면
 * 매시간 같은 티켓에 재발송되는 문제가 있었음)
 *
 * 완료된 지 오래된 티켓은 매번 다시 검사 대상에 넣지 않는다 — 완료 시점이 한참
 * 지나면 설문을 보낼 타이밍 자체가 지난 것으로 보고, 최근에 완료된 것만 검사한다.
 * (예전엔 "완료+이메일 있음" 전체 이력을 매번 다시 훑어서, 티켓이 쌓일수록
 * 이 크론의 조회량이 계속 커지는 구조였음)
 */
export const dynamic = "force-dynamic";

const RECENT_COMPLETION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 완료(최종 수정) 7일 이내만 검사 대상

export async function GET(req: NextRequest) {
  // Vercel Cron 인증 헤더 확인 (배포 환경에서만 동작)
  const authHeader = req.headers.get("authorization");
  if (
    process.env.NODE_ENV === "production" &&
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL || "https://assetify-desk-main.vercel.app";
  const start  = Date.now();
  const results: { id: string; email: string; result: string }[] = [];

  try {
    // 헬프데스크 전체 티켓 조회 (캐시 무시 — 최신 상태 필요)
    const tickets = await fetchHelpDeskTickets();

    // 완료 + 이메일 있고 + 아직 미발송인 티켓 중, 최근에(7일 이내) 완료된 것만 검사 대상으로 삼는다
    const now = Date.now();
    const pending = tickets.filter(t => {
      if (t.status !== "완료" || !t.requesterEmail || t.feedbackEmailSent) return false;
      const editedAt = new Date(t.lastEditedAt).getTime();
      return Number.isFinite(editedAt) && (now - editedAt) <= RECENT_COMPLETION_WINDOW_MS;
    });

    if (pending.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, alreadySentAll: true, elapsed: `${Date.now() - start}ms` });
    }

    // 이메일 발송 (순차 처리 — Resend 레이트 리밋 방지)
    for (const ticket of pending) {
      try {
        const res = await fetch(`${origin}/api/helpdesk/send-feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ticketId:       ticket.id,
            requesterEmail: ticket.requesterEmail,
            requesterName:  ticket.requester  || "고객",
            ticketContent:  ticket.content    || ticket.title || "문의 내용",
            assignee:       ticket.assignee   || "담당자",
          }),
        });
        const json = await res.json();

        if (res.ok || json.skipped) {
          results.push({ id: ticket.id, email: ticket.requesterEmail, result: json.skipped ? "skipped" : "sent" });
        } else {
          results.push({ id: ticket.id, email: ticket.requesterEmail, result: `error: ${json.error}` });
        }

        // Resend free tier: 2 req/s 제한 → 600ms 간격
        await new Promise(r => setTimeout(r, 600));
      } catch (e) {
        results.push({ id: ticket.id, email: ticket.requesterEmail, result: `exception: ${e}` });
      }
    }

    const sentCount = results.filter(r => r.result === "sent").length;
    console.log(`[cron/send-feedback] sent=${sentCount}/${pending.length}`, results);

    return NextResponse.json({
      ok: true,
      sent: sentCount,
      total: pending.length,
      elapsed: `${Date.now() - start}ms`,
      results,
    });
  } catch (e) {
    console.error("[cron/send-feedback]", e);
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
