import { NextResponse, type NextRequest } from "next/server";
import { kvGet, kvSet, kvDel, kvSetPermanent } from "@/lib/kv-store";
import { hashPassword } from "@/lib/crypto";
import { createMailTransporter } from "@/lib/mail";
import type { Account } from "@/app/api/admin/accounts/route";
import crypto from "crypto";

const ACCOUNTS_KEY = "sw:accounts";
const RESET_KEY    = (userId: string) => `pw-reset:${userId}`;
const RESET_TTL    = 60 * 10; // 10분

// ── POST /api/admin/reset-password — 인증코드 발송 요청 ──────
// Body: { userId, email }
export async function POST(request: NextRequest) {
  try {
    const { userId, email } = await request.json();
    if (!userId || !email) {
      return NextResponse.json({ error: "아이디와 이메일을 입력해주세요" }, { status: 400 });
    }

    // Redis에서 userId + email 일치하는 활성 계정 조회
    const accounts = (await kvGet<Account[]>(ACCOUNTS_KEY)) ?? [];
    const account  = accounts.find(
      a => a.userId === userId && a.active && a.email.toLowerCase() === email.toLowerCase(),
    );

    // 보안상 계정 존재 여부와 무관하게 항상 성공 응답
    if (!account) {
      return NextResponse.json({ ok: true });
    }

    // 6자리 인증코드 생성 및 Redis 저장
    const code = crypto.randomInt(100000, 999999).toString();
    await kvSet(RESET_KEY(userId), { code, accountId: account.id }, RESET_TTL);

    // Gmail 발송
    const transporter = createMailTransporter();
    if (transporter) {
      const html = `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">
<div style="max-width:480px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
  <div style="background:#7C3AED;padding:24px 32px;">
    <div style="color:white;font-size:16px;font-weight:800;">SW 포털 비밀번호 초기화</div>
  </div>
  <div style="padding:28px 32px;">
    <p style="font-size:14px;color:#475569;margin:0 0 20px;">
      아래 인증코드를 입력하여 비밀번호를 초기화하세요.<br>
      인증코드는 <strong>10분간</strong> 유효합니다.
    </p>
    <div style="background:#F3F0FF;border:2px solid #7C3AED;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
      <div style="font-size:36px;font-weight:900;letter-spacing:8px;color:#7C3AED;">${code}</div>
    </div>
    <p style="font-size:12px;color:#94A3B8;margin:0;">본 메일을 요청하지 않으셨다면 무시하시기 바랍니다.</p>
  </div>
</div>
</body>
</html>`;
      await transporter.sendMail({
        from:    `"SW 포털" <${process.env.GMAIL_USER}>`,
        to:      email,
        subject: "[SW 포털] 비밀번호 초기화 인증코드",
        html,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[reset-password POST]", e);
    return NextResponse.json({ error: "처리 중 오류가 발생했습니다" }, { status: 500 });
  }
}

// ── PATCH /api/admin/reset-password — 코드 검증 + 새 비밀번호 설정 ──
// Body: { userId, code, newPassword, confirmPassword }
export async function PATCH(request: NextRequest) {
  try {
    const { userId, code, newPassword, confirmPassword } = await request.json();
    if (!userId || !code || !newPassword) {
      return NextResponse.json({ error: "필수 항목을 입력해주세요" }, { status: 400 });
    }
    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: "비밀번호 확인이 일치하지 않습니다" }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "비밀번호는 6자 이상이어야 합니다" }, { status: 400 });
    }

    const stored = await kvGet<{ code: string; accountId: string }>(RESET_KEY(userId));
    if (!stored || stored.code !== code) {
      return NextResponse.json(
        { error: "인증코드가 올바르지 않거나 만료되었습니다" },
        { status: 400 },
      );
    }

    // Redis 계정 배열에서 해당 계정 비밀번호 업데이트
    const accounts = (await kvGet<Account[]>(ACCOUNTS_KEY)) ?? [];
    const idx = accounts.findIndex(a => a.id === stored.accountId);
    if (idx !== -1) {
      accounts[idx] = {
        ...accounts[idx],
        password:           hashPassword(newPassword),
        mustChangePassword: false,
      };
      // 인증코드는 이미 확인됐는데 저장만 조용히 실패하면, 사용자는 비밀번호를 초기화했다고
      // 믿지만 실제로는 예전 비밀번호로만 로그인되는 상태가 된다 — 반드시 확인한다.
      const saved = await kvSetPermanent(ACCOUNTS_KEY, accounts);
      if (!saved) {
        return NextResponse.json({ error: "비밀번호 저장에 실패했습니다. 잠시 후 다시 시도해주세요.", code: "PASSWORD_SAVE_FAILED" }, { status: 500 });
      }
    }

    await kvDel(RESET_KEY(userId));
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[reset-password PATCH]", e);
    return NextResponse.json({ error: "처리 중 오류가 발생했습니다" }, { status: 500 });
  }
}
