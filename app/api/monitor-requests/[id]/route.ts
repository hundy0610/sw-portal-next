import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { getSession } from "@/lib/session";
import type { MonitorRequest } from "../route";

const REQUESTS_KEY = "sw:monitor-requests";

async function getRequests(): Promise<MonitorRequest[]> {
  try {
    if (!process.env.KV_REST_API_URL) return [];
    const data = await kv.get<MonitorRequest[]>(REQUESTS_KEY);
    return data ?? [];
  } catch {
    return [];
  }
}

async function saveRequests(requests: MonitorRequest[]): Promise<void> {
  if (!process.env.KV_REST_API_URL) return;
  await kv.set(REQUESTS_KEY, requests);
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

// PATCH /api/monitor-requests/[id] — 상태 변경 (처리중 / 완료)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  // 총무 관리자 or 슈퍼어드민만 상태 변경 가능
  const managers = await getGeneralManagers();
  const isPrivileged = session.role === "super" || managers.includes(session.userId);
  if (!isPrivileged) {
    return NextResponse.json({ ok: false, error: "권한 없음" }, { status: 403 });
  }

  const body = await req.json();
  const { status } = body as { status: MonitorRequest["status"] };

  if (!["pending", "in_progress", "done"].includes(status)) {
    return NextResponse.json({ ok: false, error: "잘못된 상태값" }, { status: 400 });
  }

  const requests = await getRequests();
  const idx = requests.findIndex(r => r.id === params.id);
  if (idx === -1) {
    return NextResponse.json({ ok: false, error: "요청 없음" }, { status: 404 });
  }

  requests[idx] = {
    ...requests[idx],
    status,
    updatedAt: new Date().toISOString(),
  };
  await saveRequests(requests);

  return NextResponse.json({ ok: true, request: requests[idx] });
}

// DELETE /api/monitor-requests/[id] — 완료된 요청 삭제 (슈퍼어드민만)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession(req);
  if (!session || session.role !== "super") {
    return NextResponse.json({ ok: false, error: "권한 없음" }, { status: 403 });
  }

  const requests = await getRequests();
  const filtered = requests.filter(r => r.id !== params.id);
  await saveRequests(filtered);

  return NextResponse.json({ ok: true });
}
