import { NextRequest, NextResponse } from "next/server";
import { fetchSwDatabase } from "@/lib/notion";
import { kvGet, kvSet } from "@/lib/kv-store";
import type { SwDbRecord } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filterCompany = searchParams.get("company")?.trim() || "";

    // ✅ KV에서 즉시 읽기 (1~5ms)
    let data = await kvGet<SwDbRecord[]>("sw:all");

    if (!data) {
      // KV 미스: Notion fetch 후 KV 저장
      data = await fetchSwDatabase();
      await kvSet("sw:all", data);
    }

    // 메모리 필터링
    if (filterCompany) {
      data = data.filter(r => r.company === filterCompany);
    }

    return NextResponse.json({
      data,
      lastSynced: new Date().toISOString(),
    }, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" },
    });
  } catch (e: any) {
    console.error("[sw-records] fetch error:", e?.message);
    return NextResponse.json(
      { data: [], error: e?.message, lastSynced: new Date().toISOString() },
      { status: 500 }
    );
  }
}
