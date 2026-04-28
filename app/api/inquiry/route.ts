import { NextRequest, NextResponse } from "next/server";
import { createHelpDeskTicket } from "@/lib/notion";
import { kvDel } from "@/lib/kv-store";

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

    // 헬프데스크 캐시 무효화 (다음 조회 시 최신 반영)
    await kvDel("helpdesk:tickets");

    return NextResponse.json({ ok: true, pageId }, { status: 201 });
  } catch (e) {
    console.error("[POST /api/inquiry]", e);
    const msg = e instanceof Error ? e.message : "서버 오류";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
