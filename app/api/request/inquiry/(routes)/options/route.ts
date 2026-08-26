import { NextResponse } from "next/server";
import { notionRequest } from "@/shared/lib/notion";

export async function GET() {
  try {
    const notionResponse = await notionRequest<any>(`/data_sources/${process.env.INQUIRY_TICKETS_DATA_SOURCE_ID}`);

    const response = {
      법인: (notionResponse.properties.법인.select?.options || []).map((option: { name: string }) => option.name),
      문의유형: (notionResponse.properties.문의유형.select?.options || []).map(
        (option: { name: string }) => option.name,
      ),
      긴급도: (notionResponse.properties.긴급도.select?.options || []).map((option: { name: string }) => option.name),
      // 근무 위치(연구소 · 센터 단위). Notion 에 속성을 아직 안 만들었으면 빈 목록이
      // 내려가고 폼은 그 칸을 감춘다 — ?. 를 빼면 속성이 없을 때 여기서 터져 문의 폼
      // 전체가 열리지 않는다.
      위치: (notionResponse.properties.위치?.select?.options || []).map((option: { name: string }) => option.name),
    };

    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json(error.data || { message: error.message }, {
      status: (error.status as number) || 500,
    });
  }
}
