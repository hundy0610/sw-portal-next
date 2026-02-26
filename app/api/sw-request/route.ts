import { NextResponse } from "next/server";
import { createSwRequest } from "@/lib/notion";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { swName, requester, reason, urgency } = body;

    if (!swName || !requester || !reason) {
      return NextResponse.json(
        { error: "필수 항목이 누락되었습니다" },
        { status: 400 }
      );
    }

    const pageId = await createSwRequest({
      swName,
      requester,
      reason,
      urgency: urgency || "중간",
    });

    return NextResponse.json({ success: true, pageId }, { status: 201 });
  } catch (error) {
    console.error("[API POST /sw-request]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "신청 실패" },
      { status: 500 }
    );
  }
}
