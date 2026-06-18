import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookieHeader } from "@/lib/session";
import { createMailTransporter } from "@/lib/mail";

// POST /api/monitor-repair-notify — 모니터 교체/수리 요청 시 총무 담당자에게 메일만 발송 (수리 접수 현황 DB 등록 없음)
export async function POST(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { to, subject, html } = await req.json() as { to?: string; subject?: string; html?: string };
  if (!to || !subject || !html) return NextResponse.json({ ok: false, error: "필수 항목 누락" }, { status: 400 });

  try {
    const transporter = createMailTransporter();
    if (!transporter) return NextResponse.json({ ok: false, error: "메일 설정이 없습니다." }, { status: 503 });

    await transporter.sendMail({
      from: `"SW 포털 자산관리" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[API POST /monitor-repair-notify]", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "알 수 없는 오류" }, { status: 500 });
  }
}
