import { NextResponse } from "next/server";
import { createHelpDeskTicket } from "@/lib/mirror-entities";
import { resolveToken } from "@/lib/resolve-token";

// 4.0verMACBOOK: 공개 문의 접수(QR/키오스크 폼) → 맥북 Postgres 미러(entity "helpdesk")에 직접 기록.
// 담당자 알림 메일은 맥북 잡이 notifyBy 표시를 보고 보낸다(수신자는 kv helpdesk:notify-emails).
export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const 법인 = (formData.get("법인") as string) || "";
    const 부서 = (formData.get("부서") as string) || "";
    const 문의자 = (formData.get("문의자") as string) || "";
    const 자산번호 = (formData.get("자산번호") as string) || "";
    const 문의유형 = (formData.get("문의유형") as string) || "";
    const 문의내용 = (formData.get("문의내용") as string) || "";
    const 긴급도 = (formData.get("긴급도") as string) || "";
    const 이메일 = (formData.get("이메일") as string) || "";
    const 위치 = (formData.get("위치") as string) || "";

    const title = 문의내용.length > 40 ? 문의내용.slice(0, 40) + "…" : 문의내용;

    const ticketId = await createHelpDeskTicket({
      title,
      company: 법인,
      department: 부서,
      requester: 문의자,
      requesterEmail: 이메일,
      inquiryType: 문의유형 || "SW",
      urgency: 긴급도 || "기다릴 수 있어요",
      content: 문의내용,
      assetNo: 자산번호,
      location: 위치,
      notifyBy: "server",
    });

    // 접수 완료 화면의 [이 매뉴얼로 해결]이 이 문의에서 온 것임을 보이는 서명(lib/resolve-token.ts).
    // 서명을 못 만들어도 접수는 이미 저장됐다 — 실패로 돌려주면 직원이 같은 문의를 또 낸다. 해결 버튼만 안 된다.
    let token = "";
    try {
      token = resolveToken(ticketId);
    } catch (e) {
      console.error("[request/inquiry] resolveToken 실패(접수는 저장됨):", e);
    }
    return NextResponse.json({ ticketId, resolveToken: token });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "서버 오류";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
