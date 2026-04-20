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

// ─── 원본 데이터 (BW_FLOOR_TABLES 기준 검증값) ──────────────────────────────
// B{n}/0 : 양면 테이블 n석 (topN=ceil(n/2), botN=floor(n/2))
// L{n}/0 : 단면 일렬 테이블 n석
// 좌석 합계:
//   3F  서54  동71   | 4F  서74  동49   | 5F  서74  동49
//   6F  서67  동65   | 7F  서19  동57   | 8F  서28  동0
//   9F  서37  동85
export const OFFICE_RAW = {
  "3F": {
    // 서편 54석: 양면12×4 + 단면6×1
    west: ["B12/0", "B12/0", "B12/0", "B12/0", "L6/0"],
    // 동편 71석: 양면16×4 + 단면7×1(Wall)
    east: ["B16/0", "B16/0", "B16/0", "B16/0", "L7/0(Wall)"],
  },
  "4F": {
    // 서편 74석: 양면14×5 + 단면4×1
    west: ["B14/0", "B14/0", "B14/0", "B14/0", "B14/0", "L4/0"],
    // 동편 49석: 단면7(상단) + 양면14×3
    east: ["L7/0", "B14/0", "B14/0", "B14/0"],
  },
  "5F": {
    // 서편 74석: 양면14×5 + 단면4×1
    west: ["B14/0", "B14/0", "B14/0", "B14/0", "B14/0", "L4/0"],
    // 동편 49석: 단면7(상단) + 양면14×3
    east: ["L7/0", "B14/0", "B14/0", "B14/0"],
  },
  "6F": {
    // 서편 67석 (개발자 34"): 양면14×4 + 양면11×1 (topN7+botN4)
    west: ["B14/0", "B14/0", "B14/0", "B14/0", "B11/0"],
    // 동편 65석: 양면16×3 + 양면17×1 (topN9+botN8)
    east: ["B16/0", "B16/0", "B16/0", "B17/0"],
  },
  "7F": {
    // 서편 19석: 양면8×2 + 단면3×1
    west: ["B8/0", "B8/0", "L3/0"],
    // 동편 57석: 양면14×3 + 양면15×1 (topN8+botN7)
    east: ["B14/0", "B14/0", "B14/0", "B15/0"],
  },
  "8F": {
    // 서편 28석: 양면14×2 (업무공간)
    west: ["B14/0", "B14/0"],
    east: [] as string[],
  },
  "9F": {
    // 서편 37석: 양면10×3 + 양면7×1 (topN4+botN3)
    west: ["B10/0", "B10/0", "B10/0", "B7/0"],
    // 동편 85석: 양면18×4 + 양면13×1 (topN7+botN6)
    east: ["B18/0", "B18/0", "B18/0", "B18/0", "B13/0"],
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
  // 예: "B12/0", "L7/0(Wall)", "B14/0"
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
