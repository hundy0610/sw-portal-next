import { NextRequest, NextResponse } from "next/server";
import { createHelpDeskTicket } from "@/lib/notion";
import { kvDel } from "@/lib/kv-store";

export const dynamic = "force-dynamic";

// POST /api/automation
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      requester, email, department,
      taskName, tools, cycle, weeklyHours,
      currentFlow, desiredFlow, extra, urgency,
    } = body;

    if (!requester || !email || !department || !taskName || !currentFlow || !desiredFlow) {
      return NextResponse.json(
        { error: "필수 항목이 누락되었습니다." },
        { status: 400 },
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "올바른 이메일 주소를 입력해주세요." }, { status: 400 });
    }

    // 내용을 하나의 텍스트로 포맷팅
    const toolsStr   = Array.isArray(tools) && tools.length > 0 ? tools.join(", ") : "-";
    const cycleStr   = cycle       || "-";
    const hoursStr   = weeklyHours || "-";
    const extraStr   = extra?.trim() || "-";

    const content = [
      `[업무명] ${taskName}`,
      `[사용 도구] ${toolsStr}`,
      `[반복 주기] ${cycleStr}`,
      `[주간 소요 시간] ${hoursStr}`,
      ``,
      `[현재 처리 방식]`,
      currentFlow,
      ``,
      `[자동화 목표]`,
      desiredFlow,
      ``,
      `[추가 요청사항]`,
      extraStr,
    ].join("\n");

    const title = `[자동화] ${taskName.length > 30 ? taskName.slice(0, 30) + "…" : taskName}`;

    const pageId = await createHelpDeskTicket({
      title,
      company:        "",
      department,
      requester,
      requesterEmail: email,
      inquiryType:    "자동화 과제",
      urgency:        urgency || "여유 있습니다",
      content,
    });

    await kvDel("helpdesk:tickets");

    return NextResponse.json({ ok: true, pageId }, { status: 201 });
  } catch (e) {
    console.error("[POST /api/automation]", e);
    const msg = e instanceof Error ? e.message : "서버 오류";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
