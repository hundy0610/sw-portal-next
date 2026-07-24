/**
 * DB 스키마 마이그레이션 러너 (4.0verMACBOOK)
 *
 * scripts/sql/*.sql 파일을 이름(번호)순으로 확인해, 아직 적용되지 않은 것만 트랜잭션으로
 * 실행하고 public.schema_migrations 에 기록한다. 이미 적용된 파일은 건너뛴다.
 * (각 .sql 은 create ... if not exists / drop policy if exists 등 재실행 안전하게 작성)
 *
 * 중앙 DB(맥북 Postgres)에서 실행한다 — 5432 는 로컬 전용(Funnel 미노출)이라 원격 불가.
 *
 * 실행:
 *   npm run migrate
 *   (= node --env-file=.env --import tsx scripts/migrate.ts)
 *
 * 접속 우선순위(.env):
 *   1) DATABASE_URL   예: postgres://postgres:<PW>@127.0.0.1:5432/postgres
 *   2) PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE (기본 127.0.0.1/5432/postgres/postgres)
 *   3) POSTGRES_PASSWORD 만 있으면 비밀번호로 사용(supabase docker .env 값)
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

const SQL_DIR = path.join(process.cwd(), "scripts", "sql");

function buildClient(): Client {
  if (process.env.DATABASE_URL) {
    return new Client({ connectionString: process.env.DATABASE_URL });
  }
  const password = process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD;
  if (!password) {
    console.error(
      "✗ DB 접속 정보 없음: .env 에 DATABASE_URL 또는 POSTGRES_PASSWORD(PGPASSWORD) 를 설정하세요.",
    );
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

async function main() {
  const client = buildClient();
  await client.connect();
  try {
    await client.query(`
      create table if not exists public.schema_migrations (
        "version"    text primary key,
        "applied_at" timestamptz default now()
      );
    `);

    const files = (await readdir(SQL_DIR)).filter(f => f.endsWith(".sql")).sort();
    if (files.length === 0) {
      console.log("적용할 .sql 파일이 없습니다.");
      return;
    }

    const { rows } = await client.query<{ version: string }>(
      "select version from public.schema_migrations",
    );
    const applied = new Set(rows.map(r => r.version));

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`  = 이미 적용됨: ${file}`);
        continue;
      }
      const sql = await readFile(path.join(SQL_DIR, file), "utf8");
      console.log(`  + 적용 중  : ${file}`);
      try {
        await client.query("begin");
        await client.query(sql);
        await client.query("insert into public.schema_migrations (version) values ($1)", [file]);
        await client.query("commit");
        ran++;
      } catch (e) {
        await client.query("rollback").catch(() => {});
        throw new Error(`마이그레이션 실패: ${file}\n${(e as Error).message}`);
      }
    }

    console.log(`\n✓ 완료 — 신규 적용 ${ran}건 / 총 ${files.length}개 파일`);
  } finally {
    await client.end();
  }
}

main().catch(e => {
  console.error("✗ " + (e?.stack || e));
  process.exit(1);
});
