import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { convertToHwFields } from "@/app/api/request/assets/(utils)/convertToHwFields";
import { updateHwFields, getHwByIdFromPostgres, isPostgresEnabled } from "@/lib/repo/hw";

type RouteContext = {
  params: { pageId: string };
};

// 4.0verMACBOOK: 자산 자가서비스 DB == HWDB(hw 테이블). 공개 자산 수정(QR)은 hw 테이블
// write-through(dirty=true) → 5분 백업 러너가 Notion 으로 단방향 반영. 응답 형태(한글 키)는
// lookup 과 동일하게 갱신본을 반환. HWDB 에 없는 워크플로 필드는 무시(드롭).
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { pageId } = context.params;
    const body = await request.json();

    if (!body || Object.keys(body).length === 0) {
      return NextResponse.json({ message: "수정할 데이터가 필요합니다." }, { status: 400 });
    }
    if (!isPostgresEnabled()) {
      return NextResponse.json({ message: "데이터 저장소(Postgres)가 설정되지 않았습니다." }, { status: 503 });
    }

    const fields = convertToHwFields(body);
    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ message: "유효한 프로퍼티가 없습니다." }, { status: 400 });
    }

    const ok = await updateHwFields(pageId, fields);
    if (!ok) {
      return NextResponse.json({ message: "수정 실패(Postgres)." }, { status: 502 });
    }

    const hw = await getHwByIdFromPostgres(pageId);
    if (!hw) {
      return NextResponse.json({ pageId });
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
