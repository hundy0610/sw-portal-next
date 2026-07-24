import { NextResponse } from "next/server";
import { fetchExchangeReturns } from "@/lib/exchange-return";
import { isMirrorEnabled } from "@/lib/repo/mirror";

export const dynamic = "force-dynamic";

export async function GET() {
  // 4.0verMACBOOK: 메인 저장소는 맥북 Postgres(미러). 미러가 꺼져 있을 때만 Notion 필요.
  if (!isMirrorEnabled()) {
    for (const v of ["NOTION_TOKEN", "NOTION_DB_EXCHANGE_RETURN"]) {
      if (!process.env[v]) {
        return NextResponse.json(
          { missingEnv: v, error: `환경변수 ${v} 가 설정되지 않았습니다.` },
          { status: 503 }
        );
      }
    }
  }

  try {
    // 미러(Postgres)에서 매 요청 조회 → 쓰기 즉시 반영.
    const data = await fetchExchangeReturns();
    return NextResponse.json({ data, lastSynced: new Date().toISOString(), cached: false });
  } catch (error) {
    console.error("[API GET /exchange-return]", error);
    return NextResponse.json(
      { data: [], error: error instanceof Error ? error.message : "알 수 없는 오류" },
      { status: 500 }
    );
  }
}
