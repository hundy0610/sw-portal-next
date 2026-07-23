import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSetPermanent } from "@/lib/kv-store";
import { getSessionFromCookieHeader } from "@/lib/session";

// 자산 흐름 관리 — 안내 메일 발송 여부를 기기가 아닌 서버(KV)에 기록해
// 어떤 관리자가 어느 기기에서 접속해도 "발송됨" 상태가 동일하게 보이도록 한다.
const KEY = "exchange-return:mail-sent";

export async function GET(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const ids = (await kvGet<string[]>(KEY)) ?? [];
  return NextResponse.json({ ok: true, ids });
}

export async function POST(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json() as { id: string };
  if (!id) return NextResponse.json({ ok: false, error: "id 필수" }, { status: 400 });

  const ids = (await kvGet<string[]>(KEY)) ?? [];
  if (!ids.includes(id)) {
    ids.push(id);
    const saved = await kvSetPermanent(KEY, ids);
    if (!saved) {
      return NextResponse.json({ ok: false, error: "발송 기록 저장에 실패했습니다. 잠시 후 다시 시도해주세요.", code: "MAIL_SENT_SAVE_FAILED" }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true, ids });
}
