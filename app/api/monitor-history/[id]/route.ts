import { NextRequest, NextResponse } from "next/server";
import { decodeSession } from "@/lib/session";
import { updateMonitorHistoryStatus } from "@/lib/notion";

function getSession(req: NextRequest) {
  const token = req.cookies.get("admin_session")?.value;
  if (!token) return null;
  return decodeSession(token);
}

// PATCH /api/monitor-history/[id] — 이력 상태 변경
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { status } = body as { status: "pending" | "수리중" | "in_progress" | "done" };

  if (!["pending", "수리중", "in_progress", "done"].includes(status)) {
    return NextResponse.json({ ok: false, error: "잘못된 상태값" }, { status: 400 });
  }

  await updateMonitorHistoryStatus(params.id, status);

  return NextResponse.json({ ok: true });
}
