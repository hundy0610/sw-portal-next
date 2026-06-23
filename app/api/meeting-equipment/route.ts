import { NextResponse } from "next/server";
import { fetchMeetingEquipment } from "@/lib/meeting-equipment";
import { memGet, memSet, memDel } from "@/lib/mem-cache";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!process.env.NOTION_DB_MEETING_EQUIPMENT) {
    return NextResponse.json({
      ok: false,
      missingEnv: "NOTION_DB_MEETING_EQUIPMENT",
      error: "환경변수 NOTION_DB_MEETING_EQUIPMENT 가 설정되지 않았습니다.",
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
    if (refresh) memDel("meeting-equipment:all");

    let data = memGet<Awaited<ReturnType<typeof fetchMeetingEquipment>>>("meeting-equipment:all");
    if (!data) {
      data = await fetchMeetingEquipment();
      memSet("meeting-equipment:all", data, 300);
    }

    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
