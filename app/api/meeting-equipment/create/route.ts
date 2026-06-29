import { NextResponse } from "next/server";
import { createMeetingEquipment } from "@/lib/meeting-equipment";
import { memDel } from "@/lib/mem-cache";
import { resolveAuditActor } from "@/lib/session";
import { appendAdminAuditLog } from "@/lib/portal-store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const record = await createMeetingEquipment(body);
    memDel("meeting-equipment:all");
    const { adminId, adminName } = await resolveAuditActor(req.headers.get("cookie"));
    await appendAdminAuditLog({
      adminId, adminName, action: "create", target: "meetingEquipment",
      itemTitle: body.name ?? record.id, timestamp: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, data: record });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
