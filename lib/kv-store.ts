import { Redis } from "@upstash/redis";

// KV TTL: 24시간 — cold miss 빈도 최소화
// (warm-cache cron 30분 + warm-hw cron 2시간으로 항상 갱신)
export const KV_TTL = 86400;

let _client: Redis | null = null;

function getClient(): Redis | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN  || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  if (_client) return _client;
  try {
    _client = new Redis({ url, token });
    return _client;
  } catch {
    return null;
  }
}

/**
 * KV에서 값 읽기. 미설정이거나 오류 시 null 반환 (Notion fallback으로 이어짐)
 */
export async function kvGet<T>(key: string): Promise<T | null> {
  const client = getClient();
  if (!client) return null;
  try {
    return await client.get<T>(key);
  } catch {
    return null;
  }
}

/**
 * KV에 값 저장 (TTL 있음, 기본 24시간)
 */
export async function kvSet<T>(key: string, value: T, ttl = KV_TTL): Promise<void> {
  const client = getClient();
  if (!client) return;
  try {
    await client.set(key, value, { ex: ttl });
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
    await client.set(key, value);
  } catch (e) {
    console.warn("[KV] setPermanent failed:", key, e);
  }
}

/**
 * KV 다중 키 한 번에 읽기 (네트워크 왕복 1회)
 */
export async function kvMGet<T>(keys: string[]): Promise<(T | null)[]> {
  const client = getClient();
  if (!client || keys.length === 0) return keys.map(() => null);
  try {
    return await client.mget<T[]>(...keys);
  } catch {
    return keys.map(() => null);
  }
}

/**
 * KV 캐시 삭제
 */
export async function kvDel(...keys: string[]): Promise<void> {
  const client = getClient();
  if (!client) return;
  try {
    await client.del(...keys);
  } catch (e) {
    console.warn("[KV] del failed:", keys, e);
  }
}
