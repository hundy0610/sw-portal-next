import { NextRequest, NextResponse } from "next/server";
import { fetchRepairTickets } from "@/lib/notion";
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
