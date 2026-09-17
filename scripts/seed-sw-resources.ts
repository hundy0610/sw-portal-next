/**
 * SW 자료실(버전·문서)과 자료실 매뉴얼을 Notion → entity_store 로 1회 이관한다.
 *
 * 왜 seed-entities.ts 를 안 쓰나: 그쪽은 파일을 Notion 에 그대로 두고 URL 만 옮긴다.
 * 여기는 Notion 을 걷어내는 것이 목적이라 **첨부 원본까지 Vercel Blob 으로 옮긴다**.
 * Notion 파일 URL 은 1시간 서명이라 그대로 저장하면 곧 죽는다.
 *
 * 실행 (맥북, 1회):
 *   node --env-file=.env --import tsx scripts/seed-sw-resources.ts          # 드라이런
 *   node --env-file=.env --import tsx scripts/seed-sw-resources.ts --write  # 실제 반영
 *
 * 필요 env: NOTION_TOKEN, NOTION_DB_SW_VERSIONS, NOTION_DB_SW_DOCS,
 *           NOTION_DB_MANUALS, BLOB_READ_WRITE_TOKEN, SUPABASE_URL, SUPABASE_KEY
 */
import { Client } from "@notionhq/client";
import type { PageObjectResponse, QueryDatabaseParameters } from "@notionhq/client/build/src/api-endpoints";
import { put } from "@vercel/blob";
import { createClient } from "@supabase/supabase-js";

const WRITE = process.argv.includes("--write");

/** 이 크기를 넘는 첨부는 Blob 으로 옮기지 않는다 — 사내 드라이브로 뺄 것들이다. */
const MAX_BLOB_BYTES = 200 * 1024 * 1024;
const OVERSIZE_NOTE = "※ 대용량 파일입니다. 사내 네이버웍스 드라이브 링크로 교체 예정입니다.";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

// ── Notion 프로퍼티 파서 (lib/notion.ts 와 같은 판정) ────────────────────────
type Props = PageObjectResponse["properties"];
const text = (p: Props, k: string): string => {
  const v = p[k];
  if (!v) return "";
  if (v.type === "title") return v.title.map(t => t.plain_text).join("");
  if (v.type === "rich_text") return v.rich_text.map(t => t.plain_text).join("");
  if (v.type === "url") return v.url ?? "";
  return "";
};
const select = (p: Props, k: string): string => {
  const v = p[k];
  if (v?.type === "select") return v.select?.name ?? "";
  if (v?.type === "status") return v.status?.name ?? "";
  return "";
};
const multi = (p: Props, k: string): string[] => {
  const v = p[k];
  return v?.type === "multi_select" ? v.multi_select.map(s => s.name) : [];
};
const check = (p: Props, k: string): boolean => {
  const v = p[k];
  return v?.type === "checkbox" ? v.checkbox : false;
};
const num = (p: Props, k: string): number => {
  const v = p[k];
  return v?.type === "number" ? (v.number ?? 0) : 0;
};

async function queryAll(dbId: string, sorts?: QueryDatabaseParameters["sorts"]): Promise<PageObjectResponse[]> {
  const out: PageObjectResponse[] = [];
  let cursor: string | undefined;
  for (;;) {
    const res = await notion.databases.query({ database_id: dbId, start_cursor: cursor, page_size: 100, sorts });
    out.push(...(res.results as PageObjectResponse[]));
    if (!res.has_more || !res.next_cursor) break;
    cursor = res.next_cursor;
  }
  return out;
}

// ── 첨부 이전 ────────────────────────────────────────────────────────────────
interface Attachment { fileUrl?: string; fileName?: string; oversize?: boolean }

async function moveAttachment(p: Props, label: string): Promise<Attachment> {
  const prop = p["파일과 미디어"];
  if (prop?.type !== "files" || prop.files.length === 0) return {};

  const f = prop.files[0];
  const fileName = f.name || undefined;

  // 이미 외부 URL(Blob·구글 등)이면 그대로 둔다 — 옮길 것이 없다.
  // type 이 옵셔널이라 좁혀지지 않으므로 속성 존재로 가른다.
  if (!("file" in f)) return { fileUrl: f.external.url, fileName };

  const url = f.file.url;
  const head = await fetch(url, { headers: { Range: "bytes=0-0" } });
  const range = head.headers.get("content-range");
  const size = range ? Number(range.split("/")[1]) : Number(head.headers.get("content-length") ?? 0);
  await head.body?.cancel();

  if (size > MAX_BLOB_BYTES) {
    console.log(`    · 첨부 ${(size / 1048576).toFixed(0)}MB — 너무 커서 건너뜀 (${label})`);
    return { fileName, oversize: true };
  }

  if (!WRITE) {
    console.log(`    · 첨부 ${(size / 1048576).toFixed(2)}MB → Blob 예정 (${label})`);
    return { fileUrl: "(dry-run)", fileName };
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`첨부 내려받기 실패 ${res.status} — ${label}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const safe = (fileName ?? "file").replace(/[^\w가-힣.\-]+/g, "_");
  const { url: blobUrl } = await put(`sw-resources/${crypto.randomUUID()}-${safe}`, buf, {
    access: "public",
    contentType: res.headers.get("content-type") || "application/octet-stream",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  console.log(`    · 첨부 ${(size / 1048576).toFixed(2)}MB → Blob 완료 (${label})`);
  return { fileUrl: blobUrl, fileName };
}

// ── 미러 기록 ────────────────────────────────────────────────────────────────
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function upsertAll(entity: string, rows: { id: string; data: unknown }[]): Promise<void> {
  if (!WRITE) return;
  // dirty=false 로 넣는다 — Notion 백업 대상이 아니다(곧 백업 자체를 내린다).
  const payload = rows.map(r => ({
    entity, id: r.id, data: r.data, deleted: false, dirty: false,
    updated_at: new Date().toISOString(),
  }));
  for (let i = 0; i < payload.length; i += 100) {
    const { error } = await supabase.from("entity_store").upsert(payload.slice(i, i + 100), { onConflict: "entity,id" });
    if (error) throw new Error(`${entity} 기록 실패: ${error.message}`);
  }
}

// ── 본체 ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log(WRITE ? "▶ 실제 반영 모드\n" : "▶ 드라이런 (아무것도 쓰지 않습니다)\n");

  let oversize = 0;

  // SW 버전
  const verDb = process.env.NOTION_DB_SW_VERSIONS;
  if (!verDb) throw new Error("NOTION_DB_SW_VERSIONS 미설정");
  const versions = (await queryAll(verDb, [{ property: "순서", direction: "ascending" }])).map(page => {
    const p = page.properties;
    return {
      id: page.id,
      data: {
        id: page.id,
        name: text(p, "SW명"),
        version: text(p, "버전"),
        category: select(p, "카테고리"),
        tier: select(p, "구분") || "업무용",
        os: multi(p, "OS"),
        description: text(p, "설명"),
        visible: check(p, "공개여부"),
        order: num(p, "순서"),
      },
    };
  });
  console.log(`SW 버전     ${versions.length}건`);
  await upsertAll("sw-version", versions);

  // SW 문서 (첨부 있음)
  const docDb = process.env.NOTION_DB_SW_DOCS;
  if (!docDb) throw new Error("NOTION_DB_SW_DOCS 미설정");
  const docPages = await queryAll(docDb, [{ property: "순서", direction: "ascending" }]);
  const docs = [];
  for (const page of docPages) {
    const p = page.properties;
    const rel = p["SW 버전"];
    const att = await moveAttachment(p, text(p, "파일명") || page.id);
    if (att.oversize) oversize++;
    const desc = text(p, "텍스트");
    docs.push({
      id: page.id,
      data: {
        id: page.id,
        name: text(p, "파일명"),
        type: select(p, "선택"),
        description: att.oversize ? `${desc}\n${OVERSIZE_NOTE}`.trim() : desc,
        versionId: rel?.type === "relation" && rel.relation.length > 0 ? rel.relation[0].id : "",
        visible: check(p, "공개 여부"),
        order: num(p, "순서"),
        fileUrl: att.fileUrl,
        fileName: att.fileName,
      },
    });
  }
  console.log(`SW 문서     ${docs.length}건`);
  await upsertAll("sw-doc", docs);

  // 자료실 매뉴얼 (첨부 있음)
  const manDb = process.env.NOTION_DB_MANUALS;
  if (!manDb) throw new Error("NOTION_DB_MANUALS 미설정");
  const manPages = await queryAll(manDb, [{ property: "순서", direction: "ascending" }]);
  const manuals = [];
  for (const page of manPages) {
    const p = page.properties;
    const att = await moveAttachment(p, text(p, "제목") || page.id);
    if (att.oversize) oversize++;
    manuals.push({
      id: page.id,
      data: {
        id: page.id,
        title: text(p, "제목"),
        slug: text(p, "슬러그"),
        category: select(p, "카테고리"),
        description: text(p, "설명"),
        visible: check(p, "공개 여부"),
        order: num(p, "순서"),
        fileUrl: att.fileUrl,
        fileName: att.fileName,
      },
    });
  }
  console.log(`자료실 매뉴얼 ${manuals.length}건`);
  await upsertAll("manual", manuals);

  console.log(`\n합계 ${versions.length + docs.length + manuals.length}건`
    + (oversize ? ` · 대용량으로 건너뛴 첨부 ${oversize}개(안내문구 추가)` : ""));
  if (!WRITE) console.log("실제 반영은 --write 를 붙여 다시 실행하세요.");
}

main().catch(e => { console.error("✗", e instanceof Error ? e.message : e); process.exit(1); });
