import { NextResponse, type NextRequest } from "next/server";
import { Client } from "@notionhq/client";
import { decodeSession, encodeSession, type AdminSession } from "@/lib/session";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

// ── POST /api/admin/change-password — 비밀번호 변경 ─────────
export async function POST(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  if (!token) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const session = decodeSession(token);
  if (!session) {
    return NextResponse.json({ error: "유효하지 않은 세션입니다" }, { status: 401 });
  }

  try {
    const { newPassword, confirmPassword } = await request.json();

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: "비밀번호는 6자 이상이어야 합니다" }, { status: 400 });
    }
    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: "비밀번호 확인이 일치하지 않습니다" }, { status: 400 });
    }

    // Notion DB 레코드 업데이트
    if (session.notionPageId && session.notionPageId !== "env-super") {
      await notion.pages.update({
        page_id: session.notionPageId,
        properties: {
          "비밀번호":     { rich_text: [{ text: { content: newPassword } }] },
          "비번변경필요": { checkbox: false },
        },
      });
    }

    // 세션에서 mustChangePassword 제거 → 새 쿠키 발급
    const newSession: AdminSession = { ...session, mustChangePassword: false };
    const newToken = encodeSession(newSession);

    const response = NextResponse.json({ ok: true });
    response.cookies.set("admin_session", newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (e) {
    console.error("[change-password]", e);
    return NextResponse.json({ error: "비밀번호 변경 중 오류가 발생했습니다" }, { status: 500 });
  }
}
