import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { convertToNotionProperties } from "@/app/api/request/assets/(utils)/convertToNotionProperties";
import { notionRequest } from "@/shared/lib/notion";

type RouteContext = {
  params: { pageId: string };
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { pageId } = context.params;
    const body = await request.json();

    if (!body || Object.keys(body).length === 0) {
      return NextResponse.json({ message: "수정할 데이터가 필요합니다." }, { status: 400 });
    }

    const properties = body.properties ? body.properties : convertToNotionProperties(body);

    if (Object.keys(properties).length === 0) {
      return NextResponse.json({ message: "유효한 프로퍼티가 없습니다." }, { status: 400 });
    }

    const notionResponse = await notionRequest<any>(`/pages/${pageId}`, {
      method: "PATCH",
      body: {
        properties,
      },
    });

    const response = {
      pageId: notionResponse.id,
      properties: {
        자산번호: notionResponse.properties.자산번호?.rich_text?.[0]?.text?.content ?? "-",
        사용자: notionResponse.properties.사용자?.title?.[0]?.text?.content ?? "-",
        법인명: notionResponse.properties.법인명?.select?.name ?? "-",
        부서: notionResponse.properties.부서?.rich_text?.[0]?.text?.content ?? "-",
        위치: notionResponse.properties.위치?.rich_text?.[0]?.text?.content ?? "-",
        제조사: notionResponse.properties.제조사?.select?.name ?? "-",
        모델명: notionResponse.properties.모델명?.rich_text?.[0]?.text?.content ?? "-",
        "시리얼 넘버": notionResponse.properties["시리얼 넘버"]?.rich_text?.[0]?.text?.content ?? "-",
        CPU: notionResponse.properties.CPU?.rich_text?.[0]?.text?.content ?? "-",
        RAM: notionResponse.properties.RAM?.rich_text?.[0]?.text?.content ?? "-",
        단가: notionResponse.properties.단가?.number ?? 0,
        잔존가치: notionResponse.properties.잔존가치?.formula?.number ?? 0,
        구매일자: notionResponse.properties.구매일자?.date?.start ?? "-",
        사용일자: notionResponse.properties.사용일자?.date?.start ?? "-",
        반납일자: notionResponse.properties.반납일자?.date?.start ?? "-",
        수리일자: notionResponse.properties.수리일자?.date?.start ?? "-",
        "사용/재고/폐기/기타": notionResponse.properties["사용/재고/폐기/기타"]?.select?.name ?? "-",
        출고진행상황: notionResponse.properties.출고진행상황?.status?.name ?? "-",
        "반납 진행 상황": notionResponse.properties["반납 진행 상황"]?.status?.name ?? "-",
        수리진행상황: notionResponse.properties.수리진행상황?.status?.name ?? "-",
        수리담당자: notionResponse.properties.수리담당자?.people?.[0]?.name ?? "-",
        "수리 작업 유형":
          notionResponse.properties["수리 작업 유형"]?.multi_select?.map((item: any) => item.name) ?? [],
        반납사유: notionResponse.properties.반납사유?.select?.name ?? "-",
        "누락 사항": notionResponse.properties["누락 사항"]?.multi_select?.map((item: any) => item.name) ?? [],
        기타: notionResponse.properties.기타?.rich_text?.[0]?.text?.content ?? "-",
        createdAt: notionResponse.created_time ?? "-",
        updatedAt: notionResponse.last_edited_time ?? "-",
      },
    };

    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json(error.data || { message: error.message }, {
      status: (error.status as number) || 500,
    });
  }
}
