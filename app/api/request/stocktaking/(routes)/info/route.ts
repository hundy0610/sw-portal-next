import { NextResponse } from "next/server";
import { notionRequest } from "@/shared/lib/notion";

export async function GET() {
  try {
    const notionResponse = await notionRequest<any>(
      `/data_sources/${process.env.STOCKTAKING_INFO_DATA_SOURCE_ID}/query`,
      {
        method: "POST",
        body: {
          page_size: 1,
        },
      },
    );

    const page = notionResponse.results[0];

    if (!page) {
      return NextResponse.json({ message: "진행 중인 자산실사가 없습니다." }, { status: 404 });
    }

    const 시작날짜 = page.properties.날짜?.date?.start ?? null;
    const 끝날짜 = page.properties.날짜?.date?.end ?? 시작날짜;
    const 오늘 = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

    if (!시작날짜 || 오늘 < 시작날짜 || 오늘 > 끝날짜) {
      return NextResponse.json({ message: "진행 중인 자산실사가 없습니다." }, { status: 404 });
    }

    const response = {
      실사제목: page.properties.실사제목?.title?.[0]?.text?.content ?? "-",
      시작날짜,
      끝날짜,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json(error.data || { message: error.message }, {
      status: (error.status as number) || 500,
    });
  }
}
