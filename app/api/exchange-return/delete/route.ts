import { NextRequest, NextResponse } from "next/server";
import { deleteExchangeReturn } from "@/lib/exchange-return";
import { memGet, memDel } from "@/lib/mem-cache";
import { resolveAuditActor } from "@/lib/session";
import { appendAdminAuditLog } from "@/lib/portal-store";
import { errorMessage } from "@/lib/api-error";
import type { ExchangeReturnRecord } from "@/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  for (const v of ["NOTION_TOKEN", "NOTION_DB_EXCHANGE_RETURN"]) {
    if (!process.env[v]) {
      return NextResponse.json({ ok: false, missingEnv: v, error: `환경변수 ${v} 가 설정되지 않았습니다.` }, { status: 503 });
    }
  }
  try {
    const { id } = await req.json() as { id: string };
    if (!id) return NextResponse.json({ ok: false, error: "id 필수" }, { status: 400 });

    const target = memGet<ExchangeReturnRecord[]>("exchange-return:all")?.find(r => r.id === id);

    await deleteExchangeReturn(id);
    memDel("exchange-return:all");
    const { adminId, adminName } = await resolveAuditActor(req.headers.get("cookie"));
    await appendAdminAuditLog({
      adminId, adminName, action: "delete", target: "exchangeReturn",
      itemTitle: target?.assetId || target?.newAssetId || id, timestamp: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[API /exchange-return/delete]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
