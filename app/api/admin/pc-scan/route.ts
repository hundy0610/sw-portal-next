import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookieHeader } from "@/lib/session";
import { fetchPcScans, matchPcScansWithHw } from "@/lib/pc-scan";
import { type HwRecord } from "@/lib/hw";
import { kvGet } from "@/lib/kv-store";
import { triggerWarmHw } from "@/lib/trigger-warm-hw";
import { errorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session || session.role !== "super") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [scans, hwAll] = await Promise.all([
      fetchPcScans(),
      kvGet<HwRecord[]>("hw:all"),
    ]);

    if (!hwAll) triggerWarmHw().catch(console.warn);

    const data = matchPcScansWithHw(scans, hwAll ?? []);
    return NextResponse.json({ ok: true, data, masterCacheWarming: !hwAll });
  } catch (e) {
    console.error("[GET /api/admin/pc-scan]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
