import { NextResponse } from "next/server";
import { fetchSwDatabase, fetchLicenseRecords, fetchSwDb } from "@/lib/notion";
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
export const maxDuration = 60;

export async function GET(_request: Request) {
  const start = Date.now();

  try {
    // Notion에서 모든 데이터를 병렬로 직접 fetch
    const [hw, sw, licenses, swDb] = await Promise.all([
      fetchAllHwRecords(),
      fetchSwDatabase(),
      fetchLicenseRecords(),
      fetchSwDb(),
    ]);

    // 대시보드용 집계 통계 계산 (수 KB → 즉시 로딩)
    const hwStats = computeHwStats(hw);

    // Vercel KV에 저장 (이후 API 요청은 KV에서 즉시 응답)
    await Promise.all([
      kvSet("hw:all",       hw),
      kvSet("hw:stats",     hwStats),
      kvSet("sw:all",       sw),
      kvSet("sw:db",        swDb),
      kvSet("licenses:all", licenses),
    ]);

    return NextResponse.json({
      ok: true,
      elapsed: `${Date.now() - start}ms`,
      counts: { hw: hw.length, sw: sw.length, swDb: swDb.length, licenses: licenses.length },
      warmedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[warm-cache]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
