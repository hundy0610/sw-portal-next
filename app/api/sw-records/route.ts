import { NextRequest, NextResponse } from "next/server";
import { fetchSwDatabase } from "@/lib/notion";
import { kvGet, kvSetPermanent } from "@/lib/kv-store";
import { memGet, memSet, memDel } from "@/lib/mem-cache";
import { compactSwRecords } from "@/lib/sw-compact";
import type { SwDbRecord } from "@/types";
import { getSessionFromCookieHeader, companyScope } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  for (const v of ["NOTION_TOKEN", "NOTION_DB_SW_UNIFIED"]) {
    if (!process.env[v]) return NextResponse.json({ missingEnv: v, error: `환경변수 ${v} 가 설정되지 않았습니다.` }, { status: 503 });
  }
  const session = getSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const scope = companyScope(session);

  try {
    const { searchParams } = new URL(request.url);
    const filterCompany = scope ?? (searchParams.get("company")?.trim() || "");

    // 1. 인메모리 캐시 (0ms) — 현재 인스턴스에서 10분간 유효
    let data = memGet<SwDbRecord[]>("sw:all");

    if (!data) {
      // 2. KV 캐시 — compact 저장으로 1MB 이하 유지
      const compact = await kvGet<Partial<SwDbRecord>[]>("sw:all");
      data = compact as SwDbRecord[] | null;

      if (!data) {
        // 3. Notion 직접 조회 (KV miss 또는 첫 로드)
        data = await fetchSwDatabase();
        // compact 저장으로 KV 용량 한도 내 유지
        await kvSetPermanent("sw:all", compactSwRecords(data));
      }

      memSet("sw:all", data, 600); // 인메모리 10분
    }

    const result = filterCompany
      ? data.filter(r => r.company === filterCompany)
      : data;

    return NextResponse.json({
      data: result,
      lastSynced: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error("[sw-records] fetch error:", e?.message);
    return NextResponse.json(
      { data: [], error: e?.message, lastSynced: new Date().toISOString() },
      { status: 500 }
    );
  }
}

// POST: 수동 캐시 강제 갱신 — UI "새로고침" 버튼에서 호출
export async function POST(request: NextRequest) {
  const session = getSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    memDel("sw:all");
    const data = await fetchSwDatabase();
    await kvSetPermanent("sw:all", compactSwRecords(data));
    memSet("sw:all", data, 600);
    return NextResponse.json({ ok: true, count: data.length, refreshedAt: new Date().toISOString() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
