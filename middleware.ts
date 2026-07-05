import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Redis } from "@upstash/redis";

const SESSION_SECRET = process.env.SESSION_SECRET;
const ACCOUNTS_KEY = "sw:accounts";

// 쿠키의 role은 로그인 시점 스냅샷이라 이후 계정관리에서 권한이 바뀌어도
// 갱신되지 않는다. super 전용 라우트 진입 직전에 최신 권한을 다시 조회한다.
async function resolveCurrentRole(userId: string, fallbackRole: string): Promise<string> {
  const url   = process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN  || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return fallbackRole;
  try {
    const accounts = await new Redis({ url, token }).get<{ userId: string; role: string }[]>(ACCOUNTS_KEY);
    const found = accounts?.find(a => a.userId === userId);
    return found?.role ?? fallbackRole;
  } catch {
    return fallbackRole;
  }
}

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
    const role = await resolveCurrentRole(session.userId, session.role);
    if (role !== "super") {
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
