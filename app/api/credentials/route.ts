import { NextResponse } from "next/server";
import { fetchCredentialsPage } from "@/lib/notion";

// ── 간단 캐시 ──────────────────────────────────────────────────────────
let cache: { data: unknown; ts: number } | null = null;
const TTL = (Number(process.env.CACHE_TTL) || 60) * 1000;

export async function GET() {
  try {
    const now = Date.now();
    if (cache && now - cache.ts < TTL) {
      return NextResponse.json({ data: cache.data, cached: true });
    }
    const data = await fetchCredentialsPage();
    cache = { data, ts: now };
    return NextResponse.json({ data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ data: [], error: message }, { status: 500 });
  }
}
