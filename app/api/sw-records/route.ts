import { NextRequest, NextResponse } from "next/server";
import { fetchSwDatabase } from "@/lib/notion";
import { isMirrorEnabled } from "@/lib/repo/mirror";
import { getSessionFromCookieHeader, companyScope } from "@/lib/session";

export const dynamic = "force-dynamic";

// 4.0verMACBOOK: 맥북 Postgres 미러가 메인. 캐시(mem/KV) 없이 매 요청 직접 조회해
// 저장 즉시 반영되게 한다(폴백으로 Notion — env 미설정 시).
export async function GET(request: NextRequest) {
  if (!isMirrorEnabled() && !process.env.NOTION_TOKEN) {
    return NextResponse.json({ missingEnv: "SUPABASE_URL", error: "데이터 저장소가 설정되지 않았습니다." }, { status: 503 });
  }
  const session = getSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const scope = companyScope(session);

  try {
    const { searchParams } = new URL(request.url);
    const filterCompany = scope ?? (searchParams.get("company")?.trim() || "");

    const data = await fetchSwDatabase();
    const result = filterCompany ? data.filter(r => r.company === filterCompany) : data;

    return NextResponse.json({
      data: result,
      lastSynced: new Date().toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[sw-records] fetch error:", msg);
    return NextResponse.json(
      { data: [], error: msg, lastSynced: new Date().toISOString() },
      { status: 500 }
    );
  }
}

// POST: 수동 새로고침 — 미러가 메인이므로 GET 과 동일하게 직접 조회해 반환.
export async function POST(request: NextRequest) {
  const session = getSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const scope = companyScope(session);
  try {
    const data = await fetchSwDatabase();
    const { searchParams } = new URL(request.url);
    const filterCompany = scope ?? (searchParams.get("company")?.trim() || "");
    const result = filterCompany ? data.filter(r => r.company === filterCompany) : data;

    return NextResponse.json({ ok: true, data: result, count: data.length, lastSynced: new Date().toISOString() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
