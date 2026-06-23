import { NextResponse } from "next/server";
import { fetchMeetingRentalTickets } from "@/lib/meeting-rental";
import { memGet, memSet, memDel } from "@/lib/mem-cache";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!process.env.MEETING_RENTAL_DATA_SOURCE_ID) {
    return NextResponse.json({
      ok: false,
      missingEnv: "MEETING_RENTAL_DATA_SOURCE_ID",
      error: "환경변수 MEETING_RENTAL_DATA_SOURCE_ID 가 설정되지 않았습니다.",
    }, { status: 503 });
  }
  if (!process.env.NOTION_TOKEN) {
    return NextResponse.json({
      ok: false,
      missingEnv: "NOTION_TOKEN",
      error: "환경변수 NOTION_TOKEN 이 설정되지 않았습니다.",
    }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const refresh = searchParams.get("refresh") === "1";

  try {
    if (refresh) memDel("meeting-rental-tickets:all");

    let data = memGet<Awaited<ReturnType<typeof fetchMeetingRentalTickets>>>("meeting-rental-tickets:all");
    if (!data) {
      data = await fetchMeetingRentalTickets();
      memSet("meeting-rental-tickets:all", data, 300);
    }

    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
