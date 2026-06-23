import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/kv-store";
import { createMailTransporter, buildMeetingRentalNewRequestEmail } from "@/lib/mail";
import formatDateTime from "@/shared/utils/formatDateTime";

// Notion Automation 설정:
//   DB: 회의실 무선 장비 대여신청 → Automation → "새 페이지가 생성될 때"
//   → Webhook POST → /api/webhooks/notion/meeting-rental-new

export const dynamic = "force-dynamic";

const NOTIFIED_KEY = (id: string) => `meeting_rental_new_notified:${id}`;
const SUPER_EMAILS_KEY = "sw:super-emails";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Notion Automation 페이로드: { source: {...}, data: { id, properties, ... } }
    const pageId: string | undefined = body?.data?.id;

    if (!pageId) {
      console.warn("[webhook/meeting-rental-new] pageId 없음:", JSON.stringify(body).slice(0, 300));
      return NextResponse.json({ ok: true, skipped: "no pageId" });
    }

    // 중복 방지 (10분 TTL — Notion 재시도 대응)
    const already = await kvGet<boolean>(NOTIFIED_KEY(pageId));
    if (already) return NextResponse.json({ ok: true, skipped: "already notified" });
    await kvSet(NOTIFIED_KEY(pageId), true, 600);

    const superEmails = (await kvGet<string[]>(SUPER_EMAILS_KEY)) ?? [];
    if (superEmails.length === 0) {
      return NextResponse.json({ ok: true, skipped: "no notify emails" });
    }

    // 프로퍼티는 페이로드에 이미 포함 — Notion API 재호출 불필요
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const props = body?.data?.properties ?? {} as Record<string, any>;

    const requester  = props?.["신청자"]?.title?.[0]?.plain_text ?? "";
    const company    = props?.["법인명"]?.select?.name ?? "";
    const department = props?.["부서"]?.rich_text?.[0]?.plain_text ?? "";
    const email       = props?.["신청자 이메일"]?.email ?? "";
    const start       = props?.["신청기간"]?.date?.start ?? "";
    const end         = props?.["신청기간"]?.date?.end ?? "";
    const period      = start && end ? `${formatDateTime(start)} ~ ${formatDateTime(end)}` : "";

    const transporter = createMailTransporter();
    if (!transporter) {
      return NextResponse.json({ error: "메일 설정 없음" }, { status: 500 });
    }

    const adminUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://swportal.vercel.app"}/admin`;
    const html = buildMeetingRentalNewRequestEmail({
      requester, company, department, email, period, adminUrl,
    });

    await transporter.sendMail({
      from: `"IDS 자산관리파트" <${process.env.GMAIL_USER}>`,
      to: superEmails.join(", "),
      subject: `[Meeting] 회의실 무선 장비 대여신청이 접수되었습니다.`,
      html,
    });

    return NextResponse.json({ ok: true, sent: superEmails.length });
  } catch (e) {
    console.error("[webhook/meeting-rental-new]", e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "meeting-rental-new-webhook" });
}
