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
      법인: notionResponse.properties.법인.select?.name ?? "-",
      부서: notionResponse.properties.부서.rich_text?.[0]?.text?.content ?? "-",
      문의자: notionResponse.properties.문의자.rich_text?.[0]?.text?.content ?? "-",
      자산번호: notionResponse.properties.자산번호.rich_text?.[0]?.text?.content ?? "-",
      문의유형: notionResponse.properties.문의유형.select?.name ?? "-",
      문의내용: notionResponse.properties.문의내용.title?.[0]?.text?.content ?? "-",
      긴급도: notionResponse.properties.긴급도.select?.name ?? "-",

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
