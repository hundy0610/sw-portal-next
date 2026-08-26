import { NextRequest, NextResponse } from "next/server";
import { softDeleteHw, getHwCompaniesByIds, isPostgresEnabled } from "@/lib/repo/hw";
import { getSessionFromCookieHeader, companyScope } from "@/lib/session";
import { errorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const MAX_IDS = 100;

type ResultItem = { id: string; ok: boolean; error?: string };

export async function POST(req: NextRequest) {
  try {
    const { ids } = await req.json() as { ids: string[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ ok: false, error: "삭제할 ID가 없습니다." }, { status: 400 });
    }
    if (ids.length > MAX_IDS) {
      return NextResponse.json({ ok: false, error: `한 번에 최대 ${MAX_IDS}건까지 삭제할 수 있습니다.` }, { status: 400 });
    }
    if (!isPostgresEnabled()) {
      return NextResponse.json({ ok: false, error: "데이터 저장소(Postgres)가 설정되지 않았습니다." }, { status: 503 });
    }

    const session = getSessionFromCookieHeader(req.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const scope = companyScope(session);

    // 법인 범위 검증 — 본인 법인 레코드만 대상으로 추린다.
    let targetIds = ids;
    const results: ResultItem[] = [];
    if (scope) {
      const companies = (await getHwCompaniesByIds(ids)) ?? new Map<string, string>();
      targetIds = [];
      for (const id of ids) {
        if (companies.get(id) === scope) targetIds.push(id);
        else results.push({ id, ok: false, error: "본인 법인 데이터만 삭제할 수 있습니다." });
      }
    }

    // 메인 저장소(맥북 Postgres) 소프트 삭제 + dirty → 5분 뒤 Notion 페이지 archive.
    let success = 0;
    if (targetIds.length > 0) {
      const ok = await softDeleteHw(targetIds);
      if (ok) {
        success = targetIds.length;
        for (const id of targetIds) results.push({ id, ok: true });
      } else {
        for (const id of targetIds) results.push({ id, ok: false, error: "삭제 실패(Postgres)" });
      }
    }

    const failed = results.length - success;
    return NextResponse.json({ ok: true, success, failed, results });
  } catch (e) {
    console.error("[API /hw/delete]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
