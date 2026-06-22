import { type NextRequest, NextResponse } from "next/server";
import { notionRequest } from "@/shared/lib/notion";

type RouteContext = {
  params: { pageId: string };
};

export async function PATCH(_request: NextRequest, context: RouteContext) {
  try {
    const { pageId } = context.params;

    if (!pageId) {
      return NextResponse.json({ message: "pageId가 필요합니다." }, { status: 400 });
    }

    const updateFormData = new FormData();
    updateFormData.append("실사확인", "true");

    await notionRequest<any>(`/pages/${pageId}`, {
      method: "PATCH",
      body: {
        properties: {
          실사확인: {
            checkbox: true,
          },
        },
      },
    });

    return NextResponse.json({ message: "실사 확인이 완료되었습니다." }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(error.data || { message: error.message }, {
      status: (error.status as number) || 500,
    });
  }
}
