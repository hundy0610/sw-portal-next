import { kvGet, kvSetPermanent } from "@/lib/kv-store";

// ─────────────────────────────────────────────────────────────────────────────
// USD → KRW 환율 조회 (F3)
//
// 구독형 SW 비용은 실제로 결제가 일어난 날짜의 환율로 환산해야 한다 — "화면을 보는
// 시점"의 환율을 전체에 일괄 적용하면 과거에 결제된 금액도 오늘 환율로 왜곡된다.
// Frankfurter(https://frankfurter.dev, ECB 데이터, 무료·키 불필요)를 사용해 날짜별
// 환율을 조회하고, 같은 날짜는 재요청하지 않도록 Postgres KV에 영구 캐시한다
// (과거 날짜의 환율 값은 절대 바뀌지 않으므로 TTL 없이 캐시해도 안전하다).
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_KEY = (date: string) => `exchange-rate:usd-krw:${date}`;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function fetchFromFrankfurter(date: string, isToday: boolean): Promise<number | null> {
  try {
    const url = isToday
      ? "https://api.frankfurter.dev/v1/latest?base=USD&symbols=KRW"
      : `https://api.frankfurter.dev/v1/${date}?base=USD&symbols=KRW`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { rates?: { KRW?: number } };
    return data.rates?.KRW ? Math.round(data.rates.KRW) : null;
  } catch {
    return null;
  }
}

/**
 * 특정 날짜(YYYY-MM-DD) 기준 USD→KRW 환율을 반환한다.
 * - 미래 날짜/빈 값은 오늘 날짜로 취급.
 * - 주말·공휴일 등 환율 미고시일은 Frankfurter가 가장 가까운 이전 영업일 값을 돌려준다.
 * - 캐시 미스 + API 실패 시 null (호출부는 대체 환율로 폴백해야 함).
 */
export async function getUsdKrwRateForDate(dateStr: string | undefined | null): Promise<number | null> {
  const today = todayIso();
  const date = dateStr && dateStr <= today ? dateStr : today;
  const cached = await kvGet<number>(CACHE_KEY(date));
  if (cached) return cached;

  const rate = await fetchFromFrankfurter(date, date === today);
  if (rate) await kvSetPermanent(CACHE_KEY(date), rate);
  return rate;
}

/**
 * 여러 날짜의 환율을 한 번에 조회한다(중복 날짜는 한 번만 요청). 조회 실패한 날짜는
 * 결과 Map에서 빠지므로, 호출부는 `.get(date) ?? fallback` 형태로 폴백을 처리한다.
 */
export async function getUsdKrwRatesForDates(dates: string[]): Promise<Map<string, number>> {
  const unique = [...new Set(dates)];
  const results = await Promise.all(unique.map(async d => [d, await getUsdKrwRateForDate(d)] as const));
  const map = new Map<string, number>();
  for (const [d, rate] of results) if (rate) map.set(d, rate);
  return map;
}
