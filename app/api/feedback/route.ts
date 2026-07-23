import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet, kvDel } from "@/lib/kv-store";
import { Client } from "@notionhq/client";

export interface FeedbackEntry {
  ticketId: string;
  rating: number;      // 1~5
  comment: string;
  submittedAt: string;
}

const KEY = (id: string) => `feedback:${id}`;
const FEEDBACK_TTL = 60 * 60 * 24 * 365; // 1년

const notion = new Client({ auth: process.env.NOTION_TOKEN });

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

    // 1. Redis에 저장 (빠른 읽기용 — GET은 Redis만 조회하므로 저장 실패 시
    //    중복 제출 방지 체크(existing)도 무력화된다. 반드시 성공 여부를 확인한다.
    const saved = await kvSet(KEY(ticketId), entry, FEEDBACK_TTL);
    if (!saved) {
      return NextResponse.json({ error: "저장에 실패했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
    }

    // 2. Notion 티켓 페이지에 영구 저장 (누적 보존)
    try {
      await notion.pages.update({
        page_id: ticketId,
        properties: {
          "만족도":     { number: entry.rating },
          "피드백코멘트": { rich_text: [{ text: { content: entry.comment || "" } }] },
        },
      });
      // 헬프데스크 캐시 무효화 → 다음 폴링 시 최신 반영
      await kvDel("helpdesk:tickets");
    } catch (notionErr) {
      // Notion 저장 실패 시에도 Redis는 저장됐으므로 성공 처리
      // (Notion DB에 해당 컬럼이 없을 경우 발생 — 컬럼 추가 필요)
      console.warn("[feedback] Notion 저장 실패 (컬럼 확인 필요):", notionErr);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/feedback]", e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
