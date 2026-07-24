import { NextResponse } from "next/server";

// 4.0verMACBOOK: 수리 접수는 이제 앱(/api/request/repair·/api/repair-tickets)이 맥북
// Postgres 미러에 직접 기록하고, 신규 알림 메일도 앱에서 직접 발송한다. 미러가 메인이라
// Notion 페이지는 5분 백업 때 뒤늦게 생성되므로, 이 Notion Automation 웹훅을 그대로 두면
// 알림이 지연·중복 발송된다. 그래서 무력화(no-op)한다.
export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json({ ok: true, skipped: "disabled (app sends notification directly)" });
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "repair-new-webhook", disabled: true });
}
