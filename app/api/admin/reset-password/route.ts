import { NextResponse, type NextRequest } from "next/server";
import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { kvGet, kvSet, kvDel } from "@/lib/kv-store";
import { hashPassword } from "@/lib/crypto";
import nodemailer from "nodemailer";
import crypto from "crypto";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const ACCOUNTS_DB_ID = process.env.ACCOUNTS_DB_ID ?? "";

const RESET_KEY = (userId: string) => `pw-reset:${userId}`;
const RESET_TTL = 60 * 10; // 10분

type Props = PageObjectResponse["properties"];
const txt = (p: Props, k: string) => {
  const v = p[k];
  if (!v) return "";
  if (v.type === "title")     return v.title.map(t => t.plain_text).join("");
  if (v.type === "rich_text") return v.rich_text.map(t => t.plain_text).join("");
  return "";
};

function createTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
}

// ── POST /api/admin/reset-password — 인증코드 발송 요청 ──────
// Body: { userId, email }
export async function POST(request: NextRequest) {
  try {
    const { userId, email } = await request.json();
    if (!userId || !email) {
      return NextResponse.json({ error: "아이디와 이메일을 입력해주세요" }, { status: 400 });
    }

    if (!ACCOUNTS_DB_ID) {
      return NextResponse.json({ error: "계정 DB가 설정되지 않았습니다" }, { status: 500 });
    }

    // Notion에서 userId + email 일치하는 활성 계정 조회
    const res = await notion.databases.query({
      database_id: ACCOUNTS_DB_ID,
      filter: {
        and: [
          { property: "아이디", rich_text: { equals: userId } },
          { property: "활성화", checkbox: { equals: true } },
        ],
      },
    });

    let notionPageId: string | null = null;
    for (const page of res.results) {
      if (page.object !== "page" || !("properties" in page)) continue;
      const p = (page as PageObjectResponse).properties;
      const storedEmail = txt(p, "메일");
      if (storedEmail.toLowerCase() === email.toLowerCase()) {
        notionPageId = page.id;
        break;
      }
    }

    if (!notionPageId) {
      // 보안상 항상 성공처럼 응답 (계정 존재 여부 노출 방지)
      return NextResponse.json({ ok: true });
    }

    // 6자리 인증코드 생성
    const code = crypto.randomInt(100000, 999999).toString();
    await kvSet(RESET_KEY(userId), { code, notionPageId }, RESET_TTL);

    const transporter = createTransporter();
    if (transporter) {
      const html = `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">
<div style="max-width:480px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
  <div style="background:#7C3AED;padding:24px 32px;">
    <div style="color:white;font-size:16px;font-weight:800;">SW 포털 비밀번호 초기화</div>
  </div>
  <div style="padding:28px 32px;">
    <p style="font-size:14px;color:#475569;margin:0 0 20px;">아래 인증코드를 입력하여 비밀번호를 초기화하세요.<br>인증코드는 <strong>10분간</strong> 유효합니다.</p>
    <div style="background:#F3F0FF;border:2px solid #7C3AED;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
      <div style="font-size:36px;font-weight:900;letter-spacing:8px;color:#7C3AED;">${code}</div>
    </div>
    <p style="font-size:12px;color:#94A3B8;margin:0;">본 메일을 요청하지 않으셨다면 무시하시기 바랍니다.</p>
  </div>
</div>
</body>
</html>`;
      await transporter.sendMail({
        from: `"SW 포털" <${process.env.GMAIL_USER}>`,
        to: email,
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

    const stored = await kvGet<{ code: string; notionPageId: string }>(RESET_KEY(userId));
    if (!stored || stored.code !== code) {
      return NextResponse.json({ error: "인증코드가 올바르지 않거나 만료되었습니다" }, { status: 400 });
    }

    await notion.pages.update({
      page_id: stored.notionPageId,
      properties: {
        "비밀번호":     { rich_text: [{ text: { content: hashPassword(newPassword) } }] },
        "비번변경필요": { checkbox: false },
      },
    });

    await kvDel(RESET_KEY(userId));
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[reset-password PATCH]", e);
    return NextResponse.json({ error: "처리 중 오류가 발생했습니다" }, { status: 500 });
  }
}
