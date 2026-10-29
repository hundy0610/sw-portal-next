import { NextRequest, NextResponse } from "next/server";
import { insertEntity } from "@/lib/repo/mirror";
import { getManual, saveManual } from "@/lib/helpdesk-manuals";
import { isValidResolveToken } from "@/lib/resolve-token";
import { extractKeywords } from "@/lib/helpdesk-manual-match";

export const dynamic = "force-dynamic";

// POST /api/request/inquiry/resolve-with-manual
// Body: { ticketId, manualId, content }
// 문의 접수 완료 화면에서 사용자가 "매뉴얼로 해결해볼래요"를 선택했을 때 호출됨.
// 담당자 배정 없이 바로 완료 처리하고, 조치내용에 어떤 매뉴얼로 처리했는지 남겨 이력을 추적한다.
//
// v2 전환 뒤: 포털은 문의 행을 읽거나 고칠 수 없다(암호문). 해결 요청을 새 행(helpdesk-resolve)으로 잠가 남기고,
// 문의 완료 처리(상태·조치내용·시각)는 맥북 처리기가 한다(데스크탑 docs/v2-handoff.md 5-6 D).
// 티켓이 있는지 DB 로 확인할 수 없으므로 접수 때 준 서명(resolveToken)으로 확인한다.
// 매뉴얼 이력 저장(saveManual)은 예전 그대로 — helpdesk:manual:* 은 평문 예외이고 손대지 않는다.
export async function POST(req: NextRequest) {
  try {
    const { ticketId, manualId, content, resolveToken } = await req.json() as {
      ticketId?: string; manualId?: string; content?: string; resolveToken?: string;
    };
    if (!ticketId || !manualId) {
      return NextResponse.json({ ok: false, error: "ticketId, manualId 필수", code: "RESOLVE_WITH_MANUAL_INVALID_INPUT" }, { status: 400 });
    }
    if (!resolveToken || !isValidResolveToken(ticketId, resolveToken)) {
      return NextResponse.json({ ok: false, error: "확인할 수 없는 문의입니다", code: "RESOLVE_WITH_MANUAL_BAD_TOKEN" }, { status: 403 });
    }

    // 매뉴얼 제목 등은 클라이언트 입력을 신뢰하지 않고 저장된 매뉴얼 원본에서 가져온다
    const manual = await getManual(manualId);
    if (!manual) {
      console.error("[POST /api/request/inquiry/resolve-with-manual] RESOLVE_WITH_MANUAL_MANUAL_NOT_FOUND", manualId);
      return NextResponse.json({ ok: false, error: "매뉴얼을 찾을 수 없습니다", code: "RESOLVE_WITH_MANUAL_MANUAL_NOT_FOUND" }, { status: 404 });
    }

    // 담당자를 거치지 않고 완료로 직행하는 경로다. 처리기가 이 시각으로 첫 응답·완료 시각을 찍는다 —
    // 안 찍으면 매뉴얼로 해결된 건만 소요 시간이 통째로 비어 평균이 왜곡된다.
    const ok = await insertEntity("helpdesk-resolve", crypto.randomUUID(), {
      ticketId,
      manualId: manual.id,
      manualTitle: manual.title,
      requestedAt: new Date().toISOString(),
    });
    if (!ok) {
      return NextResponse.json({ ok: false, error: "저장 실패(Postgres)", code: "RESOLVE_WITH_MANUAL_SAVE_FAILED" }, { status: 500 });
    }

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
