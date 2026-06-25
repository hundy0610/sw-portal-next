import { NextResponse } from "next/server";
import { updateMeetingRentalTicket } from "@/lib/meeting-rental";
import { memDel } from "@/lib/mem-cache";
import { resolveAuditActor } from "@/lib/session";
import { appendAdminAuditLog } from "@/lib/portal-store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { id, fields } = await req.json();
    if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
    await updateMeetingRentalTicket(id, fields);
    memDel("meeting-rental-tickets:all");
    const { adminId, adminName } = await resolveAuditActor(req.headers.get("cookie"));
    await appendAdminAuditLog({
      adminId, adminName, action: "update", target: "meetingRental",
      itemTitle: id, detail: fields?.status, timestamp: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
