import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookieHeader, resolveCurrentName, companyScope } from "@/lib/session";
import { errorMessage } from "@/lib/api-error";
import { applyFields, SW_ENTITY, type FieldMap } from "@/lib/sw-notion";
import { readEntityOne, upsertEntity } from "@/lib/repo/mirror";
import type { SwDbRecord } from "@/types";

export const dynamic = "force-dynamic";

const MAX_IDS = 100;

// 일괄 수정 허용 필드 — 여러 건에 동일하게 덮어써도 안전한 공통값만 허용
// (사용자명/자산 고유값/파일첨부/버전/금액/날짜 등은 제외)
const ALLOWED_FIELDS = new Set([
  "status", "company", "department", "workType", "billingType", "accountType", "renewalCycle", "licenseType",
]);

type ResultItem = { id: string; ok: boolean; error?: string };

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ids, fields } = body as { ids: string[]; fields: FieldMap };

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ ok: false, error: "ids 필수" }, { status: 400 });
    }
    if (ids.length > MAX_IDS) {
      return NextResponse.json({ ok: false, error: `한 번에 최대 ${MAX_IDS}건까지 수정할 수 있습니다.` }, { status: 400 });
    }
    if (!fields || typeof fields !== "object" || Object.keys(fields).length === 0) {
      return NextResponse.json({ ok: false, error: "fields 필수" }, { status: 400 });
    }
    const invalidKeys = Object.keys(fields).filter(k => !ALLOWED_FIELDS.has(k));
    if (invalidKeys.length > 0) {
      return NextResponse.json({ ok: false, error: `일괄 수정할 수 없는 필드입니다: ${invalidKeys.join(", ")}` }, { status: 400 });
    }

    const session = getSessionFromCookieHeader(req.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const scope = companyScope(session);
    if (fields.company !== undefined && scope !== null) {
      return NextResponse.json({ ok: false, error: "법인명 일괄 수정은 슈퍼어드민만 가능합니다." }, { status: 403 });
    }

    const modifiedBy = `${await resolveCurrentName(session)} (${session.userId})`;
    const fieldsWithModifier: FieldMap = {
      ...fields,
      lastModifiedBy: modifiedBy,
      lastModifiedAt: new Date().toISOString(),
    };

    const results: ResultItem[] = [];
    for (const id of ids) {
      try {
        const base = await readEntityOne<SwDbRecord>(SW_ENTITY, id);
        if (!base) {
          results.push({ id, ok: false, error: "레코드를 찾을 수 없습니다." });
          continue;
        }
        if (scope && (base.company ?? "") !== scope) {
          results.push({ id, ok: false, error: "본인 법인 데이터만 수정할 수 있습니다." });
          continue;
        }
        const { next } = applyFields(base, fieldsWithModifier);
        const ok = await upsertEntity(SW_ENTITY, id, next);
        results.push(ok ? { id, ok: true } : { id, ok: false, error: "저장 실패(Postgres)" });
      } catch (e) {
        results.push({ id, ok: false, error: errorMessage(e) });
      }
    }

    const success = results.filter(r => r.ok).length;
    const failed  = results.length - success;

    return NextResponse.json({ ok: true, success, failed, results });
  } catch (e) {
    console.error("[API /sw/bulk-update]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
