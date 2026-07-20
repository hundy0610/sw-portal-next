import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/kv-store";
import { createMailTransporter, buildHelpdeskManualReplyEmail } from "@/lib/mail";
import { getManual } from "@/lib/helpdesk-manuals";

export const dynamic = "force-dynamic";

const SENT_KEY = (id: string) => `helpdesk:manual-reply-sent:${id}`;
const SENT_TTL = 60 * 60 * 24 * 365; // 1년

// POST /api/helpdesk/send-manual-reply
// Body: { ticketId, requesterEmail, requesterName, ticketContent, manualId, manualTitle, assignee }
export async function POST(req: NextRequest) {
  const transporter = createMailTransporter();
  if (!transporter) {
    console.error("[POST /api/helpdesk/send-manual-reply] MANUAL_MAIL_ENV_MISSING");
    return NextResponse.json({ ok: false, error: "GMAIL_USER 또는 GMAIL_APP_PASSWORD 미설정", code: "MANUAL_MAIL_ENV_MISSING" }, { status: 500 });
  }

  try {
    const { ticketId, requesterEmail, requesterName, ticketContent, manualId, manualTitle, assignee } = await req.json() as {
      ticketId?: string; requesterEmail?: string; requesterName?: string;
      ticketContent?: string; manualId?: string; manualTitle?: string; assignee?: string;
    };

    if (!ticketId || !requesterEmail || !manualId) {
      return NextResponse.json({ ok: false, error: "ticketId, requesterEmail, manualId 필수", code: "MANUAL_MAIL_INVALID_INPUT" }, { status: 400 });
    }

    const alreadySent = await kvGet<boolean>(SENT_KEY(ticketId));
    if (alreadySent) return NextResponse.json({ ok: true, skipped: true, reason: "이미 발송됨" });

    // URL/제목/조치분류는 클라이언트 입력을 신뢰하지 않고 저장된 매뉴얼 원본에서 가져옴 (임의 링크 발송 방지)
    const manual = await getManual(manualId);
    if (!manual) {
      console.error("[POST /api/helpdesk/send-manual-reply] MANUAL_MAIL_MANUAL_NOT_FOUND", manualId);
      return NextResponse.json({ ok: false, error: "매뉴얼을 찾을 수 없습니다", code: "MANUAL_MAIL_MANUAL_NOT_FOUND" }, { status: 404 });
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL || "https://assetify-desk-main.vercel.app";
    const manualUrl = manual.contentType === "url"
      ? manual.body
      : `${origin}/api/helpdesk/manuals/view?id=${encodeURIComponent(manual.id)}`;

    const html = buildHelpdeskManualReplyEmail({
      requesterName: requesterName || "고객",
      category: manual.categories.join(", "),
      manualTitle: manualTitle || manual.title,
      manualUrl,
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
