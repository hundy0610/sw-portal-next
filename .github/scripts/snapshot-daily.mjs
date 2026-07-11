/**
 * .github/scripts/snapshot-daily.mjs
 *
 * GitHub Actions에서 직접 실행 — Node.js 18+ 내장 fetch 사용, 외부 패키지 없음.
 * 이미 warm-hw.yml / warm-cache.yml이 채워둔 Upstash 캐시(hw:stats, sw:all)를
 * 그대로 읽어 핵심 지표 스냅샷을 날짜별 키로 저장한다.
 * (Notion을 다시 조회하지 않음 — 기존 캐시 재사용)
 *
 * 환경변수 (GitHub Secrets에 등록 필요):
 *   UPSTASH_REDIS_REST_URL    — Upstash Redis REST URL
 *   UPSTASH_REDIS_REST_TOKEN  — Upstash Redis REST Token
 */

const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!UPSTASH_URL)   { console.error("❌ UPSTASH_REDIS_REST_URL 미설정"); process.exit(1); }
if (!UPSTASH_TOKEN) { console.error("❌ UPSTASH_REDIS_REST_TOKEN 미설정"); process.exit(1); }

async function upstashPipeline(commands) {
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`Upstash API ${res.status}: ${await res.text()}`);
  return res.json();
}

// @upstash/redis 클라이언트(lib/kv-store.ts)로 저장된 값은 JSON 문자열로 직렬화되어 있음
function parseResult(raw) {
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function main() {
  console.log(`[snapshot-daily] 시작: ${new Date().toISOString()}`);

  const [hwStatsRes, swAllRes] = await upstashPipeline([
    ["GET", "hw:stats"],
    ["GET", "sw:all"],
  ]);

  const hwStats = parseResult(hwStatsRes.result);
  const swAll   = parseResult(swAllRes.result);

  const hwTotal = typeof hwStats?.total === "number" ? hwStats.total : null;
  const swTotal = Array.isArray(swAll) ? swAll.length : null;

  if (hwTotal === null) console.warn("  ⚠️ hw:stats 캐시 없음 — hwTotal 생략");
  if (swTotal === null) console.warn("  ⚠️ sw:all 캐시 없음 — swTotal 생략");

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const snapshot = {
    date: today,
    capturedAt: new Date().toISOString(),
    hwTotal,
    swTotal,
  };

  console.log(`[snapshot-daily] snapshot:${today} 저장 중...`, snapshot);
  await upstashPipeline([
    ["SET", `snapshot:${today}`, JSON.stringify(snapshot)],
  ]);

  console.log(`[snapshot-daily] 완료`);
}

main().catch(e => {
  console.error("[snapshot-daily] 오류:", e.message);
  process.exit(1);
});
