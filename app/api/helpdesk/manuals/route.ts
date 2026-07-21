import { NextRequest, NextResponse } from "next/server";
import { listManuals, saveManual, deleteManual } from "@/lib/helpdesk-manuals";
import { extractPerTicketKeywordSets } from "@/lib/helpdesk-manual-match";
import { fetchHelpDeskTickets, getCachedHelpdeskTicketsRaw, type HelpDeskTicket } from "@/lib/notion";

export const dynamic = "force-dynamic";

// 관리자 목록 화면(/api/helpdesk)과 같은 캐시를 재사용 — 없으면 Notion에서 직접(회사 범위 제한 없이) 가져옴.
// 매뉴얼에 연결된 티켓은 관리자 세션의 회사 범위와 무관하게 항상 전체 데이터 기준으로 계산해야 하므로,
// 브라우저에 이미 로드된 티켓 목록(회사 범위로 필터링됐거나 아직 로딩 전일 수 있음)에 의존하지 않는다.
async function resolveAllTickets(): Promise<HelpDeskTicket[]> {
  const cached = await getCachedHelpdeskTicketsRaw();
  if (cached) return cached.data;
  return fetchHelpDeskTickets();
}

export async function GET(req: NextRequest) {
  try {
    const debugKey = req.nextUrl.searchParams.get("_debugMgetKey");
    if (debugKey) {
      const { kvGet, kvMGet } = await import("@/lib/kv-store");
      const single = await kvGet(debugKey);
      let mgetResult: unknown, mgetError: string | null = null;
      try {
        mgetResult = await kvMGet([debugKey]);
      } catch (e) {
        mgetError = e instanceof Error ? e.message : String(e);
      }
      return NextResponse.json({ single: single ? "present" : null, mgetResult, mgetError });
    }
    const manuals = await listManuals();
    return NextResponse.json({ ok: true, manuals });
  } catch (e) {
    console.error("[API /helpdesk/manuals GET] MANUAL_LIST_FAILED", e);
    return NextResponse.json({ ok: false, error: "서버 오류", code: "MANUAL_LIST_FAILED" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { id, title, contentType, body, linkedTicketIds, updatedBy } = await req.json() as {
      id?: string; title?: string; contentType?: "html" | "url"; body?: string;
      linkedTicketIds?: string[]; updatedBy?: string;
    };
    if (!title || !body || (contentType !== "html" && contentType !== "url")) {
      return NextResponse.json({ ok: false, error: "title, body, contentType 필수", code: "MANUAL_SAVE_INVALID_INPUT" }, { status: 400 });
    }
    if (contentType === "url" && !/^https?:\/\//.test(body)) {
      return NextResponse.json({ ok: false, error: "올바른 URL이 아닙니다 (http:// 또는 https://로 시작해야 함)", code: "MANUAL_SAVE_INVALID_URL" }, { status: 400 });
    }
    const cleanIds = Array.isArray(linkedTicketIds) ? linkedTicketIds.filter(k => typeof k === "string") : [];

    // 매칭 키워드는 클라이언트가 보낸 값을 신뢰하지 않고, 서버가 Notion 원본 데이터를 기준으로 직접 계산한다
    let matchKeywords: string[][] = [];
    if (cleanIds.length > 0) {
      try {
        const allTickets = await resolveAllTickets();
        const linkedTickets = allTickets.filter(t => cleanIds.includes(t.id));
        matchKeywords = extractPerTicketKeywordSets(linkedTickets);
      } catch (e) {
        console.error("[API /helpdesk/manuals POST] MANUAL_SAVE_KEYWORD_COMPUTE_FAILED", e);
        return NextResponse.json({ ok: false, error: "연결된 이력을 불러오지 못해 저장에 실패했습니다", code: "MANUAL_SAVE_KEYWORD_COMPUTE_FAILED" }, { status: 500 });
      }
    }

    const manual = await saveManual({ id, title, contentType, body, linkedTicketIds: cleanIds, matchKeywords, updatedBy: updatedBy || "" });
    return NextResponse.json({ ok: true, manual });
  } catch (e) {
    console.error("[API /helpdesk/manuals POST] MANUAL_SAVE_FAILED", e);
    return NextResponse.json({ ok: false, error: "서버 오류", code: "MANUAL_SAVE_FAILED" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json() as { id?: string };
    if (!id) return NextResponse.json({ ok: false, error: "id 필수", code: "MANUAL_DELETE_INVALID_INPUT" }, { status: 400 });
    await deleteManual(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[API /helpdesk/manuals DELETE] MANUAL_DELETE_FAILED", e);
    return NextResponse.json({ ok: false, error: "서버 오류", code: "MANUAL_DELETE_FAILED" }, { status: 500 });
  }
}
