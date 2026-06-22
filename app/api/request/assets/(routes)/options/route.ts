import { NextResponse } from "next/server";
import { notionRequest } from "@/shared/lib/notion";

export async function GET() {
  try {
    const notionResponse = await notionRequest<any>(`/data_sources/${process.env.ASSETS_DATA_SOURCE_ID}`);

    const response = {
      "사용/재고/폐기/기타": (notionResponse.properties["사용/재고/폐기/기타"].select?.options || []).map(
        (option: { name: string }) => option.name,
      ),
      법인명: (notionResponse.properties.법인명.select?.options || []).map((option: { name: string }) => option.name),
      제조사: (notionResponse.properties.제조사.select?.options || []).map((option: { name: string }) => option.name),
      출고진행상황: (notionResponse.properties.출고진행상황.status?.options || []).map(
        (option: { name: string }) => option.name,
      ),
      "수리 작업 유형": (notionResponse.properties["수리 작업 유형"].multi_select?.options || []).map(
        (option: { name: string }) => option.name,
      ),
      수리진행상황: (notionResponse.properties.수리진행상황.status?.options || []).map(
        (option: { name: string }) => option.name,
      ),
      "반납 진행 상황": (notionResponse.properties["반납 진행 상황"].status?.options || []).map(
        (option: { name: string }) => option.name,
      ),
      반납사유: (notionResponse.properties.반납사유.select?.options || []).map(
        (option: { name: string }) => option.name,
      ),
      "누락 사항": (notionResponse.properties["누락 사항"].multi_select?.options || []).map(
        (option: { name: string }) => option.name,
      ),
    };

    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json(error.data || { message: error.message }, {
      status: (error.status as number) || 500,
    });
  }
}
