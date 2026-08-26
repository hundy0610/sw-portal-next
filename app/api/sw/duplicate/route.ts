import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookieHeader, resolveCurrentName, companyScope } from "@/lib/session";
import { errorMessage } from "@/lib/api-error";
import { readEntityOne, upsertEntity, isMirrorEnabled } from "@/lib/repo/mirror";
import { SW_ENTITY } from "@/lib/sw-notion";
import type { SwDbRecord } from "@/types";

export const dynamic = "force-dynamic";

const MAX_COPIES = 50;

// POST /api/sw/duplicate  { id, count } — 선택한 1건을 count개 복제(같은 내용, 새 id).
// 대량으로 비슷한 데이터를 등록할 때, 원본을 복제한 뒤 각 항목만 개별 수정하도록 지원.
export async function POST(req: NextRequest) {
  if (!isMirrorEnabled()) {
    return NextResponse.json({ ok: false, error: "데이터 저장소(Postgres)가 설정되지 않았습니다." }, { status: 503 });
  }

  try {
    const { id, count } = await req.json() as { id: string; count: number };

    if (!id || typeof id !== "string") {
      return NextResponse.json({ ok: false, error: "id 필수" }, { status: 400 });
    }
    const n = Math.floor(Number(count));
    if (!Number.isFinite(n) || n < 1) {
      return NextResponse.json({ ok: false, error: "복제 건수는 1 이상이어야 합니다." }, { status: 400 });
    }
    if (n > MAX_COPIES) {
      return NextResponse.json({ ok: false, error: `한 번에 최대 ${MAX_COPIES}건까지 복제할 수 있습니다.` }, { status: 400 });
    }

    const session = getSessionFromCookieHeader(req.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const base = await readEntityOne<SwDbRecord>(SW_ENTITY, id);
    if (!base) {
      return NextResponse.json({ ok: false, error: "원본 레코드를 찾을 수 없습니다." }, { status: 404 });
    }
    const scope = companyScope(session);
    if (scope && base.company !== scope) {
      return NextResponse.json({ ok: false, error: "본인 법인 데이터만 복제할 수 있습니다." }, { status: 403 });
    }

    const modifiedBy = `${await resolveCurrentName(session)} (${session.userId})`;
    const modifiedAt = new Date().toISOString();

    const created: SwDbRecord[] = [];
    let failed = 0;
    for (let i = 0; i < n; i++) {
      const record: SwDbRecord = {
        ...base,
        id: crypto.randomUUID(),
        lastModifiedBy: modifiedBy,
        lastModifiedAt: modifiedAt,
        // 원본 Notion 페이지와 별개의 새 레코드이므로 백업 잡이 새로 만들 때까지 비워둔다.
        notionUrl: "",
      };
      const ok = await upsertEntity(SW_ENTITY, record.id, record);
      if (ok) created.push(record); else failed++;
    }

    if (created.length === 0) {
      return NextResponse.json({ ok: false, error: "복제 실패(Postgres). 잠시 후 다시 시도해주세요." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, created, failed });
  } catch (e) {
    console.error("[API /sw/duplicate]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
