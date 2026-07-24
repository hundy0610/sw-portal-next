import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { convertToAssetFields } from "@/app/api/request/assets/(utils)/convertToAssetFields";
import { updateAsset } from "@/lib/asset-selfservice";

type RouteContext = {
  params: { pageId: string };
};

// 4.0verMACBOOK: 공개 자산 수정(QR) → asset-selfservice 미러(맥북 Postgres) write-through(dirty=true).
// 5분 백업 러너가 Notion(ASSETS_DATA_SOURCE_ID)으로 단방향 반영한다. 미러 미스 시 Notion에서
// lazy-migrate 후 적용. 응답 형태(한글 키)는 기존과 동일하게 유지.
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { pageId } = context.params;
    const body = await request.json();

    if (!body || Object.keys(body).length === 0) {
      return NextResponse.json({ message: "수정할 데이터가 필요합니다." }, { status: 400 });
    }

    const fields = convertToAssetFields(body);
    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ message: "유효한 프로퍼티가 없습니다." }, { status: 400 });
    }

    const a = await updateAsset(pageId, fields);
    if (!a) {
      return NextResponse.json({ message: "대상 자산을 찾을 수 없습니다." }, { status: 404 });
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
