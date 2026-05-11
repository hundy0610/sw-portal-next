import { NextRequest, NextResponse } from "next/server";
import { fetchSwDatabase } from "@/lib/notion";
import { kvGet, kvSetPermanent } from "@/lib/kv-store";
import { memGet, memSet } from "@/lib/mem-cache";
import type { SwDbRecord } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  for (const v of ["NOTION_TOKEN", "NOTION_DB_SW_UNIFIED"]) {
    if (!process.env[v]) return NextResponse.json({ missingEnv: v, error: `환경변수 ${v} 가 설정되지 않았습니다.` }, { status: 503 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const filterCompany = searchParams.get("company")?.trim() || "";

    // 1. 인메모리 캐시 (0ms)
    let data = memGet<SwDbRecord[]>("sw:all");

    if (!data) {
      // 2. KV 캐시 (1~5ms, KV 미설정 시 null 반환)
      data = await kvGet<SwDbRecord[]>("sw:all");

      if (!data) {
        // 3. Notion 직접 조회
        data = await fetchSwDatabase();
        await kvSetPermanent("sw:all", data);
      }

      memSet("sw:all", data, 300);
    }

    const result = filterCompany
      ? data.filter(r => r.company === filterCompany)
      : data;

    return NextResponse.json({
      data: result,
      lastSynced: new Date().toISOString(),
    }, {
      headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" },
    });
  } catch (e: any) {
    console.error("[sw-records] fetch error:", e?.message);
    return NextResponse.json(
      { data: [], error: e?.message, lastSynced: new Date().toISOString() },
      { status: 500 }
    );
  }
}
