import { kv } from "@vercel/kv";

// KV TTL: 25시간 (warm-cache가 24h 간격으로 실행되므로 여유 있게 설정)
export const KV_TTL = 90000;

/**
 * KV에서 값 읽기. KV 미설정이거나 오류 시 null 반환 (Notion fallback으로 이어짐)
 */
export async function kvGet<T>(key: string): Promise<T | null> {
  try {
    if (!process.env.KV_REST_API_URL) return null;
    return await kv.get<T>(key);
  } catch {
    return null;
  }
}

/**
 * KV에 값 저장. 오류 시 조용히 무시 (로깅만)
 */
export async function kvSet<T>(key: string, value: T): Promise<void> {
  try {
    if (!process.env.KV_REST_API_URL) return;
    await kv.set(key, value, { ex: KV_TTL });
  } catch (e) {
    console.warn("[KV] set failed:", key, e);
  }
}

/**
 * KV 캐시 삭제. Notion 업데이트 후 캐시 무효화에 사용
 */
export async function kvDel(...keys: string[]): Promise<void> {
  try {
    if (!process.env.KV_REST_API_URL) return;
    await Promise.all(keys.map(k => kv.del(k)));
  } catch (e) {
    console.warn("[KV] del failed:", keys, e);
  }
}
