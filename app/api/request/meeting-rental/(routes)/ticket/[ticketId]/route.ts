import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { notionRequest } from "@/shared/lib/notion";

type RouteContext = {
  params: { ticketId: string };
};

export async function GET(_: NextRequest, context: RouteContext) {
  try {
    const { ticketId } = context.params;

    const notionResponse = await notionRequest<any>(`/pages/${ticketId}`, {
      method: "GET",
    });

    const response = {
      법인명: notionResponse.properties.법인명.select?.name ?? "-",
      부서: notionResponse.properties.부서.rich_text?.[0]?.text?.content ?? "-",
      신청자: notionResponse.properties.신청자.title?.[0]?.text?.content ?? "-",
      이메일: notionResponse.properties["신청자 이메일"].email ?? "-",
      시작일시: notionResponse.properties.신청기간.date?.start ?? "-",
      종료일시: notionResponse.properties.신청기간.date?.end ?? "-",

      상태: notionResponse.properties.상태.status?.name ?? "-",
      담당자: notionResponse.properties.담당자.people?.[0]?.name ?? "-",

      createdAt: notionResponse.created_time ?? "-",
    };

    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json(error.data || { message: error.message }, {
      status: (error.status as number) || 500,
    });
  }
}
