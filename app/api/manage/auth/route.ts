// 이 엔드포인트는 더 이상 사용하지 않습니다.
// /manage 페이지는 기존 어드민 로그인(/admin/login)의 admin_session 쿠키로 인증합니다.
// 슈퍼어드민(role: "super") 계정만 접근 가능합니다.
import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json({ error: "Deprecated. Use /admin/login instead." }, { status: 410 });
}
