import { NextResponse } from "next/server";
import { syncWithHwDb } from "@/lib/exchange-return";
import { memDel } from "@/lib/mem-cache";

export const dynamic = "force-dynamic";

export async function POST() {
  for (const v of ["NOTION_TOKEN", "NOTION_DB_EXCHANGE_RETURN"]) {
    if (!process.env[v]) {
      return NextResponse.json(
        { ok: false, missingEnv: v, error: `환경변수 ${v} 가 설정되지 않았습니다.` },
        { status: 503 }
      );
    }
  }

  try {
    const result = await syncWithHwDb();
    memDel("exchange-return:all");
    return NextResponse.json({ ok: true, result, syncedAt: new Date().toISOString() });
  } catch (e) {
    console.error("[API /exchange-return/sync]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
