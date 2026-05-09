import { NextRequest, NextResponse } from "next/server";
import { createExchangeReturn, type CreateFields } from "@/lib/exchange-return";
import { memDel } from "@/lib/mem-cache";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!process.env.NOTION_DB_EXCHANGE_RETURN) {
    return NextResponse.json({ ok: false, error: "NOTION_DB_EXCHANGE_RETURN 없음" }, { status: 503 });
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
