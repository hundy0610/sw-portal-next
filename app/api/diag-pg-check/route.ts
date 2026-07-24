import { NextRequest, NextResponse } from "next/server";
import { getHwByAssetNoFromPostgres, isPostgresEnabled } from "@/lib/repo/hw";

// 임시 진단용 라우트 — 특정 자산번호의 Postgres 실제 값을 직접 조회.
// 확인 끝나면 이 파일을 삭제할 것.
export const dynamic = "force-dynamic";

const DIAG_KEY = "swp-diag-2026-0724";

export async function GET(req: NextRequest) {
  if (req.headers.get("x-diag-key") !== DIAG_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const assetNo = new URL(req.url).searchParams.get("assetNo")?.trim() || "";
  if (!assetNo) {
    return NextResponse.json({ error: "assetNo 필요" }, { status: 400 });
  }

  const record = await getHwByAssetNoFromPostgres(assetNo);
  return NextResponse.json({
    ok: true,
    postgresEnabled: isPostgresEnabled(),
    found: !!record,
    record,
  });
}
