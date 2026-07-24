import { NextResponse } from "next/server";
import { fetchMeetingEquipment, isMirrorEnabled } from "@/lib/meeting-equipment";

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
    // 미러(Postgres)에서 매 요청 조회 → 쓰기 즉시 반영. (레코드 수가 적어 부담 없음)
    const data = await fetchMeetingEquipment();
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
