import { NextResponse } from "next/server";
import { fetchRentalRecords } from "@/lib/rental-hw";
import { isMirrorEnabled } from "@/lib/repo/mirror";

export const dynamic = "force-dynamic";

export async function GET() {
  // 4.0verMACBOOK: 메인 저장소는 맥북 Postgres(미러). 미러가 꺼져 있을 때만 Notion 필요.
  if (!isMirrorEnabled() && !process.env.NOTION_TOKEN) {
    return NextResponse.json({
      ok: false,
      missingEnv: "SUPABASE_KEY",
      error: "데이터 저장소(Postgres/Notion)가 설정되지 않았습니다.",
    }, { status: 503 });
  }

  try {
    const data = await fetchRentalRecords();
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
