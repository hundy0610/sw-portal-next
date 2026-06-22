import { NextResponse } from "next/server";
import { notionRequest } from "@/shared/lib/notion";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const 자산번호 = formData.get("자산번호") as string;

    if (!자산번호) {
      return NextResponse.json({ message: "자산번호를 입력해주세요." }, { status: 400 });
    }

    const notionResponse = await notionRequest<any>(`/data_sources/${process.env.ASSETS_DATA_SOURCE_ID}/query`, {
      method: "POST",
      body: {
        filter: {
          property: "자산번호",
          rich_text: {
            equals: 자산번호,
          },
        },
      },
    });

    if (notionResponse.results.length === 0) {
      return NextResponse.json(
        { message: "해당 자산번호를 찾을 수 없습니다. 수동으로 입력해주세요." },
        { status: 404 },
      );
    }

    const asset = notionResponse.results[0];

    const response = {
      pageId: asset.id,
      properties: {
        법인명: asset.properties.법인명?.select?.name ?? "-",
        부서: asset.properties.부서?.rich_text?.[0]?.text?.content ?? "-",
        사용자: asset.properties.사용자?.title?.[0]?.text?.content ?? "-",
        제조사: asset.properties.제조사?.select?.name ?? "-",
        실사확인: asset.properties.실사확인?.checkbox ?? false,
      },
    };

    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json(error.data || { message: error.message }, {
      status: (error.status as number) || 500,
    });
  }
}
