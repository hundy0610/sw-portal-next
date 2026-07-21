import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/kv-store";
import { createMailTransporter, buildHelpdeskManualReplyEmail } from "@/lib/mail";
import { getManual, saveManual } from "@/lib/helpdesk-manuals";
import { extractKeywords } from "@/lib/helpdesk-manual-match";

export const dynamic = "force-dynamic";

const SENT_KEY = (id: string) => `helpdesk:manual-reply-sent:${id}`;
const SENT_TTL = 60 * 60 * 24 * 365; // 1년

// POST /api/helpdesk/send-manual-reply
// Body: { ticketId, requesterEmail, requesterName, ticketContent, manualId, manualTitle, extraNote, assignee }
export async function POST(req: NextRequest) {
  const transporter = createMailTransporter();
  if (!transporter) {
    console.error("[POST /api/helpdesk/send-manual-reply] MANUAL_MAIL_ENV_MISSING");
    return NextResponse.json({ ok: false, error: "GMAIL_USER 또는 GMAIL_APP_PASSWORD 미설정", code: "MANUAL_MAIL_ENV_MISSING" }, { status: 500 });
  }

  try {
    const { ticketId, requesterEmail, requesterName, ticketContent, manualId, manualTitle, extraNote, assignee } = await req.json() as {
      ticketId?: string; requesterEmail?: string; requesterName?: string;
      ticketContent?: string; manualId?: string; manualTitle?: string; extraNote?: string; assignee?: string;
    };

    if (!ticketId || !requesterEmail || !manualId) {
      return NextResponse.json({ ok: false, error: "ticketId, requesterEmail, manualId 필수", code: "MANUAL_MAIL_INVALID_INPUT" }, { status: 400 });
    }

    const alreadySent = await kvGet<boolean>(SENT_KEY(ticketId));
    if (alreadySent) return NextResponse.json({ ok: true, skipped: true, reason: "이미 발송됨" });

    // URL/제목은 클라이언트 입력을 신뢰하지 않고 저장된 매뉴얼 원본에서 가져옴 (임의 링크 발송 방지)
    const manual = await getManual(manualId);
    if (!manual) {
      console.error("[POST /api/helpdesk/send-manual-reply] MANUAL_MAIL_MANUAL_NOT_FOUND", manualId);
      return NextResponse.json({ ok: false, error: "매뉴얼을 찾을 수 없습니다", code: "MANUAL_MAIL_MANUAL_NOT_FOUND" }, { status: 404 });
    }

    // 배포 환경(TEST/운영)마다 실제 접속 도메인이 다르므로, 요청이 들어온 origin을 그대로 사용한다.
    // env 값에 의존하면 TEST에서 발송해도 메일 속 링크가 운영 도메인을 가리켜 매뉴얼을 못 찾는 문제가 생긴다.
    const origin = req.nextUrl.origin;
    const manualUrl = manual.contentType === "url"
      ? manual.body
      : `${origin}/api/helpdesk/manuals/view?id=${encodeURIComponent(manual.id)}`;

    const html = buildHelpdeskManualReplyEmail({
      requesterName: requesterName || "고객",
      manualTitle: manualTitle || manual.title,
      manualUrl,
      extraNote: extraNote || "",
      ticketContent: ticketContent || "",
      assignee: assignee || "담당자",
    });

    await transporter.sendMail({
      from: `"IDS 자산관리파트 Help Desk" <${process.env.GMAIL_USER}>`,
      to: requesterEmail,
      subject: "[IDS Help Desk] 문의하신 내용에 대한 처리 안내",
      html,
    });

    await kvSet(SENT_KEY(ticketId), true, SENT_TTL);

    // 담당자가 실제로 이 매뉴얼로 이 티켓을 처리했다고 확인한 것이므로, 매뉴얼의 이력에도 반영해
    // 앞으로 비슷한 문의를 자동으로 더 잘 매칭할 수 있게 한다 (매뉴얼 화면에서 수동으로 검색해
    // 연결하지 않아도 됨)
    try {
      if (!manual.linkedTicketIds.includes(ticketId)) {
        const historyKw = extractKeywords(`${ticketContent || ""} ${extraNote || ""}`);
        await saveManual({
          id: manual.id,
          title: manual.title,
          contentType: manual.contentType,
          body: manual.body,
          linkedTicketIds: [...manual.linkedTicketIds, ticketId],
          matchKeywords: historyKw.length > 0 ? [...manual.matchKeywords, historyKw] : manual.matchKeywords,
          updatedBy: manual.updatedBy,
        });
      }
    } catch (e) {
      console.error("[POST /api/helpdesk/send-manual-reply] MANUAL_LINK_HISTORY_FAILED", e);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/helpdesk/send-manual-reply] MANUAL_MAIL_SEND_FAILED", e);
    return NextResponse.json({ ok: false, error: "서버 오류", code: "MANUAL_MAIL_SEND_FAILED" }, { status: 500 });
  }
}

// GET /api/helpdesk/send-manual-reply?id=xxx → 발송 여부 확인
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id 필요", code: "MANUAL_MAIL_STATUS_INVALID_INPUT" }, { status: 400 });
  try {
    const sent = await kvGet<boolean>(SENT_KEY(id));
    return NextResponse.json({ ok: true, sent: !!sent });
  } catch (e) {
    console.error("[GET /api/helpdesk/send-manual-reply] MANUAL_MAIL_STATUS_CHECK_FAILED", e);
    return NextResponse.json({ ok: false, error: "서버 오류", code: "MANUAL_MAIL_STATUS_CHECK_FAILED" }, { status: 500 });
  }
}
