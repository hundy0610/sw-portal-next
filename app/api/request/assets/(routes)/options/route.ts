import { NextResponse } from "next/server";
import { ASSET_OPTIONS } from "@/lib/request-form-options";

// 예전에는 Notion data source 스키마를 매 요청마다 읽었다. 지금은 스냅샷 상수다
// (lib/request-form-options.ts). 응답 모양은 그대로라 폼은 손대지 않는다.
export async function GET() {
  return NextResponse.json({
    "사용/재고/폐기/기타": ASSET_OPTIONS["사용/재고/폐기/기타"],
    법인명: ASSET_OPTIONS["법인명"],
    제조사: ASSET_OPTIONS["제조사"],
    출고진행상황: ASSET_OPTIONS["출고진행상황"],
    "수리 작업 유형": ASSET_OPTIONS["수리 작업 유형"],
    수리진행상황: ASSET_OPTIONS["수리진행상황"],
    "반납 진행 상황": ASSET_OPTIONS["반납 진행 상황"],
    반납사유: ASSET_OPTIONS["반납사유"],
    "누락 사항": ASSET_OPTIONS["누락 사항"],
  });
}
