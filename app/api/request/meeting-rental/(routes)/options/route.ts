import { NextResponse } from "next/server";
import { MEETING_RENTAL_OPTIONS } from "@/lib/request-form-options";

// 예전에는 Notion data source 스키마를 매 요청마다 읽었다. 지금은 스냅샷 상수다
// (lib/request-form-options.ts). 응답 모양은 그대로라 폼은 손대지 않는다.
export async function GET() {
  return NextResponse.json({
    법인명: MEETING_RENTAL_OPTIONS["법인명"],
  });
}
