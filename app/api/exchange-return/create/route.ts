import { NextRequest, NextResponse } from "next/server";
import { createExchangeReturn, type CreateFields } from "@/lib/exchange-return";
import { memDel } from "@/lib/mem-cache";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  for (const v of ["NOTION_TOKEN", "NOTION_DB_EXCHANGE_RETURN"]) {
    if (!process.env[v]) {
      return NextResponse.json({ ok: false, missingEnv: v, error: `환경변수 ${v} 가 설정되지 않았습니다.` }, { status: 503 });
    }
  }

  try {
    const body = await req.json() as CreateFields;
    if (!body.assetId?.trim()) {
      return NextResponse.json({ ok: false, error: "자산번호 필수" }, { status: 400 });
    }
    if (!body.type) {
      return NextResponse.json({ ok: false, error: "유형 필수" }, { status: 400 });
    }

    const record = await createExchangeReturn(body);
    memDel("exchange-return:all");
    return NextResponse.json({ ok: true, record });
  } catch (e) {
    console.error("[API /exchange-return/create]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
