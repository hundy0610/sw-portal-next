import { NextResponse } from "next/server";
import { fetchHelpDeskTickets, getCachedHelpdeskTicketsRaw } from "@/lib/notion";
import { kvSet } from "@/lib/kv-store";
import type { HelpDeskTicket } from "@/lib/notion";
import { getSessionFromCookieHeader, companyScope } from "@/lib/session";

export const dynamic = "force-dynamic";

const CACHE_KEY = "helpdesk:tickets";
const CACHE_TTL = 300; // 5분

export async function GET(req: Request) {
  for (const v of ["NOTION_TOKEN", "NOTION_DB_HELPDESK"]) {
    if (!process.env[v]) return NextResponse.json({ missingEnv: v, error: `환경변수 ${v} 가 설정되지 않았습니다.` }, { status: 503 });
  }
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const scope = companyScope(session);

  const { searchParams } = new URL(req.url);
  const refresh = searchParams.get("refresh") === "1";
  const company = scope ?? (searchParams.get("company")?.trim() || "");

  const applyFilter = (data: HelpDeskTicket[]) =>
    company ? data.filter(t => t.company === company) : data;

  try {
    if (!refresh) {
      const cached = await getCachedHelpdeskTicketsRaw();
      if (cached) return NextResponse.json({ ...cached, data: applyFilter(cached.data), cached: true });
    }

    const data = await fetchHelpDeskTickets();
    await kvSet(CACHE_KEY, { data, lastSynced: new Date().toISOString() }, CACHE_TTL);
    return NextResponse.json({ data: applyFilter(data), lastSynced: new Date().toISOString(), cached: false });
  } catch (error) {
    console.error("[API GET /helpdesk]", error);
    return NextResponse.json(
      { data: [], error: error instanceof Error ? error.message : "오류 발생" },
      { status: 500 }
    );
  }
}
