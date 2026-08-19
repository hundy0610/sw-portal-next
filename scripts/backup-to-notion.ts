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
  type NotionBackupEntry,
} from "@/lib/backup/notion-map";

const BATCH = 300; // 주기당 엔티티별 최대 처리 건수(과도한 러닝 방지)
const RATE_MS = 350;

/**
 * entity_store 를 쓰지만 애초에 Notion 백업 대상이 아닌 엔티티.
 * upsertEntity/deleteEntity(lib/repo/mirror.ts) 는 모든 엔티티에 공통으로 dirty=true 를
 * 켜므로, 백업 안 할 엔티티도 dirty 행이 쌓인다. 여기 등록해 두면 cleanupUnbackedDirty 가
 * 그 dirty 를 정리한다 — 값은 "왜 백업 대상이 아닌지"이고, 나중에 이 목록을 보는 사람이
 * "빠뜨린 건가?"를 다시 묻지 않게 하기 위한 것이다.
 * (entityRegistry 에도 여기에도 없는 엔티티의 dirty 는 cleanupUnbackedDirty 가 건드리지
 * 않고 경고만 한다 — 레지스트리 등록을 깜빡한 실수일 수 있어서다.)
 */
const NOT_BACKED_UP_ENTITIES: Record<string, string> = {
  "admin-account": "관리자 계정 정보 — Notion 에 두지 않는다.",
  "warehouse": "창고 정의(랙/칸 구성, 데스크탑 앱 설정)이지 자산이 아니다. " +
    "자산의 창고 배치는 public.hw.warehouse/warehouseCell 로 이미 Notion 에 백업된다.",
  "rental-hw": "임대노트북 현황 관리 기능 폐지 — 임대 자산은 이제 public.hw(company=\"임대용\")로 관리된다. " +
    "기존 레코드는 entity_store 에 보관만 하고 더 이상 Notion 으로 백업하지 않는다.",
};

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
      // 원본 Notion 에러의 .code 를 보존한다(isGoneOrArchivedError 판별용).
      const wrapped = new Error(`${label}: ${(e as Error).message}`);
      (wrapped as { code?: string }).code = (e as { code?: string })?.code;
      throw wrapped;
    }
  }
  throw new Error(`${label}: 재시도 초과`);
}

/**
 * Notion 이 "아카이브/삭제되어 편집할 수 없다"고 답하는 경우만 골라낸다.
 *  - validation_error + 메시지에 archived: 다른 프로세스/사람이 이미 아카이브한 페이지
 *  - object_not_found: 휴지통에서 30일 지나 완전히 삭제된 페이지
 * 그 외 에러(권한/네트워크/속성 불일치 등)는 절대 여기 걸리지 않고 그대로 실패 처리된다.
 */
function isGoneOrArchivedError(e: unknown): boolean {
  const code = (e as { code?: string })?.code;
  if (code === "object_not_found") return true;
  if (code === "validation_error") {
    const msg = (e as { message?: string })?.message ?? "";
    return /archived/i.test(msg);
  }
  return false;
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createPage = (r: Record<string, unknown>) => withRetry(
    () => notion.pages.create({
      parent: { database_id: HW_DB_ID },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      properties: buildHwBackupProperties(r) as any,
    }),
    `hw create ${r.id}`,
  );

  for (const r of rows) {
    const id: string = r.id;
    // 낙관적 락: Postgres timestamptz 는 µs 정밀도라 JS Date(ms)로 비교하면 항상 불일치 →
    // dirty 가 안 풀린다. ::text 로 읽은 전체 정밀도 문자열로 WHERE 매칭한다.
    const updatedAt: string = r.updated_at_lock;
    try {
      if (r.deleted) {
        if (r.notion_id) {
          try {
            await withRetry(() => notion.pages.update({ page_id: r.notion_id, archived: true }), `hw archive ${id}`);
          } catch (e) {
            // 이미 아카이브/삭제된 페이지 — 소프트 삭제의 목표 상태는 이미 달성됐으므로 성공 처리.
            if (!isGoneOrArchivedError(e)) throw e;
            console.log(`  ↺ [hw] ${id}: 이미 아카이브/삭제됨(notion_id=${r.notion_id}) → 목표 상태 달성으로 처리`);
          }
        }
        await pg.query(
          `update public.hw set dirty=false, synced_at=now() where id=$1 and updated_at=$2`,
          [id, updatedAt],
        );
        c.archived++;
      } else if (!r.notion_id) {
        const page = await createPage(r);
        await pg.query(
          `update public.hw set dirty=false, synced_at=now(), notion_id=$2, "notionUrl"=$3
             where id=$1 and updated_at=$4`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          [id, page.id, (page as any).url ?? null, updatedAt],
        );
        c.created++;
      } else {
        try {
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
        } catch (e) {
          // 연결된 페이지가 사람/다른 프로세스에 의해 아카이브/삭제됨 — 앱엔 살아있는 레코드이므로
          // 재시도 대신 같은 DB 에 새 페이지를 만들어 notion_id 를 다시 연결한다.
          if (!isGoneOrArchivedError(e)) throw e;
          console.log(`  ↺ [hw] ${id}: 연결된 페이지(${r.notion_id})가 아카이브/삭제됨 → 새 페이지로 재생성`);
          const page = await createPage(r);
          await pg.query(
            `update public.hw set dirty=false, synced_at=now(), notion_id=$2, "notionUrl"=$3
               where id=$1 and updated_at=$4`,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            [id, page.id, (page as any).url ?? null, updatedAt],
          );
          console.log(`  ↺ [hw] ${id}: notion_id ${r.notion_id} → ${page.id}`);
          c.updated++;
        }
      }
    } catch (e) {
      c.failed++;
      console.warn(`  ! [hw] 실패 ${id}: ${(e as Error).message}`);
    }
    await sleep(RATE_MS);
  }
  return c;
}

// entry.databaseId/dataSourceId 에 새 페이지를 만든다(최초 생성 · 아카이브된 페이지 복구 공용).
async function createEntityPage(
  notion: Notion,
  entry: NotionBackupEntry,
  entity: string,
  id: string,
  data: Record<string, unknown>,
): Promise<{ page: { id: string }; newData: Record<string, unknown> | null }> {
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
  return { page, newData };
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
          try {
            await withRetry(() => notion.pages.update({ page_id: r.notion_id, archived: true }), `${entity} archive ${id}`);
          } catch (e) {
            // 이미 아카이브/삭제된 페이지 — 소프트 삭제의 목표 상태는 이미 달성됐으므로 성공 처리.
            if (!isGoneOrArchivedError(e)) throw e;
            console.log(`  ↺ [${entity}] ${id}: 이미 아카이브/삭제됨(notion_id=${r.notion_id}) → 목표 상태 달성으로 처리`);
          }
        }
        await pg.query(
          `update public.entity_store set dirty=false, synced_at=now()
             where entity=$1 and id=$2 and updated_at=$3`,
          [entity, id, updatedAt],
        );
        c.archived++;
      } else if (!r.notion_id) {
        const { page, newData } = await createEntityPage(notion, entry, entity, id, data);
        await pg.query(
          `update public.entity_store set dirty=false, synced_at=now(), notion_id=$3
             ${newData ? ", data=$5::jsonb" : ""}
             where entity=$1 and id=$2 and updated_at=$4`,
          newData ? [entity, id, page.id, updatedAt, JSON.stringify(newData)] : [entity, id, page.id, updatedAt],
        );
        c.created++;
      } else {
        try {
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
        } catch (e) {
          // 연결된 페이지가 사람/다른 프로세스에 의해 아카이브/삭제됨 — 앱엔 살아있는 레코드이므로
          // 재시도 대신 같은 DB 에 새 페이지를 만들어 notion_id 를 다시 연결한다.
          if (!isGoneOrArchivedError(e)) throw e;
          console.log(`  ↺ [${entity}] ${id}: 연결된 페이지(${r.notion_id})가 아카이브/삭제됨 → 새 페이지로 재생성`);
          const { page, newData } = await createEntityPage(notion, entry, entity, id, data);
          await pg.query(
            `update public.entity_store set dirty=false, synced_at=now(), notion_id=$3
               ${newData ? ", data=$5::jsonb" : ""}
               where entity=$1 and id=$2 and updated_at=$4`,
            newData ? [entity, id, page.id, updatedAt, JSON.stringify(newData)] : [entity, id, page.id, updatedAt],
          );
          console.log(`  ↺ [${entity}] ${id}: notion_id ${r.notion_id} → ${page.id}`);
          c.updated++;
        }
      }
    } catch (e) {
      c.failed++;
      console.warn(`  ! [${entity}] 실패 ${id}: ${(e as Error).message}`);
    }
    await sleep(RATE_MS);
  }
  return c;
}

/**
 * 정식 백업(위 backupHw/backupEntity) 이후에 한 번 도는 별도 정리 단계.
 * entityRegistry 에 없는(=위 루프가 손대지 않은) 엔티티에 dirty 행이 남아 있을 때:
 *  - NOT_BACKED_UP_ENTITIES 에 있으면 → 백업 대상이 아니라고 이미 선언된 것이므로 dirty 만
 *    내린다. synced_at 은 건드리지 않는다 — Notion 에 보낸 적이 없는데 동기화 시각을
 *    적으면 거짓이 된다.
 *  - 둘 다 아니면 → 정리하지 않고 경고만 남긴다. 여기서 무조건 dirty 를 내려버리면, 나중에
 *    진짜 백업해야 할 엔티티를 추가하고 레지스트리 등록을 깜빡했을 때 그 실수가 조용히
 *    묻힌다. dirty=true 로 남겨 "밀려 있다"는 신호를 계속 보이게 한다.
 */
async function cleanupUnbackedDirty(pg: Pg): Promise<{ cleaned: number; unknown: number }> {
  const { rows } = await pg.query(
    `select entity, count(*)::int as cnt from public.entity_store where dirty = true group by entity`,
  );
  let cleaned = 0;
  let unknown = 0;
  for (const row of rows as { entity: string; cnt: number }[]) {
    if (entityRegistry[row.entity]) continue; // 정식 등록 엔티티는 위 루프가 이미 처리(실패해도 그대로 둔다)
    const reason = NOT_BACKED_UP_ENTITIES[row.entity];
    if (reason) {
      const { rowCount } = await pg.query(
        `update public.entity_store set dirty = false where entity = $1 and dirty = true`,
        [row.entity],
      );
      console.log(`  [cleanup] [${row.entity}] 백업 대상 아님(${reason}) — dirty ${rowCount}건 정리`);
      cleaned += rowCount ?? 0;
    } else {
      console.warn(`  ! [cleanup] 미등록 엔티티 "${row.entity}" 에 dirty ${row.cnt}건 — 레지스트리 등록 누락 의심, 정리하지 않음`);
      unknown += row.cnt;
    }
  }
  return { cleaned, unknown };
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
    const { cleaned, unknown } = await cleanupUnbackedDirty(pg);
    console.log(
      `✓ 완료 — 생성 ${total.created} / 수정 ${total.updated} / 아카이브 ${total.archived} / 실패 ${total.failed}` +
        (cleaned > 0 ? ` / 백업대상아님정리 ${cleaned}` : "") +
        (unknown > 0 ? ` / 미등록경고 ${unknown}` : "") +
        ` (${Date.now() - started}ms)`,
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
