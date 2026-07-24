import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAssetByAssetNo } from "@/lib/asset-selfservice";

type RouteContext = {
  params: { assetId: string };
};

// 4.0verMACBOOK: 공개 자산 자가조회(QR) → asset-selfservice 미러(맥북 Postgres) 우선,
// 미스 시 Notion(ASSETS_DATA_SOURCE_ID) 폴백 + lazy-migration. 응답 JSON 한글 키 형태는
// 기존 Notion 버전과 100% 동일하게 유지한다(외부 클라이언트 무수정).
export async function GET(_: NextRequest, context: RouteContext) {
  try {
    const { assetId } = context.params;

    const a = await getAssetByAssetNo(assetId);
    if (!a) {
      return NextResponse.json({ message: "자산을 찾을 수 없습니다." }, { status: 404 });
    }

    const response = {
      pageId: a.id,
      properties: {
        자산번호: a.assetNo || "-",
        사용자: a.user || "-",
        법인명: a.company || "-",
        부서: a.dept || "-",
        위치: a.location || "-",
        제조사: a.maker || "-",
        모델명: a.model || "-",
        "시리얼 넘버": a.serial || "-",
        CPU: a.cpu || "-",
        RAM: a.ram || "-",
        단가: a.price ?? 0,
        // 잔존가치는 Notion formula(계산필드) — 미러에 저장하지 않으므로 0으로 응답.
        잔존가치: 0,
        구매일자: a.purchaseDate || "-",
        사용일자: a.useDate || "-",
        반납일자: a.returnDate || "-",
        수리일자: a.repairDate || "-",
        "사용/재고/폐기/기타": a.status || "-",
        출고진행상황: a.shipStatus || "-",
        "반납 진행 상황": a.returnStatus || "-",
        수리진행상황: a.repairStatus || "-",
        수리담당자: a.repairAssignee || "-",
        "수리 작업 유형": a.repairTypes ?? [],
        반납사유: a.returnReason || "-",
        "누락 사항": a.missingItems ?? [],
        기타: a.note || "-",
        createdAt: "-",
        updatedAt: "-",
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "서버 오류";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
