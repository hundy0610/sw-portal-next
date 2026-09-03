import { NextResponse, type NextRequest } from "next/server";
import { cropBoxAround, describeLocation, findItemLocation } from "@/lib/monitor-map";
import { errorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

// GET /api/monitor-location/:itemId — QR 확인 화면 전용. 인증 없음(직원이 로그인 없이
// 스캔). 좌석 하나가 있는 층의 배치 데이터 전체를 내려주지만, 실제로 화면에는 crop
// 영역 안쪽만 보인다 — 그 층의 모든 모니터 위치가 이미 공개 배치도이므로 노출 범위는
// 문제없다(자산번호·구매일 등 MonitorAsset의 민감한 관리 정보는 여기서 다루지 않는다).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const { itemId } = await params;
    const loc = await findItemLocation(itemId);
    if (!loc) {
      return NextResponse.json({ ok: false, error: "등록되지 않은 좌석입니다." }, { status: 404 });
    }
    const crop = cropBoxAround(loc.item, loc.elements.canvasW, loc.elements.canvasH);
    const { buildingLabel, floorLabel } = describeLocation(loc.floorMap);
    return NextResponse.json({
      ok: true,
      buildingLabel,
      floorLabel,
      imageUrl: loc.floorMap.imageUrl,
      elements: loc.elements,
      itemId: loc.item.id,
      crop,
    });
  } catch (e) {
    console.error("[GET /api/monitor-location/:itemId]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
