"use client";
import { useState, useRef, useEffect } from "react";
import { Stage, Layer, Rect, Text, Group, Line } from "react-konva";
import { parseFloor, FLOOR_IDS, type FloorId, type LayoutTable } from "./officeData";
import { layoutZone, zoneContentHeight, ZONE_W, CORE_W, CANVAS_W, C } from "./layout";
import { TableBlock } from "./TableBlock";
import { TableLine } from "./TableLine";

// ─── 색상 ────────────────────────────────────────────────────────────────────
const Z = {
  bg:     "#EFF6FF",
  border: "#93C5FD",
  label:  "#1E3A8A",
  core:   "#E2E8F0",
  coreTx: "#64748B",
  hatch:  "#CBD5E1",
};

// ─── 인포 패널 (선택 시) ─────────────────────────────────────────────────────
function InfoPanel({ table, onClose }: { table: LayoutTable; onClose: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 border border-amber-300 rounded-lg text-sm shadow-sm">
      <span className="font-semibold text-amber-800">{table.id}</span>
      <span className="text-amber-700">
        {table.type === "B" ? "블록(양면)" : "라인"} —
        좌석 <strong>{table.seats}석</strong> / 자산 <strong>{table.assets}개</strong>
      </span>
      <button onClick={onClose} className="ml-auto text-amber-500 hover:text-amber-800 text-xs">✕</button>
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export function FloorMap() {
  const [floorId, setFloorId] = useState<FloorId>("3F");
  const [selected, setSelected] = useState<LayoutTable | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // 컨테이너 너비에 따라 Stage 축소
  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      const cw = containerRef.current.clientWidth;
      setScale(Math.min(1, cw / CANVAS_W));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // 층 데이터 파싱 + 레이아웃 계산
  const { west, east } = parseFloor(floorId);
  const wLayout = layoutZone(west);
  const eLayout = layoutZone(east);
  const canvasH = Math.max(zoneContentHeight(wLayout), zoneContentHeight(eLayout), 160) + 20;

  const eastX = ZONE_W + CORE_W;

  const westSeats = west.reduce((s, t) => s + t.seats, 0);
  const eastSeats = east.reduce((s, t) => s + t.seats, 0);

  // ── 클릭 핸들러 ─────────────────────────────────────────────────────────
  const handleSelect = (t: LayoutTable) => {
    const next = t.id === selected?.id ? null : t;
    setSelected(next);
    if (next) {
      console.log(
        `${next.id} 번 테이블 선택됨, 좌석/자산 정보: 좌석 ${next.seats}석 / 자산 ${next.assets}개`,
      );
    }
  };

  // ── 구역 렌더 ────────────────────────────────────────────────────────────
  const renderZone = (
    tables: LayoutTable[],
    offsetX: number,
    label: string,
    seats: number,
  ) => (
    <Group x={offsetX}>
      {/* 배경 */}
      <Rect
        x={0} y={0} width={ZONE_W} height={canvasH}
        fill={Z.bg} stroke={Z.border} strokeWidth={1.5} cornerRadius={6}
      />
      {/* 레이블 */}
      <Text
        x={0} y={8} width={ZONE_W}
        text={`${label}  —  ${seats}석`}
        fontSize={10} fontStyle="bold" fill={Z.label} align="center"
        listening={false}
      />

      {/* 테이블 렌더 */}
      {tables.map((t) => {
        const props = { table: t, selected: t.id === selected?.id, onSelect: handleSelect };
        return t.type === "B"
          ? <TableBlock key={t.id} {...props} />
          : <TableLine  key={t.id} {...props} />;
      })}
    </Group>
  );

  // ── 중앙 코어 ────────────────────────────────────────────────────────────
  const renderCore = () => (
    <Group x={ZONE_W}>
      <Rect x={0} y={0} width={CORE_W} height={canvasH} fill={Z.core} strokeWidth={0} />
      {/* 해치 패턴 대용 세로선 */}
      {Array.from({ length: 6 }, (_, i) => (
        <Line
          key={i}
          points={[22 + i * 24, 0, 22 + i * 24, canvasH]}
          stroke={Z.hatch} strokeWidth={0.5} opacity={0.6}
        />
      ))}
      <Text
        x={0} y={canvasH / 2 - 32} width={CORE_W}
        text={"계단\nEPS\n화장실"}
        fontSize={10} fill={Z.coreTx} align="center" lineHeight={2}
        listening={false}
      />
    </Group>
  );

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* ── 층 선택 탭 ─────────────────────────────────────────────────── */}
      <div className="flex gap-1.5 flex-wrap">
        {FLOOR_IDS.map((fid) => (
          <button
            key={fid}
            onClick={() => { setFloorId(fid); setSelected(null); }}
            className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${
              floorId === fid
                ? "bg-blue-600 text-white shadow"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {fid}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-400 self-center">
          총 {westSeats + eastSeats}석
        </span>
      </div>

      {/* ── 선택 정보 ───────────────────────────────────────────────────── */}
      {selected && (
        <InfoPanel table={selected} onClose={() => setSelected(null)} />
      )}

      {/* ── 범례 ────────────────────────────────────────────────────────── */}
      <div className="flex gap-4 text-xs text-slate-500 flex-wrap">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-[#D2B48C] border border-[#8B6914]" />
          B형 (양면 그리드)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-[#EEF2FF] border border-[#818CF8]" />
          L형 (일렬)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-[#2563EB]" />
          자산(모니터)
        </span>
      </div>

      {/* ── Konva Stage ─────────────────────────────────────────────────── */}
      <div ref={containerRef} className="w-full overflow-x-auto">
        <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: CANVAS_W }}>
          <Stage width={CANVAS_W} height={canvasH}>
            <Layer>
              {east.length > 0 ? (
                <>
                  {renderZone(wLayout, 0,      "서편", westSeats)}
                  {renderCore()}
                  {renderZone(eLayout, eastX,  "동편", eastSeats)}
                </>
              ) : (
                /* 8F처럼 동편 없는 경우 */
                <>
                  {renderZone(wLayout, ZONE_W / 2, "서편", westSeats)}
                </>
              )}
            </Layer>
          </Stage>
        </div>
      </div>
    </div>
  );
}
