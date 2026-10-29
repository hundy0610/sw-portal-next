import { NextResponse } from "next/server";
import { kvDel } from "@/lib/kv-store";
import { rejectWithoutSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const denied = rejectWithoutSession(req);
  if (denied) return denied;
  await kvDel("hw:all", "hw:stats", "hw:deltas");
  return NextResponse.json({ ok: true, clearedAt: new Date().toISOString() });
}
