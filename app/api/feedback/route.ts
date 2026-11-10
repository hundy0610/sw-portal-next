import { NextRequest, NextResponse } from "next/server";
import { insertEntity } from "@/lib/repo/mirror";

export const dynamic = "force-dynamic";

// POST /api/feedback  { ticketId, rating, comment }
//
// 만족도 평가 제출(11-10 되살림). v2 전환 뒤 포털은 문의 행을 읽거나 고칠 수 없다(암호문) — 평가를 잠긴 새 행
// (helpdesk-feedback)으로 남기기만 하고, 문의의 별점·의견 반영은 맥북 처리기가 한다(데스크탑 core/inbox.ts applyFeedback,
// [이 매뉴얼로 해결]과 같은 방식). 문의가 있는지는 여기서 확인할 수 없어 처리기가 없는 문의의 평가를 버린다.
// 예전의 '이미 평가함'(409) 확인은 없다 — 다시 내면 처리기가 나중 평가로 덮는다(사용자 결정).
const MAX_COMMENT = 500; // 평가 화면의 글자 수 제한과 같다
const TICKET_ID = /^[A-Za-z0-9-]{1,64}$/;

export async function POST(req: NextRequest) {
  try {
    const { ticketId, rating, comment } = (await req.json()) as { ticketId?: unknown; rating?: unknown; comment?: unknown };
    if (typeof ticketId !== "string" || !TICKET_ID.test(ticketId)) {
      return NextResponse.json({ error: "확인할 수 없는 문의입니다" }, { status: 400 });
    }
    if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "평점 1~5만 허용" }, { status: 400 });
    }
    const text = typeof comment === "string" ? comment.trim().slice(0, MAX_COMMENT) : "";

    const ok = await insertEntity("helpdesk-feedback", crypto.randomUUID(), {
      ticketId,
      rating,
      comment: text,
      submittedAt: new Date().toISOString(),
    });
    if (!ok) return NextResponse.json({ error: "저장에 실패했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/feedback]", e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
