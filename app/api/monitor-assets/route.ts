import { NextRequest, NextResponse } from "next/server";
import { decodeSession } from "@/lib/session";
import { fetchMonitorAssets, createMonitorAsset } from "@/lib/notion";

function getSession(req: NextRequest) {
  const token = req.cookies.get("admin_session")?.value;
  if (!token) return null;
  return decodeSession(token);
}

// GET /api/monitor-assets?itemId=...&building=...&floor=... — 자산 정보 조회
export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const assets = await fetchMonitorAssets({
    itemId:   searchParams.get("itemId")   ?? undefined,
    building: searchParams.get("building") ?? undefined,
    floor:    searchParams.get("floor")    ?? undefined,
  });

  return NextResponse.json({ ok: true, assets });
}

// POST /api/monitor-assets — 자산 정보 등록
export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { itemId, title, building, floor, model, status, assetNo, corp, purchaseDate, note } = body;

  if (!itemId || !title || !building || !floor) {
    return NextResponse.json({ ok: false, error: "필수 항목 누락" }, { status: 400 });
  }

  const id = await createMonitorAsset({
    itemId, title, building, floor, model, status, assetNo, corp, purchaseDate, note,
  });

  return NextResponse.json({ ok: true, id });
}
