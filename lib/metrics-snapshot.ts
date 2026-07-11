import { kvGet } from "./kv-store";

/**
 * .github/scripts/snapshot-daily.mjs가 매일 00:10 UTC에 저장하는 일별 지표 스냅샷.
 * 키 형식: snapshot:YYYY-MM-DD
 */
export interface DailySnapshot {
  date: string;             // YYYY-MM-DD (UTC)
  capturedAt: string;       // ISO timestamp
  hwTotal: number | null;
  swTotal: number | null;
}

export type SnapshotMetric = "hwTotal" | "swTotal";

export interface MetricTrend {
  current: number;
  previous: number;
  delta: number;
  deltaPct: number | null;  // previous가 0이면 null
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function getSnapshot(date: string): Promise<DailySnapshot | null> {
  return kvGet<DailySnapshot>(`snapshot:${date}`);
}

/**
 * 기준일 근처(최대 maxLookbackDays일 전까지)에서 값이 있는 가장 가까운 스냅샷을 찾는다.
 * cron 실패 등으로 특정 날짜 스냅샷이 비어 있을 수 있어 며칠 여유를 둔다.
 */
async function findRecentValue(around: Date, metric: SnapshotMetric, maxLookbackDays: number): Promise<number | null> {
  for (let i = 0; i <= maxLookbackDays; i++) {
    const d = new Date(around);
    d.setUTCDate(d.getUTCDate() - i);
    const snap = await getSnapshot(dateKey(d));
    const value = snap?.[metric];
    if (typeof value === "number") return value;
  }
  return null;
}

/**
 * 오늘(최근) 스냅샷과 한 달 전 스냅샷을 비교해 증감을 계산한다.
 * 인프라가 신규라 스냅샷이 없거나 부족하면 null을 반환한다 — 호출 측에서 조용히 생략 처리.
 */
export async function getMonthOverMonthTrend(metric: SnapshotMetric): Promise<MetricTrend | null> {
  const today = new Date();
  const current = await findRecentValue(today, metric, 3);
  if (current === null) return null;

  const oneMonthAgo = new Date(today);
  oneMonthAgo.setUTCMonth(oneMonthAgo.getUTCMonth() - 1);
  const previous = await findRecentValue(oneMonthAgo, metric, 5);
  if (previous === null) return null;

  const delta = current - previous;
  const deltaPct = previous !== 0 ? (delta / previous) * 100 : null;
  return { current, previous, delta, deltaPct };
}
