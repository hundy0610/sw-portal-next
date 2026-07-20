import { NextRequest, NextResponse } from "next/server";
import { getManual } from "@/lib/helpdesk-manuals";

export const dynamic = "force-dynamic";

// GET /api/helpdesk/manuals/view?id=xxx
// 문의자가 메일의 "매뉴얼 확인하기" 링크로 접속하는 공개 페이지 (로그인 불필요)
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return new NextResponse("잘못된 접근입니다.", { status: 400 });
  }

  try {
    const manual = await getManual(id);
    if (!manual) {
      console.error("[GET /api/helpdesk/manuals/view] MANUAL_VIEW_NOT_FOUND", id);
      return new NextResponse("매뉴얼을 찾을 수 없습니다. 담당자에게 문의해주세요.", { status: 404 });
    }
    if (manual.contentType === "url") {
      return NextResponse.redirect(manual.body);
    }
    return new NextResponse(manual.body, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (e) {
    console.error("[GET /api/helpdesk/manuals/view] MANUAL_VIEW_FAILED", e);
    return new NextResponse("매뉴얼을 불러오지 못했습니다. (코드: MANUAL_VIEW_FAILED)", { status: 500 });
  }
}
