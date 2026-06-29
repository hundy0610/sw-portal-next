import { NextResponse } from "next/server";
import { notionRequest } from "@/shared/lib/notion";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const 법인 = formData.get("법인") as string;
    const 부서 = formData.get("부서") as string;
    const 문의자 = formData.get("문의자") as string;
    const 건물명 = formData.get("건물명") as string;
    const 층수 = formData.get("층수") as string;
    const 모니터번호 = formData.get("모니터번호") as string;
    const 고장내역 = formData.get("고장내역") as string;
    const 세부내역 = formData.get("세부내역") as string;

    const body = {
      parent: {
        data_source_id: process.env.REPAIR_TICKETS_DATA_SOURCE_ID,
      },
      properties: {
        법인: { select: { name: 법인 || "" } },
        부서: { rich_text: [{ text: { content: 부서 || "" } }] },
        문의자: { rich_text: [{ text: { content: 문의자 || "" } }] },
        건물명: { select: { name: 건물명 || "" } },
        층수: { rich_text: [{ text: { content: 층수 || "" } }] },
        자산번호: { rich_text: [{ text: { content: 모니터번호 || "" } }] },
        "고장 내역": { multi_select: [{ name: 고장내역 || "" }] },
        세부내역: { rich_text: [{ text: { content: 세부내역 || "" } }] },
        고장증상: { title: [{ text: { content: 모니터번호 || "" } }] },
      },
    };

    const notionResponse = await notionRequest<any>("/pages", {
      method: "POST",
      body,
    });

    const response = {
      ticketId: notionResponse.id,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json(error.data || { message: error.message }, {
      status: (error.status as number) || 500,
    });
  }
}
