import { NextRequest, NextResponse } from "next/server";
import { getAuditLogs } from "@/lib/portal-store";
import { getSessionFromCookieHeader } from "@/lib/session";

export async function GET(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session || session.role !== "super") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "100");
  const logs = await getAuditLogs(limit);
  return NextResponse.json({ data: logs });
}
