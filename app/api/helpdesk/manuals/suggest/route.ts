import { NextRequest, NextResponse } from "next/server";
import { listManuals } from "@/lib/helpdesk-manuals";
import { matchManualForContent } from "@/lib/helpdesk-manual-match";

export const dynamic = "force-dynamic";

// POST /api/helpdesk/manuals/suggest
// Body: { content: string }
// 문의 접수 완료 화면에서, 방금 작성한 문의 내용으로 바로 시도해볼 수 있는 매뉴얼이 있는지 확인 (로그인 불필요)
export async function POST(req: NextRequest) {
  try {
    const { content } = await req.json() as { content?: string };
    if (!content || !content.trim()) {
      return NextResponse.json({ ok: false, error: "content 필수", code: "MANUAL_SUGGEST_INVALID_INPUT" }, { status: 400 });
    }

    const manuals = await listManuals();
    const matched = matchManualForContent(content, manuals);
    if (!matched) {
      return NextResponse.json({ ok: true, match: null });
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL || "https://assetify-desk-main.vercel.app";
    const url = matched.manual.contentType === "url"
      ? matched.manual.body
      : `${origin}/api/helpdesk/manuals/view?id=${encodeURIComponent(matched.manual.id)}`;

    return NextResponse.json({
      ok: true,
      match: { id: matched.manual.id, title: matched.manual.title, url },
    });
  } catch (e) {
    console.error("[POST /api/helpdesk/manuals/suggest] MANUAL_SUGGEST_FAILED", e);
    return NextResponse.json({ ok: false, error: "서버 오류", code: "MANUAL_SUGGEST_FAILED" }, { status: 500 });
  }
}
