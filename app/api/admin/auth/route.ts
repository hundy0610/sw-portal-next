import { NextResponse, type NextRequest } from "next/server";
import { encodeSession, decodeSession, resolveCurrentName, resolveCurrentRole, type AdminSession } from "@/lib/session";

const SUPER_ADMIN_ID = process.env.SUPER_ADMIN_ID ?? "admin";
const SUPER_ADMIN_PW = process.env.SUPER_ADMIN_PW;

// v2 전환 뒤: 환경변수 슈퍼어드민 하나만 로그인한다(포털 공개 자료 관리 /manage 전용, 10-29 결정).
// 관리자 계정 목록(sw:accounts)은 암호문이라 포털이 읽을 수 없다 — 계정 관리는 데스크탑 앱에서 한다.

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
    if (SUPER_ADMIN_PW && userId === SUPER_ADMIN_ID && password === SUPER_ADMIN_PW) {
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
        role:               await resolveCurrentRole(session),
        company:            session.company,
        name:               await resolveCurrentName(session),
        email:              session.email,
        userId:             session.userId,
        mustChangePassword: session.mustChangePassword ?? false,
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
