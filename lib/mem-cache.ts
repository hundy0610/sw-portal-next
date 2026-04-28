/**
 * 서버사이드 인메모리 캐시
 *
 * Vercel 무료 플랜 최적화:
 * - 외부 의존성(KV, Redis) 없이 동작
 * - 동일 서버리스 인스턴스 내 재사용 시 0ms 응답
 * - KV가 설정된 경우 추가 레이어로 활용 (선택적)
 */

interface CacheEntry<T> {
  data: T;
  expires: number;
}

const store = new Map<string, CacheEntry<unknown>>();

/**
 * 캐시에서 데이터 조회. 만료됐거나 없으면 null 반환
 */
export function memGet<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

/**
 * 캐시에 데이터 저장
 * @param ttl 유효 시간 (초), 기본 300초 (5분)
 */
export function memSet<T>(key: string, data: T, ttl = 300): void {
  store.set(key, { data, expires: Date.now() + ttl * 1000 });
}

/**
 * 캐시 무효화
 */
export function memDel(...keys: string[]): void {
  keys.forEach(k => store.delete(k));
}

/**
 * 캐시 히트 시 즉시 반환, 미스 시 fetcher 실행 후 저장
 */
export async function memCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl = 300
): Promise<{ data: T; cached: boolean }> {
  const hit = memGet<T>(key);
  if (hit !== null) return { data: hit, cached: true };

  const data = await fetcher();
  memSet(key, data, ttl);
  return { data, cached: false };
}
