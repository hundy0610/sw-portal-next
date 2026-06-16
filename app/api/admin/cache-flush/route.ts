import { NextResponse } from "next/server";
import { memDel } from "@/lib/mem-cache";
import { kvDel } from "@/lib/kv-store";

export async function POST() {
  memDel("sw:all");
  await kvDel("sw:all");
  return NextResponse.json({ ok: true, flushed: ["sw:all"] });
}
