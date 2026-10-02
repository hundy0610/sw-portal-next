// SW 자료실(버전·문서)과 자료실 매뉴얼 저장소 — 맥북 Postgres(entity_store).
//
// 예전에는 lib/notion.ts 가 Notion DB 3개(SW_VERSIONS·SW_DOCS·MANUALS)를 직접 읽고 썼고,
// 첨부 원본도 Notion 이 갖고 있었다. /api/sw-docs/[id]/file 은 요청마다 Notion 페이지를
// 조회해 1시간짜리 서명 URL 로 리다이렉트했다 — Notion 이 없으면 통째로 죽는 구조였다.
//
// 이관(scripts/seed-sw-resources.ts) 결과:
//   · 레코드 304건(버전 76 · 문서 225 · 매뉴얼 3)이 entity_store 로 들어갔다.
//   · 첨부 원본은 Vercel Blob 으로 옮겼다. 이제 fileUrl 이 영구 URL 이라 중계가 필요 없다.
//   · 1.58GB 짜리 설치파일 하나만 남겨뒀다(사내 네이버웍스 드라이브 링크로 교체 예정).
//
// 첨부를 새로 올리는 경로는 /api/sw-docs/upload · /api/manuals/upload 로 그대로다
// (Vercel Blob, 4MB 이하). 그보다 큰 파일은 드라이브 링크를 externalFileUrl 로 받는다.
import { randomUUID } from "node:crypto";
import type { SwVersion, SwDoc, Manual } from "@/types/portal";
import { readEntity, readEntityOne, upsertEntity, deleteEntity } from "@/lib/repo/mirror";

export const SW_VERSION_ENTITY = "sw-version";
export const SW_DOC_ENTITY = "sw-doc";
export const MANUAL_ENTITY = "manual";

/** 첨부 지정. externalFileUrl 이 오면 교체, clearFile 이면 비운다. 없으면 기존 유지. */
export interface FileOpts {
  externalFileUrl?: string;
  externalFileName?: string;
  clearFile?: boolean;
}

function applyFile<T extends { fileUrl?: string; fileName?: string }>(base: T, opts?: FileOpts): T {
  if (!opts) return base;
  if (opts.clearFile) return { ...base, fileUrl: undefined, fileName: undefined };
  if (opts.externalFileUrl) {
    return { ...base, fileUrl: opts.externalFileUrl, fileName: opts.externalFileName ?? base.fileName };
  }
  return base;
}

/** 지정된 키만 덮어쓴다 — 라우트가 body 에 없던 키를 undefined 로 흘려도 기존 값이 남는다. */
function merge<T extends object>(base: T, patch: Partial<T>): T {
  const next = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) (next as Record<string, unknown>)[k] = v;
  }
  return next;
}

const byOrder = (a: { order: number }, b: { order: number }): number => (a.order ?? 0) - (b.order ?? 0);

// ── SW 버전 ──────────────────────────────────────────────────────────────────

export async function fetchSwVersions(onlyVisible = true): Promise<SwVersion[]> {
  const rows = (await readEntity<SwVersion>(SW_VERSION_ENTITY)) ?? [];
  return rows.filter(v => !onlyVisible || v.visible).sort(byOrder);
}

export async function createSwVersion(data: Omit<SwVersion, "id">): Promise<string> {
  const id = randomUUID();
  const record: SwVersion = { ...data, id, tier: data.tier || "업무용", os: data.os ?? [] };
  if (!(await upsertEntity(SW_VERSION_ENTITY, id, record))) throw new Error("SW 버전 저장 실패(Postgres)");
  return id;
}

export async function updateSwVersion(id: string, data: Partial<Omit<SwVersion, "id">>): Promise<void> {
  const base = await readEntityOne<SwVersion>(SW_VERSION_ENTITY, id);
  if (!base) throw new Error("대상 SW 버전을 찾을 수 없습니다.");
  if (!(await upsertEntity(SW_VERSION_ENTITY, id, merge(base, data)))) throw new Error("SW 버전 저장 실패(Postgres)");
}

export async function archiveSwVersion(id: string): Promise<void> {
  if (!(await deleteEntity(SW_VERSION_ENTITY, id))) throw new Error("SW 버전 삭제 실패(Postgres)");
}

// ── SW 문서 ──────────────────────────────────────────────────────────────────

export async function fetchSwDocs(versionId?: string, onlyVisible = true): Promise<SwDoc[]> {
  const rows = (await readEntity<SwDoc>(SW_DOC_ENTITY)) ?? [];
  return rows
    .filter(d => (!onlyVisible || d.visible) && (!versionId || d.versionId === versionId))
    .sort(byOrder);
}

export async function createSwDoc(data: Omit<SwDoc, "id">, opts?: FileOpts): Promise<string> {
  const id = randomUUID();
  const record = applyFile<SwDoc>({ ...data, id }, opts);
  if (!(await upsertEntity(SW_DOC_ENTITY, id, record))) throw new Error("SW 문서 저장 실패(Postgres)");
  return id;
}

export async function updateSwDoc(id: string, data: Partial<Omit<SwDoc, "id">>, opts?: FileOpts): Promise<void> {
  const base = await readEntityOne<SwDoc>(SW_DOC_ENTITY, id);
  if (!base) throw new Error("대상 SW 문서를 찾을 수 없습니다.");
  if (!(await upsertEntity(SW_DOC_ENTITY, id, applyFile(merge(base, data), opts)))) {
    throw new Error("SW 문서 저장 실패(Postgres)");
  }
}

export async function archiveSwDoc(id: string): Promise<void> {
  if (!(await deleteEntity(SW_DOC_ENTITY, id))) throw new Error("SW 문서 삭제 실패(Postgres)");
}

/** 다운로드·미리보기용 첨부 URL. 없으면 null. */
export async function findSwDocFileUrl(id: string): Promise<{ url: string; name?: string } | null> {
  const doc = await readEntityOne<SwDoc>(SW_DOC_ENTITY, id);
  return doc?.fileUrl ? { url: doc.fileUrl, name: doc.fileName } : null;
}

// ── 자료실 매뉴얼 ────────────────────────────────────────────────────────────

export async function fetchManuals(onlyVisible = true): Promise<Manual[]> {
  const rows = (await readEntity<Manual>(MANUAL_ENTITY)) ?? [];
  return rows.filter(m => !onlyVisible || m.visible).sort(byOrder);
}

export async function fetchManualBySlug(slug: string, allowHidden = false): Promise<Manual | null> {
  const rows = (await readEntity<Manual>(MANUAL_ENTITY)) ?? [];
  return rows.find(m => m.slug === slug && (allowHidden || m.visible)) ?? null;
}

export async function createManual(data: Omit<Manual, "id">, opts?: FileOpts): Promise<string> {
  const id = randomUUID();
  const record = applyFile<Manual>({ ...data, id }, opts);
  if (!(await upsertEntity(MANUAL_ENTITY, id, record))) throw new Error("매뉴얼 저장 실패(Postgres)");
  return id;
}

export async function updateManual(id: string, data: Partial<Omit<Manual, "id">>, opts?: FileOpts): Promise<void> {
  const base = await readEntityOne<Manual>(MANUAL_ENTITY, id);
  if (!base) throw new Error("대상 매뉴얼을 찾을 수 없습니다.");
  if (!(await upsertEntity(MANUAL_ENTITY, id, applyFile(merge(base, data), opts)))) {
    throw new Error("매뉴얼 저장 실패(Postgres)");
  }
}

export async function archiveManual(id: string): Promise<void> {
  if (!(await deleteEntity(MANUAL_ENTITY, id))) throw new Error("매뉴얼 삭제 실패(Postgres)");
}
