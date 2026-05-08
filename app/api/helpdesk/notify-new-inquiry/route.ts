import { NextRequest, NextResponse } from "next/server";
import { kvGet } from "@/lib/kv-store";
import nodemailer from "nodemailer";

const NOTIFY_KEY = "helpdesk:notify-emails";

const URGENCY_LABEL: Record<string, string> = {
  "매우 급합니다":    "🔴 매우 급합니다",
  "조금 급합니다":   "🟡 조금 급합니다",
  "기다릴 수 있어요": "🟢 기다릴 수 있어요",
};

function buildNotifyHtml(opts: {
  requester: string;
  company: string;
  department: string;
  inquiryType: string;
  urgency: string;
  content: string;
  assetNo: string;
  ticketUrl: string;
}): string {
  const { requester, company, department, inquiryType, urgency, content, assetNo, ticketUrl } = opts;
  const urgencyLabel = URGENCY_LABEL[urgency] ?? urgency;
  const companyDept = [company, department].filter(Boolean).join(" / ");

  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">
<div style="max-width:560px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

  <!-- Header -->
  <div style="background:#0EA5E9;padding:28px 32px;">
    <div style="color:white;font-size:18px;font-weight:800;">IDS 자산관리파트 Help Desk</div>
    <div style="color:rgba(255,255,255,0.7);font-size:13px;margin-top:4px;">신규 문의가 접수되었습니다</div>
  </div>

  <!-- Body -->
  <div style="padding:28px 32px;">
    <p style="font-size:14px;color:#475569;margin:0 0 20px;line-height:1.6;">
      새로운 문의가 접수되었습니다. 아래 내용을 확인하고 처리해주세요.
    </p>

    <!-- Info table -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px;">
      <tr>
        <td style="padding:8px 12px;background:#F8FAFC;border:1px solid #E2E8F0;font-weight:600;color:#64748B;width:90px;">접수자</td>
        <td style="padding:8px 12px;border:1px solid #E2E8F0;color:#1E293B;">${requester}${companyDept ? ` (${companyDept})` : ""}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;background:#F8FAFC;border:1px solid #E2E8F0;font-weight:600;color:#64748B;">유형</td>
        <td style="padding:8px 12px;border:1px solid #E2E8F0;color:#1E293B;">${inquiryType}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;background:#F8FAFC;border:1px solid #E2E8F0;font-weight:600;color:#64748B;">긴급도</td>
        <td style="padding:8px 12px;border:1px solid #E2E8F0;color:#1E293B;">${urgencyLabel}</td>
      </tr>
      ${assetNo ? `<tr>
        <td style="padding:8px 12px;background:#F8FAFC;border:1px solid #E2E8F0;font-weight:600;color:#64748B;">자산번호</td>
        <td style="padding:8px 12px;border:1px solid #E2E8F0;color:#1E293B;">${assetNo}</td>
      </tr>` : ""}
    </table>

    <!-- Content -->
    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:14px 16px;margin-bottom:24px;">
      <div style="font-size:11px;color:#94A3B8;margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">문의 내용</div>
      <p style="font-size:13px;color:#334155;margin:0;line-height:1.6;white-space:pre-wrap;">${content}</p>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${ticketUrl}" target="_blank"
        style="display:inline-block;background:#0EA5E9;color:white;font-size:14px;font-weight:700;padding:12px 28px;border-radius:10px;text-decoration:none;">
        어드민 패널에서 확인하기
      </a>
    </div>

    <p style="font-size:12px;color:#94A3B8;text-align:center;margin:0;">
      본 메일은 발신 전용입니다.
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
  return nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
}

// POST /api/helpdesk/notify-new-inquiry
// Body: { requester, company, department, inquiryType, urgency, content, assetNo }
export async function POST(req: NextRequest) {
  const transporter = createTransporter();
  if (!transporter) {
    return NextResponse.json({ error: "GMAIL_USER 또는 GMAIL_APP_PASSWORD 미설정" }, { status: 500 });
  }

  const notifyEmails = (await kvGet<string[]>(NOTIFY_KEY)) ?? [];
  if (notifyEmails.length === 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: "수신자 없음" });
  }

  try {
    const body = await req.json();
    const { requester, company, department, inquiryType, urgency, content, assetNo } = body;

    const ticketUrl = "https://swportal.vercel.app/admin";

    const html = buildNotifyHtml({
      requester: requester || "미상",
      company: company || "",
      department: department || "",
      inquiryType: inquiryType || "기타",
      urgency: urgency || "기다릴 수 있어요",
      content: content || "",
      assetNo: assetNo || "",
      ticketUrl,
    });

    const urgencySuffix = urgency === "매우 급합니다" ? " [긴급]" : "";
    await transporter.sendMail({
      from: `"IDS 자산관리파트 Help Desk" <${process.env.GMAIL_USER}>`,
      to: notifyEmails.join(", "),
      subject: `[IDS Help Desk] 신규 문의 접수 - ${requester || "미상"}${urgencySuffix}`,
      html,
    });

    return NextResponse.json({ ok: true, sent: notifyEmails.length });
  } catch (e) {
    console.error("[POST /api/helpdesk/notify-new-inquiry]", e);
    return NextResponse.json({ error: "서버 오류", detail: String(e) }, { status: 500 });
  }
}
