import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { type HwRecord, removeFromHwCache } from "@/lib/hw";
import { kvGet } from "@/lib/kv-store";
import { getSessionFromCookieHeader, resolveCurrentName, companyScope } from "@/lib/session";
import { appendAdminAuditLog } from "@/lib/portal-store";
import { errorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const MAX_IDS = 100;

// 캐시 우선 조회, 미스 시 Notion 직접 조회 (법인 범위 검증용)
async function getRecordCompany(id: string): Promise<string | null> {
  const all = await kvGet<HwRecord[]>("hw:all");
  const cached = all?.find(r => r.id === id);
  if (cached) return cached.company;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page: any = await notion.pages.retrieve({ page_id: id });
    return page.properties?.["법인명"]?.select?.name ?? "";
  } catch {
    return null;
  }
}

type ResultItem = { id: string; ok: boolean; error?: string };

export async function POST(req: NextRequest) {
  try {
    const { ids } = await req.json() as { ids: string[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ ok: false, error: "삭제할 ID가 없습니다." }, { status: 400 });
    }
    if (ids.length > MAX_IDS) {
      return NextResponse.json({ ok: false, error: `한 번에 최대 ${MAX_IDS}건까지 삭제할 수 있습니다.` }, { status: 400 });
    }

    const session = getSessionFromCookieHeader(req.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const scope = companyScope(session);
    const adminName = await resolveCurrentName(session);

    const results: ResultItem[] = [];
    for (const id of ids) {
      if (scope && (await getRecordCompany(id)) !== scope) {
        results.push({ id, ok: false, error: "본인 법인 데이터만 삭제할 수 있습니다." });
      } else {
        try {
          await notion.pages.update({ page_id: id, archived: true });
          results.push({ id, ok: true });
        } catch (e) {
          results.push({ id, ok: false, error: errorMessage(e) });
        }
      }
      // Notion API rate limit
      await new Promise(r => setTimeout(r, 350));
    }

    const success = results.filter(r => r.ok).length;
    const failed  = results.length - success;
    const successIds = results.filter(r => r.ok).map(r => r.id);

    if (success > 0) {
      await removeFromHwCache(successIds);
      await appendAdminAuditLog({
        adminId: session.userId, adminName, action: "delete", target: "hw",
        itemTitle: `${success}건 일괄삭제`,
        detail: failed > 0 ? `성공 ${success}건, 실패 ${failed}건` : undefined,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({ ok: true, success, failed, results });
  } catch (e) {
    console.error("[API /hw/delete]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
