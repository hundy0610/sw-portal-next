import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSetPermanent, kvDel } from "@/lib/kv-store";
import { errorMessage } from "@/lib/api-error";

const KV_KEY = "buildings:custom";

export interface FloorMeta    { id: string; label: string; note: string; }
export interface BuildingMeta { id: string; label: string; isCustom: true; floors: FloorMeta[]; }
export interface BuildingGroup {
  id:             string;
  label:          string;       // 그룹 이름 (예: "서울 캠퍼스")
  buildingIds:    string[];     // 포함된 건물 id 목록
  allowedUserIds: string[];     // 접근 허용 userId 목록 (비어있으면 슈퍼만 접근)
}
export interface BuildingsConfig {
  customBuildings: BuildingMeta[];
  extraFloors:     Record<string, FloorMeta[]>;
  floorOverrides:  Record<string, FloorMeta[]>;
  groups:          BuildingGroup[];
}

const EMPTY: BuildingsConfig = { customBuildings: [], extraFloors: {}, floorOverrides: {}, groups: [] };

// GET /api/buildings
export async function GET() {
  try {
    const cfg = (await kvGet<BuildingsConfig>(KV_KEY)) ?? EMPTY;
    if (!cfg.groups) cfg.groups = [];
    if (!cfg.floorOverrides) cfg.floorOverrides = {};
    return NextResponse.json({ ok: true, ...cfg });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

// POST /api/buildings — 전체 config 저장
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as BuildingsConfig;
    await kvSetPermanent(KV_KEY, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

// DELETE /api/buildings — 전체 초기화
export async function DELETE() {
  try {
    await kvDel(KV_KEY);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
