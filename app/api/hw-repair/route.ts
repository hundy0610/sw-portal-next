import { NextResponse } from "next/server";
import { fetchHwRepairs } from "@/lib/notion";
import { isMirrorEnabled } from "@/lib/repo/mirror";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isMirrorEnabled() && !process.env.NOTION_TOKEN) {
    return NextResponse.json(
      { missingEnv: "SUPABASE_URL", error: "데이터 저장소가 설정되지 않았습니다." },
      { status: 503 }
    );
  }
  try {
    const data = await fetchHwRepairs();
    return NextResponse.json({ data, lastSynced: new Date().toISOString() });
  } catch (error) {
    console.error("[API GET /hw-repair]", error);
    return NextResponse.json(
      { data: [], lastSynced: new Date().toISOString(), error: error instanceof Error ? error.message : "알 수 없는 오류" },
      { status: 500 }
    );
  }
}
