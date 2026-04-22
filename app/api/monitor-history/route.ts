import { NextRequest, NextResponse } from "next/server";
import { decodeSession } from "@/lib/session";
import {
  fetchMonitorHistory,
  createMonitorHistory,
} from "@/lib/notion";

function getSession(req: NextRequest) {
  const token = req.cookies.get("admin_session")?.value;
  if (!token) return null;
  return decodeSession(token);
}

// GET /api/monitor-history?itemId=&building=&floor=
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const itemId   = searchParams.get("itemId")   ?? undefined;
  const building = searchParams.get("building") ?? undefined;
  const floor    = searchParams.get("floor")    ?? undefined;

  try {
    const entries = await fetchMonitorHistory({ itemId, building, floor, limit: 50 });
    return NextResponse.json({ ok: true, entries });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// POST /api/monitor-history
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { itemId, label, building, floor, eventType, from, to, description } = body;

  if (!itemId || !building || !floor || !eventType) {
    return NextResponse.json({ ok: false, error: "필수 항목 누락" }, { status: 400 });
  }

  try {
    const pageId = await createMonitorHistory({
      itemId,
      label: label ?? "",
      building,
      floor,
      eventType,
      from:        from ?? "",
      to:          to ?? "",
      description: description ?? "",
      createdBy:   session.name ?? session.userId,
    });
    return NextResponse.json({ ok: true, id: pageId });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
