import { NextResponse } from "next/server";
import { memDel } from "@/lib/mem-cache";
import { kvDel } from "@/lib/kv-store";

export const dynamic = "force-dynamic";

export async function POST() {
  memDel("hw:all", "hw:stats");
  await kvDel("hw:all", "hw:stats");
  return NextResponse.json({ ok: true, clearedAt: new Date().toISOString() });
}
