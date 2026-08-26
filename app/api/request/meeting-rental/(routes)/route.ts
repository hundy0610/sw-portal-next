import { NextResponse } from "next/server";
import { createMeetingRentalTicketRecord } from "@/lib/meeting-rental";
import { kvGet } from "@/lib/kv-store";
import { createMailTransporter, buildMeetingRentalNewRequestEmail } from "@/lib/mail";
import formatDateTime from "@/shared/utils/formatDateTime";

// <input type="datetime-local"> 값("YYYY-MM-DDTHH:mm")에는 타임존이 없어
// 그대로 보내면 UTC로 해석된다. KST(+09:00)를 명시해 시각 오류를 방지한다.
function toKstIso(local: string): string {
  return local ? `${local}:00+09:00` : "";
}

const SUPER_EMAILS_KEY = "sw:super-emails";

// 4.0verMACBOOK: 회의실 무선 장비 대여신청 → 맥북 Postgres 미러(entity "meeting-rental")에 직접 기록.
// 신규 알림 메일도 접수 시점에 앱에서 직접 발송한다(예전 Notion Automation 웹훅 대체).
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

    // 관리자 신규 접수 알림 메일 (fire-and-forget)
    void (async () => {
      try {
        const superEmails = (await kvGet<string[]>(SUPER_EMAILS_KEY)) ?? [];
        if (superEmails.length === 0) return;
        const transporter = createMailTransporter();
        if (!transporter) return;
        const period = startAt && endAt ? `${formatDateTime(startAt)} ~ ${formatDateTime(endAt)}` : "";
        const adminUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://swportal.vercel.app"}/admin`;
        const html = buildMeetingRentalNewRequestEmail({
          requester: 신청자, company: 법인명, department: 부서, email: 이메일, period, adminUrl,
        });
        await transporter.sendMail({
          from: `"IDS 자산관리파트" <${process.env.GMAIL_USER}>`,
          to: superEmails.join(", "),
          subject: `[Meeting] 회의실 무선 장비 대여신청이 접수되었습니다.`,
          html,
        });
      } catch (e) {
        console.error("[request/meeting-rental] notify failed:", e);
      }
    })();

    return NextResponse.json({ ticketId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "서버 오류";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
