import { NextRequest, NextResponse } from "next/server";
import { fetchExchangeReturns } from "@/lib/exchange-return";
import { isMirrorEnabled } from "@/lib/repo/mirror";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isMirrorEnabled()) {
    return NextResponse.json({ missingEnv: "SUPABASE_URL", error: "데이터 저장소가 설정되지 않았습니다." }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const assetId = searchParams.get("assetId")?.trim() || "";
  const type    = searchParams.get("type")?.trim()    || "";

  try {
    // 미러(Postgres)에서 매 요청 조회 → 쓰기 즉시 반영.
    let data = await fetchExchangeReturns();
    // 자산 상세의 "임대 메모" 등 특정 자산/유형만 필요한 화면에서 전체 목록을 내려보내지 않도록 필터.
    if (assetId) data = data.filter(r => r.assetId === assetId || r.newAssetId === assetId);
    if (type)    data = data.filter(r => r.type === type);
    return NextResponse.json({ data, lastSynced: new Date().toISOString(), cached: false });
  } catch (error) {
    console.error("[API GET /exchange-return]", error);
    return NextResponse.json(
      { data: [], error: error instanceof Error ? error.message : "알 수 없는 오류" },
      { status: 500 }
    );
  }
}
