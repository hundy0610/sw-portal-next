import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { readEntityOne } from "@/lib/repo/mirror";
import type { RepairTicket } from "@/types";

type RouteContext = {
  params: { ticketId: string };
};

// 미러(Postgres)가 항상 최신이어야 하므로 라우트/데이터 캐시를 끈다(새로고침 시 최신 상태 조회).
export const dynamic = "force-dynamic";

// 4.0verMACBOOK: 수리 접수 티켓 조회 → 맥북 Postgres 미러(entity "repair").
export async function GET(_: NextRequest, context: RouteContext) {
  try {
    const { ticketId } = context.params;
    const t = await readEntityOne<RepairTicket>("repair", ticketId);
    if (!t) return NextResponse.json({ message: "티켓을 찾을 수 없습니다." }, { status: 404 });

    const response = {
      법인: t.company || "-",
      부서: t.department || "-",
      문의자: t.requester || "-",
      건물명: t.building || "-",
      층수: t.floor || "-",
      모니터번호: t.assetId || "-",
      고장내역: (t.faultTypes && t.faultTypes[0]) || "-",
      세부내역: t.detail || "-",
      상태: t.status || "-",
      조치내용: t.actionNote || "-",
      담당자: t.assignee || "-",
      // 아래 3개는 레거시 표시 필드로 미러에서 관리하지 않음
      과실여부: "-",
      수리일정: t.repairDate || "-",
      단가: "-",
      수리진행상황: "-",
      createdAt: t.createdAt || "-",
    };

    return NextResponse.json(response);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "서버 오류";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
