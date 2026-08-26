import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_SECRET = process.env.SESSION_SECRET;
const ACCOUNTS_KEY = "sw:accounts";

// 계정 목록은 super 전용 라우트(/event/admin, /manage) 진입 시에만 조회한다.
// Edge 미들웨어는 매 요청 실행되므로, 매번 맥북 Postgres 로 왕복하지 않도록
// 모듈 스코프에 아주 짧게(수초) 캐시해 지연·부하를 줄인다.
type AccountRole = { userId: string; role: string };
let _accountsCache: { at: number; data: AccountRole[] } | null = null;
const ACCOUNTS_CACHE_MS = 5000;

// 계정 목록(kv:sw:accounts)을 맥북 Postgres(자체 Supabase, Tailscale Funnel)에서
// PostgREST fetch 로 읽는다. service_role 키는 서버(Edge) 전용 env 로만 사용한다.
async function fetchAccounts(): Promise<AccountRole[] | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) return null;

  const now = Date.now();
  if (_accountsCache && now - _accountsCache.at < ACCOUNTS_CACHE_MS) {
    return _accountsCache.data;
  }

  try {
    const endpoint =
      `${url}/rest/v1/kv?select=value&key=eq.${encodeURIComponent(ACCOUNTS_KEY)}`;
    const res = await fetch(endpoint, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) return _accountsCache?.data ?? null;
    const rows = (await res.json()) as { value: AccountRole[] }[];
    const accounts = rows?.[0]?.value ?? [];
    _accountsCache = { at: now, data: accounts };
    return accounts;
  } catch {
    // 조회 실패 시 마지막 캐시라도 사용(없으면 null → 호출부가 fallbackRole 사용)
    return _accountsCache?.data ?? null;
  }
}

// 쿠키의 role은 로그인 시점 스냅샷이라 이후 계정관리에서 권한이 바뀌어도
// 갱신되지 않는다. super 전용 라우트 진입 직전에 최신 권한을 다시 조회한다.
async function resolveCurrentRole(userId: string, fallbackRole: string): Promise<string> {
  const accounts = await fetchAccounts();
  if (!accounts) return fallbackRole;
  const found = accounts.find(a => a.userId === userId);
  return found?.role ?? fallbackRole;
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

  // /manage(포털 콘텐츠 관리)도 super 전용
  if (pathname.startsWith("/manage")) {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.redirect(new URL("/admin/login?redirect=/manage", request.url));
    }
    const role = await resolveCurrentRole(session.userId, session.role);
    if (role !== "super") {
      return NextResponse.redirect(new URL("/admin/login?redirect=/manage", request.url));
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
  matcher: ["/admin/:path*", "/event/admin/:path*", "/manage/:path*"],
};
