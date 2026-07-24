import { NextRequest, NextResponse } from "next/server";
import { getHwByAssetNoFromPostgres, getHwAllFromPostgres, getHwByIdFromPostgres, updateHwFields, isPostgresEnabled } from "@/lib/repo/hw";

export const dynamic = "force-dynamic";
const DIAG_KEY = "swp-diag2-2026-0724";

export async function GET(req: NextRequest) {
  if (req.headers.get("x-diag-key") !== DIAG_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const assetNo = new URL(req.url).searchParams.get("assetNo")?.trim() || "";
  if (!assetNo) return NextResponse.json({ error: "assetNo 필요" }, { status: 400 });

  const single = await getHwByAssetNoFromPostgres(assetNo);

  const t0 = Date.now();
  let fullOk = false, fullMs = 0, fullCount = 0;
  let inFullList: unknown = null;
  try {
    const all = await getHwAllFromPostgres();
    fullMs = Date.now() - t0;
    fullOk = all !== null;
    fullCount = all?.length ?? 0;
    const found = all?.find(r => r.assetNo === assetNo);
    inFullList = found ? { user: found.user, note: found.note, lastModifiedAt: found.lastModifiedAt, updated_at: (found as unknown as { updated_at?: string }).updated_at } : null;
  } catch (e) {
    inFullList = { error: e instanceof Error ? e.message : String(e) };
  }

  return NextResponse.json({
    ok: true,
    postgresEnabled: isPostgresEnabled(),
    singleLookup: single ? { user: single.user, note: single.note, lastModifiedAt: single.lastModifiedAt, updated_at: (single as unknown as { updated_at?: string }).updated_at } : null,
    fullList: { ok: fullOk, ms: fullMs, count: fullCount, record: inFullList },
  });
}

// 실제 write → 즉시 단건/전체목록 재조회 — 진짜 엔드투엔드 신선도 확인용.
export async function POST(req: NextRequest) {
  if (req.headers.get("x-diag-key") !== DIAG_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { assetNo } = (await req.json()) as { assetNo: string };
  if (!assetNo) return NextResponse.json({ error: "assetNo 필요" }, { status: 400 });

  const before = await getHwByAssetNoFromPostgres(assetNo);
  if (!before) return NextResponse.json({ error: "자산을 찾을 수 없음" }, { status: 404 });

  const marker = `진단-${Date.now()}`;
  const writeOk = await updateHwFields(before.id, { note: marker });

  const singleAfter = await getHwByIdFromPostgres(before.id);
  const all = await getHwAllFromPostgres();
  const inList = all?.find(r => r.id === before.id) ?? null;

  return NextResponse.json({
    ok: true,
    marker,
    writeOk,
    singleAfterMatches: singleAfter?.note === marker,
    fullListAfterMatches: inList?.note === marker,
    singleAfterNote: singleAfter?.note,
    fullListNote: inList?.note,
  });
}
