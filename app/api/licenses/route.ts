import { NextRequest, NextResponse } from "next/server";
import { fetchLicenseRecords } from "@/lib/notion";
import { kvGet, kvSet } from "@/lib/kv-store";
import type { LicenseRecord } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const company = searchParams.get("company")?.trim() || "";

    // ✅ KV에서 즉시 읽기 (1~5ms)
    let data = await kvGet<LicenseRecord[]>("licenses:all");

    if (!data) {
      // KV 미스: Notion fetch 후 KV 저장
      data = await fetchLicenseRecords();
      await kvSet("licenses:all", data);
    }

    // 메모리 필터링
    if (company) {
      data = data.filter(r => r.company === company);
    }

    return NextResponse.json({
      data,
      lastSynced: new Date().toISOString(),
    }, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" },
    });
  } catch (error) {
    console.error("[API /licenses]", error);
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
