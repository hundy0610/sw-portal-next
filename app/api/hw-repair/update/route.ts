import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";

export const dynamic = "force-dynamic";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

export async function POST(req: NextRequest) {
  try {
    const { id, fields } = await req.json() as {
      id: string;
      fields: {
        stage?: string;
        vendor?: string;
        company?: string;
        department?: string;
        user?: string;
        receivedAt?: string;
        completedAt?: string;
        faultType?: string;
        assigneeId?: string;
        note?: string;
        isClosed?: boolean;
      };
    };

    if (!id) return NextResponse.json({ ok: false, error: "id 필수" }, { status: 400 });

    const properties: Record<string, unknown> = {};

    if (fields.stage !== undefined) {
      properties["현재단계"] = { select: fields.stage ? { name: fields.stage } : null };
    }
    if (fields.vendor !== undefined) {
      properties["수리업체"] = { select: fields.vendor ? { name: fields.vendor } : null };
    }
    if (fields.receivedAt !== undefined) {
      properties["접수일"] = { date: fields.receivedAt ? { start: fields.receivedAt } : null };
    }
    if (fields.completedAt !== undefined) {
      properties["실제완료일"] = { date: fields.completedAt ? { start: fields.completedAt } : null };
    }
    if (fields.faultType !== undefined) {
      properties["과실여부"] = { select: fields.faultType ? { name: fields.faultType } : null };
    }
    if (fields.assigneeId !== undefined) {
      properties["담당자"] = fields.assigneeId
        ? { people: [{ object: "user", id: fields.assigneeId }] }
        : { people: [] };
    }
    if (fields.company !== undefined) {
      properties["법인"] = { select: fields.company ? { name: fields.company } : null };
    }
    if (fields.department !== undefined) {
      properties["부서"] = { rich_text: [{ text: { content: fields.department } }] };
    }
    if (fields.user !== undefined) {
      properties["사용자"] = { rich_text: [{ text: { content: fields.user } }] };
    }
    if (fields.note !== undefined) {
      properties["수리내용"] = { rich_text: [{ text: { content: fields.note } }] };
    }
    if (fields.isClosed !== undefined) {
      properties["케이스종료"] = { checkbox: fields.isClosed };
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
    console.error("[API /hw-repair/update]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
