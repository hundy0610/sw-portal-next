import { NextRequest, NextResponse } from "next/server";
import { fetchLicenseRecords } from "@/lib/notion";
import { kvGet, kvSet } from "@/lib/kv-store";
import { memGet, memSet } from "@/lib/mem-cache";
import type { LicenseRecord } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const company = searchParams.get("company")?.trim() || "";

    // 1. 인메모리 캐시 (0ms)
    let data = memGet<LicenseRecord[]>("licenses:all");

    if (!data) {
      // 2. KV 캐시 (1~5ms, KV 미설정 시 null 반환)
      data = await kvGet<LicenseRecord[]>("licenses:all");

      if (!data) {
        // 3. Notion 직접 조회 (13개 DB 병렬)
        data = await fetchLicenseRecords();
        await kvSet("licenses:all", data);
      }

      memSet("licenses:all", data, 300);
    }

    const result = company ? data.filter(r => r.company === company) : data;

    return NextResponse.json({
      data: result,
      lastSynced: new Date().toISOString(),
    }, {
      headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" },
    });
  } catch (error) {
    console.error("[API /licenses]", error);
    return NextResponse.json(
      { data: [], lastSynced: new Date().toISOString(), error: error instanceof Error ? error.message : "알 수 없는 오류" },
      { status: 500 }
    );
  }
}
