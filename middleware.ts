import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// v2 전환 뒤 포털의 관리 화면은 공개 자료 관리(/manage) 하나뿐이고, 들어오는 계정은 환경변수 슈퍼어드민
// 하나다(10-29 결정 — 관리자 계정 목록 sw:accounts 는 암호문이라 포털이 읽을 수 없다). 세션 쿠키의 서명과
// 그 계정인지만 본다. /admin 관리 화면·/event/admin 은 없앴다(관리는 데스크탑 앱).
const SESSION_SECRET = process.env.SESSION_SECRET;
const SUPER_ADMIN_ID = process.env.SUPER_ADMIN_ID ?? "admin";

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

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session || session.role !== "super" || session.userId !== SUPER_ADMIN_ID) {
    return NextResponse.redirect(new URL("/admin/login?redirect=/manage", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/manage/:path*"],
};
