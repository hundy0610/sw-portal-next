import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/kv-store";

export interface FeedbackEntry {
  ticketId: string;
  rating: number;      // 1~5
  comment: string;
  submittedAt: string;
}

const KEY = (id: string) => `feedback:${id}`;
const FEEDBACK_TTL = 60 * 60 * 24 * 365; // 1년

// GET /api/feedback?id=xxx
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });

  const entry = await kvGet<FeedbackEntry>(KEY(id));
  return NextResponse.json({ data: entry ?? null });
}

// POST /api/feedback  { ticketId, rating, comment }
export async function POST(req: NextRequest) {
  try {
    const { ticketId, rating, comment } = await req.json();
    if (!ticketId || !rating) return NextResponse.json({ error: "필수 항목 누락" }, { status: 400 });
    if (rating < 1 || rating > 5) return NextResponse.json({ error: "평점 1~5만 허용" }, { status: 400 });

    const existing = await kvGet<FeedbackEntry>(KEY(ticketId));
    if (existing) return NextResponse.json({ error: "이미 평가가 완료된 문의입니다." }, { status: 409 });

    const entry: FeedbackEntry = {
      ticketId,
      rating: Number(rating),
      comment: (comment ?? "").trim(),
      submittedAt: new Date().toISOString(),
    };
    await kvSet(KEY(ticketId), entry, FEEDBACK_TTL);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/feedback]", e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
