import { NextRequest, NextResponse } from "next/server";
import { decodeSession } from "@/lib/session";
import { updateMonitorHistoryStatus } from "@/lib/notion";
import { kv } from "@vercel/kv";

function getSession(req: NextRequest) {
  const token = req.cookies.get("admin_session")?.value;
  if (!token) return null;
  return decodeSession(token);
}

async function getGeneralManagers(): Promise<string[]> {
  try {
    if (!process.env.KV_REST_API_URL) return [];
    const data = await kv.get<string[]>("sw:general-managers");
    return data ?? [];
  } catch {
    return [];
  }
}

// PATCH /api/monitor-history/[id]  — 상태 업데이트 (관리자 전용)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const managers = await getGeneralManagers();
  const isPrivileged = session.role === "super" || managers.includes(session.userId);
  if (!isPrivileged) return NextResponse.json({ ok: false, error: "권한 없음" }, { status: 403 });

  const { status } = await req.json();
  if (!["pending", "수리중", "in_progress", "done"].includes(status)) {
    return NextResponse.json({ ok: false, error: "유효하지 않은 상태값" }, { status: 400 });
  }

  try {
    await updateMonitorHistoryStatus(params.id, status);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
