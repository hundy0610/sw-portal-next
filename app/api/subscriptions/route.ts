import { NextResponse } from "next/server";
import { fetchSubscriptions } from "@/lib/notion";
import { memCached } from "@/lib/mem-cache";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data, cached } = await memCached("subscriptions:all", fetchSubscriptions, 300);
    return NextResponse.json(
      { data, lastSynced: new Date().toISOString(), cached },
      { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" } }
    );
  } catch (error) {
    console.error("[API /subscriptions]", error);
    return NextResponse.json(
      { data: [], lastSynced: new Date().toISOString(), error: error instanceof Error ? error.message : "알 수 없는 오류" },
      { status: 500 }
    );
  }
}
