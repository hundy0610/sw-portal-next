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
    };

    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json(error.data || { message: error.message }, {
      status: (error.status as number) || 500,
    });
  }
}
