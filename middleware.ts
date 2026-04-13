import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 구버전 호환: 환경변수 기반 관리자 키
const ADMIN_KEY = process.env.ADMIN_SECRET_KEY ?? "3589";

function isAuthenticated(request: NextRequest): boolean {
  // 신버전: admin_session 쿠키 (base64 JSON)
  const sessionToken = request.cookies.get("admin_session")?.value;
  if (sessionToken) {
    try {
      const json = Buffer.from(sessionToken, "base64").toString("utf-8");
      const s = JSON.parse(json);
      if (s?.userId && s?.role) return true;
    } catch {
      // 파싱 실패 시 fallback
    }
  }

  // 구버전 fallback: admin_key 쿠키
  const adminKey = request.cookies.get("admin_key")?.value;
  if (adminKey === ADMIN_KEY) return true;

  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 인증 없이 허용하는 경로
  if (
    pathname === "/admin/login" ||
    pathname.startsWith("/api/admin/auth") ||
    pathname === "/admin/change-password"
  ) {
    return NextResponse.next();
  }

  // /admin/* 경로 보호
  if (pathname.startsWith("/admin")) {
    if (!isAuthenticated(request)) {
      const loginUrl = new URL("/admin/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
