import { NextResponse } from "next/server";
import { createHelpDeskTicket } from "@/lib/notion";
import { kvGet } from "@/lib/kv-store";

const NOTIFY_KEY = "helpdesk:notify-emails";

// 4.0verMACBOOK: 공개 문의 접수(QR/키오스크 폼) → 맥북 Postgres 미러(entity "helpdesk")에 직접 기록.
// 예전엔 Notion 페이지 생성 후 Automation 웹훅이 알림 메일을 보냈지만, 미러가 메인이라
// Notion 반영이 5분 지연되므로 접수 시점에 앱에서 직접 관리자 알림 메일을 발송한다.
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
    });

    // 관리자 신규 접수 알림 메일 (fire-and-forget)
    void (async () => {
      try {
        const notifyEmails = (await kvGet<string[]>(NOTIFY_KEY)) ?? [];
        if (notifyEmails.length === 0) return;
        const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
        await fetch(`${origin}/api/helpdesk/notify-new-inquiry`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requester: 문의자, company: 법인, department: 부서,
            inquiryType: 문의유형, urgency: 긴급도, content: 문의내용, assetNo: 자산번호,
          }),
        });
      } catch (e) {
        console.error("[request/inquiry] notify failed:", e);
      }
    })();

    return NextResponse.json({ ticketId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "서버 오류";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
