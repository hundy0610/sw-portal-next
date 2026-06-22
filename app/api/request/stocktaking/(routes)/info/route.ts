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

    const response = {
      실사제목: page.properties.실사제목?.title?.[0]?.text?.content ?? "-",
      시작날짜: page.properties.날짜?.date?.start ?? null,
      끝날짜: page.properties.날짜?.date?.end ?? null,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json(error.data || { message: error.message }, {
      status: (error.status as number) || 500,
    });
  }
}
