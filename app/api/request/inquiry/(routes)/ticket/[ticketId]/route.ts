import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { readEntityOne } from "@/lib/repo/mirror";
import type { HelpDeskTicket } from "@/lib/notion";

type RouteContext = {
  params: { ticketId: string };
};

// 미러(Postgres)가 항상 최신이어야 하므로 라우트/데이터 캐시를 끈다(새로고침 시 최신 상태 조회).
export const dynamic = "force-dynamic";

// 4.0verMACBOOK: 문의 접수 티켓 조회 → 맥북 Postgres 미러(entity "helpdesk").
export async function GET(_: NextRequest, context: RouteContext) {
  try {
    const { ticketId } = context.params;
    const t = await readEntityOne<HelpDeskTicket>("helpdesk", ticketId);
    if (!t) return NextResponse.json({ message: "티켓을 찾을 수 없습니다." }, { status: 404 });

    const response = {
      법인: t.company || "-",
      부서: t.department || "-",
      문의자: t.requester || "-",
      자산번호: t.assetNo || "-",
      문의유형: t.inquiryType || "-",
      문의내용: t.content || t.title || "-",
      긴급도: t.urgency || "-",
      상태: t.status || "-",
      담당자: t.assignee || "-",
      createdAt: t.submittedAt || "-",
    };

    return NextResponse.json(response);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "서버 오류";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
