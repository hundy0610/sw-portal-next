import { NextResponse } from "next/server";
import { notionRequest } from "@/shared/lib/notion";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const 법인 = formData.get("법인") as string;
    const 부서 = formData.get("부서") as string;
    const 문의자 = formData.get("문의자") as string;
    const 자산번호 = formData.get("자산번호") as string;
    const 문의유형 = formData.get("문의유형") as string;
    const 문의내용 = formData.get("문의내용") as string;
    const 긴급도 = formData.get("긴급도") as string;
    const 이메일 = formData.get("이메일") as string;

    const body = {
      parent: {
        data_source_id: process.env.INQUIRY_TICKETS_DATA_SOURCE_ID,
      },
      properties: {
        법인: { select: { name: 법인 || "" } },
        부서: { rich_text: [{ text: { content: 부서 || "" } }] },
        문의자: { rich_text: [{ text: { content: 문의자 || "" } }] },
        자산번호: { rich_text: [{ text: { content: 자산번호 || "" } }] },
        문의유형: { select: { name: 문의유형 || "" } },
        문의내용: { title: [{ text: { content: 문의내용 || "" } }] },
        긴급도: { select: { name: 긴급도 || "" } },
        "문의자 이메일": { email: 이메일 || null },
      },
    };

    const notionResponse = await notionRequest<any>("/pages", {
      method: "POST",
      body,
    });

    // 매뉴얼 매칭/완료 처리는 더 이상 여기서 자동으로 하지 않는다 — 접수 완료 화면에서
    // 사용자가 "매뉴얼로 해결"/"담당자 지원" 중 직접 선택하면 그때 /resolve-with-manual에서 처리한다.
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
