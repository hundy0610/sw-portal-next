import { NextRequest, NextResponse } from "next/server";
import { fetchHwHistory } from "@/lib/notion";
import { type HwRecord } from "@/lib/hw";
import { kvGet } from "@/lib/kv-store";
import { getSessionFromCookieHeader, companyScope } from "@/lib/session";
import { errorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

// 법인 범위 제한이 있는 계정은 본인 법인 자산의 이력만 조회 가능
async function assetInScope(assetId: string, assetNo: string, scope: string): Promise<boolean> {
  const all = await kvGet<HwRecord[]>("hw:all");
  if (!all) return true; // 캐시 미스 — 과도한 차단보다는 조회 허용 (자산 자체 접근은 이미 다른 라우트에서 검증됨)
  const record = all.find(r => (assetId && r.id === assetId) || (assetNo && r.assetNo === assetNo));
  if (!record) return true;
  return record.company === scope;
}

export async function GET(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const scope = companyScope(session);

  const { searchParams } = new URL(req.url);
  const assetId = searchParams.get("assetId")?.trim() || "";
  const assetNo = searchParams.get("assetNo")?.trim() || "";
  const field   = searchParams.get("field")?.trim()   || "";
  const limit   = Number(searchParams.get("limit")) || undefined;

  try {
    if (scope && (assetId || assetNo) && !(await assetInScope(assetId, assetNo, scope))) {
      return NextResponse.json({ ok: false, error: "본인 법인 데이터만 조회할 수 있습니다." }, { status: 403 });
    }

    let history = await fetchHwHistory({ assetId, assetNo, field, limit });

    // assetId/assetNo 없이 전체 조회하는 경우(전체 이력 페이지) — 법인 범위로 후필터링
    if (scope && !assetId && !assetNo) {
      const all = await kvGet<HwRecord[]>("hw:all");
      if (all) {
        const scopedAssetNos = new Set(all.filter(r => r.company === scope).map(r => r.assetNo));
        history = history.filter(h => scopedAssetNos.has(h.assetNo));
      }
    }

    return NextResponse.json({ ok: true, history });
  } catch (e) {
    console.error("[API /hw/history]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e), history: [] }, { status: 500 });
  }
}
