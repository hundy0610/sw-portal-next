import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/kv-store";
import { createMailTransporter, buildRepairNewInquiryEmail } from "@/lib/mail";

// Notion Automation 설정:
//   DB: 수리 접수 현황 → Automation → "새 페이지가 생성될 때"
//   → Webhook POST → /api/webhooks/notion/repair-new

export const dynamic = "force-dynamic";

const NOTIFIED_KEY = (id: string) => `repair_new_notified:${id}`;
const SUPER_EMAILS_KEY = "sw:super-emails";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Notion Automation 페이로드: { source: {...}, data: { id, properties, ... } }
    const pageId: string | undefined = body?.data?.id;

    if (!pageId) {
      console.warn("[webhook/repair-new] pageId 없음:", JSON.stringify(body).slice(0, 300));
      return NextResponse.json({ ok: true, skipped: "no pageId" });
    }

    // 중복 방지 (10분 TTL — Notion 재시도 대응)
    const already = await kvGet<boolean>(NOTIFIED_KEY(pageId));
    if (already) return NextResponse.json({ ok: true, skipped: "already notified" });
    await kvSet(NOTIFIED_KEY(pageId), true, 600);

    const superEmails = (await kvGet<string[]>(SUPER_EMAILS_KEY)) ?? [];
    if (superEmails.length === 0) {
      return NextResponse.json({ ok: true, skipped: "no super admin emails" });
    }

    // 프로퍼티는 페이로드에 이미 포함 — Notion API 재호출 불필요
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const props = body?.data?.properties ?? {} as Record<string, any>;

    const getText = (key: string): string =>
      props?.[key]?.rich_text?.[0]?.plain_text || props?.[key]?.title?.[0]?.plain_text || "";
    const getSelect = (key: string): string =>
      props?.[key]?.select?.name || "";
    const getMultiSelect = (key: string): string =>
      (props?.[key]?.multi_select ?? []).map((s: { name: string }) => s.name).join(", ");
    const assetId      = getText("자산번호");
    const company      = getSelect("법인");
    const department   = getText("부서");
    const requester    = getText("문의자");
    const workLocation = getText("실제 근무 위치");
    const faultDesc    = getText("고장증상");
    const faultTypes   = getMultiSelect("고장 내역");

    const transporter = createMailTransporter();
    if (!transporter) {
      return NextResponse.json({ error: "메일 설정 없음" }, { status: 500 });
    }

    const adminUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://swportal.vercel.app"}/admin`;
    const html = buildRepairNewInquiryEmail({
      assetId: assetId || "미상",
      company, department, requester, workLocation, faultDesc, faultTypes, adminUrl,
    });

    await transporter.sendMail({
      from: `"IDS 자산관리파트" <${process.env.GMAIL_USER}>`,
      to: superEmails.join(", "),
      subject: `[Repair] 신규 수리문의가 접수되었습니다.`,
      html,
    });

    return NextResponse.json({ ok: true, sent: superEmails.length });
  } catch (e) {
    console.error("[webhook/repair-new]", e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "repair-new-webhook" });
}
