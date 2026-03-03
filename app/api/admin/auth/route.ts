import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { key } = await request.json();
    const secretKey = process.env.ADMIN_SECRET_KEY;

    if (!secretKey || key !== secretKey) {
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
