import { NextResponse } from "next/server";
import { notionRequest } from "@/shared/lib/notion";
import { listManuals } from "@/lib/helpdesk-manuals";
import { matchManualForContent } from "@/lib/helpdesk-manual-match";

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

    // 접수된 문의 내용이 등록된 매뉴얼과 매칭되면, 담당자 배정 없이 바로 완료 처리하고
    // 조치내용에 어떤 매뉴얼로 안내됐는지 남겨 이력을 추적할 수 있게 한다.
    // 이 단계가 실패해도 문의 접수 자체는 이미 완료된 것이므로 응답에는 영향을 주지 않는다.
    let debugInfo: any = null;
    try {
      const manuals = await listManuals();
      const matched = matchManualForContent(문의내용 || "", manuals);
      debugInfo = { manualsCount: manuals.length, matched: !!matched };
      if (matched) {
        await notionRequest(`/pages/${notionResponse.id}`, {
          method: "PATCH",
          body: {
            properties: {
              상태: { status: { name: "완료" } },
              조치방법: { select: { name: "매뉴얼" } },
              "조치 내용": {
                rich_text: [{ text: { content: `매뉴얼 "${matched.manual.title}" 자동 안내됨 (문의 접수 시 자동 매칭)` } }],
              },
            },
          },
        });
        debugInfo.patched = true;
      }
    } catch (e: any) {
      console.error("[POST /api/request/inquiry] INQUIRY_AUTO_COMPLETE_FAILED", e);
      debugInfo = { ...debugInfo, error: e?.data || e?.message || String(e) };
    }

    const response = {
      ticketId: notionResponse.id,
      _debug: debugInfo,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json(error.data || { message: error.message }, {
      status: (error.status as number) || 500,
    });
  }
}
