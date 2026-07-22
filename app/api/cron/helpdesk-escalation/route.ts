import { NextRequest, NextResponse } from "next/server";
import { fetchHelpDeskTickets } from "@/lib/notion";
import { kvGet, kvSet } from "@/lib/kv-store";
import { createMailTransporter, buildHelpdeskEscalationEmail } from "@/lib/mail";
import { errorMessage } from "@/lib/api-error";

/**
 * GET /api/cron/helpdesk-escalation
 *
 * 30분마다 호출 (GitHub Actions).
 * "시작 전" 상태로 남아있는 문의 티켓에 대해 접수 후 30분·60분·90분…
 * 30분 간격으로 담당자에게 미처리 알림 메일을 반복 발송한다.
 *
 * 중복 발송 방지: Redis helpdesk_escalation:{id} 키에 마지막으로
 * 발송한 30분 구간(bucket)을 저장 — 같은 구간에서는 재발송하지 않는다.
 */
export const dynamic = "force-dynamic";

const BUCKET_MIN = 30;
const ESCALATION_KEY = (id: string) => `helpdesk_escalation:${id}`;
const ESCALATION_TTL = 60 * 60 * 24 * 7; // 7일 — 티켓이 오래 방치돼도 키가 무한정 쌓이지 않도록

// 이 키 저장이 실패하면 다음 30분 주기에도 같은 구간으로 인식돼 알림이 중복 발송된다
// (평가 메일의 SENT_KEY와 동일한 위험) — 기본 kvSet의 1회 재시도보다 더 집요하게 재시도한다.
async function markEscalationSent(ticketId: string, bucket: number): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt++) {
    if (await kvSet(ESCALATION_KEY(ticketId), bucket, ESCALATION_TTL)) return;
    if (attempt < 3) await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
  }
  console.error(`[helpdesk-escalation] 발송 완료 표시 저장 실패 — 중복 발송 위험: ${ticketId}`);
}

interface AccountLite { name: string; email: string; }

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (
    process.env.NODE_ENV === "production" &&
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();
  const results: { id: string; to: string; bucket: number; result: string }[] = [];

  try {
    // 헬프데스크 전체 티켓 조회 (캐시 무시 — 최신 상태 필요)
    const tickets = await fetchHelpDeskTickets();

    // 아직 시작하지 않은(미처리) 티켓만
    const pending = tickets.filter(t => t.status === "시작 전");

    if (pending.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, elapsed: `${Date.now() - start}ms` });
    }

    const [accounts, superEmails] = await Promise.all([
      kvGet<AccountLite[]>("sw:accounts"),
      kvGet<string[]>("sw:super-emails"),
    ]);

    const transporter = createMailTransporter();
    if (!transporter) {
      return NextResponse.json({ error: "메일 설정 없음 (GMAIL_USER/GMAIL_APP_PASSWORD)" }, { status: 500 });
    }

    const adminUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://swportal.vercel.app"}/admin`;

    // kvMGet으로 바꿨더니 항상 빈 값이 나와 중복발송 방지 자체가 무력화되는 문제가 발견돼
    // (kvMGet 자체의 문제로 추정, 검증 전까지 되돌림) 건별 조회로 복원
    for (const ticket of pending) {
      try {
        const elapsedMin = Math.floor((Date.now() - new Date(ticket.submittedAt).getTime()) / 60000);
        const bucket = Math.floor(elapsedMin / BUCKET_MIN); // 30분 단위 구간 (30~59분=1, 60~89분=2, ...)
        if (bucket < 1) continue; // 아직 30분 안 지남

        const lastBucket = await kvGet<number>(ESCALATION_KEY(ticket.id));
        if (lastBucket !== null && lastBucket >= bucket) continue; // 이 구간엔 이미 발송함

        // 담당자 이메일 매칭 (없으면 슈퍼관리자 전체에게 폴백)
        const assigneeEmail = accounts?.find(a => a.name === ticket.assignee)?.email;
        const to = assigneeEmail || (superEmails && superEmails.length > 0 ? superEmails.join(", ") : "");
        if (!to) {
          results.push({ id: ticket.id, to: "", bucket, result: "skipped: no recipient" });
          continue;
        }

        const html = buildHelpdeskEscalationEmail({
          requester: ticket.requester || "미상",
          company: ticket.company,
          department: ticket.department,
          inquiryType: ticket.inquiryType,
          urgency: ticket.urgency,
          content: ticket.content,
          elapsedMinutes: elapsedMin,
          adminUrl,
        });

        await transporter.sendMail({
          from: `"IDS Help Desk" <${process.env.GMAIL_USER}>`,
          to,
          subject: `[Help Desk] 미처리 문의 알림 — 접수 ${bucket * BUCKET_MIN}분 경과`,
          html,
        });

        await markEscalationSent(ticket.id, bucket);
        results.push({ id: ticket.id, to, bucket, result: "sent" });

        // Gmail 발송 간격 확보
        await new Promise(r => setTimeout(r, 600));
      } catch (e) {
        results.push({ id: ticket.id, to: "", bucket: -1, result: `exception: ${e}` });
      }
    }

    const sentCount = results.filter(r => r.result === "sent").length;
    console.log(`[cron/helpdesk-escalation] sent=${sentCount}/${pending.length}`, results);

    return NextResponse.json({
      ok: true,
      sent: sentCount,
      total: pending.length,
      elapsed: `${Date.now() - start}ms`,
      results,
    });
  } catch (e) {
    console.error("[cron/helpdesk-escalation]", e);
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
