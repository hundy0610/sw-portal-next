import { NextRequest, NextResponse } from "next/server";
import { deleteEntity } from "@/lib/repo/mirror";
import { SW_ENTITY } from "@/lib/sw-notion";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { ids } = await req.json() as { ids: string[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ ok: false, error: "삭제할 ID가 없습니다." }, { status: 400 });
    }
    if (ids.length > 100) {
      return NextResponse.json({ ok: false, error: "한 번에 최대 100건까지 삭제할 수 있습니다." }, { status: 400 });
    }

    const results: { id: string; ok: boolean; error?: string }[] = [];

    for (const id of ids) {
      // 미러(메인) 소프트 삭제 → 5분 백업 러너가 Notion 페이지를 archive.
      const ok = await deleteEntity(SW_ENTITY, id);
      results.push(ok ? { id, ok: true } : { id, ok: false, error: "삭제 실패(Postgres)" });
    }

    const success = results.filter(r => r.ok).length;
    const failed  = results.filter(r => !r.ok).length;

    return NextResponse.json({ ok: true, success, failed, results });
  } catch (e) {
    console.error("[API /sw/delete]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
