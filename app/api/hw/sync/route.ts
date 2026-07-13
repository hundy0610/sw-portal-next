import { NextResponse } from "next/server";
import { fetchHwUpdatedSince, mergeHwRecords, getHwLastSyncedAt, setHwLastSyncedAt, SYNC_OVERLAP_MS } from "@/lib/hw";
import { errorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

/**
 * POST /api/hw/sync
 * Notion에서 last_edited_time 기준 최근 수정분만 조회해 KV 캐시에 즉시 반영.
 * 전체 재스캔(warm-hw GitHub Actions) 대신 증분 동기화로 몇 초 내 완료됨.
 */
export async function POST() {
  const startedAt = new Date();

  try {
    const since = await getHwLastSyncedAt();
    const updated = await fetchHwUpdatedSince(since);
    const stats = await mergeHwRecords(updated);
    await setHwLastSyncedAt(new Date(startedAt.getTime() - SYNC_OVERLAP_MS).toISOString());

    return NextResponse.json({
      ok: true,
      updatedCount: updated.length,
      total: stats.total,
      message: updated.length > 0
        ? `Notion 동기화 완료 (${updated.length}건 반영)`
        : "Notion 동기화 완료 (변경 사항 없음)",
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
