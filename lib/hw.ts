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

const email = (p: Props, k: string) => {
  const v = p[k];
  if (!v || v.type !== "email") return "";
  return v.email || "";
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
    mac:          txt(p, "MAC"),
    email:        email(p, "이메일"),
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

const MAX_CHANGE_LOG_ENTRIES = 150;

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
    byMaker[mk]   = (byMaker[mk]   || 0) + 1;
    // 미확인 자산은 실사 후 실물 확인되면 "사용중"으로 전환됨 — 확인 전까지는
    // 법인별 분포·법인별 총계·전체 수량 집계에서 제외한다 (byStatus 자체엔 남겨서 미확인 건수는 계속 조회 가능)
    if (st !== "미확인") {
      byCompany[co] = (byCompany[co] || 0) + 1;
      if (!coMap[co]) coMap[co] = { total: 0, active: 0, stock: 0 };
      coMap[co].total++;
      if (st === "사용중") coMap[co].active++;
      if (st === "재고")   coMap[co].stock++;
      totalValue += r.price || 0;
    }
    if (r.verified) verifiedCount++;
  }

  return {
    total:          records.length - (byStatus["미확인"] || 0),
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

// HwRecord 필드 → Notion 프로퍼티 매핑 (hw/update, hw/bulk-update 공용)
export type FieldMap = Record<string, unknown>;

export function buildHwProperties(fields: FieldMap) {
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
  if (fields.email       !== undefined) {
    const emailVal = String(fields.email ?? "");
    props["이메일"] = emailVal ? { email: emailVal } : { email: null };
  }

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

// ─────────────────────────────────────────────────────────────────────────────
// hw:all/hw:stats/hw:deltas KV 캐시 in-place 패치 — Notion 페이지 업데이트 후 호출
// ─────────────────────────────────────────────────────────────────────────────

// Notion 갱신 직후라 hw:all이 있어야 정상인데, Redis 무료 티어 한도 초과로 인한 일시적
// 실패로 null이 나오는 경우가 있다. 이때 패치를 그냥 포기하면 방금 반영한 변경사항이
// 다음 warm-hw 실행(최대 30분)까지 검색 결과에서 안 보이게 되므로, 짧게 한 번 더 확인한다.
export async function getHwAllForPatch(): Promise<HwRecord[] | null> {
  const all = await kvGet<HwRecord[]>("hw:all");
  if (all) return all;
  await new Promise(r => setTimeout(r, 300));
  return kvGet<HwRecord[]>("hw:all");
}

export async function patchHwCache(id: string, fields: Record<string, unknown>): Promise<void> {
  const kvPatchPromise = (async () => {
    const all = await getHwAllForPatch();
    if (!all) { console.warn("[HW] patchHwCache: hw:all KV 미스, 패치 스킵 (warm 시 자연히 반영됨)", id); return; }
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

// 일괄수정용 — 동일한 fields를 여러 id에 적용, KV 읽기/쓰기를 1회로 묶어서 처리
export async function patchHwCacheBulk(ids: string[], fields: Record<string, unknown>): Promise<void> {
  const kvPatchPromise = (async () => {
    const all = await getHwAllForPatch();
    if (!all) { console.warn("[HW] patchHwCacheBulk: hw:all KV 미스, 패치 스킵 (warm 시 자연히 반영됨)", ids); return; }
    const idSet = new Set(ids);
    const updated = all.map(r => idSet.has(r.id) ? { ...r, ...fields } : r);
    const stats   = computeHwStats(updated);
    await Promise.all([
      kvSetPermanent("hw:all",   updated),
      kvSetPermanent("hw:stats", stats),
    ]);
  })();

  const deltaPromise = (async () => {
    const existing = await kvGet<Record<string, Record<string, unknown>>>("hw:deltas") ?? {};
    const next = { ...existing };
    for (const id of ids) next[id] = fields;
    await kvSet("hw:deltas", next, 3600);
  })();

  await Promise.all([kvPatchPromise, deltaPromise]);
}

// 삭제(archive)용 — hw:all 캐시에서 해당 id들을 제거 (Notion 쿼리는 archived 페이지를 자동 제외하므로 동일하게 맞춤)
export async function removeFromHwCache(ids: string[]): Promise<void> {
  const idSet = new Set(ids);
  const all = await getHwAllForPatch();
  if (!all) { console.warn("[HW] removeFromHwCache: hw:all KV 미스, 제거 스킵 (warm 시 자연히 반영됨)", ids); return; }
  const updated = all.filter(r => !idSet.has(r.id));
  const stats   = computeHwStats(updated);
  await Promise.all([
    kvSetPermanent("hw:all",   updated),
    kvSetPermanent("hw:stats", stats),
  ]);
}

/**
 * PC 실사 스캔이 마스터값과 완전히 일치할 때 자동 호출 — 해당 자산을
 * 사용중 상태로, 실사확인 체크박스를 true로 표시한다.
 * 스캔에서 받은 MAC/이메일/CPU/RAM이 있으면 마스터에도 함께 반영한다.
 */
export async function markHwVerifiedByScanMatch(
  id: string,
  extra?: { mac?: string; email?: string; cpu?: string; ram?: string }
): Promise<void> {
  const properties: Record<string, unknown> = {
    "사용/재고/폐기/기타": { select: { name: "사용중" } },
    "실사확인": { checkbox: true },
  };
  const patch: Record<string, unknown> = { status: "사용중", verified: true };

  if (extra?.mac) {
    properties["MAC"] = { rich_text: [{ text: { content: extra.mac } }] };
    patch.mac = extra.mac;
  }
  if (extra?.email) {
    properties["이메일"] = { email: extra.email };
    patch.email = extra.email;
  }
  if (extra?.cpu) {
    properties["CPU"] = { rich_text: [{ text: { content: extra.cpu } }] };
    patch.cpu = extra.cpu;
  }
  if (extra?.ram) {
    properties["RAM"] = { rich_text: [{ text: { content: extra.ram } }] };
    patch.ram = extra.ram;
  }

  await notion.pages.update({
    page_id: id,
    properties: properties as Parameters<typeof notion.pages.update>[0]["properties"],
  });
  await patchHwCache(id, patch);
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
  search = "",
}: {
  statuses?: string[];   // OR 조건 (예: ["출고준비중","출고준비완료"])
  returnDue?: boolean;   // 반납예정일이 있는 레코드만
  company?: string;
  assetNo?: string;      // 자산번호 정확히 일치 조회
  // 검색창 입력값 — /api/hw가 KV 캐시 히트 시 사용자/자산번호/모델/시리얼/부서에 대해
  // 부분 일치(대소문자 무시) OR 검색을 하는 것과 동일한 의미로 맞춘다. 이 함수는 KV 캐시가
  // 비어있을 때의 라이브 폴백이라, 여기서 assetNo처럼 정확히 일치만 찾으면 캐시가 비어있는
  // 순간에만 검색이 실패하는 것처럼 보이는 문제가 생긴다 — 실제로 "두 번 검색해야 나온다"는
  // 증상의 원인이었음(첫 검색이 캐시 미스로 이 폴백을 타면서 정확 일치만 확인해 빈 결과를
  // 반환하고, 다시 검색했을 때 캐시가 채워져 있으면 그제서야 부분 일치로 찾아졌음).
  search?: string;
}): Promise<HwRecord[]> {
  const searchTerms = search ? search.split(",").map(s => s.trim().toLowerCase()).filter(Boolean) : [];
  if (isMock()) {
    return mockHwRecords.filter(r =>
      (statuses.length === 0 || statuses.includes(r.status)) &&
      (!returnDue || !!r.returnDue) &&
      (!company || r.company === company) &&
      (!assetNo || r.assetNo === assetNo) &&
      (searchTerms.length === 0 || searchTerms.some(q =>
        r.user.toLowerCase().includes(q)   || r.assetNo.toLowerCase().includes(q) ||
        r.model.toLowerCase().includes(q)  || r.serial.toLowerCase().includes(q) ||
        r.dept.toLowerCase().includes(q)
      ))
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

  if (searchTerms.length > 0) {
    const termFilters = searchTerms.map(term => ({
      or: [
        { property: "사용자",      title:     { contains: term } },
        { property: "자산번호",    rich_text: { contains: term } },
        { property: "모델명",      rich_text: { contains: term } },
        { property: "시리얼 넘버", rich_text: { contains: term } },
        { property: "부서",        rich_text: { contains: term } },
      ],
    }));
    andFilters.push(termFilters.length === 1 ? termFilters[0] : { or: termFilters });
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

// 자산번호는 중복 등록된 경우(HwRecord.duplicated)가 있어 자산번호만으로 조회하면
// 사용자가 클릭한 것과 다른 레코드가 나올 수 있다 — id가 있으면 이 함수로 정확히 단건 조회한다.
export async function findHwById(id: string): Promise<HwRecord | null> {
  if (isMock()) {
    return (mockHwRecords.find(r => r.id === id) as HwRecord) ?? null;
  }
  const page = await notion.pages.retrieve({ page_id: id });
  if (page.object !== "page" || !("properties" in page)) return null;
  return mapPage(page as PageObjectResponse);
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

// ─────────────────────────────────────────────────────────────────────────────
// 증분 동기화 — "Notion 동기화" 버튼용. 전체 재조회 대신 최근 수정분만 가져온다.
// ─────────────────────────────────────────────────────────────────────────────
const LAST_SYNCED_KEY = "hw:lastSyncedAt";
// Notion last_edited_time은 분 단위 정밀도라, 직전 동기화 시각 그대로 필터하면
// 같은 시각에 걸친 수정 건을 놓칠 수 있음 — 여유를 두고 겹쳐서 조회한다.
const SYNC_OVERLAP_MS = 3 * 60 * 1000;

/**
 * Notion에서 last_edited_time 기준으로 최근 수정된 레코드만 조회.
 * (전체 스캔 대비 몇 건~수십 건 규모라 1~2초 내 완료됨)
 */
export async function fetchHwUpdatedSince(sinceIso: string): Promise<HwRecord[]> {
  if (isMock()) return [];

  const records: HwRecord[] = [];
  let cursor: string | undefined;

  do {
    const res = await queryWithRetry({
      database_id: DB_ID,
      page_size: 100,
      start_cursor: cursor,
      filter: { timestamp: "last_edited_time", last_edited_time: { on_or_after: sinceIso } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    for (const page of res.results) {
      if (page.object === "page" && "properties" in page) {
        records.push(mapPage(page as PageObjectResponse));
      }
    }

    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return records;
}

/**
 * 방금 Notion에서 새로 조회한 레코드들을 hw:all 캐시에 id 기준으로 upsert하고
 * hw:stats를 재계산한다. 신규 생성된 페이지도 자연히 추가됨(id가 없던 항목).
 */
export async function mergeHwRecords(updated: HwRecord[]): Promise<HwStats> {
  const existing = (await kvGet<HwRecord[]>("hw:all")) ?? [];
  const byId = new Map(existing.map(r => [r.id, r]));
  for (const r of updated) byId.set(r.id, r);
  const merged = Array.from(byId.values());
  merged.sort((a, b) => (b.purchaseDate || "") > (a.purchaseDate || "") ? 1 : -1);

  const stats = computeHwStats(merged);
  await kvSetPermanent("hw:all", merged);
  await kvSetPermanent("hw:stats", stats);

  // 방금 Notion에서 새로 받아온 값이 최신이므로, 해당 id에 남아있던 로컬 patch 델타는 정리
  if (updated.length > 0) {
    const deltas = await kvGet<Record<string, Record<string, unknown>>>("hw:deltas");
    if (deltas) {
      let changed = false;
      for (const r of updated) { if (deltas[r.id]) { delete deltas[r.id]; changed = true; } }
      if (changed) await kvSet("hw:deltas", deltas, 3600);
    }
  }

  return stats;
}

/** 마지막 증분 동기화 시각 조회 (없으면 24시간 전을 기본값으로) */
export async function getHwLastSyncedAt(): Promise<string> {
  const saved = await kvGet<string>(LAST_SYNCED_KEY);
  return saved ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

export async function setHwLastSyncedAt(iso: string): Promise<void> {
  await kvSetPermanent(LAST_SYNCED_KEY, iso);
}

export { SYNC_OVERLAP_MS };
