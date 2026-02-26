import { NextResponse } from "next/server";
import { fetchTickets, createTicket } from "@/lib/notion";

export const revalidate = 30; // 티켓은 더 자주 갱신

export async function GET() {
  try {
    const data = await fetchTickets();
    return NextResponse.json({
      data,
      lastSynced: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[API GET /tickets]", error);
    return NextResponse.json(
      {
        data: [],
        lastSynced: new Date().toISOString(),
        error: error instanceof Error ? error.message : "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, category, priority, description, requester } = body;

    if (!title || !description || !requester) {
      return NextResponse.json(
        { error: "필수 항목이 누락되었습니다 (title, description, requester)" },
        { status: 400 }
      );
    }

    const pageId = await createTicket({
      title,
      category: category || "기타",
      priority: priority || "중간",
      description,
      requester,
    });

    return NextResponse.json({ success: true, pageId }, { status: 201 });
  } catch (error) {
    console.error("[API POST /tickets]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "티켓 생성 실패" },
      { status: 500 }
    );
  }
}
