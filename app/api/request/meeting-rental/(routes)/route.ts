import { NextResponse } from "next/server";
import { createMeetingRentalTicketRecord } from "@/lib/meeting-rental";

// <input type="datetime-local"> 값("YYYY-MM-DDTHH:mm")에는 타임존이 없어
// 그대로 보내면 UTC로 해석된다. KST(+09:00)를 명시해 시각 오류를 방지한다.
function toKstIso(local: string): string {
  return local ? `${local}:00+09:00` : "";
}

// 4.0verMACBOOK: 회의실 무선 장비 대여신청 → 맥북 Postgres 미러(entity "meeting-rental")에 직접 기록.
// v2 전환 뒤: 새 행으로 잠가 추가만 한다. 관리자 알림 메일은 맥북 잡이 notifyBy 표시를 보고 보낸다
// (포털은 수신자 KV sw:super-emails 를 읽을 수 없다 — 암호문).
export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const 법인명 = (formData.get("법인명") as string) || "";
    const 부서 = (formData.get("부서") as string) || "";
    const 신청자 = (formData.get("신청자") as string) || "";
    const 이메일 = (formData.get("이메일") as string) || "";
    const 시작일시 = (formData.get("시작일시") as string) || "";
    const 종료일시 = (formData.get("종료일시") as string) || "";

    const startAt = toKstIso(시작일시);
    const endAt = toKstIso(종료일시);

    const ticketId = await createMeetingRentalTicketRecord({
      requester: 신청자,
      company: 법인명,
      department: 부서,
      email: 이메일,
      startAt,
      endAt,
    });

    return NextResponse.json({ ticketId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "서버 오류";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
