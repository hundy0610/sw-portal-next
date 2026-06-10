import { NextRequest, NextResponse } from "next/server";
import { fetchRepairTickets, createRepairTicket } from "@/lib/notion";
import { getSessionFromCookieHeader } from "@/lib/session";
import type { RepairTicket } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  for (const v of ["NOTION_TOKEN", "NOTION_DB_REPAIR_TICKETS"]) {
    if (!process.env[v]) return NextResponse.json({ missingEnv: v, error: `환경변수 ${v} 가 설정되지 않았습니다.` }, { status: 503 });
  }
  const company = new URL(req.url).searchParams.get("company")?.trim() || "";
  try {
    const all = await fetchRepairTickets();
    const data = company ? all.filter((t: RepairTicket) => t.company === company) : all;
    return NextResponse.json({ data, lastSynced: new Date().toISOString() });
  } catch (error) {
    console.error("[API GET /repair-tickets]", error);
    return NextResponse.json(
      { data: [], lastSynced: new Date().toISOString(), error: error instanceof Error ? error.message : "알 수 없는 오류" },
      { status: 500 }
    );
  }
}

// POST /api/repair-tickets — 새 수리 접수 생성 (예: 모니터 수리 요청)
export async function POST(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, faultTypes, location, assetId, requester, priority } = body as {
    title?: string; faultTypes?: string[]; location?: string; assetId?: string; requester?: string; priority?: string;
  };

  if (!title) return NextResponse.json({ ok: false, error: "title 필수" }, { status: 400 });

  try {
    const id = await createRepairTicket({
      title,
      faultTypes: faultTypes?.length ? faultTypes : ["기타"],
      company: session.company || undefined,
      department: session.department,
      location,
      assetId,
      requester: requester || session.name,
      priority,
    });
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error("[API POST /repair-tickets]", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "알 수 없는 오류" }, { status: 500 });
  }
}
