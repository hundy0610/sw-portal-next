import { NextResponse } from "next/server";
import { fetchHelpDeskTickets } from "@/lib/notion";
import { isMirrorEnabled } from "@/lib/repo/mirror";
import type { HelpDeskTicket } from "@/lib/notion";
import { getSessionFromCookieHeader, companyScope } from "@/lib/session";

export const dynamic = "force-dynamic";

// 4.0verMACBOOK: 맥북 Postgres 미러가 메인. 캐시 없이 매 요청 직접 조회해 즉시 반영.
export async function GET(req: Request) {
  if (!isMirrorEnabled() && !process.env.NOTION_TOKEN) {
    return NextResponse.json({ missingEnv: "SUPABASE_URL", error: "데이터 저장소가 설정되지 않았습니다." }, { status: 503 });
  }
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const scope = companyScope(session);

  const { searchParams } = new URL(req.url);
  const company = scope ?? (searchParams.get("company")?.trim() || "");

  const applyFilter = (data: HelpDeskTicket[]) =>
    company ? data.filter(t => t.company === company) : data;

  try {
    const data = await fetchHelpDeskTickets();
    return NextResponse.json({ data: applyFilter(data), lastSynced: new Date().toISOString(), cached: false });
  } catch (error) {
    console.error("[API GET /helpdesk]", error);
    return NextResponse.json(
      { data: [], error: error instanceof Error ? error.message : "오류 발생" },
      { status: 500 }
    );
  }
}
