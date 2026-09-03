// 스마트오피스 모니터 배치도 — assetify-for-desktop core/monitor.ts 이식(읽기 전용 부분만).
//
// 이 저장소(sw-portal-next)는 배치도를 관리하지 않는다 — 관리는 데스크탑 앱에서만
// 한다("포털과 데스크탑 앱을 통일해야 하고, 주로 데스크탑 앱을 쓸 예정"). 여기서는
// 딱 하나만 한다: 공개 접수 폼이 좌석(itemId)의 등록된 위치를 찾아 "직원이 입력한
// 위치와 다른가"를 대조하고, QR 확인 화면이 그 좌석 주변을 그릴 수 있게 데이터를
// 내려준다. 등록·수정 API는 옮기지 않는다 — 그건 데스크탑 앱의 몫이다.
import { readEntity, upsertEntity } from "@/lib/repo/mirror";

export const FLOOR_MAP_ENTITY = "floor-map";
export const MONITOR_HISTORY_ENTITY = "monitor-history";

export type MonitorType = "std27" | "std24" | "dev34" | "none" | "unk" | "repair" | "repairing";
export type FacilityKind = "elevator" | "stairs" | "entrance" | "exit" | "restroom";

export interface PlacedItem {
  id: string;
  kind: "monitor";
  monitorType: MonitorType;
  x: number; y: number;
  w: number; h: number;
  rotation: number;
  label: string;
  tags: string[];
}

export interface DrawnZone {
  id: string;
  x: number; y: number; w: number; h: number;
  name: string;
  color: string;
  tags: string[];
  rotation: number;
}

export interface Facility {
  id: string;
  kind: FacilityKind;
  x: number; y: number;
  r: number;
  label: string;
  tags: string[];
}

export interface FloorGroup {
  id: string;
  name: string;
  memberIds: string[];
}

export interface FloorElements {
  items: PlacedItem[];
  zones: DrawnZone[];
  facilities: Facility[];
  groups: FloorGroup[];
  renderOrder: string[];
  canvasW: number;
  canvasH: number;
}

export interface FloorMapRecord {
  id: string;
  key: string;
  building: string;
  floor: string;
  imageUrl: string;
  elements: FloorElements | string | null;
}

export const DEFAULT_CANVAS_W = 1500;
export const DEFAULT_CANVAS_H = 1000;

function emptyFloorElements(): FloorElements {
  return { items: [], zones: [], facilities: [], groups: [], renderOrder: [], canvasW: DEFAULT_CANVAS_W, canvasH: DEFAULT_CANVAS_H };
}

/** 저장된 elements(jsonb 객체 또는 레거시 JSON 문자열)를 항상 객체로 정규화한다. */
export function parseFloorElements(raw: FloorElements | string | null | undefined): FloorElements {
  if (!raw) return emptyFloorElements();
  let obj: Partial<FloorElements>;
  if (typeof raw === "string") {
    try { obj = JSON.parse(raw) as Partial<FloorElements>; } catch { return emptyFloorElements(); }
  } else {
    obj = raw;
  }
  return {
    items: obj.items ?? [],
    zones: obj.zones ?? [],
    facilities: obj.facilities ?? [],
    groups: obj.groups ?? [],
    renderOrder: obj.renderOrder ?? [],
    canvasW: obj.canvasW ?? DEFAULT_CANVAS_W,
    canvasH: obj.canvasH ?? DEFAULT_CANVAS_H,
  };
}

/** 모니터 종류별 색 — assetify-for-desktop core/monitor.ts MONITOR_META와 값을 맞춘다. */
export const MONITOR_META: Record<MonitorType, { label: string; long: string; color: string; pale: string; border: string }> = {
  std27: { label: '27"', long: '표준형 27"', color: "#4F46E5", pale: "#DBEAFE", border: "#A5B4FC" },
  std24: { label: '24"', long: '표준형 24"', color: "#0284C7", pale: "#E0F2FE", border: "#7DD3FC" },
  dev34: { label: '34"', long: '개발자 34"', color: "#7C3AED", pale: "#EDE9FE", border: "#C4B5FD" },
  none: { label: "✕", long: "미설치", color: "#DC2626", pale: "#FEE2E2", border: "#FCA5A5" },
  unk: { label: "·", long: "미확인", color: "#A1A1AA", pale: "#F4F4F5", border: "#CBD5E1" },
  repair: { label: "요청", long: "수리 요청", color: "#F97316", pale: "#FFF7ED", border: "#FED7AA" },
  repairing: { label: "수리", long: "수리 중", color: "#EF4444", pale: "#FEF2F2", border: "#FECACA" },
};

export async function fetchFloorMaps(): Promise<FloorMapRecord[]> {
  return (await readEntity<FloorMapRecord>(FLOOR_MAP_ENTITY)) ?? [];
}

// ── 건물/층 코드 ↔ 한글 라벨 ─────────────────────────────────────────────────
//
// FloorMapRecord.building/floor 는 코드다(예: "bw", "4F") — assetify-for-desktop
// core/monitor.ts DEFAULT_BUILDINGS 그대로. 반면 이 공개 폼의 "건물명"은 Notion
// select 옵션(한글 라벨, 예: "본관")을, "층수"는 자유 입력("4층" 등)을 받는다. 둘을
// 대조하려면 코드를 라벨로 바꿔야 한다 — 이 표는 데스크탑 앱의 기본값과 반드시
// 같게 유지해야 한다(관리자가 커스텀 건물을 추가한 경우는 대조 대상에서 제외됨).
const BUILDING_LABELS: Record<string, string> = { bw: "본관", ns: "신관", sb: "S빌딩" };

/** 코드("bw", "4F")를 화면에 보여줄 한글로 바꾼다. 매핑이 없는 커스텀 건물/층은
 * 코드를 그대로 보여준다 — 아예 안 보여주는 것보다는 낫다. */
export function describeLocation(floorMap: Pick<FloorMapRecord, "building" | "floor">): { buildingLabel: string; floorLabel: string } {
  return {
    buildingLabel: BUILDING_LABELS[floorMap.building] ?? floorMap.building,
    floorLabel: /\d/.test(floorMap.floor) ? `${floorNumberOf(floorMap.floor)}층` : floorMap.floor,
  };
}

/** "4층"/"4F"/"04" 등 표기가 제각각이라 층 번호(숫자)만 뽑아 비교한다. */
function floorNumberOf(text: string): number | null {
  const m = String(text || "").match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

/**
 * 직원이 입력한 건물명/층수가 이 좌석에 등록된 위치와 다른지 판단한다. 코드에 대응하는
 * 라벨을 모르면(커스텀 건물 등) 비교할 수 없다는 뜻이라 "다르다"로 단정하지 않는다
 * (오탐으로 관리자를 성가시게 하는 것보다, 확신 없을 땐 표시 안 하는 쪽이 안전하다).
 */
export function isLocationMismatch(floorMap: FloorMapRecord, submittedBuilding: string, submittedFloor: string): boolean {
  const expectedBuilding = BUILDING_LABELS[floorMap.building];
  if (!expectedBuilding) return false;
  if (submittedBuilding.trim() && submittedBuilding.trim() !== expectedBuilding) return true;

  const expectedFloorNo = floorNumberOf(floorMap.floor);
  const submittedFloorNo = floorNumberOf(submittedFloor);
  if (expectedFloorNo != null && submittedFloorNo != null && expectedFloorNo !== submittedFloorNo) return true;

  return false;
}

export interface ItemLocation {
  floorMap: FloorMapRecord;
  elements: FloorElements;
  item: PlacedItem;
}

/**
 * 좌석(itemId)이 등록된 층 도면과, 그 좌석 자체를 찾는다. 도면은 building-floor 단위로
 * 저장돼 있고 좌석은 그 안의 배열이라, 어느 도면에 속하는지 미리 알 수 없다 — 전체
 * 도면(현재 15장, 가벼움)을 훑어 찾는다.
 */
export async function findItemLocation(itemId: string): Promise<ItemLocation | null> {
  if (!itemId) return null;
  const floorMaps = await fetchFloorMaps();
  for (const floorMap of floorMaps) {
    const elements = parseFloorElements(floorMap.elements);
    const item = elements.items.find(i => i.id === itemId);
    if (item) return { floorMap, elements, item };
  }
  return null;
}

/** 좌석 주변만 보여주기 위한 자르기 영역 — 휴대폰 화면에서 전체 도면은 좌석을 찾기 힘들다. */
export function cropBoxAround(item: PlacedItem, canvasW: number, canvasH: number) {
  const PAD = 220;
  const w = Math.min(canvasW, Math.max(item.w + PAD * 2, 520));
  const h = Math.min(canvasH, Math.max(item.h + PAD * 2, 400));
  const x = Math.min(Math.max(item.x + item.w / 2 - w / 2, 0), Math.max(canvasW - w, 0));
  const y = Math.min(Math.max(item.y + item.h / 2 - h / 2, 0), Math.max(canvasH - h, 0));
  return { x, y, w, h };
}

// ── 배치도 이력(assetify-for-desktop core/monitor.ts MonitorHistoryEntry 이식) ──
//
// 등록·조회 화면은 데스크탑 앱에만 있다 — 여기서는 QR 확인 화면이 남기는 두 종류의
// 기록(실사 확인 / 위치 이동 신고)만 같은 저장소에 써넣는다. 데스크탑 앱이 그대로
// 읽을 수 있도록 필드 모양을 정확히 맞춘다.
export type MonitorEventType = "zone_move" | "repair_request" | "repair_done" | "note" | "audit_confirm";
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

async function appendMonitorHistory(entry: Omit<MonitorHistoryEntry, "id" | "createdAt">): Promise<boolean> {
  const id = crypto.randomUUID();
  const record: MonitorHistoryEntry = { ...entry, id, createdAt: new Date().toISOString() };
  return upsertEntity(MONITOR_HISTORY_ENTITY, id, record);
}

/** QR "정상이에요" 탭 — 실사 확인 한 건을 이력에 남긴다. 폼도, 관리자 검토도 필요 없다. */
export async function recordAuditConfirm(loc: ItemLocation, createdBy: string): Promise<boolean> {
  return appendMonitorHistory({
    title: loc.item.label || loc.item.id,
    itemId: loc.item.id,
    label: loc.item.label,
    building: loc.floorMap.building,
    floor: loc.floorMap.floor,
    eventType: "audit_confirm",
    from: "", to: "",
    description: "QR 스캔으로 실사 확인",
    status: "done",
    createdBy,
  });
}

/** QR "다른 곳이에요" — 확인 대기 상태로 남긴다. 관리자가 다음 실사 때 배치도에 반영. */
export async function recordLocationReport(loc: ItemLocation, note: string, createdBy: string): Promise<boolean> {
  return appendMonitorHistory({
    title: loc.item.label || loc.item.id,
    itemId: loc.item.id,
    label: loc.item.label,
    building: loc.floorMap.building,
    floor: loc.floorMap.floor,
    eventType: "zone_move",
    from: `${BUILDING_LABELS[loc.floorMap.building] ?? loc.floorMap.building} ${loc.floorMap.floor}`,
    to: note || "(직원이 상세 위치를 남기지 않음)",
    description: "QR 스캔 시 직원이 '실제 위치가 다름'으로 신고",
    status: "pending",
    createdBy,
  });
}
