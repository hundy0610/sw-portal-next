import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 관리자 비밀 키 — 환경변수 미설정 시 기본값 3589 사용
const ADMIN_KEY = process.env.ADMIN_SECRET_KEY ?? "3589";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /admin/login, /api/admin/auth 는 인증 없이 허용
  if (
    pathname === "/admin/login" ||
    pathname.startsWith("/api/admin/auth")
  ) {
    return NextResponse.next();
  }

  // /admin/* 경로 보호
  if (pathname.startsWith("/admin")) {
    const adminKey = request.cookies.get("admin_key")?.value;
    if (adminKey !== ADMIN_KEY) {
      const loginUrl = new URL("/admin/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
