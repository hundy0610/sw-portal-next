import { NextResponse } from "next/server";
import { fetchRepairTickets } from "@/lib/notion";

export const revalidate = 30;

export async function GET() {
  for (const v of ["NOTION_TOKEN", "NOTION_DB_REPAIR_TICKETS"]) {
    if (!process.env[v]) return NextResponse.json({ missingEnv: v, error: `환경변수 ${v} 가 설정되지 않았습니다.` }, { status: 503 });
  }
  try {
    const data = await fetchRepairTickets();
    return NextResponse.json({
      data,
      lastSynced: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[API GET /repair-tickets]", error);
    return NextResponse.json(
      {
        data: [],
        lastSynced: new Date().toISOString(),
        error: error instanceof Error ? error.message : "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}
