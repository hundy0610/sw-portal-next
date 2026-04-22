import Redis from "ioredis";

// KV TTL: 2시간 (cron 30분 주기 × 4배 여유 — cold start 후에도 캐시 생존 보장)
export const KV_TTL = 7200;

let _client: Redis | null = null;

function getClient(): Redis | null {
  if (!process.env.REDIS_URL) return null;
  if (_client) return _client;
  try {
    _client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,   // 3000ms → 2000ms
      enableOfflineQueue: false, // 연결 전 요청 큐잉 비활성화 (빠른 실패)
    });
    _client.on("error", (e) => console.warn("[KV] Redis error:", e.message));
    return _client;
  } catch {
    return null;
  }
}

/**
 * KV에서 값 읽기. KV 미설정이거나 오류 시 null 반환 (Notion fallback으로 이어짐)
 */
export async function kvGet<T>(key: string): Promise<T | null> {
  const client = getClient();
  if (!client) return null;
  try {
    const raw = await client.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * KV에 값 저장 (TTL 있음, 기본 1시간). 오류 시 조용히 무시
 */
export async function kvSet<T>(key: string, value: T, ttl = KV_TTL): Promise<void> {
  const client = getClient();
  if (!client) return;
  try {
    await client.set(key, JSON.stringify(value), "EX", ttl);
  } catch (e) {
    console.warn("[KV] set failed:", key, e);
  }
}

/**
 * KV에 값 영구 저장 (TTL 없음). 공지사항/강의/자료 등 관리 데이터에 사용
 */
export async function kvSetPermanent<T>(key: string, value: T): Promise<void> {
  const client = getClient();
  if (!client) return;
  try {
    await client.set(key, JSON.stringify(value));
  } catch (e) {
    console.warn("[KV] setPermament failed:", key, e);
  }
}

/**
 * KV 캐시 삭제. Notion 업데이트 후 캐시 무효화에 사용
 */
export async function kvDel(...keys: string[]): Promise<void> {
  const client = getClient();
  if (!client) return;
  try {
    await Promise.all(keys.map((k) => client.del(k)));
  } catch (e) {
    console.warn("[KV] del failed:", keys, e);
  }
}
