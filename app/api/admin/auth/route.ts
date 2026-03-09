import { NextResponse } from "next/server";

// 관리자 비밀 키 — 환경변수 미설정 시 기본값 3589 사용
const ADMIN_KEY = process.env.ADMIN_SECRET_KEY ?? "3589";

export async function POST(request: Request) {
  try {
    const { key } = await request.json();

    if (!key || key !== ADMIN_KEY) {
      return NextResponse.json({ error: "Invalid key" }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set("admin_key", key, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7일
      path: "/",
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

// 로그아웃
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set("admin_key", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
