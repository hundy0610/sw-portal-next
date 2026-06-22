import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_SECRET = process.env.SESSION_SECRET;

async function verifySessionToken(token: string): Promise<{ userId: string; role: string } | null> {
  if (!SESSION_SECRET) return null;
  const dotIdx = token.lastIndexOf(".");
  if (dotIdx === -1) return null;
  const payload = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(SESSION_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      Buffer.from(sig, "hex"),
      new TextEncoder().encode(payload),
    );
    if (!valid) return null;

    const json = Buffer.from(payload, "base64").toString("utf-8");
    const s = JSON.parse(json);
    if (!s?.userId || !s?.role) return null;
    return { userId: s.userId, role: s.role };
  } catch {
    return null;
  }
}

async function getSession(request: NextRequest): Promise<{ userId: string; role: string } | null> {
  const sessionToken = request.cookies.get("admin_session")?.value;
  if (!sessionToken) return null;
  return verifySessionToken(sessionToken);
}

async function isAuthenticated(request: NextRequest): Promise<boolean> {
  return !!(await getSession(request));
}

function isMobile(request: NextRequest): boolean {
  const ua = request.headers.get("user-agent") ?? "";
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 인증 없이 허용
  if (
    pathname === "/admin/login" ||
    pathname.startsWith("/api/admin/auth") ||
    pathname === "/admin/change-password"
  ) {
    return NextResponse.next();
  }

  // /event/admin/* 는 super 전용
  if (pathname.startsWith("/event/admin")) {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.redirect(new URL("/admin/login?redirect=/event/admin", request.url));
    }
    if (session.role !== "super") {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  // /admin/* 인증 보호
  if (pathname.startsWith("/admin")) {
    if (!(await isAuthenticated(request))) {
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
  matcher: ["/admin/:path*", "/event/admin/:path*"],
};
