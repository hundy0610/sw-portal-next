import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { kvSet } from "@/lib/kv-store";
import { fetchOrgUnits } from "@/lib/org-chart";
import { createMailTransporter } from "@/lib/mail";
import { errorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const OTP_KEY = (email: string) => `asset-audit:manager-otp:${email.toLowerCase()}`;
const OTP_TTL = 60 * 10; // 10분

// POST /api/asset-audit/manager-auth — 직책자 이메일로 인증코드 발송
// Body: { email }
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ ok: false, error: "이메일을 입력해주세요." }, { status: 400 });
    }

    const units = await fetchOrgUnits();
    const unit = units.find(u => u.managerEmail.toLowerCase() === email.toLowerCase());

    // 보안상 계정 존재 여부와 무관하게 항상 성공 응답
    if (!unit) {
      return NextResponse.json({ ok: true });
    }

    const code = crypto.randomInt(100000, 999999).toString();
    await kvSet(OTP_KEY(email), { code }, OTP_TTL);

    const transporter = createMailTransporter();
    if (transporter) {
      const html = `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">
<div style="max-width:480px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
  <div style="background:#0EA5E9;padding:24px 32px;">
    <div style="color:white;font-size:16px;font-weight:800;">자산 실사 조직 현황 조회 인증</div>
  </div>
  <div style="padding:28px 32px;">
    <p style="font-size:14px;color:#475569;margin:0 0 20px;">
      아래 인증코드를 입력하여 담당 조직의 자산 실사 진행률을 조회하세요.<br>
      인증코드는 <strong>10분간</strong> 유효합니다.
    </p>
    <div style="background:#F0F9FF;border:2px solid #0EA5E9;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
      <div style="font-size:36px;font-weight:900;letter-spacing:8px;color:#0EA5E9;">${code}</div>
    </div>
    <p style="font-size:12px;color:#94A3B8;margin:0;">본 메일을 요청하지 않으셨다면 무시하시기 바랍니다.</p>
  </div>
</div>
</body>
</html>`;
      await transporter.sendMail({
        from:    `"SW 포털" <${process.env.GMAIL_USER}>`,
        to:      email,
        subject: "[SW 포털] 자산 실사 조직 조회 인증코드",
        html,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[manager-auth POST]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
