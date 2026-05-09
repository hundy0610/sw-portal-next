import { NextResponse } from "next/server";
import { fetchExchangeReturns } from "@/lib/exchange-return";
import { memCached } from "@/lib/mem-cache";

export const dynamic = "force-dynamic";

const CACHE_KEY = "exchange-return:all";
const CACHE_TTL = 120;

export async function GET(request: Request) {
  for (const v of ["NOTION_TOKEN", "NOTION_DB_EXCHANGE_RETURN"]) {
    if (!process.env[v]) {
      return NextResponse.json(
        { missingEnv: v, error: `환경변수 ${v} 가 설정되지 않았습니다.` },
        { status: 503 }
      );
    }
  }

  try {
    const refresh = new URL(request.url).searchParams.get("refresh") === "1";
    if (refresh) {
      const data = await fetchExchangeReturns();
      return NextResponse.json({ data, lastSynced: new Date().toISOString(), cached: false });
    }
    const { data, cached } = await memCached(CACHE_KEY, fetchExchangeReturns, CACHE_TTL);
    return NextResponse.json({ data, lastSynced: new Date().toISOString(), cached });
  } catch (error) {
    console.error("[API GET /exchange-return]", error);
    return NextResponse.json(
      { data: [], error: error instanceof Error ? error.message : "알 수 없는 오류" },
      { status: 500 }
    );
  }
}
