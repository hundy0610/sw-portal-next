import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookieHeader } from "@/lib/session";
import { getBugStages, saveBugStages } from "@/lib/portal-store";
import type { BugStage } from "@/types/bug-report";

export async function GET(req: NextRequest) {
  const s = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stages = await getBugStages();
  return NextResponse.json({ data: stages });
}

export async function POST(req: NextRequest) {
  const s = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const stages = body.stages as BugStage[];
  if (!Array.isArray(stages)) {
    return NextResponse.json({ error: "stages array required" }, { status: 400 });
  }

  await saveBugStages(stages);
  return NextResponse.json({ ok: true });
}
