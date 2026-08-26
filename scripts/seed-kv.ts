/**
 * 초기 데이터 이관: 기존 Upstash Redis(KV) → 맥북 Postgres public.kv  [1회, 맥북에서]
 *
 * 계정/공지/설정/매뉴얼 등 KV에 저장된 운영 데이터를 유실 없이 옮긴다.
 * KV는 전부 문자열(JSON) 타입만 사용하므로 SCAN + GET + PTTL 로 안전하게 복사한다.
 *
 * 실행:
 *   npm run seed:kv
 *   (= node --env-file=.env --import tsx scripts/seed-kv.ts)
 *
 * 필요 env (.env, git 제외):
 *   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN   (또는 KV_REST_API_URL / KV_REST_API_TOKEN)
 *     └ 현재 운영 Upstash 자격증명(읽기 전용으로만 사용). 프로덕션 env는 건드리지 않고 값만 받아 사용.
 *   DATABASE_URL 또는 POSTGRES_PASSWORD  (맥북 로컬 Postgres 쓰기용, 5432 로컬 전용)
 *
 * 안전: Upstash는 읽기만 하고 변경하지 않는다. Postgres는 key 기준 upsert(재실행 안전).
 */
import { Redis } from "@upstash/redis";
import { Client } from "pg";

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

function die(msg: string): never {
  console.error("✗ " + msg);
  process.exit(1);
}

if (!url || !token) {
  die("Upstash 자격증명(UPSTASH_REDIS_REST_URL/TOKEN 또는 KV_REST_API_URL/TOKEN)이 .env 에 없습니다.");
}

function buildPgClient(): Client {
  if (process.env.DATABASE_URL) return new Client({ connectionString: process.env.DATABASE_URL });
  const password = process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD;
  if (!password) die("DB 접속 정보 없음: .env 에 DATABASE_URL 또는 POSTGRES_PASSWORD 를 설정하세요.");
  return new Client({
    host: process.env.PGHOST || "127.0.0.1",
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || "postgres",
    password,
    database: process.env.PGDATABASE || "postgres",
  });
}

const BATCH = 200;

async function main() {
  const redis = new Redis({ url: url as string, token: token as string });
  const pg = buildPgClient();
  await pg.connect();

  try {
    // 1) 전체 키 수집 (SCAN)
    console.log("→ Upstash 키 스캔 중...");
    const keys: string[] = [];
    let cursor = "0";
    do {
      const [next, batch] = await redis.scan(cursor, { count: 500 });
      cursor = next;
      keys.push(...batch);
    } while (cursor !== "0");
    console.log(`  키 수: ${keys.length}`);
    if (keys.length === 0) die("Upstash 에서 0개 키 조회됨 — 자격증명/URL 확인 필요.");

    // 2) 값 + TTL 조회 후 Postgres upsert
    console.log(`→ Postgres kv 로 upsert (배치 ${BATCH})...`);
    let done = 0;
    let skipped = 0;

    for (let i = 0; i < keys.length; i += BATCH) {
      const chunk = keys.slice(i, i + BATCH);

      // 각 키의 타입/값/남은TTL 병렬 조회 (KV는 전부 string 타입)
      const rows = await Promise.all(
        chunk.map(async key => {
          try {
            const type = await redis.type(key);
            if (type !== "string") {
              skipped++;
              return null; // 해시/셋/리스트 등은 앱이 쓰지 않음 — 스킵
            }
            const [value, pttl] = await Promise.all([redis.get(key), redis.pttl(key)]);
            // pttl: -1 = 만료없음(영구), -2 = 키없음(만료됨) → 스킵
            if (pttl === -2) { skipped++; return null; }
            const expiresAt = pttl > 0 ? new Date(Date.now() + pttl).toISOString() : null;
            return { key, value: JSON.stringify(value ?? null), expiresAt };
          } catch (e) {
            skipped++;
            console.warn(`  ! 스킵(${key}): ${(e as Error).message}`);
            return null;
          }
        }),
      );

      const valid = rows.filter((r): r is NonNullable<typeof r> => r !== null);
      if (valid.length === 0) continue;

      // 다중행 upsert
      const params: unknown[] = [];
      const tuples = valid.map((r, idx) => {
        const b = idx * 3;
        params.push(r.key, r.value, r.expiresAt);
        return `($${b + 1}, $${b + 2}::jsonb, $${b + 3}::timestamptz, now())`;
      });
      await pg.query(
        `insert into public.kv (key, value, expires_at, updated_at)
         values ${tuples.join(",")}
         on conflict (key) do update
           set value = excluded.value,
               expires_at = excluded.expires_at,
               updated_at = now()`,
        params,
      );

      done += valid.length;
      process.stdout.write(`  진행: ${done}/${keys.length}\r`);
    }

    console.log(`\n  upsert 완료: ${done} 건, 스킵: ${skipped} 건`);

    // 3) 검증: Postgres kv 총 건수
    const { rows: cntRows } = await pg.query<{ count: string }>("select count(*)::int as count from public.kv");
    const pgCount = Number(cntRows[0]?.count ?? 0);

    console.log("\n=== 정합성 검증 ===");
    console.log(`  Upstash 키(string) 이관: ${done}`);
    console.log(`  Postgres kv 총 행수     : ${pgCount}`);

    // 샘플 스팟체크 (앞 3개 키 존재 확인 — 값 자체는 출력하지 않음)
    const sampleKeys = keys.slice(0, 3);
    const { rows: sample } = await pg.query<{ key: string }>(
      "select key from public.kv where key = any($1)",
      [sampleKeys],
    );
    console.log(`  샘플 키 존재 확인       : ${sample.map(s => s.key).join(", ") || "(없음)"}`);

    console.log("\n✓ KV 이관 완료.");
  } finally {
    await pg.end();
  }
}

main().catch(e => die(String(e?.stack || e)));
