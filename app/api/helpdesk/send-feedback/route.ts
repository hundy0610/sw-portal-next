import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/kv-store";
import nodemailer from "nodemailer";

const SENT_KEY  = (id: string) => `feedback_email_sent:${id}`;
const SENT_TTL  = 60 * 60 * 24 * 365; // 1년

// 이 키는 "이미 보낸 메일을 재발송하지 않는다"는 유일한 안전장치라, 한 번의 읽기/쓰기
// 실패가 곧바로 고객에게 평가 메일이 반복 발송되는 사고로 이어진다. Redis 무료 티어
// 한도 초과로 인한 간헐적 실패에 대비해, 기본 kvGet/kvSet의 1회 재시도보다 더 집요하게
// 재시도한다 — 이 경로는 명령 수가 조금 늘어도 감수할 가치가 있는 곳이다.
async function alreadySentFeedback(ticketId: string): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (await kvGet<boolean>(SENT_KEY(ticketId))) return true;
    if (attempt < 2) await new Promise(r => setTimeout(r, 250 * (attempt + 1)));
  }
  return false;
}

async function markFeedbackSent(ticketId: string): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt++) {
    if (await kvSet(SENT_KEY(ticketId), true, SENT_TTL)) return;
    if (attempt < 3) await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
  }
  console.error(`[send-feedback] 발송 완료 표시 저장 실패 — 중복 발송 위험: ${ticketId}`);
}

function buildEmailHtml(opts: {
  requesterName: string;
  ticketContent: string;
  assignee: string;
  feedbackUrl: string;
}): string {
  const { requesterName, ticketContent, assignee, feedbackUrl } = opts;
  const stars = [1, 2, 3, 4, 5];
  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">
<div style="max-width:560px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

  <!-- 이미지/링크 차단 안내 -->
  <div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:10px;padding:10px 16px;margin-bottom:12px;font-size:12px;color:#92400E;line-height:1.6;">
    ⚠️ <strong>메일 상단에 '이미지/링크 보기'가 표시되는 경우</strong>, 반드시 클릭하신 후 별점 및 평가하기 버튼을 이용해 주세요.<br>
    클릭하지 않으면 만족도 평가 링크가 정상적으로 작동하지 않을 수 있습니다.
  </div>

  <!-- Header -->
  <div style="background:#7C3AED;padding:28px 32px;">
    <div style="color:white;font-size:18px;font-weight:800;">IDS 자산관리파트 Help Desk</div>
    <div style="color:rgba(255,255,255,0.7);font-size:13px;margin-top:4px;">문의가 처리 완료되었습니다</div>
  </div>

  <!-- Body -->
  <div style="padding:28px 32px;">
    <p style="font-size:15px;color:#1E293B;margin:0 0 16px;">안녕하세요, <strong>${requesterName}</strong>님</p>
    <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 20px;">
      접수하신 문의가 담당자 <strong>${assignee}</strong>에 의해 처리 완료되었습니다.<br>
      서비스 개선을 위해 아래 버튼을 눌러 간단한 만족도 평가를 부탁드립니다.
    </p>

    <!-- Ticket content box -->
    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:14px 16px;margin-bottom:24px;">
      <div style="font-size:11px;color:#94A3B8;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">문의 내용</div>
      <p style="font-size:13px;color:#334155;margin:0;line-height:1.5;">${ticketContent}</p>
    </div>

    <!-- Star links -->
    <div style="text-align:center;margin-bottom:20px;">
      <div style="font-size:13px;color:#475569;font-weight:600;margin-bottom:12px;">만족도를 선택해주세요</div>
      <div style="display:flex;justify-content:center;gap:8px;">
        ${stars.map(s => `
        <a href="${feedbackUrl}?rating=${s}" target="_blank"
          style="display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:50%;background:#FEF3C7;color:#F59E0B;font-size:20px;text-decoration:none;font-weight:bold;">
          ${s}★
        </a>`).join("")}
      </div>
      <div style="display:flex;justify-content:center;gap:8px;margin-top:4px;">
        <span style="font-size:10px;color:#94A3B8;width:44px;text-align:center;">매우<br>불만족</span>
        <span style="width:44px;"></span><span style="width:44px;"></span><span style="width:44px;"></span>
        <span style="font-size:10px;color:#94A3B8;width:44px;text-align:center;">매우<br>만족</span>
      </div>
    </div>

    <!-- CTA button -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${feedbackUrl}" target="_blank"
        style="display:inline-block;background:#7C3AED;color:white;font-size:14px;font-weight:700;padding:12px 28px;border-radius:10px;text-decoration:none;">
        만족도 평가하기
      </a>
    </div>

    <p style="font-size:12px;color:#94A3B8;text-align:center;margin:0;">
      본 메일은 발신 전용입니다. 추가 문의는
      <a href="https://assetify-desk-main.vercel.app/inquiry" style="color:#7C3AED;">문의 접수 페이지</a>를 이용해 주세요.
    </p>
  </div>

  <!-- Footer -->
  <div style="background:#F8FAFC;border-top:1px solid #E2E8F0;padding:16px 32px;text-align:center;">
    <p style="font-size:11px;color:#CBD5E1;margin:0;">IDS 자산관리파트 · PC/OA 관리팀</p>
  </div>
</div>
</body>
</html>`;
}

function createTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

// POST /api/helpdesk/send-feedback
// Body: { ticketId, requesterEmail, requesterName, ticketContent, assignee }
export async function POST(req: NextRequest) {
  const transporter = createTransporter();
  if (!transporter) {
    return NextResponse.json({ error: "GMAIL_USER 또는 GMAIL_APP_PASSWORD 미설정" }, { status: 500 });
  }

  try {
    const { ticketId, requesterEmail, requesterName, ticketContent, assignee } = await req.json();
    if (!ticketId || !requesterEmail)
      return NextResponse.json({ error: "ticketId, requesterEmail 필수" }, { status: 400 });

    // 중복 발송 방지
    if (await alreadySentFeedback(ticketId)) {
      return NextResponse.json({ ok: true, skipped: true, reason: "이미 발송됨" });
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL || "https://assetify-desk-main.vercel.app";
    const feedbackUrl = `${origin}/inquiry/feedback/${ticketId}`;

    const html = buildEmailHtml({
      requesterName: requesterName || "고객",
      ticketContent: ticketContent || "문의 내용",
      assignee: assignee || "담당자",
      feedbackUrl,
    });

    await transporter.sendMail({
      from: `"IDS 자산관리파트 Help Desk" <${process.env.GMAIL_USER}>`,
      to: requesterEmail,
      subject: "[IDS Help Desk] 문의가 처리 완료되었습니다 - 만족도 평가 요청",
      html,
    });

    await markFeedbackSent(ticketId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/helpdesk/send-feedback]", e);
    return NextResponse.json({ error: "서버 오류", detail: String(e) }, { status: 500 });
  }
}

// GET /api/helpdesk/send-feedback?id=xxx → 발송 여부 확인
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
  const sent = await kvGet<boolean>(SENT_KEY(id));
  return NextResponse.json({ sent: !!sent });
}
