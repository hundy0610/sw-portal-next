import { NextResponse } from "next/server";
import { fetchMeetingRentalTickets } from "@/lib/meeting-rental";
import { isMirrorEnabled } from "@/lib/repo/mirror";

export const dynamic = "force-dynamic";

// 4.0verMACBOOK: 맥북 Postgres 미러가 메인. 캐시 없이 즉시 일관성.
export async function GET() {
  if (!isMirrorEnabled() && !process.env.NOTION_TOKEN) {
    return NextResponse.json({
      ok: false,
      missingEnv: "SUPABASE_URL",
      error: "데이터 저장소가 설정되지 않았습니다.",
    }, { status: 503 });
  }

  try {
    const data = await fetchMeetingRentalTickets();
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
