import { NextResponse } from "next/server";
import { kvDel } from "@/lib/kv-store";

export const dynamic = "force-dynamic";

export async function POST() {
  await kvDel("hw:all", "hw:stats", "hw:deltas");
  return NextResponse.json({ ok: true, clearedAt: new Date().toISOString() });
}
