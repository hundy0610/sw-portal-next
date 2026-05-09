import { NextResponse } from "next/server";
import { syncWithHwDb } from "@/lib/exchange-return";
import { memDel } from "@/lib/mem-cache";

/**
 * GET /api/cron/sync-exchange-return
 *
 * Vercel Cron 또는 외부 스케줄러에서 정기 호출.
 * HW DB와 동기화하여 교체/반납 트래커의 단계를 자동 진행하고
 * 퇴사 반납을 자동 등록.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.NOTION_DB_EXCHANGE_RETURN) {
    return NextResponse.json({ ok: false, error: "NOTION_DB_EXCHANGE_RETURN 미설정" }, { status: 503 });
  }

  try {
    const result = await syncWithHwDb();
    memDel("exchange-return:all");
    return NextResponse.json({ ok: true, result, syncedAt: new Date().toISOString() });
  } catch (e) {
    console.error("[Cron sync-exchange-return]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
