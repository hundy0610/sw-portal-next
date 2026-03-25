import { NextResponse } from "next/server";
import { fetchSwDatabase, fetchLicenseRecords } from "@/lib/notion";
import { fetchAllHwRecords } from "@/lib/hw";
import { kvSet } from "@/lib/kv-store";

/**
 * GET /api/cron/warm-cache
 *
 * GitHub Actions에서 1분마다 호출.
 * Notion에서 전체 데이터를 직접 fetch하여 Vercel KV에 저장.
 * → 이후 사용자 요청은 KV에서 즉시 응답 (1~5ms)
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();

  try {
    // Notion에서 모든 데이터를 병렬로 직접 fetch
    const [hw, sw, licenses] = await Promise.all([
      fetchAllHwRecords(),
      fetchSwDatabase(),
      fetchLicenseRecords(),
    ]);

    // Vercel KV에 저장 (이후 API 요청은 KV에서 즉시 응답)
    await Promise.all([
      kvSet("hw:all", hw),
      kvSet("sw:all", sw),
      kvSet("licenses:all", licenses),
    ]);

    return NextResponse.json({
      ok: true,
      elapsed: `${Date.now() - start}ms`,
      counts: { hw: hw.length, sw: sw.length, licenses: licenses.length },
      warmedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[warm-cache]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
