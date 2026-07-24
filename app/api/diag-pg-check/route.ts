import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getHwByAssetNoFromPostgres, isPostgresEnabled } from "@/lib/repo/hw";

// 임시 진단용 라우트 — 특정 자산번호의 Postgres 실제 값을 직접 조회(중복 행 포함).
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

  let allRows: unknown[] | null = null;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (url && key) {
    const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data } = await sb.from("hw").select("id,assetNo,user,deleted,updated_at").eq("assetNo", assetNo);
    allRows = data;
  }

  return NextResponse.json({
    ok: true,
    postgresEnabled: isPostgresEnabled(),
    found: !!record,
    record,
    allRowsWithThisAssetNo: allRows,
    rowCount: allRows?.length ?? null,
  });
}
