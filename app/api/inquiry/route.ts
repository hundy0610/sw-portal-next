import { NextRequest, NextResponse } from "next/server";
import { createHelpDeskTicket } from "@/lib/notion";

export const dynamic = "force-dynamic";

// POST /api/inquiry
// Body: { requester, requesterEmail, company, department, inquiryType, urgency, content, assetNo? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      requester, requesterEmail, company, department,
      inquiryType, urgency, content, assetNo,
    } = body;

    if (!requester || !requesterEmail || !content) {
      return NextResponse.json(
        { error: "필수 항목이 누락되었습니다 (requester, requesterEmail, content)" },
        { status: 400 },
      );
    }

    // 이메일 형식 검증
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requesterEmail)) {
      return NextResponse.json({ error: "올바른 이메일 주소를 입력해주세요." }, { status: 400 });
    }

    // 제목: 문의내용 앞 40자
    const title = content.length > 40 ? content.slice(0, 40) + "…" : content;

    const pageId = await createHelpDeskTicket({
      title,
      company:        company       || "",
      department:     department    || "",
      requester,
      requesterEmail,
      inquiryType:    inquiryType   || "SW",
      urgency:        urgency       || "기다릴 수 있어요",
      content,
      assetNo:        assetNo       || "",
    });

    // 4.0verMACBOOK: 문의는 이제 Postgres 미러가 메인이라 Notion 페이지가 즉시 생기지 않는다.
    // 예전엔 Notion Automation 웹훅(helpdesk-new)이 신규 알림 메일을 보냈지만, 지연/누락을
    // 없애기 위해 접수 시점에 앱에서 직접 관리자 알림 메일을 발송한다(웹훅은 무력화됨).
    const origin = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    fetch(`${origin}/api/helpdesk/notify-new-inquiry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requester, company, department, inquiryType, urgency, content, assetNo }),
    }).catch(e => console.error("[inquiry] notify failed:", e));

    return NextResponse.json({ ok: true, pageId }, { status: 201 });
  } catch (e) {
    console.error("[POST /api/inquiry]", e);
    const msg = e instanceof Error ? e.message : "서버 오류";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
