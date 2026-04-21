import { NextResponse } from "next/server";
import { fetchSwDb } from "@/lib/notion";
import { kvGet, kvSet } from "@/lib/kv-store";
import type { SwItem } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    // KV 캐시 우선 (1~5ms)
    let data = await kvGet<SwItem[]>("sw:db");
    if (!data) {
      data = await fetchSwDb();
      await kvSet("sw:db", data);
    }
    return NextResponse.json({
      data,
      lastSynced: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[API /sw-db]", error);
    return NextResponse.json(
      {
        data: [],
        lastSynced: new Date().toISOString(),
        error: error instanceof Error ? error.message : "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}
