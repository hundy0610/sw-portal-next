import { NextRequest, NextResponse } from "next/server";
import { findHwById } from "@/lib/hw";
import { isPostgresEnabled } from "@/lib/repo/hw";
import { errorMessage } from "@/lib/api-error";
import { getSessionFromCookieHeader, companyScope } from "@/lib/session";

export const dynamic = "force-dynamic";

// 변경이력 타임라인 탭 전용 — 캐시(hw:all)를 거치지 않고 단건을 직접 조회한다(findHwById는 Postgres 전용).
// warm-hw.mjs의 캐시 워밍 매핑이 changeLog를 채우지 않는 갭이 있어, 이 필드는 캐시를 신뢰하지 않는다.
export async function GET(req: NextRequest) {
  if (!isPostgresEnabled()) return NextResponse.json({ ok: false, error: "데이터 저장소(Postgres)가 설정되지 않았습니다." }, { status: 503 });

  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const scope = companyScope(session);

  const id = new URL(req.url).searchParams.get("id")?.trim() || "";
  if (!id) {
    return NextResponse.json({ ok: false, error: "id가 필요합니다." }, { status: 400 });
  }

  try {
    const record = await findHwById(id);
    if (!record || (scope && record.company !== scope)) {
      return NextResponse.json({ ok: true, record: null });
    }
    return NextResponse.json({ ok: true, record });
  } catch (e) {
    console.error("[API /hw/history]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
