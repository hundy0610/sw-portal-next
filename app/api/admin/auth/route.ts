import { NextResponse, type NextRequest } from "next/server";
import { encodeSession, decodeSession, resolveCurrentName, type AdminSession } from "@/lib/session";
import { verifyPassword } from "@/lib/crypto";
import { kvGet } from "@/lib/kv-store";
import type { Account } from "@/app/api/admin/accounts/route";

const ACCOUNTS_KEY   = "sw:accounts";
const SUPER_ADMIN_ID = process.env.SUPER_ADMIN_ID ?? "admin";
const SUPER_ADMIN_PW = process.env.SUPER_ADMIN_PW ?? "3589";

async function lookupAccount(userId: string, password: string): Promise<AdminSession | null> {
  try {
    if (!process.env.REDIS_URL) return null;
    const accounts = (await kvGet<Account[]>(ACCOUNTS_KEY)) ?? [];

    const account = accounts.find(a => a.userId === userId && a.active);
    if (!account) return null;

    // 비밀번호 미설정 계정 — 로그인 불가, 비밀번호 초기화 필요
    if (!account.password) return null;
    if (!verifyPassword(password, account.password)) return null;

    return {
      notionPageId: account.id,   // account.id 를 세션 식별자로 재사용
      userId:       account.userId,
      name:         account.name,
      email:        account.email,
      company:      account.company,
      department:   account.department,
      role:         account.role,
      mustChangePassword: account.mustChangePassword,
    };
  } catch (e) {
    console.error("[auth] Redis lookup error:", e);
    return null;
  }
}

// ── POST /api/admin/auth — 로그인 ────────────────────────────
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId: string   = (body.userId ?? "").trim();
    const password: string = body.password ?? "";

    if (!userId || !password) {
      return NextResponse.json({ error: "아이디/비밀번호를 입력해주세요" }, { status: 400 });
    }

    let session: AdminSession | null = null;

    // 1. ENV 슈퍼어드민 (평문 비교 유지)
    if (userId === SUPER_ADMIN_ID && password === SUPER_ADMIN_PW) {
      session = {
        notionPageId: "env-super",
        userId:       SUPER_ADMIN_ID,
        name:         "슈퍼 어드민",
        email:        process.env.SUPER_ADMIN_EMAIL ?? "",
        company:      "",
        department:   "",
        role:         "super",
      };
    }

    // 2. Redis 계정 DB 조회
    if (!session) {
      session = await lookupAccount(userId, password);
    }

    if (!session) {
      return NextResponse.json(
        { error: "아이디 또는 비밀번호가 올바르지 않습니다" },
        { status: 401 },
      );
    }

    const token = encodeSession(session);
    const response = NextResponse.json({
      success: true,
      role:               session.role,
      company:            session.company,
      name:               session.name,
      mustChangePassword: session.mustChangePassword ?? false,
    });

    response.cookies.set("admin_session", token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge:   60 * 60 * 24 * 7,
      path:     "/",
    });

    response.cookies.set("admin_key", "", { httpOnly: true, maxAge: 0, path: "/" });

    return response;
  } catch (e) {
    console.error("[auth POST]", e);
    return NextResponse.json({ error: "로그인 처리 중 오류가 발생했습니다" }, { status: 500 });
  }
}

// ── GET /api/admin/auth — 현재 세션 정보 ────────────────────
export async function GET(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;

  if (token) {
    const session = decodeSession(token);
    if (session) {
      return NextResponse.json({
        ok:                 true,
        role:               session.role,
        company:            session.company,
        name:               await resolveCurrentName(session),
        email:              session.email,
        userId:             session.userId,
        mustChangePassword: session.mustChangePassword ?? false,
      });
    }
  }

  // 구버전 admin_key 쿠키 fallback
  const key = request.cookies.get("admin_key")?.value;
  if (key) {
    const ADMIN_KEY = process.env.ADMIN_SECRET_KEY ?? "3589";
    if (key === ADMIN_KEY) {
      return NextResponse.json({
        ok:      true,
        role:    "super",
        company: "",
        name:    "슈퍼 어드민",
        email:   "",
        userId:  "admin",
      });
    }
  }

  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

// ── DELETE /api/admin/auth — 로그아웃 ───────────────────────
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set("admin_session", "", {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   0,
    path:     "/",
  });
  response.cookies.set("admin_key", "", { httpOnly: true, maxAge: 0, path: "/" });
  return response;
}
