import { NextResponse } from "next/server";
import { updateMeetingEquipment } from "@/lib/meeting-equipment";
import { memDel } from "@/lib/mem-cache";
import { resolveAuditActor } from "@/lib/session";
import { appendAdminAuditLog } from "@/lib/portal-store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { id, fields } = await req.json();
    if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
    await updateMeetingEquipment(id, fields);
    memDel("meeting-equipment:all");
    const { adminId, adminName } = await resolveAuditActor(req.headers.get("cookie"));
    await appendAdminAuditLog({
      adminId, adminName, action: "update", target: "meetingEquipment",
      itemTitle: fields?.name ?? id, timestamp: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
