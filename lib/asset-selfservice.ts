import { notionRequest } from "@/shared/lib/notion";
import { readEntity, readEntityOne, upsertEntity } from "@/lib/repo/mirror";

// 4.0verMACBOOK: 자산 자가서비스(공개 QR)는 HW 트래커(DB_ID)와 별개인 Notion DB
// (ASSETS_DATA_SOURCE_ID)를 원천으로 한다. 이 DB를 자체 미러 엔티티 "asset-selfservice"
// 로 관리한다(맥북 Postgres 메인 + 5분 Notion 백업). 시드 전에도 안 깨지도록 lazy-migration
// 폴백(Notion 단건 조회 → 미러 upsert)을 둔다.

export const ASSET_ENTITY = "asset-selfservice";

export interface AssetSelfServiceRecord {
  id: string;              // 미러 record id = Notion page id
  notionUrl: string;
  assetNo: string;         // 자산번호 (rich_text)
  user: string;            // 사용자 (title)
  company: string;         // 법인명 (select)
  dept: string;            // 부서 (rich_text)
  location: string;        // 위치 (rich_text)
  maker: string;           // 제조사 (select)
  model: string;           // 모델명 (rich_text)
  serial: string;          // 시리얼 넘버 (rich_text)
  cpu: string;             // CPU (rich_text)
  ram: string;             // RAM (rich_text)
  price: number;           // 단가 (number)
  purchaseDate: string;    // 구매일자 (date)
  useDate: string;         // 사용일자 (date)
  returnDate: string;      // 반납일자 (date)
  repairDate: string;      // 수리일자 (date)
  status: string;          // 사용/재고/폐기/기타 (select)
  shipStatus: string;      // 출고진행상황 (status)
  returnStatus: string;    // 반납 진행 상황 (status)
  repairStatus: string;    // 수리진행상황 (status)
  repairAssignee: string;  // 수리담당자 이름 (people)
  repairAssigneeId: string;// 수리담당자 Notion user id
  repairTypes: string[];   // 수리 작업 유형 (multi_select)
  missingItems: string[];  // 누락 사항 (multi_select)
  returnReason: string;    // 반납사유 (select)
  note: string;            // 기타 (rich_text)
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const txt = (p: any, k: string): string =>
  (p?.[k]?.rich_text ?? []).map((t: any) => t?.plain_text ?? t?.text?.content ?? "").join("") || "";
const title = (p: any, k: string): string =>
  (p?.[k]?.title ?? []).map((t: any) => t?.plain_text ?? t?.text?.content ?? "").join("") || "";
const sel = (p: any, k: string): string => p?.[k]?.select?.name ?? "";
const status = (p: any, k: string): string => p?.[k]?.status?.name ?? "";
const dt = (p: any, k: string): string => p?.[k]?.date?.start ?? "";
const num = (p: any, k: string): number => p?.[k]?.number ?? 0;
const multi = (p: any, k: string): string[] => (p?.[k]?.multi_select ?? []).map((o: any) => o?.name).filter(Boolean);

function mapPage(page: any): AssetSelfServiceRecord {
  const p = page.properties ?? {};
  const assignee = (p["수리담당자"]?.people ?? [])[0] as { id?: string; name?: string } | undefined;
  return {
    id: page.id,
    notionUrl: page.url ?? "",
    assetNo: txt(p, "자산번호"),
    user: title(p, "사용자"),
    company: sel(p, "법인명"),
    dept: txt(p, "부서"),
    location: txt(p, "위치"),
    maker: sel(p, "제조사"),
    model: txt(p, "모델명"),
    serial: txt(p, "시리얼 넘버"),
    cpu: txt(p, "CPU"),
    ram: txt(p, "RAM"),
    price: num(p, "단가"),
    purchaseDate: dt(p, "구매일자"),
    useDate: dt(p, "사용일자"),
    returnDate: dt(p, "반납일자"),
    repairDate: dt(p, "수리일자"),
    status: sel(p, "사용/재고/폐기/기타"),
    shipStatus: status(p, "출고진행상황"),
    returnStatus: status(p, "반납 진행 상황"),
    repairStatus: status(p, "수리진행상황"),
    repairAssignee: assignee?.name ?? "",
    repairAssigneeId: assignee?.id ?? "",
    repairTypes: multi(p, "수리 작업 유형"),
    missingItems: multi(p, "누락 사항"),
    returnReason: sel(p, "반납사유"),
    note: txt(p, "기타"),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// Notion 직접 조회(초기 seed / 폴백 전용) — 전체.
export async function fetchAssetsFromNotion(): Promise<AssetSelfServiceRecord[]> {
  const dataSourceId = process.env.ASSETS_DATA_SOURCE_ID;
  if (!dataSourceId) throw new Error("ASSETS_DATA_SOURCE_ID 환경변수가 설정되지 않았습니다.");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results: any[] = [];
  let cursor: string | undefined;
  do {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await notionRequest<any>(`/data_sources/${dataSourceId}/query`, {
      method: "POST",
      body: { start_cursor: cursor },
    });
    results.push(...res.results);
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);
  return results.map(mapPage);
}

// Notion 단건 조회(자산번호) — lazy-migration 폴백용.
async function fetchOneFromNotionByAssetNo(assetNo: string): Promise<AssetSelfServiceRecord | null> {
  const dataSourceId = process.env.ASSETS_DATA_SOURCE_ID;
  if (!dataSourceId) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await notionRequest<any>(`/data_sources/${dataSourceId}/query`, {
    method: "POST",
    body: { filter: { property: "자산번호", rich_text: { equals: assetNo } }, page_size: 1 },
  });
  const page = res.results?.[0];
  return page ? mapPage(page) : null;
}

// Notion 단건 조회(page id) — edit lazy-migration 폴백용.
async function fetchOneFromNotionById(id: string): Promise<AssetSelfServiceRecord | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page = await notionRequest<any>(`/pages/${id}`, { method: "GET" });
    return page ? mapPage(page) : null;
  } catch {
    return null;
  }
}

/**
 * 자산번호로 단건 조회. 미러 우선 → 미스 시 Notion 폴백(lazy-migration: 찾으면 미러에 upsert).
 * 시드 전/미러 미설정 상태에서도 Notion 폴백으로 조회가 깨지지 않는다.
 */
export async function getAssetByAssetNo(assetNo: string): Promise<AssetSelfServiceRecord | null> {
  const rows = await readEntity<AssetSelfServiceRecord>(ASSET_ENTITY);
  if (rows) {
    const hit = rows.find(r => r.assetNo === assetNo);
    if (hit) return hit;
  }
  // 미러 미스/미설정 → Notion 폴백 + lazy-migration
  const fromNotion = await fetchOneFromNotionByAssetNo(assetNo);
  if (!fromNotion) return null;
  // 미러가 활성일 때만 upsert(미설정이면 조회만 반환)
  await upsertEntity(ASSET_ENTITY, fromNotion.id, fromNotion).catch(() => {});
  return fromNotion;
}

export type AssetUpdateFields = Partial<Omit<AssetSelfServiceRecord, "id" | "notionUrl">>;

/**
 * 자산 수정 write-through. 미러 레코드 우선, 없으면 Notion에서 lazy-migrate 후 변경 적용 → upsert(dirty).
 * 반환: 갱신된 레코드(재조회 실패 시 병합값).
 */
export async function updateAsset(id: string, fields: AssetUpdateFields): Promise<AssetSelfServiceRecord | null> {
  let base = await readEntityOne<AssetSelfServiceRecord>(ASSET_ENTITY, id);
  if (!base) base = await fetchOneFromNotionById(id);
  if (!base) return null;

  const next: AssetSelfServiceRecord = { ...base, ...fields, id: base.id, notionUrl: base.notionUrl };
  const ok = await upsertEntity(ASSET_ENTITY, id, next);
  if (!ok) throw new Error("자산 수정 저장 실패(Postgres)");
  return next;
}
