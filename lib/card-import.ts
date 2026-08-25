import { kvGet, kvSetPermanent, kvDel } from "@/lib/kv-store";

// ─────────────────────────────────────────────────────────────────────────────
// 카드명세 업로드 & 표준화 (F4)
//
// 계열사·재경팀마다 카드 사용내역 엑셀의 컬럼 구조가 다르므로, "법인+소스" 조합마다
// 컬럼 매핑(import profile)을 한 번만 설정해두면 다음 업로드부터는 매핑 화면 없이
// 바로 표준 형식으로 변환된다.
//
// 저장 위치: Postgres KV(public.kv, lib/kv-store.ts).
//   - entity_store(lib/repo/mirror.ts)를 쓰지 않는 이유: 그쪽은 Notion으로 5분마다
//     단방향 백업되는 "Notion 연동 엔티티" 전용인데, 카드명세는 대응하는 Notion DB가
//     없어 백업 잡에서 어차피 건너뛰어진다. 설정성/집계용 데이터이므로 KV가 적합.
// ─────────────────────────────────────────────────────────────────────────────

const KV_PROFILES = "card-import:profiles";
const KV_BATCHES  = "card-import:batches";
const KV_BATCH    = (id: string) => `card-import:batch:${id}`;

const MAX_BATCHES = 200;

/** 표준 필드 — 업로드된 각 행이 최종적으로 변환되는 형태 */
export const STANDARD_FIELDS = [
  { key: "company",    label: "법인",           required: true  },
  { key: "department", label: "부서",           required: false },
  { key: "cardLast4",  label: "카드번호 뒤 4자리", required: false },
  { key: "paidAt",     label: "결제일",         required: true  },
  { key: "amount",     label: "금액",           required: true  },
  { key: "note",       label: "비고",           required: false },
] as const;

export type StandardFieldKey = typeof STANDARD_FIELDS[number]["key"];

/** 컬럼 매핑 프로필 — 법인+소스 조합 단위로 저장 */
export interface ImportProfile {
  id: string;             // `${company}__${source}`
  company: string;
  source: string;         // 예: "신한카드", "더존 회계"
  headerRow: number;      // 헤더가 있는 행 번호(1-based)
  /** 표준 필드 → 엑셀 컬럼 인덱스(0-based). 매핑 안 한 필드는 없음 */
  mapping: Partial<Record<StandardFieldKey, number>>;
  updatedAt: string;
  updatedBy: string;
}

/** 표준화된 카드명세 1행 */
export interface CardRow {
  company: string;
  department: string;
  cardLast4: string;
  paidAt: string;   // YYYY-MM-DD
  amount: number;
  note: string;
  /** 검증 경고 — 금액 0/누락, 중복 의심 등. 저장은 되지만 화면에서 구분 표시된다. */
  warnings: string[];
}

/** 업로드 배치 요약(목록용) */
export interface BatchMeta {
  id: string;
  company: string;
  source: string;
  fileName: string;
  rowCount: number;
  totalAmount: number;
  warningCount: number;
  uploadedAt: string;
  uploadedBy: string;
}

export function profileId(company: string, source: string): string {
  return `${company.trim()}__${source.trim()}`;
}

// ─── 프로필 ──────────────────────────────────────────────────────────────────

export async function listProfiles(): Promise<ImportProfile[]> {
  return (await kvGet<ImportProfile[]>(KV_PROFILES)) ?? [];
}

export async function getProfile(company: string, source: string): Promise<ImportProfile | null> {
  const all = await listProfiles();
  return all.find(p => p.id === profileId(company, source)) ?? null;
}

/** 생성/수정 겸용. 실패 시 false. */
export async function saveProfile(profile: ImportProfile): Promise<boolean> {
  const all = await listProfiles();
  const next = [profile, ...all.filter(p => p.id !== profile.id)];
  return kvSetPermanent(KV_PROFILES, next);
}

export async function deleteProfile(id: string): Promise<boolean> {
  const all = await listProfiles();
  return kvSetPermanent(KV_PROFILES, all.filter(p => p.id !== id));
}

// ─── 배치(업로드 건) ─────────────────────────────────────────────────────────

export async function listBatches(): Promise<BatchMeta[]> {
  return (await kvGet<BatchMeta[]>(KV_BATCHES)) ?? [];
}

export async function getBatchRows(id: string): Promise<CardRow[] | null> {
  return kvGet<CardRow[]>(KV_BATCH(id));
}

/** 배치 본문 + 목록 인덱스를 함께 저장한다. 둘 중 하나라도 실패하면 false. */
export async function saveBatch(meta: BatchMeta, rows: CardRow[]): Promise<boolean> {
  if (!(await kvSetPermanent(KV_BATCH(meta.id), rows))) return false;
  const all = await listBatches();
  const next = [meta, ...all.filter(b => b.id !== meta.id)].slice(0, MAX_BATCHES);
  return kvSetPermanent(KV_BATCHES, next);
}

export async function deleteBatch(id: string): Promise<boolean> {
  const all = await listBatches();
  const ok = await kvSetPermanent(KV_BATCHES, all.filter(b => b.id !== id));
  await kvDel(KV_BATCH(id)); // 본문은 실패해도 목록에서 사라지면 사용자에겐 삭제된 것
  return ok;
}

// ─── 검증 ────────────────────────────────────────────────────────────────────

/**
 * 표준화된 행들에 검증 경고를 매긴다(금액 0/누락, 동일 법인+카드+결제일+금액 중복).
 * 저장을 막지는 않고, 사용자가 확인하고 넘어갈 수 있도록 표시만 한다.
 */
export function annotateWarnings(rows: Omit<CardRow, "warnings">[]): CardRow[] {
  const seen = new Map<string, number>();
  for (const r of rows) {
    const key = `${r.company}|${r.cardLast4}|${r.paidAt}|${r.amount}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return rows.map(r => {
    const warnings: string[] = [];
    if (!r.amount) warnings.push("금액 없음/0원");
    if (!r.paidAt) warnings.push("결제일 없음");
    if (!r.company) warnings.push("법인 없음");
    const key = `${r.company}|${r.cardLast4}|${r.paidAt}|${r.amount}`;
    if ((seen.get(key) ?? 0) > 1) warnings.push("중복 의심");
    return { ...r, warnings };
  });
}
