import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { notionRequest } from "@/shared/lib/notion";

type RouteContext = {
  params: { assetId: string };
};

export async function GET(_: NextRequest, context: RouteContext) {
  try {
    const { assetId } = context.params;

    const notionResponse = await notionRequest<any>(`/data_sources/${process.env.ASSETS_DATA_SOURCE_ID}/query`, {
      method: "POST",
      body: {
        filter: {
          property: "자산번호",
          rich_text: {
            equals: assetId,
          },
        },
      },
    });

    if (!notionResponse.results || notionResponse.results.length === 0) {
      return NextResponse.json({ message: "자산을 찾을 수 없습니다." }, { status: 404 });
    }

    const asset = notionResponse.results[0];

    const response = {
      pageId: asset.id,
      properties: {
        자산번호: asset.properties.자산번호?.rich_text?.[0]?.text?.content ?? "-",
        사용자: asset.properties.사용자?.title?.[0]?.text?.content ?? "-",
        법인명: asset.properties.법인명?.select?.name ?? "-",
        부서: asset.properties.부서?.rich_text?.[0]?.text?.content ?? "-",
        위치: asset.properties.위치?.rich_text?.[0]?.text?.content ?? "-",
        제조사: asset.properties.제조사?.select?.name ?? "-",
        모델명: asset.properties.모델명?.rich_text?.[0]?.text?.content ?? "-",
        "시리얼 넘버": asset.properties["시리얼 넘버"]?.rich_text?.[0]?.text?.content ?? "-",
        CPU: asset.properties.CPU?.rich_text?.[0]?.text?.content ?? "-",
        RAM: asset.properties.RAM?.rich_text?.[0]?.text?.content ?? "-",
        단가: asset.properties.단가?.number ?? 0,
        잔존가치: asset.properties.잔존가치?.formula?.number ?? 0,
        구매일자: asset.properties.구매일자?.date?.start ?? "-",
        사용일자: asset.properties.사용일자?.date?.start ?? "-",
        반납일자: asset.properties.반납일자?.date?.start ?? "-",
        수리일자: asset.properties.수리일자?.date?.start ?? "-",
        "사용/재고/폐기/기타": asset.properties["사용/재고/폐기/기타"]?.select?.name ?? "-",
        출고진행상황: asset.properties.출고진행상황?.status?.name ?? "-",
        "반납 진행 상황": asset.properties["반납 진행 상황"]?.status?.name ?? "-",
        수리진행상황: asset.properties.수리진행상황?.status?.name ?? "-",
        수리담당자: asset.properties.수리담당자?.people?.[0]?.name ?? "-",
        "수리 작업 유형": asset.properties["수리 작업 유형"]?.multi_select?.map((item: any) => item.name) ?? [],
        반납사유: asset.properties.반납사유?.select?.name ?? "-",
        "누락 사항": asset.properties["누락 사항"]?.multi_select?.map((item: any) => item.name) ?? [],
        기타: asset.properties.기타?.rich_text?.[0]?.text?.content ?? "-",
        createdAt: asset.created_time ?? "-",
        updatedAt: asset.last_edited_time ?? "-",
      },
    };

    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json(error.data || { message: error.message }, {
      status: (error.status as number) || 500,
    });
  }
}
