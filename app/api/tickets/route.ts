import { NextResponse } from "next/server";
import { fetchTickets, createTicket } from "@/lib/notion";
import { memCached, memDel } from "@/lib/mem-cache";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data, cached } = await memCached("tickets:all", fetchTickets, 120);
    return NextResponse.json(
      { data, lastSynced: new Date().toISOString(), cached },
      { headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=30" } }
    );
  } catch (error) {
    console.error("[API GET /tickets]", error);
    return NextResponse.json(
      { data: [], lastSynced: new Date().toISOString(), error: error instanceof Error ? error.message : "알 수 없는 오류" },
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

    // 티켓 생성 후 캐시 무효화
    memDel("tickets:all");

    return NextResponse.json({ success: true, pageId }, { status: 201 });
  } catch (error) {
    console.error("[API POST /tickets]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "티켓 생성 실패" },
      { status: 500 }
    );
  }
}
