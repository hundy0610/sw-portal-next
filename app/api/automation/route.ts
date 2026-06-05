import { NextRequest, NextResponse } from "next/server";
import { createAutomationTask } from "@/lib/notion";

export const dynamic = "force-dynamic";

// POST /api/automation
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { requester, email, department, taskName, tools, cycle, weeklyHours, currentFlow, desiredFlow } = body;

    if (!requester || !email || !department || !taskName || !currentFlow || !desiredFlow) {
      return NextResponse.json({ error: "필수 항목이 누락되었습니다." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "올바른 이메일 주소를 입력해주세요." }, { status: 400 });
    }

    const pageId = await createAutomationTask({
      taskName,
      requester,
      email,
      department,
      tools:       Array.isArray(tools) ? tools.join(", ") : (tools || ""),
      cycle:       cycle       || "",
      weeklyHours: weeklyHours || "",
      currentFlow,
      desiredFlow,
    });

    return NextResponse.json({ ok: true, pageId }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "서버 오류";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
