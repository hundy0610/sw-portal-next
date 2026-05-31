import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN_KEY = process.env.ADMIN_SECRET_KEY ?? "3589";

function isAuthenticated(request: NextRequest): boolean {
  const sessionToken = request.cookies.get("admin_session")?.value;
  if (sessionToken) {
    try {
      const json = Buffer.from(sessionToken, "base64").toString("utf-8");
      const s = JSON.parse(json);
      if (s?.userId && s?.role) return true;
    } catch {}
  }
  const adminKey = request.cookies.get("admin_key")?.value;
  if (adminKey === ADMIN_KEY) return true;
  return false;
}

function isMobile(request: NextRequest): boolean {
  const ua = request.headers.get("user-agent") ?? "";
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 인증 없이 허용
  if (
    pathname === "/admin/login" ||
    pathname.startsWith("/api/admin/auth") ||
    pathname === "/admin/change-password"
  ) {
    return NextResponse.next();
  }

  // /admin/* 인증 보호
  if (pathname.startsWith("/admin")) {
    if (!isAuthenticated(request)) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }

    // 모바일 기기로 /admin 접속 시 → /admin/mobile 자동 이동
    // (이미 /admin/mobile 이하면 제외)
    if (!pathname.startsWith("/admin/mobile") && isMobile(request)) {
      return NextResponse.redirect(new URL("/admin/mobile", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
