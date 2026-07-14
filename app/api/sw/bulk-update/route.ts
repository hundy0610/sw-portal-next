import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { kvDel } from "@/lib/kv-store";
import { memDel } from "@/lib/mem-cache";
import { getSessionFromCookieHeader, resolveCurrentName, companyScope } from "@/lib/session";
import { errorMessage } from "@/lib/api-error";
import { getRecordCompany, buildProperties, type FieldMap } from "@/lib/sw-notion";

export const dynamic = "force-dynamic";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const MAX_IDS = 100;

// 일괄 수정 허용 필드 — 여러 건에 동일하게 덮어써도 안전한 공통값만 허용
// (사용자명/자산 고유값/파일첨부/버전/금액/날짜 등은 제외)
const ALLOWED_FIELDS = new Set([
  "status", "company", "department", "workType", "billingType", "accountType", "renewalCycle", "licenseType",
]);

type ResultItem = { id: string; ok: boolean; error?: string };

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ids, fields } = body as { ids: string[]; fields: FieldMap };

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ ok: false, error: "ids 필수" }, { status: 400 });
    }
    if (ids.length > MAX_IDS) {
      return NextResponse.json({ ok: false, error: `한 번에 최대 ${MAX_IDS}건까지 수정할 수 있습니다.` }, { status: 400 });
    }
    if (!fields || typeof fields !== "object" || Object.keys(fields).length === 0) {
      return NextResponse.json({ ok: false, error: "fields 필수" }, { status: 400 });
    }
    const invalidKeys = Object.keys(fields).filter(k => !ALLOWED_FIELDS.has(k));
    if (invalidKeys.length > 0) {
      return NextResponse.json({ ok: false, error: `일괄 수정할 수 없는 필드입니다: ${invalidKeys.join(", ")}` }, { status: 400 });
    }

    const session = getSessionFromCookieHeader(req.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const scope = companyScope(session);
    if (fields.company !== undefined && scope !== null) {
      return NextResponse.json({ ok: false, error: "법인명 일괄 수정은 슈퍼어드민만 가능합니다." }, { status: 403 });
    }

    const modifiedBy = `${await resolveCurrentName(session)} (${session.userId})`;
    const fieldsWithModifier: FieldMap = {
      ...fields,
      lastModifiedBy: modifiedBy,
      lastModifiedAt: new Date().toISOString(),
    };
    const properties = buildProperties(fieldsWithModifier);

    const results: ResultItem[] = [];
    for (const id of ids) {
      if (scope && (await getRecordCompany(id)) !== scope) {
        results.push({ id, ok: false, error: "본인 법인 데이터만 수정할 수 있습니다." });
      } else {
        try {
          await notion.pages.update({
            page_id: id,
            properties: properties as Parameters<typeof notion.pages.update>[0]["properties"],
          });
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

    if (success > 0) {
      memDel("sw:all");
      await kvDel("sw:all");
    }

    return NextResponse.json({ ok: true, success, failed, results });
  } catch (e) {
    console.error("[API /sw/bulk-update]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
