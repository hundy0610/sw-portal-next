import { NextRequest, NextResponse } from "next/server";
import { decodeSession } from "@/lib/session";
import { updateMonitorAsset } from "@/lib/notion";

function getSession(req: NextRequest) {
  const token = req.cookies.get("admin_session")?.value;
  if (!token) return null;
  return decodeSession(token);
}

// PATCH /api/monitor-assets/[id] — 자산 정보 수정
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, assetNo, building, floor, model, status, corp, purchaseDate, note } = body;

  await updateMonitorAsset(params.id, { title, assetNo, building, floor, model, status, corp, purchaseDate, note });

  return NextResponse.json({ ok: true });
}
