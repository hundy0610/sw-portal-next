import { NextResponse, type NextRequest } from "next/server";
import { decodeSession, encodeSession, type AdminSession } from "@/lib/session";
import { hashPassword } from "@/lib/crypto";
import { kvGet, kvSetPermanent } from "@/lib/kv-store";
import type { Account } from "@/app/api/admin/accounts/route";

const ACCOUNTS_KEY = "sw:accounts";

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

    // ENV 슈퍼어드민은 비밀번호 변경 불필요
    if (session.notionPageId && session.notionPageId !== "env-super") {
      const accounts = (await kvGet<Account[]>(ACCOUNTS_KEY)) ?? [];
      const idx = accounts.findIndex(a => a.id === session.notionPageId);
      if (idx !== -1) {
        accounts[idx] = {
          ...accounts[idx],
          password:           hashPassword(newPassword),
          mustChangePassword: false,
        };
        await kvSetPermanent(ACCOUNTS_KEY, accounts);
      }
    }

    const newSession: AdminSession = { ...session, mustChangePassword: false };
    const newToken = encodeSession(newSession);

    const response = NextResponse.json({ ok: true });
    response.cookies.set("admin_session", newToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge:   60 * 60 * 24 * 7,
      path:     "/",
    });

    return response;
  } catch (e) {
    console.error("[change-password]", e);
    return NextResponse.json({ error: "비밀번호 변경 중 오류가 발생했습니다" }, { status: 500 });
  }
}
