import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet, kvDel } from "@/lib/kv-store";

const KV_KEY = "buildings:custom";

export interface FloorMeta  { id: string; label: string; note: string; }
export interface BuildingMeta { id: string; label: string; isCustom: true; floors: FloorMeta[]; }
export interface BuildingsConfig {
  customBuildings: BuildingMeta[];
  extraFloors: Record<string, FloorMeta[]>; // 기존 건물(bw/ns/sb)에 추가된 층
}

const EMPTY: BuildingsConfig = { customBuildings: [], extraFloors: {} };

// GET /api/buildings
export async function GET() {
  try {
    const cfg = (await kvGet<BuildingsConfig>(KV_KEY)) ?? EMPTY;
    return NextResponse.json({ ok: true, ...cfg });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// POST /api/buildings  — 전체 config 저장
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as BuildingsConfig;
    await kvSet(KV_KEY, body, 0); // TTL 0 = 영구
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// DELETE /api/buildings  — 전체 초기화
export async function DELETE() {
  try {
    await kvDel(KV_KEY);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
