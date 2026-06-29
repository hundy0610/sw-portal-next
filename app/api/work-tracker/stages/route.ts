import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookieHeader } from "@/lib/session";
import { getWorkStages, saveWorkStages } from "@/lib/portal-store";
import type { WorkStage } from "@/types/work-tracker";

function getSuperSession(req: NextRequest) {
  const s = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!s || s.role !== "super") return null;
  return s;
}

export async function GET(req: NextRequest) {
  const s = getSuperSession(req);
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stages = await getWorkStages();
  return NextResponse.json({ data: stages });
}

export async function POST(req: NextRequest) {
  const s = getSuperSession(req);
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const stages = body.stages as WorkStage[];
  if (!Array.isArray(stages)) {
    return NextResponse.json({ error: "stages array required" }, { status: 400 });
  }

  await saveWorkStages(stages);
  return NextResponse.json({ ok: true });
}
