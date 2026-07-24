/**
 * 5분 단위 Notion 백업 러너 (4.0verMACBOOK) — 맥북 launchd 로 실행.
 *
 * 맥북 Postgres 가 메인 저장소이고, 여기서 dirty=true 로 표시된 행만 Notion 으로
 * 단방향 백업한다(생성/수정/아카이브). Notion 은 읽기 폴백/백업 용도로만 유지된다.
 *
 *   - HW      : typed public.hw 테이블
 *   - 그 외    : public.entity_store (제네릭 미러), lib/backup/notion-map.ts 의 레지스트리 사용
 *
 * 실행:
 *   npm run backup:notion
 *   (= node --env-file=.env --import tsx scripts/backup-to-notion.ts)
 *
 * 필요 env (.env, git 제외):
 *   NOTION_TOKEN                                  (Notion 쓰기)
 *   DATABASE_URL 또는 POSTGRES_PASSWORD          (맥북 로컬 Postgres, 5432 로컬 전용)
 *   (엔티티별 Notion DB id 는 각 NOTION_DB_* env, notion-map.ts 참조)
 *
 * 안전:
 *   - Notion 반영 성공 후에만 dirty=false + synced_at 기록. 실패 행은 다음 주기 재시도.
 *   - dirty 클리어는 updated_at 이 읽은 시점과 동일할 때만(중간에 앱이 또 수정하면 건너뛰어 다음 주기).
 *   - Notion rate limit(3req/s) 회피용 요청 간 350ms + 429/5xx 재시도.
 */
import { Client as Pg } from "pg";
import { Client as Notion } from "@notionhq/client";
import {
  HW_DB_ID,
  buildHwBackupProperties,
  entityRegistry,
} from "@/lib/backup/notion-map";

const BATCH = 300; // 주기당 엔티티별 최대 처리 건수(과도한 러닝 방지)
const RATE_MS = 350;

function buildPg(): Pg {
  if (process.env.DATABASE_URL) return new Pg({ connectionString: process.env.DATABASE_URL });
  const password = process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD;
  if (!password) {
    console.error("✗ DB 접속 정보 없음: .env 에 DATABASE_URL 또는 POSTGRES_PASSWORD 를 설정하세요.");
    process.exit(1);
  }
  return new Pg({
    host: process.env.PGHOST || "127.0.0.1",
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || "postgres",
    password,
    database: process.env.PGDATABASE || "postgres",
  });
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const NOTION_FILE_VER = "2026-03-11";

// Blob 공개 URL 의 파일을 Notion file_uploads 로 올리고 file_upload id 를 반환한다(raw fetch).
async function uploadUrlToNotion(token: string, url: string, name: string): Promise<string> {
  const dl = await fetch(url);
  if (!dl.ok) throw new Error(`파일 다운로드 실패(${dl.status}): ${url}`);
  const contentType = dl.headers.get("content-type") || "application/octet-stream";
  const buffer = Buffer.from(await dl.arrayBuffer());

  const createRes = await fetch("https://api.notion.com/v1/file_uploads", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Notion-Version": NOTION_FILE_VER, "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "single_part", filename: name, content_type: contentType }),
  });
  if (!createRes.ok) throw new Error(`file_uploads 세션 실패: ${await createRes.text()}`);
  const { id } = await createRes.json();

  const fd = new FormData();
  fd.append("file", new Blob([buffer], { type: contentType }), name);
  const sendRes = await fetch(`https://api.notion.com/v1/file_uploads/${id}/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Notion-Version": NOTION_FILE_VER },
    body: fd,
  });
  if (!sendRes.ok) throw new Error(`file_uploads 전송 실패: ${await sendRes.text()}`);
  return id as string;
}

// data_source_id 를 parent 로 하는 페이지 생성(신 Notion API). SDK 기본 버전(2022-06-28)은
// data_source_id parent 를 모르므로 raw fetch + 신 버전 헤더로 생성한다. 생성된 page.id 반환.
async function createPageInDataSource(
  token: string,
  dataSourceId: string,
  properties: Record<string, unknown>,
): Promise<{ id: string }> {
  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Notion-Version": NOTION_FILE_VER, "Content-Type": "application/json" },
    body: JSON.stringify({ parent: { data_source_id: dataSourceId }, properties }),
  });
  if (!res.ok) throw new Error(`pages.create(data_source) 실패: ${await res.text()}`);
  return res.json() as Promise<{ id: string }>;
}

/**
 * 엔티티 파일필드를 처리한다. Blob URL 이 직전 백업(__syncedFiles)과 다르면 Notion 에 재업로드하고
 * files 프로퍼티를 반환한다. 새로 올린 파일은 syncedFiles 에 기록해 다음 주기 재업로드를 막는다.
 */
type FileRef = { url: string; name: string };

async function buildFileProps(
  token: string,
  entry: { files?: { prop: string; get: (d: Record<string, unknown>) => FileRef | FileRef[] | null }[] },
  data: Record<string, unknown>,
): Promise<{ props: Record<string, unknown>; syncedFiles: Record<string, string> }> {
  const props: Record<string, unknown> = {};
  const syncedFiles: Record<string, string> = {};
  if (!entry.files || entry.files.length === 0) return { props, syncedFiles };
  const prev = (data.__syncedFiles as Record<string, string> | undefined) ?? {};

  for (const f of entry.files) {
    const got = f.get(data);
    if (!got) continue; // 파일 없음 → 스킵(기존 유지)
    const refs = (Array.isArray(got) ? got : [got]).filter(r => r.url && /^https?:\/\//.test(r.url));
    if (refs.length === 0) continue;
    // 다중 파일은 URL 목록을 키로 비교 — 하나라도 바뀌면 전체 재업로드(Notion files 는 전체 배열 교체).
    const key = refs.map(r => r.url).join("\n");
    if (prev[f.prop] === key) continue; // 이미 이 구성으로 업로드됨 → 재업로드 안 함
    const uploaded: { type: "file_upload"; name: string; file_upload: { id: string } }[] = [];
    for (const r of refs) {
      const uploadId = await uploadUrlToNotion(token, r.url, r.name || "file");
      uploaded.push({ type: "file_upload", name: r.name || "file", file_upload: { id: uploadId } });
    }
    props[f.prop] = { files: uploaded };
    syncedFiles[f.prop] = key;
  }
  return { props, syncedFiles };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isRetryable(e: any): boolean {
  const s = e?.status ?? e?.code;
  return s === 429 || s === 409 || s === 502 || s === 503 || s === 504;
}

async function withRetry<T>(fn: () => Promise<T>, label: string, max = 3): Promise<T> {
  for (let attempt = 0; attempt < max; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (isRetryable(e) && attempt < max - 1) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
      throw new Error(`${label}: ${(e as Error).message}`);
    }
  }
  throw new Error(`${label}: 재시도 초과`);
}

type Counts = { created: number; updated: number; archived: number; failed: number };

// ── HW (typed hw 테이블) ─────────────────────────────────────────────────────
async function backupHw(pg: Pg, notion: Notion): Promise<Counts> {
  const c: Counts = { created: 0, updated: 0, archived: 0, failed: 0 };
  const { rows } = await pg.query(
    `select *, updated_at::text as updated_at_lock from public.hw where dirty = true order by updated_at asc limit $1`,
    [BATCH],
  );
  if (rows.length === 0) return c;
  console.log(`  [hw] dirty ${rows.length}건`);

  for (const r of rows) {
    const id: string = r.id;
    // 낙관적 락: Postgres timestamptz 는 µs 정밀도라 JS Date(ms)로 비교하면 항상 불일치 →
    // dirty 가 안 풀린다. ::text 로 읽은 전체 정밀도 문자열로 WHERE 매칭한다.
    const updatedAt: string = r.updated_at_lock;
    try {
      if (r.deleted) {
        if (r.notion_id) {
          await withRetry(() => notion.pages.update({ page_id: r.notion_id, archived: true }), `hw archive ${id}`);
        }
        await pg.query(
          `update public.hw set dirty=false, synced_at=now() where id=$1 and updated_at=$2`,
          [id, updatedAt],
        );
        c.archived++;
      } else if (!r.notion_id) {
        const page = await withRetry(
          () => notion.pages.create({
            parent: { database_id: HW_DB_ID },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            properties: buildHwBackupProperties(r) as any,
          }),
          `hw create ${id}`,
        );
        await pg.query(
          `update public.hw set dirty=false, synced_at=now(), notion_id=$2, "notionUrl"=$3
             where id=$1 and updated_at=$4`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          [id, page.id, (page as any).url ?? null, updatedAt],
        );
        c.created++;
      } else {
        await withRetry(
          () => notion.pages.update({
            page_id: r.notion_id,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            properties: buildHwBackupProperties(r) as any,
          }),
          `hw update ${id}`,
        );
        await pg.query(
          `update public.hw set dirty=false, synced_at=now() where id=$1 and updated_at=$2`,
          [id, updatedAt],
        );
        c.updated++;
      }
    } catch (e) {
      c.failed++;
      console.warn(`  ! [hw] 실패 ${id}: ${(e as Error).message}`);
    }
    await sleep(RATE_MS);
  }
  return c;
}

// ── 제네릭 미러(entity_store) ────────────────────────────────────────────────
async function backupEntity(
  pg: Pg,
  notion: Notion,
  entity: string,
): Promise<Counts> {
  const c: Counts = { created: 0, updated: 0, archived: 0, failed: 0 };
  const entry = entityRegistry[entity];
  if (!entry) return c;
  if (!entry.databaseId && !entry.dataSourceId) {
    console.warn(`  ! [${entity}] databaseId/dataSourceId 미설정(env) — 건너뜀`);
    return c;
  }

  const { rows } = await pg.query(
    `select id, notion_id, data, deleted, updated_at, updated_at::text as updated_at_lock
       from public.entity_store where entity=$1 and dirty=true order by updated_at asc limit $2`,
    [entity, BATCH],
  );
  if (rows.length === 0) return c;
  console.log(`  [${entity}] dirty ${rows.length}건`);

  for (const r of rows) {
    const id: string = r.id;
    // 낙관적 락: µs 정밀도 보존을 위해 ::text 로 읽은 전체 정밀도 문자열 사용(위 hw 주석 참조).
    const updatedAt: string = r.updated_at_lock;
    const data = (r.data ?? {}) as Record<string, unknown>;
    try {
      if (r.deleted) {
        if (r.notion_id) {
          await withRetry(() => notion.pages.update({ page_id: r.notion_id, archived: true }), `${entity} archive ${id}`);
        }
        await pg.query(
          `update public.entity_store set dirty=false, synced_at=now()
             where entity=$1 and id=$2 and updated_at=$3`,
          [entity, id, updatedAt],
        );
        c.archived++;
      } else if (!r.notion_id) {
        const { props: fileProps, syncedFiles } = await buildFileProps(process.env.NOTION_TOKEN as string, entry, data);
        const properties = { ...entry.buildProperties(data), ...fileProps };
        const page = await withRetry(
          () => entry.dataSourceId
            ? createPageInDataSource(process.env.NOTION_TOKEN as string, entry.dataSourceId, properties)
            : notion.pages.create({
                parent: { database_id: entry.databaseId as string },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                properties: properties as any,
              }),
          `${entity} create ${id}`,
        );
        const newData = Object.keys(syncedFiles).length
          ? { ...data, __syncedFiles: { ...((data.__syncedFiles as object) ?? {}), ...syncedFiles } }
          : null;
        await pg.query(
          `update public.entity_store set dirty=false, synced_at=now(), notion_id=$3
             ${newData ? ", data=$5::jsonb" : ""}
             where entity=$1 and id=$2 and updated_at=$4`,
          newData ? [entity, id, page.id, updatedAt, JSON.stringify(newData)] : [entity, id, page.id, updatedAt],
        );
        c.created++;
      } else {
        const { props: fileProps, syncedFiles } = await buildFileProps(process.env.NOTION_TOKEN as string, entry, data);
        const properties = { ...entry.buildProperties(data), ...fileProps };
        await withRetry(
          () => notion.pages.update({
            page_id: r.notion_id,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            properties: properties as any,
          }),
          `${entity} update ${id}`,
        );
        const newData = Object.keys(syncedFiles).length
          ? { ...data, __syncedFiles: { ...((data.__syncedFiles as object) ?? {}), ...syncedFiles } }
          : null;
        await pg.query(
          `update public.entity_store set dirty=false, synced_at=now()
             ${newData ? ", data=$4::jsonb" : ""}
             where entity=$1 and id=$2 and updated_at=$3`,
          newData ? [entity, id, updatedAt, JSON.stringify(newData)] : [entity, id, updatedAt],
        );
        c.updated++;
      }
    } catch (e) {
      c.failed++;
      console.warn(`  ! [${entity}] 실패 ${id}: ${(e as Error).message}`);
    }
    await sleep(RATE_MS);
  }
  return c;
}

function add(a: Counts, b: Counts): Counts {
  return {
    created: a.created + b.created,
    updated: a.updated + b.updated,
    archived: a.archived + b.archived,
    failed: a.failed + b.failed,
  };
}

async function main() {
  if (!process.env.NOTION_TOKEN) {
    console.error("✗ NOTION_TOKEN 이 .env 에 없습니다.");
    process.exit(1);
  }
  const started = Date.now();
  const pg = buildPg();
  await pg.connect();
  const notion = new Notion({ auth: process.env.NOTION_TOKEN });

  let total: Counts = { created: 0, updated: 0, archived: 0, failed: 0 };
  try {
    console.log(`▶ Notion 백업 시작: ${new Date().toISOString()}`);
    total = add(total, await backupHw(pg, notion));
    for (const entity of Object.keys(entityRegistry)) {
      total = add(total, await backupEntity(pg, notion, entity));
    }
    console.log(
      `✓ 완료 — 생성 ${total.created} / 수정 ${total.updated} / 아카이브 ${total.archived} / 실패 ${total.failed} (${Date.now() - started}ms)`,
    );
  } finally {
    await pg.end();
  }

  // 실패가 있으면 비정상 종료 코드로 알림(로그 확인용). launchd 는 재시도하지 않고 다음 주기 진행.
  if (total.failed > 0) process.exit(2);
}

main().catch(e => {
  console.error("✗ " + (e?.stack || e));
  process.exit(1);
});
