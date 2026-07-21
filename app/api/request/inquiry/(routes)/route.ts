import { NextResponse } from "next/server";
import { notionRequest } from "@/shared/lib/notion";
import { listManuals, saveManual } from "@/lib/helpdesk-manuals";
import { matchManualForContent, extractKeywords } from "@/lib/helpdesk-manual-match";

// listManuals()가 내부적으로 fetch(Upstash REST)를 쓰는데, force-dynamic이 없으면
// Next.js가 이 라우트의 fetch 결과를 캐시해 매뉴얼이 새로 추가/변경돼도 반영되지 않는다.
export const dynamic = "force-dynamic";

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
    try {
      const manuals = await listManuals();
      const matched = matchManualForContent(문의내용 || "", manuals);
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

        // 이 문의도 실제로 이 매뉴얼로 자동 처리된 사례이므로 이력에 추가해, 비슷한 표현의
        // 다음 문의를 더 잘 매칭할 수 있게 한다 (매뉴얼 화면에서 수동으로 연결하지 않아도 됨)
        try {
          const historyKw = extractKeywords(문의내용 || "");
          if (historyKw.length > 0 && !matched.manual.linkedTicketIds.includes(notionResponse.id)) {
            await saveManual({
              id: matched.manual.id,
              title: matched.manual.title,
              contentType: matched.manual.contentType,
              body: matched.manual.body,
              linkedTicketIds: [...matched.manual.linkedTicketIds, notionResponse.id],
              matchKeywords: [...matched.manual.matchKeywords, historyKw],
              updatedBy: matched.manual.updatedBy,
            });
          }
        } catch (e) {
          console.error("[POST /api/request/inquiry] MANUAL_LINK_HISTORY_FAILED", e);
        }
      }
    } catch (e) {
      console.error("[POST /api/request/inquiry] INQUIRY_AUTO_COMPLETE_FAILED", e);
    }

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
