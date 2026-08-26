/**
 * 초기 이관: 현재 Notion 데이터 → 맥북 Postgres public.entity_store  [1회, 맥북에서]
 *
 * HW 는 별도(scripts/seed-hw.ts)로 이미 이관되어 있고, 이 스크립트는 Batch B/C 로
 * 미러(entity_store)로 전환한 나머지 엔티티들을 대상으로 한다. lib/backup/notion-map.ts
 * 의 seedRegistry 에 등록된 엔티티만 적재한다.
 *
 * 각 레코드는 dirty=false 로 적재한다(방금 Notion 에서 읽은 값 = 이미 동기화 상태).
 * id 와 notion_id 는 기존 Notion page id 로 맞춰, 이후 백업/수정이 같은 페이지를 가리키게 한다.
 * key(entity,id) upsert 이므로 재실행해도 안전하다.
 *
 * 실행:
 *   npm run seed:entities                 # 등록된 전체 엔티티
 *   npm run seed:entities -- sw helpdesk  # 특정 엔티티만
 *
 * 필요 env (.env, git 제외): NOTION_TOKEN, 각 NOTION_DB_* , DATABASE_URL 또는 POSTGRES_PASSWORD
 */
import { Client } from "pg";
import { seedRegistry } from "@/lib/backup/notion-map";

function buildPg(): Client {
  if (process.env.DATABASE_URL) return new Client({ connectionString: process.env.DATABASE_URL });
  const password = process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD;
  if (!password) {
    console.error("✗ DB 접속 정보 없음: .env 에 DATABASE_URL 또는 POSTGRES_PASSWORD 를 설정하세요.");
    process.exit(1);
  }
  return new Client({
    host: process.env.PGHOST || "127.0.0.1",
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || "postgres",
    password,
    database: process.env.PGDATABASE || "postgres",
  });
}

const BATCH = 200;

async function seedEntity(pg: Client, entity: string): Promise<number> {
  const source = seedRegistry[entity];
  if (!source) {
    console.warn(`  ! [${entity}] seedRegistry 미등록 — 건너뜀`);
    return 0;
  }
  console.log(`→ [${entity}] Notion 조회 중...`);
  const records = await source.fetch();
  console.log(`  [${entity}] ${records.length}건`);
  if (records.length === 0) return 0;

  let done = 0;
  for (let i = 0; i < records.length; i += BATCH) {
    const chunk = records.slice(i, i + BATCH);
    const params: unknown[] = [];
    const tuples = chunk.map((r, idx) => {
      const b = idx * 4;
      params.push(entity, r.id, r.notionId, JSON.stringify(r.data));
      return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}::jsonb, false, false, now())`;
    });
    await pg.query(
      `insert into public.entity_store (entity, id, notion_id, data, deleted, dirty, updated_at)
       values ${tuples.join(",")}
       on conflict (entity, id) do update
         set notion_id = excluded.notion_id,
             data = excluded.data,
             deleted = false,
             dirty = false,
             updated_at = now(),
             synced_at = now()`,
      params,
    );
    done += chunk.length;
    process.stdout.write(`  [${entity}] 진행: ${done}/${records.length}\r`);
  }
  console.log(`\n  [${entity}] 적재 완료: ${done}건`);
  return done;
}

async function main() {
  if (!process.env.NOTION_TOKEN) {
    console.error("✗ NOTION_TOKEN 이 .env 에 없습니다.");
    process.exit(1);
  }
  const requested = process.argv.slice(2).filter(a => !a.startsWith("-"));
  const entities = requested.length > 0 ? requested : Object.keys(seedRegistry);
  if (entities.length === 0) {
    console.log("등록된 seed 엔티티가 없습니다(Batch B/C 전환 후 seedRegistry 에 추가됨).");
    return;
  }

  const pg = buildPg();
  await pg.connect();
  try {
    let total = 0;
    for (const entity of entities) total += await seedEntity(pg, entity);
    console.log(`\n✓ seed 완료 — 총 ${total}건 (${entities.length}개 엔티티)`);
  } finally {
    await pg.end();
  }
}

main().catch(e => {
  console.error("✗ " + (e?.stack || e));
  process.exit(1);
});
