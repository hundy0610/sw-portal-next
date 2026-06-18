import { NextRequest, NextResponse } from "next/server";
import { createExchangeReturn, type CreateFields } from "@/lib/exchange-return";
import { memGet, memDel } from "@/lib/mem-cache";
import { getSessionFromCookieHeader, resolveCurrentName } from "@/lib/session";
import type { ExchangeReturnRecord } from "@/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  for (const v of ["NOTION_TOKEN", "NOTION_DB_EXCHANGE_RETURN"]) {
    if (!process.env[v]) {
      return NextResponse.json({ ok: false, missingEnv: v, error: `환경변수 ${v} 가 설정되지 않았습니다.` }, { status: 503 });
    }
  }

  try {
    const body = await req.json() as CreateFields;
    if (body.type !== "신규지급" && !body.assetId?.trim()) {
      return NextResponse.json({ ok: false, error: "자산번호 필수" }, { status: 400 });
    }
    if (!body.type) {
      return NextResponse.json({ ok: false, error: "유형 필수" }, { status: 400 });
    }

    // 같은 자산번호의 미완료 교체/퇴사반납 이력이 이미 있으면 중복 등록 방지
    // 신규지급은 assetId가 항상 "" 이므로 newAssetId로 비교
    const cached = memGet<ExchangeReturnRecord[]>("exchange-return:all");
    if (cached && body.type !== "신규지급") {
      const dup = cached.find(r =>
        r.type === body.type &&
        r.assetId === body.assetId.trim() &&
        r.stage !== "반납완료"
      );
      if (dup) return NextResponse.json({ ok: true, skipped: true, existingId: dup.id });
    }

    const session = getSessionFromCookieHeader(req.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const lastModifiedBy = `${await resolveCurrentName(session)} (${session.userId})`;

    const record = await createExchangeReturn({ ...body, lastModifiedBy });
    memDel("exchange-return:all");
    return NextResponse.json({ ok: true, record });
  } catch (e) {
    console.error("[API /exchange-return/create]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
