import { NextRequest, NextResponse } from "next/server";
import { updateExchangeReturn, type UpdateFields } from "@/lib/exchange-return";
import { memDel } from "@/lib/mem-cache";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { id, fields } = await req.json() as { id: string; fields: UpdateFields };
    if (!id) return NextResponse.json({ ok: false, error: "id 필수" }, { status: 400 });
    if (!fields || Object.keys(fields).length === 0) {
      return NextResponse.json({ ok: false, error: "업데이트할 필드 없음" }, { status: 400 });
    }

    await updateExchangeReturn(id, fields);
    memDel("exchange-return:all");
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[API /exchange-return/update]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
