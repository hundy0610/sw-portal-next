import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookieHeader, resolveCurrentName, companyScope } from "@/lib/session";
import { errorMessage } from "@/lib/api-error";
import { getRecordCompany, applyFields, SW_ENTITY, type FieldMap } from "@/lib/sw-notion";
import { readEntityOne, upsertEntity } from "@/lib/repo/mirror";
import type { SwDbRecord } from "@/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, fields } = body as { id: string; fields: FieldMap };

    if (!id || typeof id !== "string") {
      return NextResponse.json({ ok: false, error: "id 필수" }, { status: 400 });
    }
    if (!fields || typeof fields !== "object") {
      return NextResponse.json({ ok: false, error: "fields 필수" }, { status: 400 });
    }

    const session = getSessionFromCookieHeader(req.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const scope = companyScope(session);
    if (scope && (await getRecordCompany(id)) !== scope) {
      return NextResponse.json({ ok: false, error: "본인 법인 데이터만 수정할 수 있습니다." }, { status: 403 });
    }
    const modifiedBy = `${await resolveCurrentName(session)} (${session.userId})`;
    const fieldsWithModifier: FieldMap = {
      ...fields,
      lastModifiedBy: modifiedBy,
      lastModifiedAt: new Date().toISOString(),
    };

    const base = await readEntityOne<SwDbRecord>(SW_ENTITY, id);
    if (!base) {
      return NextResponse.json({ ok: false, error: "대상 SW 레코드를 찾을 수 없습니다." }, { status: 404 });
    }
    const { next } = applyFields(base, fieldsWithModifier);
    const ok = await upsertEntity(SW_ENTITY, id, next);
    if (!ok) {
      return NextResponse.json({ ok: false, error: "저장 실패(Postgres)" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[API /sw/update]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
