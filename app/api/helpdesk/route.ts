import { NextResponse } from "next/server";
import { fetchHelpDeskTickets } from "@/lib/notion";
import { kvGet, kvSet } from "@/lib/kv-store";
import type { HelpDeskTicket } from "@/lib/notion";

export const dynamic = "force-dynamic";

const CACHE_KEY = "helpdesk:tickets";
const CACHE_TTL = 300; // 5분

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const refresh = searchParams.get("refresh") === "1";

  try {
    if (!refresh) {
      const cached = await kvGet<{ data: HelpDeskTicket[]; lastSynced: string }>(CACHE_KEY);
      if (cached) return NextResponse.json({ ...cached, cached: true });
    }

    const data = await fetchHelpDeskTickets();
    const result = { data, lastSynced: new Date().toISOString(), cached: false };
    await kvSet(CACHE_KEY, { data, lastSynced: result.lastSynced }, CACHE_TTL);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[API GET /helpdesk]", error);
    return NextResponse.json(
      { data: [], error: error instanceof Error ? error.message : "오류 발생" },
      { status: 500 }
    );
  }
}
