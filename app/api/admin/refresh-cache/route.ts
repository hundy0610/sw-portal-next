import { NextResponse } from "next/server";
import { fetchSwDatabase, fetchLicenseRecords, fetchSwDb } from "@/lib/notion";
import { fetchAllHwRecords, computeHwStats } from "@/lib/hw";
import { kvSet } from "@/lib/kv-store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/admin/refresh-cache
 * 관리자 페이지에서 수동으로 KV 캐시를 갱신할 때 사용
 * (middleware가 /admin/* 경로만 보호하므로 별도 인증 불필요)
 */
export async function GET() {
  const start = Date.now();

  try {
    const [hw, sw, licenses, swDb] = await Promise.all([
      fetchAllHwRecords(),
      fetchSwDatabase(),
      fetchLicenseRecords(),
      fetchSwDb(),
    ]);

    const hwStats = computeHwStats(hw);

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
      refreshedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[refresh-cache]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
