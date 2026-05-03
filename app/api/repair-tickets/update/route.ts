import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";

export const dynamic = "force-dynamic";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

export async function POST(req: NextRequest) {
  try {
    const { id, fields } = await req.json() as {
      id: string;
      fields: { status?: string; assigneeId?: string; actionNote?: string };
    };

    if (!id) return NextResponse.json({ ok: false, error: "id 필수" }, { status: 400 });

    const properties: Record<string, unknown> = {};

    if (fields.status !== undefined) {
      properties["상태"] = { select: { name: fields.status } };
    }
    if (fields.assigneeId !== undefined) {
      properties["담당자"] = fields.assigneeId
        ? { people: [{ object: "user", id: fields.assigneeId }] }
        : { people: [] };
    }
    if (fields.actionNote !== undefined) {
      properties["조치내용"] = { rich_text: [{ text: { content: fields.actionNote } }] };
    }

    if (Object.keys(properties).length === 0) {
      return NextResponse.json({ ok: false, error: "업데이트할 필드 없음" }, { status: 400 });
    }

    await notion.pages.update({
      page_id: id,
      properties: properties as Parameters<typeof notion.pages.update>[0]["properties"],
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[API /repair-tickets/update]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
