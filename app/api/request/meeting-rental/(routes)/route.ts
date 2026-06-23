import { NextResponse } from "next/server";
import { notionRequest } from "@/shared/lib/notion";

// <input type="datetime-local"> 값("YYYY-MM-DDTHH:mm")에는 타임존이 없어
// 그대로 보내면 Notion이 UTC로 해석한다. KST(+09:00)를 명시해 시각 오류를 방지한다.
function toKstIso(local: string): string | null {
  return local ? `${local}:00+09:00` : null;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const 법인명 = formData.get("법인명") as string;
    const 부서 = formData.get("부서") as string;
    const 신청자 = formData.get("신청자") as string;
    const 이메일 = formData.get("이메일") as string;
    const 시작일시 = formData.get("시작일시") as string;
    const 종료일시 = formData.get("종료일시") as string;

    const body = {
      parent: {
        data_source_id: process.env.MEETING_RENTAL_DATA_SOURCE_ID,
      },
      properties: {
        신청자: { title: [{ text: { content: 신청자 || "" } }] },
        법인명: { select: { name: 법인명 || "" } },
        부서: { rich_text: [{ text: { content: 부서 || "" } }] },
        "신청자 이메일": { email: 이메일 || null },
        신청기간: { date: { start: toKstIso(시작일시), end: toKstIso(종료일시) } },
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
