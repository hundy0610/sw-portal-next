"use client";
import { Group, Rect, Text } from "react-konva";
import { C } from "./layout";
import type { LayoutTable } from "./officeData";

// ─── 색상 팔레트 ──────────────────────────────────────────────────────────────
const CLR = {
  tableFill:   "#D2B48C",
  tableStroke: "#8B6914",
  tableSelFill:"#F59E0B",
  tableSelStroke:"#92400E",
  desk:        "#F5F0E8",
  deskStroke:  "#C4B49A",
  chair:       "#E2E8F0",
  chairStroke: "#94A3B8",
  chairSel:    "#BAE6FD",
  assetDot:    "#2563EB",
  label:       "#5D4037",
};

interface Props {
  table: LayoutTable;
  selected: boolean;
  onSelect: (t: LayoutTable) => void;
}

export function TableBlock({ table, selected, onSelect }: Props) {
  const { topN, botN } = table;

  // ── Y 좌표 계산 ──────────────────────────────────────────────────────────
  const topDeskY  = C.CHAIR_H + C.CHAIR_GAP;
  const coreY     = topDeskY + C.DESK_H;
  const botDeskY  = coreY + C.TABLE_H;
  const botChairY = botDeskY + C.DESK_H + C.CHAIR_GAP;

  // 자산 배분: 상단→하단 순서로 채움
  const assTop = Math.min(table.assets, topN);
  const assBot = Math.max(0, table.assets - assTop);

  function renderCell(colIdx: number, isTop: boolean, hasAsset: boolean) {
    const cx    = colIdx * (C.CELL_W + C.CELL_GAP);
    const deskY = isTop ? topDeskY : botDeskY;
    const chrY  = isTop ? 0 : botChairY;

    return (
      <Group key={`${isTop ? "T" : "B"}-${colIdx}`} x={cx}>
        {/* 의자 */}
        <Rect
          x={2} y={chrY}
          width={C.CELL_W - 4} height={C.CHAIR_H}
          fill={selected ? CLR.chairSel : CLR.chair}
          stroke={CLR.chairStroke} strokeWidth={0.7}
          cornerRadius={3}
        />
        {/* 데스크 */}
        <Rect
          x={0} y={deskY}
          width={C.CELL_W} height={C.DESK_H}
          fill={CLR.desk} stroke={CLR.deskStroke} strokeWidth={0.7}
        />
        {/* 자산(모니터) 표시 점 */}
        {hasAsset && (
          <Rect
            x={C.CELL_W / 2 - 4} y={deskY + C.DESK_H / 2 - 4}
            width={8} height={8}
            fill={CLR.assetDot} cornerRadius={2}
          />
        )}
      </Group>
    );
  }

  const cols = Math.max(topN, botN);
  const tableW = cols * (C.CELL_W + C.CELL_GAP) - C.CELL_GAP;

  return (
    <Group
      x={table.x} y={table.y}
      onClick={() => onSelect(table)}
      onMouseEnter={(e) => { e.target.getStage()!.container().style.cursor = "pointer"; }}
      onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = "default"; }}
    >
      {/* 테이블 코어 면 */}
      <Rect
        x={0} y={coreY}
        width={tableW} height={C.TABLE_H}
        fill={selected ? CLR.tableSelFill : CLR.tableFill}
        stroke={selected ? CLR.tableSelStroke : CLR.tableStroke}
        strokeWidth={selected ? 2 : 1.2}
        cornerRadius={3}
      />
      <Text
        x={0} y={coreY + 1}
        width={tableW} height={C.TABLE_H}
        text={`${table.seats}석 / ${table.assets}자산`}
        fontSize={7} align="center" verticalAlign="middle"
        fill={CLR.label} fontStyle="bold"
        listening={false}
      />

      {/* 상단 좌석 */}
      {Array.from({ length: topN }, (_, i) => renderCell(i, true,  i < assTop))}
      {/* 하단 좌석 */}
      {Array.from({ length: botN }, (_, i) => renderCell(i, false, i < assBot))}
    </Group>
  );
}
