import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { kvGet, kvSet } from "@/lib/kv-store";
import { createMailTransporter, buildRepairNewInquiryEmail } from "@/lib/mail";

// Notion Automation 설정:
//   DB: 수리 접수 현황 → Automation → "새 페이지가 생성될 때"
//   → Webhook POST → /api/webhooks/notion/repair-new

export const dynamic = "force-dynamic";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const NOTIFIED_KEY = (id: string) => `repair_new_notified:${id}`;
const SUPER_EMAILS_KEY = "sw:super-emails";

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.NOTION_WEBHOOK_SECRET;
    if (secret) {
      const sig = req.headers.get("x-notion-signature") || req.headers.get("x-hub-signature-256");
      if (!sig?.includes(secret)) {
        return NextResponse.json({ error: "인증 실패" }, { status: 401 });
      }
    }

    const body = await req.json();
    const pageId: string | undefined =
      body?.entity?.id || body?.data?.entity?.id || body?.page_id || body?.id;

    if (!pageId) {
      console.warn("[webhook/repair-new] pageId 없음:", JSON.stringify(body).slice(0, 200));
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page = await notion.pages.retrieve({ page_id: pageId }) as any;
    const props = page.properties;

    const getText = (key: string): string =>
      props?.[key]?.rich_text?.[0]?.plain_text || props?.[key]?.title?.[0]?.plain_text || "";
    const getSelect = (key: string): string =>
      props?.[key]?.select?.name || "";
    const getDate = (key: string): string =>
      props?.[key]?.date?.start || "";

    const assetId    = getText("자산번호");
    const company    = getSelect("법인");
    const department = getText("부서");
    const user       = getText("사용자");
    const vendor     = getSelect("수리업체");
    const receivedAt = getDate("접수일");
    const faultType  = getSelect("과실여부");
    const note       = getText("수리내용");

    const transporter = createMailTransporter();
    if (!transporter) {
      return NextResponse.json({ error: "메일 설정 없음" }, { status: 500 });
    }

    const adminUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://swportal.vercel.app"}/admin`;
    const html = buildRepairNewInquiryEmail({
      assetId: assetId || "미상",
      company, department, user, vendor, receivedAt, faultType, note, adminUrl,
    });

    await transporter.sendMail({
      from: `"IDS 자산관리파트" <${process.env.GMAIL_USER}>`,
      to: superEmails.join(", "),
      subject: `[수리 접수] 신규 수리 접수 - ${assetId || "미상"}`,
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
