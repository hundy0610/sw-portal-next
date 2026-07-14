import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { type HwRecord, type FieldMap, buildHwProperties, patchHwCacheBulk } from "@/lib/hw";
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

// 일괄 수정 허용 필드 — 여러 건에 동일하게 덮어써도 안전한 공통값만 허용
// (사용자명/자산번호/시리얼/이메일/날짜 등은 제외)
const ALLOWED_FIELDS = new Set(["status", "company", "dept", "location", "note"]);

type ResultItem = { id: string; ok: boolean; error?: string };

const FIELD_LABEL: Record<string, string> = {
  status: "상태", company: "법인명", dept: "부서", location: "위치", note: "기타",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ids, fields: rawFields } = body as { ids: string[]; fields: FieldMap };

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ ok: false, error: "ids 필수" }, { status: 400 });
    }
    if (ids.length > MAX_IDS) {
      return NextResponse.json({ ok: false, error: `한 번에 최대 ${MAX_IDS}건까지 수정할 수 있습니다.` }, { status: 400 });
    }
    if (!rawFields || typeof rawFields !== "object" || Object.keys(rawFields).length === 0) {
      return NextResponse.json({ ok: false, error: "fields 필수" }, { status: 400 });
    }
    const invalidKeys = Object.keys(rawFields).filter(k => !ALLOWED_FIELDS.has(k));
    if (invalidKeys.length > 0) {
      return NextResponse.json({ ok: false, error: `일괄 수정할 수 없는 필드입니다: ${invalidKeys.join(", ")}` }, { status: 400 });
    }
    if (rawFields.status === "교체요청") {
      return NextResponse.json({ ok: false, error: "'교체요청' 상태는 일괄 수정으로 지원되지 않습니다. 개별로 수정해주세요." }, { status: 400 });
    }

    const session = getSessionFromCookieHeader(req.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const scope = companyScope(session);
    if (rawFields.company !== undefined && scope !== null) {
      return NextResponse.json({ ok: false, error: "법인명 일괄 수정은 슈퍼어드민만 가능합니다." }, { status: 403 });
    }

    const adminName = await resolveCurrentName(session);
    const modifiedBy = `${adminName} (${session.userId})`;
    const modifiedAt = new Date().toISOString();

    // 재고 상태로 변경 시 반납예정일 자동 초기화 (단건 update와 동일 로직)
    const fields: FieldMap = {
      ...(rawFields.status === "재고" && rawFields.returnDue === undefined
        ? { ...rawFields, returnDue: "" }
        : rawFields),
      lastModifiedBy: modifiedBy,
      lastModifiedAt: modifiedAt,
    };
    const properties = buildHwProperties(fields);

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
    const successIds = results.filter(r => r.ok).map(r => r.id);

    if (success > 0) {
      await patchHwCacheBulk(successIds, fields);
    }

    // 감사로그 — 건별이 아닌 이번 일괄수정 전체를 요약한 항목 1건만 기록
    const fieldSummary = Object.keys(rawFields)
      .map(k => `${FIELD_LABEL[k] ?? k} → ${String(rawFields[k])}`)
      .join(", ");
    await appendAdminAuditLog({
      adminId: session.userId, adminName, action: "bulk-update", target: "hw",
      itemTitle: `${ids.length}건 일괄수정`,
      detail: `${fieldSummary} (성공 ${success}건${failed > 0 ? `, 실패 ${failed}건` : ""})`,
      timestamp: modifiedAt,
    });

    return NextResponse.json({ ok: true, success, failed, results });
  } catch (e) {
    console.error("[API /hw/bulk-update]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
