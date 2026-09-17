// 스마트오피스 모니터 관리 저장소 — 맥북 Postgres(entity_store) 직접 접근.
//
// 예전에는 lib/notion.ts 가 Notion DB 3개(MONITOR_ASSETS·MONITOR_HISTORY·FLOOR_MAPS)를
// 직접 읽고 썼다. 그런데 같은 데이터가 이미 미러에 들어가 있고 데스크탑 앱
// (assetify-for-desktop core/repo/monitor.ts)이 그쪽을 메인으로 쓰고 있었다 —
// 둘을 잇는 장치가 없어(이 세 엔티티는 5분 백업 대상 목록에도 없다) 포털만 옛 도면을
// 보여주고 있었다. 실측(2026-09-16): 도면 미러 최종수정 09-11 vs Notion 07-10.
//
// 그래서 저장소를 미러로 옮긴다. 레코드 모양과 함수 시그니처는 그대로라 화면(AssetMapPanel,
// MonitorAssetSection)은 손대지 않는다.
//
// 데스크탑과 다른 점: 여기는 Electron 밖이라 로컬 SQLite 캐시가 없다. readEntity 로
// 매번 미러를 읽는다(자산 95·이력 11·도면 15건이라 전량 조회가 부담되지 않는다).
import { randomUUID } from "node:crypto";
import { readEntity, readEntityOne, upsertEntity } from "@/lib/repo/mirror";
import { uploadToBlob } from "@/lib/blob-store";

export const MONITOR_ASSET_ENTITY = "monitor-asset";
export const MONITOR_HISTORY_ENTITY = "monitor-history";
export const FLOOR_MAP_ENTITY = "floor-map";

// ── 모니터 자산 ──────────────────────────────────────────────────────────────

export interface MonitorAsset {
  id: string;
  /** 도면의 좌석(PlacedItem) id 와 연결되는 키. */
  itemId: string;
  title: string;
  assetNo: string;
  building: string;
  floor: string;
  model: string;
  status: string;
  corp: string;
  purchaseDate: string;
  note: string;
}

export type MonitorAssetInput = Partial<Omit<MonitorAsset, "id">>;

interface MonitorFilter {
  itemId?: string;
  building?: string;
  floor?: string;
}

function matches(r: { itemId: string; building: string; floor: string }, f: MonitorFilter): boolean {
  return (!f.itemId || r.itemId === f.itemId)
    && (!f.building || r.building === f.building)
    && (!f.floor || r.floor === f.floor);
}

export async function fetchMonitorAssets(opts: MonitorFilter = {}): Promise<MonitorAsset[]> {
  const rows = (await readEntity<MonitorAsset>(MONITOR_ASSET_ENTITY)) ?? [];
  return rows.filter(r => matches(r, opts));
}

export async function createMonitorAsset(data: MonitorAssetInput & {
  itemId: string; title: string; building: string; floor: string;
}): Promise<string> {
  const record: MonitorAsset = {
    id: randomUUID(),
    itemId: data.itemId.trim(),
    title: data.title.trim(),
    assetNo: (data.assetNo ?? "").trim(),
    building: data.building.trim(),
    floor: data.floor.trim(),
    model: (data.model ?? "").trim(),
    status: (data.status ?? "미확인").trim(),
    corp: (data.corp ?? "").trim(),
    purchaseDate: data.purchaseDate ?? "",
    note: (data.note ?? "").trim(),
  };
  if (!(await upsertEntity(MONITOR_ASSET_ENTITY, record.id, record))) {
    throw new Error("모니터 자산 저장 실패(Postgres)");
  }
  return record.id;
}

export async function updateMonitorAsset(id: string, data: MonitorAssetInput): Promise<void> {
  const base = await readEntityOne<MonitorAsset>(MONITOR_ASSET_ENTITY, id);
  if (!base) throw new Error("대상 모니터 자산을 찾을 수 없습니다.");

  // 명시적으로 넘어온 필드만 바꾼다 — 라우트가 body 에 없던 키를 undefined 로 흘려보내도
  // 기존 값이 덮이지 않는다(부분 수정).
  const next: MonitorAsset = { ...base };
  for (const k of ["itemId", "title", "assetNo", "building", "floor", "model", "status", "corp", "purchaseDate", "note"] as const) {
    const v = data[k];
    if (v !== undefined) next[k] = v;
  }

  if (!(await upsertEntity(MONITOR_ASSET_ENTITY, id, next))) {
    throw new Error("모니터 자산 저장 실패(Postgres)");
  }
}

// ── 이력 ─────────────────────────────────────────────────────────────────────

export type MonitorEventType = "zone_move" | "repair_request" | "repair_done" | "note";
export type MonitorHistoryStatus = "pending" | "수리중" | "in_progress" | "done";

export interface MonitorHistoryEntry {
  id: string;
  title: string;
  itemId: string;
  label: string;
  building: string;
  floor: string;
  eventType: MonitorEventType;
  from: string;
  to: string;
  description: string;
  status: MonitorHistoryStatus;
  createdAt: string;
  createdBy: string;
}

/** 수리 요청은 미완료로 시작하고, 나머지 이벤트는 기록 자체가 완료다. */
function initialStatus(eventType: MonitorEventType): MonitorHistoryStatus {
  return eventType === "repair_request" ? "pending" : "done";
}

export async function fetchMonitorHistory(
  opts: MonitorFilter & { limit?: number } = {},
): Promise<MonitorHistoryEntry[]> {
  const rows = (await readEntity<MonitorHistoryEntry>(MONITOR_HISTORY_ENTITY)) ?? [];
  const list = rows
    .filter(r => matches(r, opts))
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return opts.limit ? list.slice(0, opts.limit) : list;
}

export async function createMonitorHistory(data: {
  itemId: string;
  label?: string;
  building: string;
  floor: string;
  eventType: MonitorEventType;
  from?: string;
  to?: string;
  description?: string;
  createdBy?: string;
}): Promise<string> {
  const record: MonitorHistoryEntry = {
    id: randomUUID(),
    // 제목은 목록에서 사람이 읽는 값이다 — Notion title 에 넣던 조합을 그대로 만든다.
    title: `${data.label || data.itemId} · ${data.eventType}`,
    itemId: data.itemId.trim(),
    label: (data.label ?? "").trim(),
    building: data.building.trim(),
    floor: data.floor.trim(),
    eventType: data.eventType,
    from: (data.from ?? "").trim(),
    to: (data.to ?? "").trim(),
    description: (data.description ?? "").trim(),
    status: initialStatus(data.eventType),
    createdAt: new Date().toISOString(),
    createdBy: data.createdBy ?? "",
  };
  if (!(await upsertEntity(MONITOR_HISTORY_ENTITY, record.id, record))) {
    throw new Error("모니터 이력 저장 실패(Postgres)");
  }
  return record.id;
}

export async function updateMonitorHistoryStatus(id: string, status: MonitorHistoryStatus): Promise<void> {
  const base = await readEntityOne<MonitorHistoryEntry>(MONITOR_HISTORY_ENTITY, id);
  if (!base) throw new Error("대상 이력을 찾을 수 없습니다.");
  if (!(await upsertEntity(MONITOR_HISTORY_ENTITY, id, { ...base, status }))) {
    throw new Error("모니터 이력 저장 실패(Postgres)");
  }
}

// ── 도면 ─────────────────────────────────────────────────────────────────────

interface FloorMapRecord {
  id: string;
  /** "ns-4F" 처럼 building-floor 를 합친 키. 조회·저장의 기준이다. */
  key: string;
  building: string;
  floor: string;
  imageUrl: string;
  /** 배치 JSON. 미러에는 jsonb 객체로 들어 있다(Notion 시절엔 문자열이었다). */
  elements: Record<string, unknown> | string | null;
}

const floorKey = (building: string, floor: string): string => `${building}-${floor}`;

function parseElements(raw: FloorMapRecord["elements"]): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try { return JSON.parse(raw) as Record<string, unknown>; } catch { return {}; }
  }
  return raw;
}

async function findRecord(building: string, floor: string): Promise<FloorMapRecord | null> {
  const key = floorKey(building, floor);
  const rows = (await readEntity<FloorMapRecord>(FLOOR_MAP_ENTITY)) ?? [];
  return rows.find(r => r.key === key) ?? null;
}

/** 화면이 기대하는 모양 그대로 — { imageUrl, items, zones, facilities, groups, … }. */
export async function fetchFloorMap(building: string, floor: string): Promise<object | null> {
  const rec = await findRecord(building, floor);
  if (!rec) return null;
  return { imageUrl: rec.imageUrl || null, ...parseElements(rec.elements) };
}

/**
 * 도면 저장(배치 + 배경).
 *
 * 배경 이미지는 Vercel Blob 이 원본이다(미러의 도면 15장 전부 Blob URL 을 갖고 있다).
 * data: URL 로 새 이미지가 오면 Blob 에 올리고 그 URL 을 저장한다. https:// 로 오면
 * 이미 Blob 에 있는 것이라 그대로 둔다. imageUrl 이 아예 없으면 기존 배경을 지킨다 —
 * 배치만 고치고 저장했을 때 배경이 사라지면 안 된다.
 */
export async function saveFloorMap(
  building: string,
  floor: string,
  data: Record<string, unknown>,
): Promise<{ ok: boolean }> {
  const { imageUrl, ...elements } = data as { imageUrl?: string | null } & Record<string, unknown>;
  const existing = await findRecord(building, floor);

  let nextImageUrl = existing?.imageUrl ?? "";
  if (imageUrl === null || imageUrl === "") {
    nextImageUrl = "";
  } else if (typeof imageUrl === "string" && imageUrl.startsWith("data:")) {
    const m = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) throw new Error("배경 이미지 형식을 읽을 수 없습니다.");
    nextImageUrl = await uploadToBlob(
      Buffer.from(m[2], "base64"),
      `${floorKey(building, floor)}.jpg`,
      m[1],
      "floor-map",
    );
  } else if (typeof imageUrl === "string") {
    nextImageUrl = imageUrl;
  }

  const record = {
    // 백업 러너가 붙여 둔 __syncedFiles 같은 필드를 지우지 않는다.
    ...(existing ?? {}),
    id: existing?.id ?? randomUUID(),
    key: floorKey(building, floor),
    building,
    floor,
    imageUrl: nextImageUrl,
    elements,
  };

  if (!(await upsertEntity(FLOOR_MAP_ENTITY, record.id, record))) {
    throw new Error("도면 저장 실패(Postgres)");
  }
  return { ok: true };
}
