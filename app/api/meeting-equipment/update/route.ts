import { NextResponse } from "next/server";
import { updateMeetingEquipment } from "@/lib/meeting-equipment";
import { memDel } from "@/lib/mem-cache";
import { rejectWithoutSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const denied = rejectWithoutSession(req);
  if (denied) return denied;
  try {
    const { id, fields } = await req.json();
    if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
    await updateMeetingEquipment(id, fields);
    memDel("meeting-equipment:all");
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
