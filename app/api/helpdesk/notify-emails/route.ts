import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSetPermanent } from "@/lib/kv-store";
import { decodeSession } from "@/lib/session";

const NOTIFY_KEY = "helpdesk:notify-emails";

function getSession(req: NextRequest) {
  const token = req.cookies.get("admin_session")?.value;
  if (!token) return null;
  return decodeSession(token);
}

// GET /api/helpdesk/notify-emails — 알림 수신 이메일 목록 조회
export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const emails = (await kvGet<string[]>(NOTIFY_KEY)) ?? [];
  return NextResponse.json({ ok: true, emails });
}

// PUT /api/helpdesk/notify-emails — 목록 전체 교체 (어드민 이상)
export async function PUT(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { emails } = (await req.json()) as { emails: string[] };
  if (!Array.isArray(emails)) {
    return NextResponse.json({ ok: false, error: "잘못된 형식" }, { status: 400 });
  }

  const invalid = emails.filter(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  if (invalid.length > 0) {
    return NextResponse.json({ ok: false, error: `올바르지 않은 이메일: ${invalid.join(", ")}` }, { status: 400 });
  }

  await kvSetPermanent(NOTIFY_KEY, emails);
  return NextResponse.json({ ok: true, emails });
}
