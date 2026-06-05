import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { kvGet } from "@/lib/kv-store";
import {
  createMailTransporter,
  buildAssetReadyHeadquartersEmail,
  buildAssetReadyCourierEmail,
  buildReturnRequestHeadquartersEmail,
  buildReturnRequestCourierEmail,
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
  stage: string;
  requesterEmail: string;
  requester: string;
  company: string;
  department: string;
  assetNo: string;
  model: string;
  address: string;
  returnDue?: string;
  returnMethod?: "행낭" | "직접방문";
};

function buildMailContent(payload: MailPayload) {
  const { stage, requester, company, department, assetNo, model, address, returnDue = "", returnMethod } = payload;
  const isReturn = stage === "반납요청";
  const isDirectVisit = isReturn && returnMethod === "직접방문";
  const isHeadquarters = address === "본사" || isDirectVisit;

  let html: string;
  let subject: string;
  let needsAttachment: boolean;

  if (isReturn) {
    if (isDirectVisit || address === "본사") {
      html = buildReturnRequestHeadquartersEmail({ requester, company, department, assetNo, model, returnDue });
      needsAttachment = false;
    } else {
      html = buildReturnRequestCourierEmail({ requester, company, department, assetNo, model, returnDue, deliveryLocation: address });
      needsAttachment = true;
    }
    subject = `[IdsTrust] ${company} ${department} ${requester} 님의 기기(${assetNo})의 반납을 요청드립니다.`;
  } else {
    if (address === "본사") {
      html = buildAssetReadyHeadquartersEmail({ requester, company, department, assetNo, model });
      subject = `[IdsTrust] ${company} ${department} ${requester} 님의 기기가 준비 되었습니다.`;
    } else {
      html = buildAssetReadyCourierEmail({ requester, company, department, assetNo, model, deliveryLocation: address });
      subject = `[IdsTrust] ${company} ${department} ${requester} 님의 기기가 금일 발송 되었습니다.`;
    }
    needsAttachment = false;
  }

  return { html, subject, isHeadquarters, needsAttachment };
}

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const preview = url.searchParams.get("preview") === "1";

    const body = await req.json() as MailPayload;

    if (!body.requesterEmail) {
      return NextResponse.json({ ok: false, error: "기안자 이메일이 없습니다." }, { status: 400 });
    }

    const { html, subject, needsAttachment } = buildMailContent(body);

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

    const ccEmails = (await kvGet<string[]>("helpdesk:notify-emails")) ?? [];

    await transporter.sendMail({
      from: `"IDS 자산관리파트" <${process.env.GMAIL_USER}>`,
      to: body.requesterEmail,
      ...(ccEmails.length > 0 && { cc: ccEmails.join(", ") }),
      subject,
      html,
      attachments: needsAttachment ? getCourierAttachments() : [],
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[API /exchange-return/notify-ready]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
