/**
 * sessionStorage 기반 클라이언트 캐시 (TTL 포함)
 *
 * 용도: 탭 간 이동 시 동일 데이터를 재요청하지 않고 즉시 렌더링 (stale-while-revalidate 패턴)
 * - 서버 재시작 / F5 새로고침 시 자동 만료
 * - 탭 닫기 시 자동 소멸 (sessionStorage 특성)
 */

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 기본 5분

export function scGet<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { data, exp } = JSON.parse(raw) as { data: T; exp: number };
    if (Date.now() > exp) {
      sessionStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function scSet<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify({ data, exp: Date.now() + ttlMs }));
  } catch {
    // sessionStorage 용량 초과 시 무시
  }
}

export function scDel(...keys: string[]): void {
  if (typeof window === "undefined") return;
  for (const key of keys) {
    try { sessionStorage.removeItem(key); } catch { /* ignore */ }
  }
}

export function scClear(prefix?: string): void {
  if (typeof window === "undefined") return;
  try {
    if (!prefix) { sessionStorage.clear(); return; }
    const toDelete: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(prefix)) toDelete.push(k);
    }
    toDelete.forEach(k => sessionStorage.removeItem(k));
  } catch { /* ignore */ }
}
