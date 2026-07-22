import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { type HwRecord, type HwChangeLogEvent, buildUpdatedChangeLog, patchHwCache, buildHwProperties } from "@/lib/hw";
import { kvGet } from "@/lib/kv-store";
import { memDel } from "@/lib/mem-cache";
import { autoCompleteReturnsByAssetId, autoSyncUseDateByAssetId } from "@/lib/exchange-return";
import { getSessionFromCookieHeader, resolveCurrentName, companyScope } from "@/lib/session";
import { errorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

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

// HwRecord 필드 → Notion 프로퍼티 매핑
type FieldMap = Record<string, unknown>;
const buildProperties = buildHwProperties;

// 변경이력에 기록할 필드 목록 — 전역 감사로그(8개)보다 넓게 전체 수정가능 필드 포함
const HW_LOG_FIELDS: { key: keyof HwRecord; label: string }[] = [
  { key: "status",     label: "상태" },
  { key: "company",    label: "법인" },
  { key: "user",       label: "사용자" },
  { key: "assetNo",    label: "자산번호" },
  { key: "serial",     label: "시리얼" },
  { key: "dept",       label: "부서" },
  { key: "location",   label: "위치" },
  { key: "note",       label: "기타" },
  { key: "email",      label: "이메일" },
  { key: "returnDue",  label: "반납예정일" },
  { key: "returnDate", label: "반납일자" },
  { key: "useDate",    label: "사용일자" },
  { key: "verified",   label: "실사확인" },
];

function fmtLogValue(v: unknown): string {
  if (typeof v === "boolean") return v ? "예" : "아니오";
  return v === undefined || v === null || v === "" ? "(없음)" : String(v);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, fields: rawFields } = body as { id: string; fields: FieldMap };

    if (!id || typeof id !== "string") {
      return NextResponse.json({ ok: false, error: "id 필수" }, { status: 400 });
    }
    if (!rawFields || typeof rawFields !== "object") {
      return NextResponse.json({ ok: false, error: "fields 필수" }, { status: 400 });
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
    const modifiedBy = `${adminName} (${session.userId})`;
    const modifiedAt = new Date().toISOString();
    const before = (await kvGet<HwRecord[]>("hw:all"))?.find(r => r.id === id);

    // 재고 상태로 변경 시 반납예정일 자동 초기화
    const fields: FieldMap = {
      ...(rawFields.status === "재고" && rawFields.returnDue === undefined
        ? { ...rawFields, returnDue: "" }
        : rawFields),
      lastModifiedBy: modifiedBy,
      lastModifiedAt: modifiedAt,
    };

    const properties = buildProperties(fields);
    if (Object.keys(properties).length === 0) {
      return NextResponse.json({ ok: false, error: "업데이트할 필드 없음" }, { status: 400 });
    }

    // 변경이력 — 이번 저장에서 실제로 바뀐 필드들을 하나의 이벤트로 묶어 "변경이력" 속성에 함께 기록
    const logChanges = HW_LOG_FIELDS
      .filter(f => f.key in (rawFields as object))
      .map(f => ({
        field: f.key as string, label: f.label,
        from: fmtLogValue(before?.[f.key]), to: fmtLogValue((rawFields as Partial<HwRecord>)[f.key]),
      }))
      .filter(c => c.from !== c.to);
    if (logChanges.length > 0) {
      const event: HwChangeLogEvent = { at: modifiedAt, by: modifiedBy, changes: logChanges };
      const { json, richText } = buildUpdatedChangeLog(before?.changeLog ?? "", event);
      properties["변경이력"] = richText;
      fields.changeLog = json; // KV 캐시 patch(hw:all/hw:deltas)에도 최신 변경이력이 함께 반영되도록
    }

    // Notion 페이지 업데이트 — 성공을 먼저 확인해야 캐시도 그 값으로 갱신
    await notion.pages.update({
      page_id: id,
      properties: properties as Parameters<typeof notion.pages.update>[0]["properties"],
    });

    // KV 캐시 in-place 패치 (삭제하지 않고 해당 레코드만 수정)
    await patchHwCache(id, fields);

    // 상태가 "재고"로 변경되거나 사용일자가 변경된 경우 — 연결된 자산 흐름 레코드에 반영
    if ((fields.status === "재고" || fields.useDate !== undefined) && process.env.NOTION_DB_EXCHANGE_RETURN) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const page: any = await notion.pages.retrieve({ page_id: id });
        const assetNo: string = page.properties?.["자산번호"]?.rich_text?.[0]?.plain_text || "";
        if (assetNo) {
          let changed = 0;
          if (fields.status === "재고") {
            changed += await autoCompleteReturnsByAssetId(assetNo);
          }
          if (fields.useDate !== undefined) {
            changed += await autoSyncUseDateByAssetId(assetNo, String(fields.useDate ?? ""));
          }
          if (changed > 0) memDel("exchange-return:all");
        }
      } catch (e) {
        console.error("[hw/update → exchange-return sync]", e);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[API /hw/update]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
