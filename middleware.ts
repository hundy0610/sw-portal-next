import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /admin/login, /api/admin/auth 는 항상 접근 허용
  if (pathname === "/admin/login" || pathname.startsWith("/api/admin/auth")) {
    return NextResponse.next();
  }

  // /admin 및 하위 경로 보호
  if (pathname.startsWith("/admin")) {
    const adminKey = request.cookies.get("admin_key")?.value;
    const secretKey = process.env.ADMIN_SECRET_KEY;

    if (!secretKey || adminKey !== secretKey) {
      const loginUrl = new URL("/admin/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
