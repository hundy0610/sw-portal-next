import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookieHeader, resolveCurrentRole } from "@/lib/session";
import { getAssetAuditConfig, setAssetAuditConfig, type AssetAuditConfig } from "@/lib/asset-audit-config";

export const dynamic = "force-dynamic";

async function isSuper(req: NextRequest): Promise<boolean> {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session) return false;
  return (await resolveCurrentRole(session)) === "super";
}

export async function GET() {
  const cfg = await getAssetAuditConfig();
  return NextResponse.json(cfg);
}

export async function POST(req: NextRequest) {
  if (!(await isSuper(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const body = await req.json();
  const patch: Partial<AssetAuditConfig> = body;
  const next = await setAssetAuditConfig(patch);
  return NextResponse.json({ ok: true, config: next });
}
