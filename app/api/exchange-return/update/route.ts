import { NextRequest, NextResponse } from "next/server";
import { updateExchangeReturn, type UpdateFields } from "@/lib/exchange-return";
import { readEntityOne, isMirrorEnabled } from "@/lib/repo/mirror";
import { getSessionFromCookieHeader, resolveCurrentName, companyScope } from "@/lib/session";
import { errorMessage } from "@/lib/api-error";
import type { ExchangeReturnRecord } from "@/types";

export const dynamic = "force-dynamic";

// 법인 범위 검증용 — 미러(Postgres)에서 대상 레코드의 법인 조회.
async function getRecordCompany(id: string): Promise<string | null> {
  const rec = await readEntityOne<ExchangeReturnRecord>("exchange-return", id);
  return rec ? rec.company : null;
}

export async function POST(req: NextRequest) {
  if (!isMirrorEnabled()) {
    return NextResponse.json({ ok: false, error: "데이터 저장소(Postgres)가 설정되지 않았습니다." }, { status: 503 });
  }
  try {
    const { id, fields } = await req.json() as { id: string; fields: UpdateFields };
    if (!id) return NextResponse.json({ ok: false, error: "id 필수" }, { status: 400 });
    if (!fields || Object.keys(fields).length === 0) {
      return NextResponse.json({ ok: false, error: "업데이트할 필드 없음" }, { status: 400 });
    }

    const session = getSessionFromCookieHeader(req.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const scope = companyScope(session);
    if (scope && (await getRecordCompany(id)) !== scope) {
      return NextResponse.json({ ok: false, error: "본인 법인 데이터만 수정할 수 있습니다." }, { status: 403 });
    }
    const adminName = await resolveCurrentName(session);
    const fieldsWithModifier: UpdateFields = {
      ...fields,
      lastModifiedBy: `${adminName} (${session.userId})`,
    };

    await updateExchangeReturn(id, fieldsWithModifier);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[API /exchange-return/update]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
