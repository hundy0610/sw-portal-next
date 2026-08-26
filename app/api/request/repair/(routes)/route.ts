import { NextResponse } from "next/server";
import { createRepairTicketRecord } from "@/lib/notion";
import { kvGet } from "@/lib/kv-store";
import { createMailTransporter, buildRepairNewInquiryEmail } from "@/lib/mail";

// 4.0verMACBOOK: 공개 수리 접수 폼 → 맥북 Postgres 미러(entity "repair")에 직접 기록.
// 신규 알림 메일도 접수 시점에 앱에서 직접 발송한다(예전 Notion Automation 웹훅 대체).
export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const 법인 = (formData.get("법인") as string) || "";
    const 부서 = (formData.get("부서") as string) || "";
    const 문의자 = (formData.get("문의자") as string) || "";
    const 건물명 = (formData.get("건물명") as string) || "";
    const 층수 = (formData.get("층수") as string) || "";
    const 모니터번호 = (formData.get("모니터번호") as string) || "";
    const 고장내역 = (formData.get("고장내역") as string) || "";
    const 세부내역 = (formData.get("세부내역") as string) || "";

    const ticketId = await createRepairTicketRecord({
      title: 모니터번호,
      faultTypes: 고장내역 ? [고장내역] : [],
      company: 법인,
      department: 부서,
      building: 건물명,
      floor: 층수,
      assetId: 모니터번호,
      detail: 세부내역,
      requester: 문의자,
    });

    // 관리자 신규 접수 알림 메일 (fire-and-forget)
    void (async () => {
      try {
        const notifyEmails = (await kvGet<string[]>("helpdesk:notify-emails")) ?? [];
        if (notifyEmails.length === 0) return;
        const transporter = createMailTransporter();
        if (!transporter) return;
        const adminUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://swportal.vercel.app"}/admin`;
        const html = buildRepairNewInquiryEmail({
          assetId: 모니터번호 || "미상",
          company: 법인,
          department: 부서,
          requester: 문의자,
          workLocation: `${건물명} ${층수}`.trim(),
          faultDesc: 세부내역,
          faultTypes: 고장내역,
          adminUrl,
        });
        await transporter.sendMail({
          from: `"IDS 자산관리파트" <${process.env.GMAIL_USER}>`,
          to: notifyEmails.join(", "),
          subject: `[Repair] 신규 수리문의가 접수되었습니다.`,
          html,
        });
      } catch (e) {
        console.error("[request/repair] notify failed:", e);
      }
    })();

    return NextResponse.json({ ticketId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "서버 오류";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
