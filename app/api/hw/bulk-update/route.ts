import { NextRequest, NextResponse } from "next/server";
import { type FieldMap } from "@/lib/hw";
import { bulkUpdateHwFields, getHwCompaniesByIds, isPostgresEnabled } from "@/lib/repo/hw";
import { getSessionFromCookieHeader, resolveCurrentName, companyScope } from "@/lib/session";
import { errorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const MAX_IDS = 100;

// 일괄 수정 허용 필드 — 여러 건에 동일하게 덮어써도 안전한 공통값만 허용
// (사용자명/자산번호/시리얼/이메일/날짜 등은 제외)
const ALLOWED_FIELDS = new Set(["status", "company", "dept", "location", "note"]);

type ResultItem = { id: string; ok: boolean; error?: string };

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ids, fields: rawFields } = body as { ids: string[]; fields: FieldMap };

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ ok: false, error: "ids 필수" }, { status: 400 });
    }
    if (ids.length > MAX_IDS) {
      return NextResponse.json({ ok: false, error: `한 번에 최대 ${MAX_IDS}건까지 수정할 수 있습니다.` }, { status: 400 });
    }
    if (!rawFields || typeof rawFields !== "object" || Object.keys(rawFields).length === 0) {
      return NextResponse.json({ ok: false, error: "fields 필수" }, { status: 400 });
    }
    const invalidKeys = Object.keys(rawFields).filter(k => !ALLOWED_FIELDS.has(k));
    if (invalidKeys.length > 0) {
      return NextResponse.json({ ok: false, error: `일괄 수정할 수 없는 필드입니다: ${invalidKeys.join(", ")}` }, { status: 400 });
    }
    if (rawFields.status === "교체요청") {
      return NextResponse.json({ ok: false, error: "'교체요청' 상태는 일괄 수정으로 지원되지 않습니다. 개별로 수정해주세요." }, { status: 400 });
    }
    if (!isPostgresEnabled()) {
      return NextResponse.json({ ok: false, error: "데이터 저장소(Postgres)가 설정되지 않았습니다." }, { status: 503 });
    }

    const session = getSessionFromCookieHeader(req.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const scope = companyScope(session);
    if (rawFields.company !== undefined && scope !== null) {
      return NextResponse.json({ ok: false, error: "법인명 일괄 수정은 슈퍼어드민만 가능합니다." }, { status: 403 });
    }

    const adminName = await resolveCurrentName(session);
    const modifiedBy = `${adminName} (${session.userId})`;
    const modifiedAt = new Date().toISOString();

    // 재고 상태로 변경 시 반납예정일 자동 초기화 (단건 update와 동일 로직)
    const fields: FieldMap = {
      ...(rawFields.status === "재고" && rawFields.returnDue === undefined
        ? { ...rawFields, returnDue: "" }
        : rawFields),
      lastModifiedBy: modifiedBy,
      lastModifiedAt: modifiedAt,
    };

    // 법인 범위 검증 — 본인 법인 레코드만 대상으로 추린다.
    let targetIds = ids;
    const results: ResultItem[] = [];
    if (scope) {
      const companies = (await getHwCompaniesByIds(ids)) ?? new Map<string, string>();
      targetIds = [];
      for (const id of ids) {
        if (companies.get(id) === scope) targetIds.push(id);
        else results.push({ id, ok: false, error: "본인 법인 데이터만 수정할 수 있습니다." });
      }
    }

    // 메인 저장소(맥북 Postgres)에 일괄 write-through + dirty 표시 → 5분 뒤 Notion 백업.
    let success = 0;
    if (targetIds.length > 0) {
      const ok = await bulkUpdateHwFields(targetIds, fields);
      if (ok) {
        success = targetIds.length;
        for (const id of targetIds) results.push({ id, ok: true });
      } else {
        for (const id of targetIds) results.push({ id, ok: false, error: "저장 실패(Postgres)" });
      }
    }

    const failed = results.length - success;
    return NextResponse.json({ ok: true, success, failed, results });
  } catch (e) {
    console.error("[API /hw/bulk-update]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
