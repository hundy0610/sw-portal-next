import { kv } from "@vercel/kv";

// KV TTL: 1시간 (GitHub Actions가 1분마다 갱신하므로 실제로는 항상 최신 상태)
export const KV_TTL = 3600;

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
