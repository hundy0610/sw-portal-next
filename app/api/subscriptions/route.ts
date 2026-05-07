import { NextResponse } from "next/server";
import { fetchSubscriptions } from "@/lib/notion";
import { memCached } from "@/lib/mem-cache";

export const dynamic = "force-dynamic";

export async function GET() {
  for (const v of ["NOTION_TOKEN", "NOTION_DB_SUBSCRIPTIONS"]) {
    if (!process.env[v]) return NextResponse.json({ missingEnv: v, error: `환경변수 ${v} 가 설정되지 않았습니다.` }, { status: 503 });
  }
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
