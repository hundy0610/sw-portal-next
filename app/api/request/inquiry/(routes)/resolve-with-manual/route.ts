import { NextRequest, NextResponse } from "next/server";
import { notionRequest } from "@/shared/lib/notion";
import { getManual, saveManual } from "@/lib/helpdesk-manuals";
import { extractKeywords } from "@/lib/helpdesk-manual-match";

export const dynamic = "force-dynamic";

// POST /api/request/inquiry/resolve-with-manual
// Body: { ticketId, manualId, content }
// 문의 접수 완료 화면에서 사용자가 "매뉴얼로 해결해볼래요"를 선택했을 때 호출됨.
// 담당자 배정 없이 바로 완료 처리하고, 조치내용에 어떤 매뉴얼로 처리했는지 남겨 이력을 추적한다.
export async function POST(req: NextRequest) {
  try {
    const { ticketId, manualId, content } = await req.json() as {
      ticketId?: string; manualId?: string; content?: string;
    };
    if (!ticketId || !manualId) {
      return NextResponse.json({ ok: false, error: "ticketId, manualId 필수", code: "RESOLVE_WITH_MANUAL_INVALID_INPUT" }, { status: 400 });
    }

    // 매뉴얼 제목 등은 클라이언트 입력을 신뢰하지 않고 저장된 매뉴얼 원본에서 가져온다
    const manual = await getManual(manualId);
    if (!manual) {
      console.error("[POST /api/request/inquiry/resolve-with-manual] RESOLVE_WITH_MANUAL_MANUAL_NOT_FOUND", manualId);
      return NextResponse.json({ ok: false, error: "매뉴얼을 찾을 수 없습니다", code: "RESOLVE_WITH_MANUAL_MANUAL_NOT_FOUND" }, { status: 404 });
    }

    await notionRequest(`/pages/${ticketId}`, {
      method: "PATCH",
      body: {
        properties: {
          상태: { status: { name: "완료" } },
          조치방법: { select: { name: "매뉴얼" } },
          "조치 내용": {
            rich_text: [{ text: { content: `매뉴얼 "${manual.title}" 로 안내됨 (문의자가 직접 매뉴얼로 해결 선택)` } }],
          },
        },
      },
    });

    // 문의자가 실제로 이 매뉴얼로 해결하기로 선택한 확인된 사례이므로 이력에 추가해,
    // 비슷한 표현의 다음 문의를 더 잘 매칭할 수 있게 한다
    try {
      const historyKw = extractKeywords(content || "");
      if (historyKw.length > 0 && !manual.linkedTicketIds.includes(ticketId)) {
        await saveManual({
          id: manual.id,
          title: manual.title,
          contentType: manual.contentType,
          body: manual.body,
          linkedTicketIds: [...manual.linkedTicketIds, ticketId],
          matchKeywords: [...manual.matchKeywords, historyKw],
          updatedBy: manual.updatedBy,
        });
      }
    } catch (e) {
      console.error("[POST /api/request/inquiry/resolve-with-manual] MANUAL_LINK_HISTORY_FAILED", e);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/request/inquiry/resolve-with-manual] RESOLVE_WITH_MANUAL_FAILED", e);
    return NextResponse.json({ ok: false, error: "서버 오류", code: "RESOLVE_WITH_MANUAL_FAILED" }, { status: 500 });
  }
}
