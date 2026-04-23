import { NextResponse } from "next/server";
import { fetchSwDb, fetchSwDatabase, fetchLicenseRecords, fetchSubscriptions, fetchTickets } from "@/lib/notion";
import { fetchAllHwRecords, computeHwStats } from "@/lib/hw";
import { kvSet } from "@/lib/kv-store";

/**
 * GET /api/cron/warm-cache
 *
 * GitHub Actions에서 1분마다 호출.
 * Notion에서 전체 데이터를 직접 fetch하여 Vercel KV에 저장.
 * → 이후 사용자 요청은 KV에서 즉시 응답 (1~5ms)
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();

  try {
    // Notion에서 모든 데이터를 병렬로 직접 fetch
    const [hw, sw, swdb, licenses, subscriptions, tickets] = await Promise.all([
      fetchAllHwRecords(),
      fetchSwDatabase(),
      fetchSwDb(),
      fetchLicenseRecords(),
      fetchSubscriptions(),
      fetchTickets(),
    ]);

    // 대시보드용 집계 통계 계산
    const hwStats = computeHwStats(hw);

    // Vercel KV에 저장 (이후 API 요청은 KV에서 즉시 응답)
    await Promise.all([
      kvSet("hw:all",            hw),
      kvSet("hw:stats",          hwStats),
      kvSet("sw:all",            sw),
      kvSet("swdb:all",          swdb),
      kvSet("licenses:all",      licenses),
      kvSet("subscriptions:all", subscriptions),
      kvSet("tickets:all",       tickets),
    ]);

    return NextResponse.json({
      ok: true,
      elapsed: `${Date.now() - start}ms`,
      counts: {
        hw:            hw.length,
        sw:            sw.length,
        swdb:          swdb.length,
        licenses:      licenses.length,
        subscriptions: subscriptions.length,
        tickets:       tickets.length,
      },
      warmedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[warm-cache]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
