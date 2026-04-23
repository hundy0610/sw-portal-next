import { NextResponse } from "next/server";
import { fetchHelpDeskTickets } from "@/lib/notion";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await fetchHelpDeskTickets();
    return NextResponse.json({ data, lastSynced: new Date().toISOString() });
  } catch (error) {
    console.error("[API GET /helpdesk]", error);
    return NextResponse.json(
      { data: [], error: error instanceof Error ? error.message : "오류 발생" },
      { status: 500 }
    );
  }
}
