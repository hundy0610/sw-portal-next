import { NextRequest, NextResponse } from "next/server";
import { deleteExchangeReturn } from "@/lib/exchange-return";
import { memDel } from "@/lib/mem-cache";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json() as { id: string };
    if (!id) return NextResponse.json({ ok: false, error: "id 필수" }, { status: 400 });

    await deleteExchangeReturn(id);
    memDel("exchange-return:all");
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[API /exchange-return/delete]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
