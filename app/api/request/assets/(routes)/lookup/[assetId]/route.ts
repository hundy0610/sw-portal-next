import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getHwByAssetNoFromPostgres } from "@/lib/repo/hw";

type RouteContext = {
  params: { assetId: string };
};

// 4.0verMACBOOK: 자산 자가서비스 DB == HWDB(hw 테이블). 공개 자산 자가조회(QR)는 hw 테이블
// 단일 소스에서 자산번호로 조회한다. 응답 JSON 한글 키 형태는 기존 Notion 버전과 100% 동일.
// HWDB 에 없는 워크플로 표시필드는 기존처럼 "-"/0/[] 로 반환.
export async function GET(_: NextRequest, context: RouteContext) {
  try {
    const { assetId } = context.params;

    const hw = await getHwByAssetNoFromPostgres(assetId);
    if (!hw) {
      return NextResponse.json({ message: "자산을 찾을 수 없습니다." }, { status: 404 });
    }

    const response = {
      pageId: hw.id,
      properties: {
        자산번호: hw.assetNo || "-",
        사용자: hw.user || "-",
        법인명: hw.company || "-",
        부서: hw.dept || "-",
        위치: hw.location || "-",
        제조사: hw.maker || "-",
        모델명: hw.model || "-",
        "시리얼 넘버": hw.serial || "-",
        CPU: hw.cpu || "-",
        RAM: hw.ram || "-",
        단가: hw.price ?? 0,
        잔존가치: hw.residualValue ?? 0,
        구매일자: hw.purchaseDate || "-",
        사용일자: hw.useDate || "-",
        반납일자: hw.returnDate || "-",
        "사용/재고/폐기/기타": hw.status || "-",
        기타: hw.note || "-",
        // HWDB 에 없는 워크플로 표시필드(기존 응답과 동일하게 기본값)
        수리일자: "-",
        출고진행상황: "-",
        "반납 진행 상황": "-",
        수리진행상황: "-",
        수리담당자: "-",
        "수리 작업 유형": [],
        반납사유: "-",
        "누락 사항": [],
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
