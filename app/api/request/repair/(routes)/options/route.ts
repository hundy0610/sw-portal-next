import { NextResponse } from "next/server";
import { notionRequest } from "@/shared/lib/notion";

export async function GET() {
  try {
    const notionResponse = await notionRequest<any>(`/data_sources/${process.env.REPAIR_TICKETS_DATA_SOURCE_ID}`);

    const response = {
      법인: (notionResponse.properties.법인.select?.options || []).map((option: { name: string }) => option.name),
      건물명: (notionResponse.properties.건물명?.select?.options || []).map((option: { name: string }) => option.name),
      고장내역: (notionResponse.properties["고장 내역"].multi_select?.options || []).map(
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
