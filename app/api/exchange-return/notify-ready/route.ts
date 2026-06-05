import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import {
  createMailTransporter,
  buildAssetReadyHeadquartersEmail,
  buildAssetReadyCourierEmail,
} from "@/lib/mail";

export const dynamic = "force-dynamic";

const COURIER_ATTACHMENTS = ["행낭포장안내.pdf", "행낭배송부착양식.pptx"];

function getCourierAttachments() {
  const dir = path.join(process.cwd(), "public", "mail-attachments");
  return COURIER_ATTACHMENTS
    .map(filename => ({ filename, path: path.join(dir, filename) }))
    .filter(a => fs.existsSync(a.path));
}

type MailPayload = {
  requesterEmail: string;
  requester: string;
  company: string;
  department: string;
  assetNo: string;
  model: string;
  address: string;
};

function buildMailContent(payload: MailPayload) {
  const { requester, company, department, assetNo, model, address } = payload;
  const isHeadquarters = address === "본사";
  const html = isHeadquarters
    ? buildAssetReadyHeadquartersEmail({ requester, company, department, assetNo, model })
    : buildAssetReadyCourierEmail({ requester, company, department, assetNo, model, deliveryLocation: address });
  const subject = isHeadquarters
    ? `[IDS 자산관리] 기기 수령 안내 - ${assetNo || model}`
    : `[IDS 자산관리] 기기 발송 안내 - ${assetNo || model}`;
  return { html, subject, isHeadquarters };
}

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const preview = url.searchParams.get("preview") === "1";

    const body = await req.json() as MailPayload;
    const { requesterEmail } = body;

    if (!requesterEmail) {
      return NextResponse.json({ ok: false, error: "기안자 이메일이 없습니다." }, { status: 400 });
    }

    const { html, subject, isHeadquarters } = buildMailContent(body);

    if (preview) {
      return NextResponse.json({ ok: true, html, subject });
    }

    const transporter = createMailTransporter();
    if (!transporter) {
      return NextResponse.json(
        { ok: false, error: "메일 설정이 없습니다. GMAIL_USER / GMAIL_APP_PASSWORD 환경변수를 확인하세요." },
        { status: 500 }
      );
    }

    await transporter.sendMail({
      from: `"IDS 자산관리파트" <${process.env.GMAIL_USER}>`,
      to: requesterEmail,
      subject,
      html,
      attachments: isHeadquarters ? [] : getCourierAttachments(),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[API /exchange-return/notify-ready]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
