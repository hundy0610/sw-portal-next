import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { readEntityOne } from "@/lib/repo/mirror";
import type { MeetingRentalTicket } from "@/types";

type RouteContext = {
  params: { ticketId: string };
};

// 4.0verMACBOOK: 대여신청 티켓 조회 → 맥북 Postgres 미러(entity "meeting-rental").
export async function GET(_: NextRequest, context: RouteContext) {
  try {
    const { ticketId } = context.params;
    const t = await readEntityOne<MeetingRentalTicket>("meeting-rental", ticketId);
    if (!t) return NextResponse.json({ message: "티켓을 찾을 수 없습니다." }, { status: 404 });

    const response = {
      법인명: t.company || "-",
      부서: t.department || "-",
      신청자: t.requester || "-",
      이메일: t.email || "-",
      시작일시: t.startAt || "-",
      종료일시: t.endAt || "-",
      상태: t.status || "-",
      담당자: t.assignee || "-",
      createdAt: t.createdAt || "-",
    };

    return NextResponse.json(response);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "서버 오류";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
