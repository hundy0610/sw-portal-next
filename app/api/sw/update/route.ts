import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { kvDel } from "@/lib/kv-store";
import { memDel } from "@/lib/mem-cache";
import { getSessionFromCookieHeader, resolveCurrentName, companyScope } from "@/lib/session";
import { errorMessage } from "@/lib/api-error";
import { getRecordCompany, buildProperties, type FieldMap } from "@/lib/sw-notion";

export const dynamic = "force-dynamic";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, fields } = body as { id: string; fields: FieldMap };

    if (!id || typeof id !== "string") {
      return NextResponse.json({ ok: false, error: "id 필수" }, { status: 400 });
    }
    if (!fields || typeof fields !== "object") {
      return NextResponse.json({ ok: false, error: "fields 필수" }, { status: 400 });
    }

    const session = getSessionFromCookieHeader(req.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const scope = companyScope(session);
    if (scope && (await getRecordCompany(id)) !== scope) {
      return NextResponse.json({ ok: false, error: "본인 법인 데이터만 수정할 수 있습니다." }, { status: 403 });
    }
    const modifiedBy = `${await resolveCurrentName(session)} (${session.userId})`;
    const fieldsWithModifier: FieldMap = {
      ...fields,
      lastModifiedBy: modifiedBy,
      lastModifiedAt: new Date().toISOString(),
    };

    const properties = buildProperties(fieldsWithModifier);
    if (Object.keys(properties).length === 0) {
      return NextResponse.json({ ok: false, error: "업데이트할 필드 없음" }, { status: 400 });
    }

    await notion.pages.update({
      page_id: id,
      properties: properties as Parameters<typeof notion.pages.update>[0]["properties"],
    });

    memDel("sw:all");
    await kvDel("sw:all");

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[API /sw/update]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
