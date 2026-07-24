import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getHwByAssetNoFromPostgres, getHwAllFromPostgres, isPostgresEnabled } from "@/lib/repo/hw";
import { kvGet } from "@/lib/kv-store";
import type { HwRecord } from "@/lib/hw";

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

  // /api/hw 가 실제로 쓰는 전체목록 함수 — 성공/실패 및 그 안에서의 이 자산 값 확인
  const t0 = Date.now();
  let fullListOk = false;
  let fullListMs = 0;
  let fullListCount: number | null = null;
  let recordInFullList: Partial<HwRecord> | null = null;
  try {
    const all = await getHwAllFromPostgres();
    fullListMs = Date.now() - t0;
    fullListOk = all !== null;
    fullListCount = all?.length ?? null;
    const found2 = all?.find(r => r.assetNo === assetNo) ?? null;
    recordInFullList = found2 ? { user: found2.user, lastModifiedAt: found2.lastModifiedAt, lastModifiedBy: found2.lastModifiedBy } : null;
  } catch (e) {
    fullListMs = Date.now() - t0;
  }

  // hw:all KV 캐시(레거시 warm-hw) 상태 — 이 안에도 같은 자산이 있는지, 값이 뭔지
  const kvAll = await kvGet<HwRecord[]>("hw:all");
  const kvRecord = kvAll?.find(r => r.assetNo === assetNo) ?? null;

  return NextResponse.json({
    ok: true,
    postgresEnabled: isPostgresEnabled(),
    found: !!record,
    record,
    allRowsWithThisAssetNo: allRows,
    rowCount: allRows?.length ?? null,
    fullList: { ok: fullListOk, ms: fullListMs, count: fullListCount, recordInFullList },
    kvAllCache: { present: !!kvAll, count: kvAll?.length ?? null, recordInKv: kvRecord ? { user: kvRecord.user, lastModifiedAt: kvRecord.lastModifiedAt, lastModifiedBy: kvRecord.lastModifiedBy } : null },
  });
}
