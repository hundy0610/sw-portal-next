import { NextResponse } from "next/server";
import { fetchSwDatabase } from "@/lib/notion";
import { deleteEntity } from "@/lib/repo/mirror";
import { SW_ENTITY } from "@/lib/sw-notion";

export const dynamic = "force-dynamic";

// 만료 처리 후 30일 경과 시 자동 삭제
const DELETE_AFTER_DAYS = 30;

export async function GET() {
  try {
    const data = await fetchSwDatabase();

    const threshold = new Date();
    threshold.setDate(threshold.getDate() - DELETE_AFTER_DAYS);

    // 만료 상태 + 최종수정일이 30일 이상 경과한 레코드
    const toDelete = data.filter(r => {
      if (r.status !== "만료") return false;
      if (!r.lastModifiedAt) return false;
      return new Date(r.lastModifiedAt) < threshold;
    });

    let deleted = 0, errors = 0;
    for (const r of toDelete) {
      // 미러(메인) 소프트 삭제 → 5분 백업 러너가 Notion 페이지를 archive.
      const ok = await deleteEntity(SW_ENTITY, r.id);
      if (ok) deleted++; else errors++;
    }

    return NextResponse.json({
      ok: true,
      checked: toDelete.length,
      deleted,
      errors,
      threshold: threshold.toISOString().slice(0, 10),
      deletedAt: new Date().toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
