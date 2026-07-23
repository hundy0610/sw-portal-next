import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookieHeader, resolveCurrentRole } from "@/lib/session";
import { getWorkStages, saveWorkStages } from "@/lib/portal-store";
import type { WorkStage } from "@/types/work-tracker";

async function getSuperSession(req: NextRequest) {
  const s = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!s || (await resolveCurrentRole(s)) !== "super") return null;
  return s;
}

export async function GET(req: NextRequest) {
  const s = await getSuperSession(req);
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stages = await getWorkStages();
  return NextResponse.json({ data: stages });
}

export async function POST(req: NextRequest) {
  const s = await getSuperSession(req);
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const stages = body.stages as WorkStage[];
  if (!Array.isArray(stages)) {
    return NextResponse.json({ error: "stages array required" }, { status: 400 });
  }

  if (!(await saveWorkStages(stages))) {
    return NextResponse.json({ error: "저장에 실패했습니다. 잠시 후 다시 시도해주세요.", code: "WORK_STAGES_SAVE_FAILED" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
