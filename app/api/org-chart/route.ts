import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// 조직도는 Assetify 데스크탑 앱이 암호화해 관리한다(Assetify v1.54.0, KV orgChart:secure).
// 이 라우트는 옛 평문 키(orgChart:units)를 읽었다 — 2026-10-12 조직도 개인정보 처리 기준에 따라
// 웹에서는 조직도를 읽지도 쓰지도 않는다. 웹 관리자 화면은 철거 대상이다.
function movedToDesktop() {
  return NextResponse.json(
    { ok: false, error: "조직도·실사 진행률은 Assetify 데스크탑 앱에서 관리합니다." }, { status: 410 });
}

export async function GET() { return movedToDesktop(); }
export async function POST() { return movedToDesktop(); }
