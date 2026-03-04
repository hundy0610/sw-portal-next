import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN_KEY = process.env.ADMIN_SECRET_KEY ?? "3589";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    // 로그인 페이지는 통과
    if (pathname === "/admin/login") return NextResponse.next();

    // 쿠키 확인
    const adminKey = request.cookies.get("admin_key")?.value;
    if (adminKey !== ADMIN_KEY) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
