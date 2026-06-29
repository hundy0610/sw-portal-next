import { NextRequest, NextResponse } from "next/server";
import { decodeSession, resolveCurrentName } from "@/lib/session";
import { fetchMonitorHistory, createMonitorHistory } from "@/lib/notion";

function getSession(req: NextRequest) {
  const token = req.cookies.get("admin_session")?.value;
  if (!token) return null;
  return decodeSession(token);
}

// GET /api/monitor-history?itemId=...&building=...&floor=... — 이력 조회
export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const entries = await fetchMonitorHistory({
    itemId:   searchParams.get("itemId")   ?? undefined,
    building: searchParams.get("building") ?? undefined,
    floor:    searchParams.get("floor")    ?? undefined,
  });

  return NextResponse.json({ ok: true, entries });
}

// POST /api/monitor-history — 이력/수리요청 등록
export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { itemId, label, building, floor, eventType, from, to, description } = body;

  if (!itemId || !building || !floor || !eventType) {
    return NextResponse.json({ ok: false, error: "필수 항목 누락" }, { status: 400 });
  }

  const id = await createMonitorHistory({
    itemId, label, building, floor, eventType, from, to, description,
    createdBy: await resolveCurrentName(session),
  });

  return NextResponse.json({ ok: true, id });
}
