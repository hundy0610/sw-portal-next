import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { isMock, mockHwRecords } from "./mock";
import { kvGet, kvSet, kvSetPermanent } from "./kv-store";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

// NT/DT/MOT 트래커 데이터베이스
const DB_ID = "29967f4b-fdac-8086-b468-ef3545b3e471";

type Props = PageObjectResponse["properties"];

const txt = (p: Props, k: string) => {
  const v = p[k];
  if (!v) return "";
  if (v.type === "title")     return v.title.map(t => t.plain_text).join("");
  if (v.type === "rich_text") return v.rich_text.map(t => t.plain_text).join("");
  return "";
};

const sel = (p: Props, k: string) => {
  const v = p[k];
  if (!v) return "";
  if (v.type === "select") return v.select?.name || "";
  if (v.type === "status") return v.status?.name || "";
  return "";
};


const date = (p: Props, k: string) => {
  const v = p[k];
  if (!v || v.type !== "date") return "";
  return v.date?.start || "";
};

const num = (p: Props, k: string) => {
  const v = p[k];
  if (!v) return 0;
  if (v.type === "number") return v.number ?? 0;
  if (v.type === "formula" && v.formula.type === "number") return v.formula.number ?? 0;
  return 0;
};

function mapPage(page: PageObjectResponse) {
  const p = page.properties;
  return {
    id:           page.id,
    notionUrl:    page.url,
    user:         txt(p, "사용자"),
    assetNo:      txt(p, "자산번호"),
    model:        txt(p, "모델명"),
    serial:       txt(p, "시리얼 넘버"),
    maker:        sel(p, "제조사"),
    cpu:          txt(p, "CPU"),
    ram:          txt(p, "RAM"),
    company:      sel(p, "법인명"),
    dept:         txt(p, "부서"),
    location:     txt(p, "위치"),
    status:       sel(p, "사용/재고/폐기/기타"),
    returnDue:    date(p, "반납예정일"),
    returnDate:   date(p, "반납일자"),
    purchaseDate: date(p, "구매일자"),
    useDate:      date(p, "사용일자"),
    price:        num(p, "단가"),
    residualValue: num(p, "잔존가치"),
    note:         txt(p, "기타"),
    docNo:        txt(p, "결재문서번호"),
    verified:     p["실사확인"]?.type === "checkbox" ? p["실사확인"].checkbox : false,
    duplicated:   p["중복"]?.type === "checkbox" ? p["중복"].checkbox : false,
    lastModifiedBy: txt(p, "마지막수정자"),
    lastModifiedAt: txt(p, "마지막수정일시"),
    changeLog:    txt(p, "변경이력"),
  };
}

export type HwRecord = ReturnType<typeof mapPage>;

// ─────────────────────────────────────────────────────────────────────────────
// 변경이력 — 별도 DB 없이 HW 레코드 자신의 "변경이력" rich_text 속성에 JSON으로 누적
// (자산당 최근 MAX_CHANGE_LOG_ENTRIES건만 유지, Notion rich_text 배열은 100블록 한도)
// ─────────────────────────────────────────────────────────────────────────────
export interface HwChangeLogEvent {
  at: string;                                                    // ISO timestamp
  by: string;                                                    // "이름 (아이디)"
  changes: { field: string; label: string; from: string; to: string }[];
}

const MAX_CHANGE_LOG_ENTRIES = 50;

export function parseChangeLog(raw: string): HwChangeLogEvent[] {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// 기존 변경이력 텍스트에 새 이벤트를 맨 앞에 추가하고, 캡을 적용한 뒤
// json(캐시 패치용 원문)과 Notion rich_text 속성 값(블록 분할)을 함께 반환
export function buildUpdatedChangeLog(existingRaw: string, event: HwChangeLogEvent) {
  const updated = [event, ...parseChangeLog(existingRaw)].slice(0, MAX_CHANGE_LOG_ENTRIES);
  const json = JSON.stringify(updated);
  const chunks: string[] = [];
  for (let i = 0; i < json.length; i += 1900) chunks.push(json.slice(i, i + 1900));
  return { json, richText: { rich_text: chunks.map(c => ({ text: { content: c } })) } };
}

// ─────────────────────────────────────────────────────────────────────────────
// 대시보드용 집계 통계 (전체 레코드 대신 이걸 KV에 별도 저장)
// ─────────────────────────────────────────────────────────────────────────────
export interface HwStats {
  total: number;
  byStatus: Record<string, number>;
  byCompany: Record<string, number>;
  byMaker: Record<string, number>;
  activeCount: number;
  stockCount: number;
  shipCount: number;
  repairCount: number;
  rentalCount: number;
  tempCount: number;
  returnCount: number;
  disposalCount: number;
  verifiedCount: number;
  totalValue: number;
  companyTable: { company: string; total: number; active: number; stock: number }[];
}

const DISPOSAL_STATUSES = [
  "폐기","폐기확정(리스트화)","폐기완료","3층문서고/폐기","지하창고/폐기",
];

export function computeHwStats(records: HwRecord[]): HwStats {
  const byStatus: Record<string, number>  = {};
  const byCompany: Record<string, number> = {};
  const byMaker: Record<string, number>   = {};
  const coMap: Record<string, { total: number; active: number; stock: number }> = {};
  let totalValue = 0;
  let verifiedCount = 0;

  for (const r of records) {
    const st = r.status  || "미분류";
    const co = r.company || "미분류";
    const mk = r.maker   || "기타";
    byStatus[st]  = (byStatus[st]  || 0) + 1;
    byCompany[co] = (byCompany[co] || 0) + 1;
    byMaker[mk]   = (byMaker[mk]   || 0) + 1;
    if (!coMap[co]) coMap[co] = { total: 0, active: 0, stock: 0 };
    coMap[co].total++;
    if (r.status === "사용중") coMap[co].active++;
    if (r.status === "재고")   coMap[co].stock++;
    totalValue += r.price || 0;
    if (r.verified) verifiedCount++;
  }

  return {
    total:          records.length,
    byStatus,
    byCompany,
    byMaker,
    activeCount:    byStatus["사용중"]       || 0,
    stockCount:     byStatus["재고"]         || 0,
    shipCount:      (byStatus["출고준비중"]   || 0) + (byStatus["출고준비완료"] || 0),
    repairCount:    byStatus["수리"]         || 0,
    rentalCount:    byStatus["렌탈"]         || 0,
    tempCount:      byStatus["임시지급"]      || 0,
    returnCount:    byStatus["반납예정"]      || 0,
    disposalCount:  DISPOSAL_STATUSES.reduce((s, k) => s + (byStatus[k] || 0), 0),
    verifiedCount,
    totalValue,
    companyTable: Object.entries(coMap)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([company, v]) => ({ company, ...v })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// hw:all/hw:stats/hw:deltas KV 캐시 in-place 패치 — Notion 페이지 업데이트 후 호출
// ─────────────────────────────────────────────────────────────────────────────
export async function patchHwCache(id: string, fields: Record<string, unknown>): Promise<void> {
  const kvPatchPromise = (async () => {
    const all = await kvGet<HwRecord[]>("hw:all");
    if (!all) return; // KV 미스 — warm 시 자연히 반영됨
    const updated = all.map(r => r.id === id ? { ...r, ...fields } : r);
    const stats   = computeHwStats(updated);
    await Promise.all([
      kvSetPermanent("hw:all",   updated),
      kvSetPermanent("hw:stats", stats),
    ]);
  })();

  const deltaPromise = (async () => {
    const existing = await kvGet<Record<string, Record<string, unknown>>>("hw:deltas") ?? {};
    await kvSet("hw:deltas", { ...existing, [id]: fields }, 3600);
  })();

  await Promise.all([kvPatchPromise, deltaPromise]);
}

/**
 * PC 실사 스캔이 마스터값과 완전히 일치할 때 자동 호출 — 해당 자산을
 * 사용중 상태로, 실사확인 체크박스를 true로 표시한다.
 */
export async function markHwVerifiedByScanMatch(id: string): Promise<void> {
  await notion.pages.update({
    page_id: id,
    properties: {
      "사용/재고/폐기/기타": { select: { name: "사용중" } },
      "실사확인": { checkbox: true },
    } as Parameters<typeof notion.pages.update>[0]["properties"],
  });
  await patchHwCache(id, { status: "사용중", verified: true });
}

async function queryWithRetry(params: Parameters<typeof notion.databases.query>[0], maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await notion.databases.query(params);
    } catch (e: unknown) {
      const status = (e as { status?: number })?.status;
      if ((status === 502 || status === 503) && attempt < maxRetries - 1) {
        await new Promise(res => setTimeout(res, 1000 * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
  throw new Error("Notion query failed after retries");
}

/**
 * 특정 상태/조건으로 필터링된 레코드만 Notion에서 직접 조회.
 * 출고 현황 / 반납 대상자 탭처럼 결과가 적을 때 전체 데이터 대신 사용.
 * (1~3회 Notion 호출, 300-900ms — Vercel 10초 타임아웃 내 안전)
 */
export async function fetchHwFiltered({
  statuses = [],
  returnDue = false,
  company = "",
  assetNo = "",
}: {
  statuses?: string[];   // OR 조건 (예: ["출고준비중","출고준비완료"])
  returnDue?: boolean;   // 반납예정일이 있는 레코드만
  company?: string;
  assetNo?: string;      // 자산번호 정확히 일치 조회
}): Promise<HwRecord[]> {
  if (isMock()) {
    return mockHwRecords.filter(r =>
      (statuses.length === 0 || statuses.includes(r.status)) &&
      (!returnDue || !!r.returnDue) &&
      (!company || r.company === company) &&
      (!assetNo || r.assetNo === assetNo)
    ) as HwRecord[];
  }
  const andFilters: object[] = [];

  if (statuses.length === 1) {
    andFilters.push({ property: "사용/재고/폐기/기타", status: { equals: statuses[0] } });
  } else if (statuses.length > 1) {
    andFilters.push({ or: statuses.map(s => ({ property: "사용/재고/폐기/기타", status: { equals: s } })) });
  }

  if (returnDue) {
    andFilters.push({ property: "반납예정일", date: { is_not_empty: true } });
  }

  if (company) {
    andFilters.push({ property: "법인명", select: { equals: company } });
  }

  if (assetNo) {
    andFilters.push({ property: "자산번호", rich_text: { equals: assetNo } });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: any = andFilters.length === 0 ? undefined
    : andFilters.length === 1 ? andFilters[0]
    : { and: andFilters };

  const records: HwRecord[] = [];
  let cursor: string | undefined;

  do {
    const res = await queryWithRetry({
      database_id: DB_ID,
      page_size: 100,
      start_cursor: cursor,
      ...(filter ? { filter } : {}),
    });

    for (const page of res.results) {
      if (page.object === "page" && "properties" in page) {
        records.push(mapPage(page as PageObjectResponse));
      }
    }

    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return records;
}

export async function findHwByAssetNo(assetNo: string): Promise<HwRecord | null> {
  if (isMock()) {
    return (mockHwRecords.find(r => r.assetNo === assetNo) as HwRecord) ?? null;
  }
  const res = await queryWithRetry({
    database_id: DB_ID,
    filter: { property: "자산번호", rich_text: { equals: assetNo } },
    page_size: 1,
  });
  const page = res.results[0];
  if (!page || page.object !== "page" || !("properties" in page)) return null;
  return mapPage(page as PageObjectResponse);
}

function normalizeSerial(s: string): string {
  return s.replace(/[\s-]/g, "").toUpperCase();
}

/**
 * 시리얼 넘버 대조. 마스터 DB에 뒷자리가 누락되어 저장된 사례가 있어
 * 완전 일치 외에도, 한쪽이 다른 쪽의 접두사이면서 길이 차가 1~2인 경우까지 일치로 본다.
 */
export function serialFuzzyMatch(a: string, b: string): boolean {
  const x = normalizeSerial(a);
  const y = normalizeSerial(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [shorter, longer] = x.length <= y.length ? [x, y] : [y, x];
  const diff = longer.length - shorter.length;
  return diff >= 1 && diff <= 2 && longer.startsWith(shorter);
}

export async function fetchAllHwRecords(): Promise<HwRecord[]> {
  if (isMock()) return mockHwRecords as HwRecord[];
  const records: HwRecord[] = [];
  let cursor: string | undefined;

  do {
    const res = await queryWithRetry({
      database_id: DB_ID,
      page_size: 100,
      start_cursor: cursor,
    });

    for (const page of res.results) {
      if (page.object === "page" && "properties" in page) {
        records.push(mapPage(page as PageObjectResponse));
      }
    }

    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  // 구매일자 내림차순 정렬 (서버 대신 클라이언트에서 처리)
  records.sort((a, b) => (b.purchaseDate || "") > (a.purchaseDate || "") ? 1 : -1);

  return records;
}
