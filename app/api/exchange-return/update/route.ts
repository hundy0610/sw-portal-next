import { NextRequest, NextResponse } from "next/server";
import { updateExchangeReturn, type UpdateFields } from "@/lib/exchange-return";
import { memDel } from "@/lib/mem-cache";
import { getSessionFromCookieHeader, resolveCurrentName } from "@/lib/session";
import { errorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  for (const v of ["NOTION_TOKEN", "NOTION_DB_EXCHANGE_RETURN"]) {
    if (!process.env[v]) {
      return NextResponse.json({ ok: false, missingEnv: v, error: `환경변수 ${v} 가 설정되지 않았습니다.` }, { status: 503 });
    }
  }
  try {
    const { id, fields } = await req.json() as { id: string; fields: UpdateFields };
    if (!id) return NextResponse.json({ ok: false, error: "id 필수" }, { status: 400 });
    if (!fields || Object.keys(fields).length === 0) {
      return NextResponse.json({ ok: false, error: "업데이트할 필드 없음" }, { status: 400 });
    }

    const session = getSessionFromCookieHeader(req.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const fieldsWithModifier: UpdateFields = {
      ...fields,
      lastModifiedBy: `${await resolveCurrentName(session)} (${session.userId})`,
    };

    await updateExchangeReturn(id, fieldsWithModifier);
    memDel("exchange-return:all");
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[API /exchange-return/update]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
