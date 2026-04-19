import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { password, key } = await req.json();

  const validKey = process.env.MANAGE_SECRET_KEY;
  const validPw  = process.env.MANAGE_PASSWORD;

  if (!validKey || !validPw) {
    return NextResponse.json({ error: "관리모드가 설정되지 않았습니다." }, { status: 503 });
  }

  if (key !== validKey || password !== validPw) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
