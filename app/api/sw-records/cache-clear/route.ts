import { NextResponse } from "next/server";
import { memDel } from "@/lib/mem-cache";
import { kvDel } from "@/lib/kv-store";
import { rejectWithoutSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const denied = rejectWithoutSession(req);
  if (denied) return denied;
  memDel("sw:all");
  await kvDel("sw:all");
  return NextResponse.json({ ok: true, clearedAt: new Date().toISOString() });
}
