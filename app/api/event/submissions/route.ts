import { NextResponse } from "next/server";
import { fetchEventSubmissions } from "@/lib/notion";
import { getEventConfig } from "@/lib/event-config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const cfg = await getEventConfig();
    const data = await fetchEventSubmissions(cfg.roundStartedAt);
    return NextResponse.json({ data });
  } catch (e) {
    console.error("[event/submissions]", e);
    return NextResponse.json({ data: [] }, { status: 500 });
  }
}
