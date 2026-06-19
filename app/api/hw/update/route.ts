import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { computeHwStats, type HwRecord } from "@/lib/hw";
import { kvGet, kvSet, kvSetPermanent } from "@/lib/kv-store";
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

function buildProperties(fields: FieldMap) {
  const props: Record<string, unknown> = {};

  const sel = (name: string, val: string) => {
    props[name] = val ? { select: { name: val } } : { select: null };
  };
  const txt = (name: string, val: string, isTitle = false) => {
    const block = [{ text: { content: val ?? "" } }];
    props[name] = isTitle ? { title: block } : { rich_text: block };
  };
  const dt = (name: string, val: string) => {
    props[name] = val ? { date: { start: val } } : { date: null };
  };

  if (fields.status      !== undefined) sel("사용/재고/폐기/기타",  String(fields.status));
  if (fields.company     !== undefined) sel("법인명",                String(fields.company));

  if (fields.user        !== undefined) txt("사용자",       String(fields.user),  true);
  if (fields.assetNo     !== undefined) txt("자산번호",     String(fields.assetNo));
  if (fields.serial      !== undefined) txt("시리얼 넘버",  String(fields.serial));
  if (fields.dept        !== undefined) txt("부서",         String(fields.dept));
  if (fields.location    !== undefined) txt("위치",         String(fields.location));
  if (fields.note        !== undefined) txt("기타",         String(fields.note));

  if (fields.returnDue   !== undefined) dt("반납예정일", String(fields.returnDue  ?? ""));
  if (fields.returnDate  !== undefined) dt("반납일자",   String(fields.returnDate ?? ""));
  if (fields.useDate     !== undefined) dt("사용일자",   String(fields.useDate    ?? ""));

  if (fields.verified !== undefined) {
    props["실사확인"] = { checkbox: !!fields.verified };
  }

  if (fields.lastModifiedBy !== undefined) txt("마지막수정자",   String(fields.lastModifiedBy));
  if (fields.lastModifiedAt !== undefined) txt("마지막수정일시", String(fields.lastModifiedAt));

  return props;
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
    const modifiedBy = `${await resolveCurrentName(session)} (${session.userId})`;
    const modifiedAt = new Date().toISOString();

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

    // Notion 페이지 업데이트 — 성공을 먼저 확인해야 캐시도 그 값으로 갱신
    await notion.pages.update({
      page_id: id,
      properties: properties as Parameters<typeof notion.pages.update>[0]["properties"],
    });

    // KV 캐시 in-place 패치 (삭제하지 않고 해당 레코드만 수정)
    const kvPatchPromise = (async () => {
      const all = await kvGet<HwRecord[]>("hw:all");
      if (!all) return; // KV 미스 — warm 시 자연히 반영됨
      const updated = all.map(r => r.id === id ? { ...r, ...fields } : r);
      const stats   = computeHwStats(updated);
      await Promise.all([
        kvSetPermanent("hw:all",   updated),
        kvSetPermanent("hw:stats", stats),
      ]);
      // 인메모리 캐시 무효화 (KV는 이미 최신)
    })();

    // hw:deltas 맵 업데이트 — hw:all 패치 성패와 무관하게 최신값 보장 (TTL 1시간)
    const deltaPromise = (async () => {
      const existing = await kvGet<Record<string, FieldMap>>("hw:deltas") ?? {};
      await kvSet("hw:deltas", { ...existing, [id]: fields }, 3600);
    })();

    await Promise.all([kvPatchPromise, deltaPromise]);

    // 상태가 "재고"로 변경되거나 사용일자가 변경된 경우 — 연결된 자산 흐름 레코드에 반영
    if ((fields.status === "재고" || fields.useDate !== undefined) && process.env.NOTION_DB_EXCHANGE_RETURN) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const page: any = await notion.pages.retrieve({ page_id: id });
        const assetNo: string = page.properties?.["자산번호"]?.title?.[0]?.plain_text || "";
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
