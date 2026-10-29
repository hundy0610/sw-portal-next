import { NextResponse } from "next/server";
import { createMeetingEquipment } from "@/lib/meeting-equipment";
import { memDel } from "@/lib/mem-cache";
import { rejectWithoutSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const denied = rejectWithoutSession(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const record = await createMeetingEquipment(body);
    memDel("meeting-equipment:all");
    return NextResponse.json({ ok: true, data: record });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
