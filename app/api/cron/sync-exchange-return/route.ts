import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: false, error: "sync 기능이 제거되었습니다." }, { status: 410 });
}
