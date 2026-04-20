import type { ParsedTable, LayoutTable } from "./officeData";

// ─── 시각 상수 ────────────────────────────────────────────────────────────────
export const C = {
  CELL_W:    36,   // 좌석 셀 너비 (px)
  CELL_GAP:   5,   // 셀 간격
  DESK_H:    20,   // 데스크 두께
  TABLE_H:   14,   // 테이블 코어 높이 (양면 중간)
  CHAIR_H:   14,   // 의자 높이
  CHAIR_GAP:  3,   // 의자↔데스크 간격

  TABLE_SPACING: 20,  // 테이블 간 수직 간격
  ZONE_PAD_X:    24,  // 구역 좌우 내부 여백
  ZONE_PAD_Y:    32,  // 구역 상단 여백 (레이블 공간)
} as const;

// B 테이블 전체 높이 (양면 고정)
export const B_H =
  C.CHAIR_H + C.CHAIR_GAP + C.DESK_H + C.TABLE_H + C.DESK_H + C.CHAIR_GAP + C.CHAIR_H;
// = 14+3+20+14+20+3+14 = 88 px

// L 테이블 단면 깊이 (의자+간격+데스크)
export const L_DEPTH = C.CHAIR_H + C.CHAIR_GAP + C.DESK_H; // = 37 px

// 캔버스 / 구역 레이아웃
export const ZONE_W  = 470;   // 구역 너비 (서편·동편 동일)
export const CORE_W  = 180;   // 중앙 코어 너비
export const CANVAS_W = ZONE_W * 2 + CORE_W; // = 1120

// 구역 내 테이블 사용 가능 너비
const INNER_W = ZONE_W - C.ZONE_PAD_X * 2; // = 422

// ─── 치수 계산 헬퍼 ───────────────────────────────────────────────────────────
function bDims(seats: number) {
  const topN = Math.ceil(seats / 2);
  const botN = Math.floor(seats / 2);
  const cols = Math.max(topN, botN);
  const w = cols * (C.CELL_W + C.CELL_GAP) - C.CELL_GAP;
  return { w, h: B_H, topN, botN };
}

function lDims(seats: number, ori: Orientation): { w: number; h: number } {
  const span = seats * (C.CELL_W + C.CELL_GAP) - C.CELL_GAP;
  return ori === "H" ? { w: span, h: L_DEPTH } : { w: L_DEPTH, h: span };
}
type Orientation = "H" | "V";

// ─── 구역 레이아웃 ────────────────────────────────────────────────────────────
export function layoutZone(tables: ParsedTable[]): LayoutTable[] {
  const { ZONE_PAD_X: padX, ZONE_PAD_Y: padY, TABLE_SPACING: gap } = C;

  // Vertical L → 사이드바 처리
  const isSidebar = (t: ParsedTable) => t.type === "L" && t.orientation === "V";
  const sidebarList = tables.filter(isSidebar);
  const mainList    = tables.filter((t) => !isSidebar(t));

  // 사이드바 공간 (벽면 L은 우측에 고정되므로 좌측 공간 차지 안 함)
  const leftSidebarW = sidebarList.filter((t) => !t.isWall).length > 0
    ? L_DEPTH + gap
    : 0;
  const mainAvailW = INNER_W - leftSidebarW;

  // ── 메인 테이블 배치 (위→아래) ──────────────────────────────────────────
  let y = padY;
  const mainResult: LayoutTable[] = [];

  for (const t of mainList) {
    const dims = t.type === "B"
      ? bDims(t.seats)
      : lDims(t.seats, t.orientation);

    const w = Math.min(dims.w, mainAvailW);
    const x = padX + leftSidebarW + (mainAvailW - w) / 2;

    const { topN, botN } = t.type === "B"
      ? { topN: Math.ceil(t.seats / 2), botN: Math.floor(t.seats / 2) }
      : { topN: t.seats, botN: 0 };

    mainResult.push({ ...t, x, y, w, h: dims.h, topN, botN });
    y += dims.h + gap;
  }

  // ── match 제약 높이 계산 ────────────────────────────────────────────────
  const bTables = mainResult.filter((t) => t.type === "B");
  const bTotalH = bTables.length > 0
    ? bTables.reduce((s, t) => s + t.h + gap, 0) - gap
    : 0;
  const allTotalH = mainResult.length > 0
    ? mainResult.reduce((s, t) => s + t.h + gap, 0) - gap
    : 0;

  // ── 사이드바(Vertical L) 배치 ───────────────────────────────────────────
  const sideResult: LayoutTable[] = [];
  let leftX = padX;

  for (const t of sidebarList) {
    const targetH =
      t.matchConstraint === "match_total_height" ? allTotalH
      : t.matchConstraint === "match_height"      ? bTotalH
      : lDims(t.seats, "V").h;

    const x = t.isWall
      ? ZONE_W - padX - L_DEPTH   // 우측 벽
      : leftX;                     // 좌측 사이드바

    sideResult.push({ ...t, x, y: padY, w: L_DEPTH, h: Math.max(targetH, L_DEPTH), topN: t.seats, botN: 0 });
    if (!t.isWall) leftX += L_DEPTH + gap;
  }

  // ── match_width: 가장 넓은 B 테이블 너비로 수평 L 확장 ────────────────
  const maxBW = Math.max(0, ...mainResult.filter((t) => t.type === "B").map((t) => t.w));
  for (const t of mainResult) {
    if (t.type === "L" && t.matchConstraint === "match_width" && maxBW > 0) {
      t.w = Math.min(maxBW, mainAvailW);
      t.x = padX + leftSidebarW + (mainAvailW - t.w) / 2;
    }
  }

  return [...mainResult, ...sideResult];
}

// 구역 전체 높이 (Stage 높이 계산용)
export function zoneContentHeight(tables: LayoutTable[]): number {
  if (tables.length === 0) return 120;
  return Math.max(...tables.map((t) => t.y + t.h)) + C.ZONE_PAD_Y;
}
