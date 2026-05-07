import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";

export const dynamic = "force-dynamic";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

export async function POST(req: NextRequest) {
  const dbId = process.env.NOTION_DB_HW_REPAIR;
  if (!dbId) return NextResponse.json({ ok: false, error: "NOTION_DB_HW_REPAIR 없음" }, { status: 503 });

  try {
    const body = await req.json() as {
      assetId: string;
      stage?: string;
      company?: string;
      department?: string;
      user?: string;
      vendor?: string;
      receivedAt?: string;
      faultType?: string;
      assigneeId?: string;
      note?: string;
    };

    if (!body.assetId?.trim()) {
      return NextResponse.json({ ok: false, error: "자산번호 필수" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties: Record<string, any> = {
      "자산번호": { title: [{ text: { content: body.assetId.trim() } }] },
    };

    if (body.stage)      properties["현재단계"]  = { select: { name: body.stage } };
    if (body.company)    properties["법인"]       = { select: { name: body.company } };
    if (body.department) properties["부서"]       = { rich_text: [{ text: { content: body.department } }] };
    if (body.user)       properties["사용자"]     = { rich_text: [{ text: { content: body.user } }] };
    if (body.vendor)     properties["수리업체"]   = { select: { name: body.vendor } };
    if (body.receivedAt) properties["접수일"]     = { date: { start: body.receivedAt } };
    if (body.faultType)  properties["과실여부"]   = { select: { name: body.faultType } };
    if (body.assigneeId) properties["담당자"]     = { people: [{ object: "user", id: body.assigneeId }] };
    if (body.note)       properties["수리내용"]   = { rich_text: [{ text: { content: body.note } }] };

    const page = await notion.pages.create({
      parent: { database_id: dbId },
      properties,
    });

    return NextResponse.json({ ok: true, id: page.id });
  } catch (e) {
    console.error("[API /hw-repair/create]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
