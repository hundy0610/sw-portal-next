// ─── 타입 ────────────────────────────────────────────────────────────────────
export type TableType = "B" | "L";
export type Orientation = "H" | "V";
export type MatchConstraint = "match_height" | "match_total_height" | "match_width";

export interface ParsedTable {
  id: string;
  type: TableType;
  seats: number;
  assets: number;
  orientation: Orientation;
  isWall: boolean;
  matchConstraint?: MatchConstraint;
  raw: string;
}

export interface LayoutTable extends ParsedTable {
  x: number;
  y: number;
  w: number;
  h: number;
  topN: number;
  botN: number;
}

// ─── 원본 데이터 ──────────────────────────────────────────────────────────────
export const OFFICE_RAW = {
  "3F": {
    west: ["B4/3", "B8/6", "B8/6"],
    east: ["B4/3", "B8/6", "B8/6", "B8/6", "L7/0(Wall)"],
  },
  "4F": {
    west: ["B7/6", "B7/6"],
    east: ["L6/0", "B6/8", "B6/7", "B6/8", "B4/7"],
  },
  "5F": {
    west: ["L12/0(Vertical,match_height)", "B6/6", "B6/6", "B6/6", "B6/4", "B6/4", "L6/0(Horizontal)"],
    east: ["B2/5", "B6/8", "B8/6", "B8/8"],
  },
  "6F": {
    west: ["L8/0(Vertical,match_height)", "B3/6", "B6/8", "B6/8", "B6/8", "L8/0(Horizontal)"],
    east: ["L6/0", "B8/8", "B8/7", "B8/8", "B6/6"],
  },
  "7F": {
    west: ["B6/4", "B10/0", "B8/6", "B8/6"],
    east: ["B8/0", "B4/6", "B8/6", "B6/6", "L6/0", "L7/0(Wall,match_total_height)"],
  },
  "8F": {
    west: ["B4/4", "B3/4", "B4/4", "L5/0"],
    east: [] as string[],
  },
  "9F": {
    west: ["L4/0(Vertical)", "B4/4", "B4/4", "L9/0(Horizontal,match_width)"],
    east: ["L6/0", "B4/6", "B4/6", "B4/6", "B6/8", "B6/8", "L9/0", "L12/0(Wall,match_total_height)"],
  },
} as const;

export type FloorId = keyof typeof OFFICE_RAW;
export const FLOOR_IDS = Object.keys(OFFICE_RAW) as FloorId[];

// ─── 파서 ────────────────────────────────────────────────────────────────────
export function parseTableDef(
  raw: string,
  floorId: string,
  zone: string,
  idx: number,
): ParsedTable {
  // 예: "B8/6", "L7/0(Wall)", "L12/0(Vertical,match_height)"
  const m = raw.match(/^([BL])(\d+)\/(\d+)(?:\(([^)]*)\))?$/);
  if (!m) throw new Error(`잘못된 테이블 정의: "${raw}"`);

  const [, type, seatsStr, assetsStr, optStr] = m;
  const opts = optStr ? optStr.split(",").map((s) => s.trim()) : [];

  const orientation: Orientation = opts.includes("Vertical") ? "V" : "H";
  const matchConstraint = opts.find((o) =>
    ["match_height", "match_total_height", "match_width"].includes(o),
  ) as MatchConstraint | undefined;

  return {
    id: `${floorId}-${zone}${idx}`,
    type: type as TableType,
    seats: parseInt(seatsStr),
    assets: parseInt(assetsStr),
    orientation,
    isWall: opts.includes("Wall"),
    matchConstraint,
    raw,
  };
}

export function parseFloor(floorId: FloorId) {
  const d = OFFICE_RAW[floorId];
  return {
    west: (d.west as readonly string[]).map((raw, i) =>
      parseTableDef(raw, floorId, "W", i),
    ),
    east: (d.east as readonly string[]).map((raw, i) =>
      parseTableDef(raw, floorId, "E", i),
    ),
  };
}
