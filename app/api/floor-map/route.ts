import { NextRequest, NextResponse } from "next/server";
import { fetchFloorMap, saveFloorMap } from "@/lib/notion";
import { errorMessage } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const building = searchParams.get("building");
  const floor    = searchParams.get("floor");
  if (!building || !floor)
    return NextResponse.json({ error: "building, floor 파라미터가 필요합니다." }, { status: 400 });

  try {
    const data = await fetchFloorMap(building, floor);
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { building, floor, data } = body;
    if (!building || !floor || !data)
      return NextResponse.json({ error: "building, floor, data가 필요합니다." }, { status: 400 });

    const result = await saveFloorMap(building, floor, data);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
