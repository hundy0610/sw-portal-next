import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { type HwRecord, type HwChangeLogEvent, buildUpdatedChangeLog } from "@/lib/hw";
import { getHwByIdFromPostgres, updateHwFields, isPostgresEnabled } from "@/lib/repo/hw";
import { kvGet } from "@/lib/kv-store";
import { memDel } from "@/lib/mem-cache";
import { autoCompleteReturnsByAssetId, autoSyncUseDateByAssetId } from "@/lib/exchange-return";
import { getSessionFromCookieHeader, resolveCurrentName, companyScope } from "@/lib/session";
import { errorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

// 대상 레코드 조회 (법인 범위 검증 + 변경이력 before). 4.0verMACBOOK: 맥북 Postgres 우선.
async function getRecord(id: string): Promise<HwRecord | null> {
  const pg = await getHwByIdFromPostgres(id);
  if (pg) return pg;
  const cached = (await kvGet<HwRecord[]>("hw:all"))?.find(r => r.id === id);
  if (cached) return cached;
  if (!process.env.NOTION_TOKEN) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page: any = await notion.pages.retrieve({ page_id: id });
    return { id, company: page.properties?.["법인명"]?.select?.name ?? "", assetNo: page.properties?.["자산번호"]?.rich_text?.[0]?.plain_text ?? "" } as HwRecord;
  } catch {
    return null;
  }
}

type FieldMap = Record<string, unknown>;

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
  { key: "maker",      label: "제조사" },
  { key: "model",      label: "모델명" },
  { key: "cpu",        label: "CPU" },
  { key: "ram",        label: "RAM" },
  { key: "mac",        label: "MAC" },
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
    if (!isPostgresEnabled()) {
      return NextResponse.json({ ok: false, error: "데이터 저장소(Postgres)가 설정되지 않았습니다." }, { status: 503 });
    }

    const session = getSessionFromCookieHeader(req.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const before = await getRecord(id);
    const scope = companyScope(session);
    if (scope && before?.company !== scope) {
      return NextResponse.json({ ok: false, error: "본인 법인 데이터만 수정할 수 있습니다." }, { status: 403 });
    }
    const adminName = await resolveCurrentName(session);
    const modifiedBy = `${adminName} (${session.userId})`;
    const modifiedAt = new Date().toISOString();

    // 재고 상태로 변경 시 반납예정일 자동 초기화
    const fields: FieldMap = {
      ...(rawFields.status === "재고" && rawFields.returnDue === undefined
        ? { ...rawFields, returnDue: "" }
        : rawFields),
      lastModifiedBy: modifiedBy,
      lastModifiedAt: modifiedAt,
    };

    // 변경이력 — 이번 저장에서 실제로 바뀐 필드들을 하나의 이벤트로 묶어 changeLog(json)에 누적
    const logChanges = HW_LOG_FIELDS
      .filter(f => f.key in (rawFields as object))
      .map(f => ({
        field: f.key as string, label: f.label,
        from: fmtLogValue(before?.[f.key]), to: fmtLogValue((rawFields as Partial<HwRecord>)[f.key]),
      }))
      .filter(c => c.from !== c.to);
    if (logChanges.length > 0) {
      const event: HwChangeLogEvent = { at: modifiedAt, by: modifiedBy, changes: logChanges };
      const { json } = buildUpdatedChangeLog(before?.changeLog ?? "", event);
      fields.changeLog = json;
    }

    // 메인 저장소(맥북 Postgres)에 write-through + dirty 표시 → 5분 뒤 Notion 백업.
    const ok = await updateHwFields(id, fields);
    if (!ok) {
      return NextResponse.json({ ok: false, error: "저장 실패(Postgres). 잠시 후 다시 시도해주세요." }, { status: 502 });
    }

    // 상태가 "재고"로 변경되거나 사용일자가 변경된 경우 — 연결된 자산 흐름 레코드에 반영
    if ((fields.status === "재고" || fields.useDate !== undefined) && process.env.NOTION_DB_EXCHANGE_RETURN) {
      try {
        const assetNo = before?.assetNo || "";
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
