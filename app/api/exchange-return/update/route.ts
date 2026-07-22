import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { updateExchangeReturn, type UpdateFields } from "@/lib/exchange-return";
import { memGet, memDel } from "@/lib/mem-cache";
import { getSessionFromCookieHeader, resolveCurrentName, companyScope } from "@/lib/session";
import { errorMessage } from "@/lib/api-error";
import type { ExchangeReturnRecord } from "@/types";

export const dynamic = "force-dynamic";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

// 캐시 우선 조회, 미스 시 Notion 직접 조회 (법인 범위 검증용)
async function getRecordCompany(id: string): Promise<string | null> {
  const all = memGet<ExchangeReturnRecord[]>("exchange-return:all");
  const cached = all?.find(r => r.id === id);
  if (cached) return cached.company;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page: any = await notion.pages.retrieve({ page_id: id });
    return page.properties?.["법인"]?.select?.name ?? "";
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  for (const v of ["NOTION_TOKEN", "NOTION_DB_EXCHANGE_RETURN"]) {
    if (!process.env[v]) {
      return NextResponse.json({ ok: false, missingEnv: v, error: `환경변수 ${v} 가 설정되지 않았습니다.` }, { status: 503 });
    }
  }
  try {
    const { id, fields } = await req.json() as { id: string; fields: UpdateFields };
    if (!id) return NextResponse.json({ ok: false, error: "id 필수" }, { status: 400 });
    if (!fields || Object.keys(fields).length === 0) {
      return NextResponse.json({ ok: false, error: "업데이트할 필드 없음" }, { status: 400 });
    }

    const session = getSessionFromCookieHeader(req.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const scope = companyScope(session);
    if (scope && (await getRecordCompany(id)) !== scope) {
      return NextResponse.json({ ok: false, error: "본인 법인 데이터만 수정할 수 있습니다." }, { status: 403 });
    }
    const adminName = await resolveCurrentName(session);
    const fieldsWithModifier: UpdateFields = {
      ...fields,
      lastModifiedBy: `${adminName} (${session.userId})`,
    };

    await updateExchangeReturn(id, fieldsWithModifier);
    memDel("exchange-return:all");
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[API /exchange-return/update]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
