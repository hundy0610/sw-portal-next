import { NextResponse, type NextRequest } from "next/server";
import { decodeSession } from "@/lib/session";
import { verifyPassword } from "@/lib/crypto";
import { kvGet } from "@/lib/kv-store";
import type { Account } from "@/app/api/admin/accounts/route";

const ACCOUNTS_KEY   = "sw:accounts";
const SUPER_ADMIN_ID = process.env.SUPER_ADMIN_ID ?? "admin";
const SUPER_ADMIN_PW = process.env.SUPER_ADMIN_PW;

export const dynamic = "force-dynamic";

// POST /api/admin/auth/verify — 쿠키 변경 없이 비밀번호만 검증
export async function POST(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  if (!token) return NextResponse.json({ ok: false, error: "세션이 없습니다" }, { status: 401 });

  const session = decodeSession(token);
  if (!session) return NextResponse.json({ ok: false, error: "세션이 유효하지 않습니다" }, { status: 401 });

  const body = await request.json();
  const password: string = body.password ?? "";
  if (!password) return NextResponse.json({ ok: false, error: "비밀번호를 입력해주세요" }, { status: 400 });

  const userId = session.userId;

  // ENV 슈퍼어드민 — 평문 비교
  if (userId === SUPER_ADMIN_ID) {
    const ok = !!SUPER_ADMIN_PW && password === SUPER_ADMIN_PW;
    return NextResponse.json(ok ? { ok: true } : { ok: false, error: "비밀번호가 올바르지 않습니다" });
  }

  // Redis 계정 — 해시 검증
  try {
    const accounts = (await kvGet<Account[]>(ACCOUNTS_KEY)) ?? [];
    const account = accounts.find(a => a.userId === userId && a.active);
    if (!account?.password) return NextResponse.json({ ok: false, error: "계정을 찾을 수 없습니다" });
    const ok = verifyPassword(password, account.password);
    return NextResponse.json(ok ? { ok: true } : { ok: false, error: "비밀번호가 올바르지 않습니다" });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
