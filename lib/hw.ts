import { isMock, mockHwRecords } from "./mock";
import { kvGet, kvSet, kvSetPermanent } from "./kv-store";
import { updateHwFields, getHwByIdFromPostgresOrThrow, getHwByAssetNoFromPostgresOrThrow } from "./repo/hw";

// NT/DT/MOT 트래커 데이터베이스

/**
 * HW 자산 레코드. 예전에는 Notion 페이지 파서(mapPage)의 반환 타입이었고, 지금은
 * public.hw 테이블 컬럼과 1:1 이라 명시 타입으로 둔다(lib/repo/hw.ts 가 그대로 캐스팅).
 * notionUrl 은 과거 백업 시절의 잔재 — 신규 레코드는 빈 문자열이다.
 */
export interface HwRecord {
  id: string;
  notionUrl: string;
  user: string;
  assetNo: string;
  model: string;
  serial: string;
  maker: string;
  cpu: string;
  ram: string;
  company: string;
  dept: string;
  location: string;
  status: string;
  returnDue: string;
  returnDate: string;
  purchaseDate: string;
  useDate: string;
  price: number;
  residualValue: number;
  note: string;
  docNo: string;
  mac: string;
  email: string;
  verified: boolean;
  duplicated: boolean;
  lastModifiedBy: string;
  lastModifiedAt: string;
  changeLog: string;
}

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

export async function markHwVerifiedByScanMatch(
  id: string,
  extra?: { mac?: string; email?: string; cpu?: string; ram?: string }
): Promise<void> {
  const patch: Record<string, unknown> = { status: "사용중", verified: true };
  if (extra?.mac)   patch.mac   = extra.mac;
  if (extra?.email) patch.email = extra.email;
  if (extra?.cpu)   patch.cpu   = extra.cpu;
  if (extra?.ram)   patch.ram   = extra.ram;

  // 메인 저장소(맥북 Postgres)에 write-through + dirty → 5분 뒤 Notion 백업.
  await updateHwFields(id, patch);
}

/**
 * 법인/부서/사용자가 스캔값과 완전히 일치하지 않아 실사확인까지는 못 걸어도,
 * 마스터에 MAC·이메일이 비어있으면 스캔값으로 채워 넣는다 (상태·실사확인은 건드리지 않음,
 * 이미 값이 있는 필드는 덮어쓰지 않음).
 */
export async function fillMissingHwContactInfo(
  id: string,
  extra: { mac?: string; email?: string }
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (extra.mac)   patch.mac   = extra.mac;
  if (extra.email) patch.email = extra.email;
  if (Object.keys(patch).length === 0) return;

  // 메인 저장소(맥북 Postgres)에 write-through + dirty → 5분 뒤 Notion 백업.
  await updateHwFields(id, patch);
}

// 자산번호는 중복 등록된 경우(HwRecord.duplicated)가 있어 자산번호만으로 조회하면
// 사용자가 클릭한 것과 다른 레코드가 나올 수 있다 — id가 있으면 이 함수로 정확히 단건 조회한다.
// HW 는 Postgres 가 메인 소스 — 조회 실패 시 Notion 으로 조용히 폴백하지 않고 그대로 throw 한다.
export async function findHwById(id: string): Promise<HwRecord | null> {
  if (isMock()) {
    return (mockHwRecords.find(r => r.id === id) as HwRecord) ?? null;
  }
  return getHwByIdFromPostgresOrThrow(id);
}

export async function findHwByAssetNo(assetNo: string): Promise<HwRecord | null> {
  if (isMock()) {
    return (mockHwRecords.find(r => r.assetNo === assetNo) as HwRecord) ?? null;
  }
  return getHwByAssetNoFromPostgresOrThrow(assetNo);
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
