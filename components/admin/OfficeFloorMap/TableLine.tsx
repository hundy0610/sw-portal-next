"use client";
import { Group, Rect, Text } from "react-konva";
import { C, L_DEPTH } from "./layout";
import type { LayoutTable } from "./officeData";

const CLR = {
  deskFill:     "#EEF2FF",
  deskStroke:   "#818CF8",
  deskSelFill:  "#C7D2FE",
  deskSelStroke:"#4338CA",
  chair:        "#E2E8F0",
  chairStroke:  "#94A3B8",
  chairSel:     "#BAE6FD",
  label:        "#3730A3",
};

interface Props {
  table: LayoutTable;
  selected: boolean;
  onSelect: (t: LayoutTable) => void;
}

export function TableLine({ table, selected, onSelect }: Props) {
  const n   = table.seats;
  const isV = table.orientation === "V";

  const cursor = {
    onMouseEnter: (e: any) => { e.target.getStage()?.container().setAttribute("style","cursor:pointer"); },
    onMouseLeave: (e: any) => { e.target.getStage()?.container().setAttribute("style","cursor:default"); },
  };

  // ── 수평 (Horizontal) ────────────────────────────────────────────────────
  if (!isV) {
    const deskY  = C.CHAIR_H + C.CHAIR_GAP;
    const cellSp = C.CELL_W + C.CELL_GAP;

    return (
      <Group x={table.x} y={table.y} onClick={() => onSelect(table)} {...cursor}>
        {/* 데스크 면 (전체 너비) */}
        <Rect
          x={0} y={deskY}
          width={table.w} height={C.DESK_H}
          fill={selected ? CLR.deskSelFill : CLR.deskFill}
          stroke={selected ? CLR.deskSelStroke : CLR.deskStroke}
          strokeWidth={selected ? 2 : 1} cornerRadius={3}
        />
        <Text
          x={0} y={deskY + 3} width={table.w} height={C.DESK_H - 6}
          text={`L${n}석`} fontSize={7} align="center" verticalAlign="middle"
          fill={CLR.label} fontStyle="bold" listening={false}
        />
        {/* 개별 의자 */}
        {Array.from({ length: n }, (_, i) => (
          <Rect
            key={i}
            x={i * cellSp + 2} y={0}
            width={C.CELL_W - 4} height={C.CHAIR_H}
            fill={selected ? CLR.chairSel : CLR.chair}
            stroke={CLR.chairStroke} strokeWidth={0.7} cornerRadius={3}
          />
        ))}
      </Group>
    );
  }

  // ── 수직 (Vertical) ──────────────────────────────────────────────────────
  // 의자는 왼쪽, 데스크는 오른쪽 (Wall이면 반전 — 우측 배치 처리는 layout에서)
  const deskX  = C.CHAIR_H + C.CHAIR_GAP;
  const cellH  = table.h / n;           // 좌석 당 높이 (match_height 반영)
  const chairH = Math.max(8, cellH - 6);

  return (
    <Group x={table.x} y={table.y} onClick={() => onSelect(table)} {...cursor}>
      {/* 데스크 면 (전체 높이) */}
      <Rect
        x={deskX} y={0}
        width={C.DESK_H} height={table.h}
        fill={selected ? CLR.deskSelFill : CLR.deskFill}
        stroke={selected ? CLR.deskSelStroke : CLR.deskStroke}
        strokeWidth={selected ? 2 : 1} cornerRadius={3}
      />
      {/* 개별 의자 */}
      {Array.from({ length: n }, (_, i) => (
        <Rect
          key={i}
          x={0} y={i * cellH + (cellH - chairH) / 2}
          width={C.CHAIR_H - 4} height={chairH}
          fill={selected ? CLR.chairSel : CLR.chair}
          stroke={CLR.chairStroke} strokeWidth={0.7} cornerRadius={2}
        />
      ))}
      {/* 좌석 수 레이블 */}
      <Text
        x={deskX} y={table.h / 2 - 8} width={C.DESK_H} height={16}
        text={`L${n}`} fontSize={7} align="center" verticalAlign="middle"
        fill={CLR.label} fontStyle="bold" rotation={0} listening={false}
      />
    </Group>
  );
}
