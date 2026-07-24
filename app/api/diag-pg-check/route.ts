import { NextRequest, NextResponse } from "next/server";
import { readEntityOne, upsertEntity, deleteEntity, isMirrorEnabled } from "@/lib/repo/mirror";
import { getHwByIdFromPostgres, insertHwRecords, softDeleteHw, isPostgresEnabled } from "@/lib/repo/hw";

// 임시 진단용 라우트 — 맥북 Postgres 왕복(쓰기 직후 읽기)이 실제로 즉시 반영되는지
// 확인하기 위한 것. 확인 끝나면 이 파일과 디렉토리를 삭제할 것.
export const dynamic = "force-dynamic";

const DIAG_KEY = "swp-diag-2026-0724";

export async function GET(req: NextRequest) {
  if (req.headers.get("x-diag-key") !== DIAG_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date().toISOString();
  const result: Record<string, unknown> = {
    now,
    mirrorEnabled: isMirrorEnabled(),
    postgresEnabled: isPostgresEnabled(),
  };

  // 1) entity_store 왕복 (쓰기 직후 즉시 읽기)
  try {
    const testId = "diag-ping";
    const writeOk = await upsertEntity("diagnostic", testId, { ping: now });
    const readBack = await readEntityOne<{ ping: string }>("diagnostic", testId);
    result.entityStore = { writeOk, readBack, matched: readBack?.ping === now };
    await deleteEntity("diagnostic", testId);
  } catch (e) {
    result.entityStore = { error: e instanceof Error ? e.message : String(e) };
  }

  // 2) hw 테이블 왕복 (더미 행 insert → 즉시 조회 → 즉시 소프트삭제)
  try {
    const testId = crypto.randomUUID();
    const insertOk = await insertHwRecords([{
      id: testId, assetNo: "ZZ-DIAG-TEST", model: "diag", serial: `diag-${now}`,
      maker: "diag", user: "", company: "", dept: "", location: "",
      status: "diag", purchaseDate: "", useDate: "", price: 0,
      note: "임시 진단용 - 자동삭제됨", changeLog: "", verified: false, duplicated: false,
      lastModifiedBy: "diagnostic", lastModifiedAt: now,
    }]);
    const readBack = await getHwByIdFromPostgres(testId);
    result.hwTable = { insertOk, readBackFound: !!readBack, matched: readBack?.assetNo === "ZZ-DIAG-TEST" };
    await softDeleteHw([testId]);
  } catch (e) {
    result.hwTable = { error: e instanceof Error ? e.message : String(e) };
  }

  return NextResponse.json({ ok: true, ...result });
}
