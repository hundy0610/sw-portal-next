import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/kv-store";
import { readEntityOne, upsertEntity } from "@/lib/repo/mirror";
import type { HelpDeskTicket } from "@/lib/notion";

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

    // 1. KV(Postgres)에 저장 (빠른 읽기용 — GET 은 KV 만 조회하므로 저장 실패 시
    //    중복 제출 방지 체크(existing)도 무력화된다. 반드시 성공 여부를 확인한다.)
    const saved = await kvSet(KEY(ticketId), entry, FEEDBACK_TTL);
    if (!saved) {
      return NextResponse.json({ error: "저장에 실패했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
    }

    // 2. 헬프데스크 미러 레코드에 영구 저장(누적 보존). 5분 백업 러너가 Notion 에 반영한다.
    try {
      const base = await readEntityOne<HelpDeskTicket>("helpdesk", ticketId);
      if (base) {
        await upsertEntity("helpdesk", ticketId, {
          ...base,
          satisfaction: entry.rating,
          feedbackComment: entry.comment,
          lastEditedAt: new Date().toISOString(),
        });
      } else {
        console.warn("[feedback] 헬프데스크 미러 레코드 없음:", ticketId);
      }
    } catch (mirrorErr) {
      // 미러 저장 실패해도 KV 는 저장됐으므로 성공 처리
      console.warn("[feedback] 미러 저장 실패:", mirrorErr);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/feedback]", e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
