"use client";
import React from "react";

// ─── 타입: AssetMapPanel과 느슨 결합 ─────────────────────────────────────────
export type MonitorType = "std27" | "std24" | "dev34" | "none" | "unk";
export interface SketchSeat { id: string; type: MonitorType; }
export interface SketchZone { id: string; label: string; seats: SketchSeat[]; }
export interface SketchCtx {
  zones: SketchZone[];
  filter: MonitorType | "all";
  selectedId: string | null;
  onSelect: (seatId: string) => void;
  colorOf: (t: MonitorType) => { color: string; pale: string };
}

// ─── 공용 1-좌석 컴포넌트 ─────────────────────────────────────────────────────
// orient: "down"=의자가 책상 아래, "up"=의자가 책상 위
function Seat({
  x, y, w = 22, h = 12, orient, seat, ctx,
}: {
  x: number; y: number; w?: number; h?: number;
  orient: "down" | "up" | "left" | "right";
  seat: SketchSeat | undefined; ctx: SketchCtx;
}) {
  if (!seat) return null;
  const meta = ctx.colorOf(seat.type);
  const dimmed = ctx.filter !== "all" && seat.type !== ctx.filter;
  const isSel = ctx.selectedId === seat.id;
  const deskFill   = dimmed ? "#E5E7EB" : meta.color + (seat.type === "unk" ? "66" : "D9");
  const deskStroke = dimmed ? "#D1D5DB" : "#1F2937";
  const chairH  = Math.max(6, Math.round(h * 0.65));
  const chairPad = 2;
  const chairY   = orient === "up" ? y - chairH - 1 : y + h + 1;
  return (
    <g style={{ cursor: "pointer" }} onClick={() => !dimmed && ctx.onSelect(seat.id)}>
      <rect
        x={x + chairPad} y={chairY}
        width={w - chairPad * 2} height={chairH}
        rx={2.5}
        fill={dimmed ? "#F3F4F6" : "#E8EAED"}
        stroke={dimmed ? "#E2E8F0" : "#94A3B8"}
        strokeWidth={0.7}
      />
      <rect
        x={x} y={y} width={w} height={h} rx={1.5}
        fill={deskFill} stroke={deskStroke}
        strokeWidth={isSel ? 1.5 : 0.7}
      />
      {seat.type === "none" && !dimmed && (
        <>
          <line x1={x + 2} y1={y + 2} x2={x + w - 2} y2={y + h - 2} stroke="white" strokeWidth={1.3}/>
          <line x1={x + w - 2} y1={y + 2} x2={x + 2} y2={y + h - 2} stroke="white" strokeWidth={1.3}/>
        </>
      )}
      {isSel && (
        <rect
          x={x - 2} y={Math.min(chairY, y) - 1}
          width={w + 4} height={h + chairH + 3}
          rx={2.5} fill="none" stroke={meta.color}
          strokeWidth={1.6} opacity={0.9}
          style={{ pointerEvents: "none" }}
        />
      )}
      <title>{seat.id} · {seat.type}</title>
    </g>
  );
}

// ─── 해치 패턴 (호환성 유지용) ────────────────────────────────────────────────
const HATCH = (
  <defs>
    <pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="5" stroke="#64748B" strokeWidth="0.6" />
    </pattern>
    <pattern id="hatchLight" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="6" stroke="#CBD5E1" strokeWidth="0.5" />
    </pattern>
  </defs>
);

// ─── 기존 헬퍼 (호환성 유지) ──────────────────────────────────────────────────
function gridPositions(
  startX: number, startY: number,
  cols: number, rows: number,
  sw: number, sh: number,
  gx: number, gy: number,
  rowGroups: number[], aisle: number
): { x: number; y: number; row: number; col: number }[] {
  const out: { x:number; y:number; row:number; col:number }[] = [];
  let rowY = startY, gi = 0, ri = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) out.push({ x: startX + c*(sw+gx), y: rowY, row: r, col: c });
    ri++;
    const gs = rowGroups[gi] || 2;
    if (ri >= gs && r < rows-1) { rowY += sh+gy+aisle; gi++; ri = 0; } else rowY += sh+gy;
  }
  return out;
}
function orientOf(row: number, rowGroups: number[]): "down"|"up" {
  let gi = 0, ri = 0;
  for (let i = 0; i < row; i++) { ri++; if (ri >= (rowGroups[gi]||2)) { gi++; ri = 0; } }
  return ri === 0 ? "down" : "up";
}
function DeskGrid({ zone, startX, startY, cols, rows, sw, sh, gx, gy, rowGroups, aisle, ctx }: {
  zone: SketchZone; startX:number; startY:number; cols:number; rows:number;
  sw:number; sh:number; gx:number; gy:number; rowGroups:number[]; aisle:number; ctx:SketchCtx;
}) {
  const positions = gridPositions(startX, startY, cols, rows, sw, sh, gx, gy, rowGroups, aisle);
  return (
    <g>
      {positions.map((p, i) => {
        const seat = zone.seats[i];
        if (!seat) return null;
        return <Seat key={seat.id} x={p.x} y={p.y} w={sw} h={sh}
          orient={orientOf(p.row, rowGroups)} seat={seat} ctx={ctx} />;
      })}
    </g>
  );
}
function CoreBlock({ x, y, w, h, hasStairs=true }: { x:number;y:number;w:number;h:number;hasStairs?:boolean }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#F1F5F9" stroke="#475569" strokeWidth={1.2}/>
      {hasStairs && <g>
        <rect x={x+4} y={y+8} width={w/2-8} height={h*0.18} fill="url(#hatchLight)" stroke="#475569" strokeWidth={0.8}/>
        {Array.from({length:5},(_,i)=><line key={i} x1={x+4} y1={y+12+i*7} x2={x+w/2-4} y2={y+12+i*7} stroke="#475569" strokeWidth={0.5}/>)}
        <text x={x+8} y={y+13} fontSize={7} fill="#475569">UP</text>
      </g>}
      <rect x={x+w/4} y={y+h*0.3} width={w/2} height={h*0.18} fill="#E2E8F0" stroke="#475569" strokeWidth={0.8}/>
      <line x1={x+w/4} y1={y+h*0.3} x2={x+3*w/4} y2={y+h*0.48} stroke="#475569" strokeWidth={0.5}/>
      <line x1={x+3*w/4} y1={y+h*0.3} x2={x+w/4} y2={y+h*0.48} stroke="#475569" strokeWidth={0.5}/>
      <text x={x+w/2} y={y+h*0.4} fontSize={7} fill="#475569" textAnchor="middle">EV</text>
      {hasStairs && <g>
        <rect x={x+4} y={y+h*0.75} width={w/2-8} height={h*0.18} fill="url(#hatchLight)" stroke="#475569" strokeWidth={0.8}/>
        {Array.from({length:5},(_,i)=><line key={i} x1={x+4} y1={y+h*0.76+i*7} x2={x+w/2-4} y2={y+h*0.76+i*7} stroke="#475569" strokeWidth={0.5}/>)}
        <text x={x+8} y={y+h*0.77} fontSize={7} fill="#475569">DN</text>
      </g>}
      <rect x={x+w/2+4} y={y+h*0.5} width={w/2-8} height={h*0.18} fill="url(#hatch)" stroke="#475569" strokeWidth={0.7}/>
      <text x={x+3*w/4} y={y+h*0.6} fontSize={7} fill="#475569" textAnchor="middle">EPS</text>
    </g>
  );
}
function MeetingBox({ x, y, w, h, name, sub }: { x:number;y:number;w:number;h:number;name:string;sub?:string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#ECFDF5" stroke="#047857" strokeWidth={1.2}/>
      <path d={`M ${x} ${y+h-10} A 10 10 0 0 1 ${x+10} ${y+h}`} fill="none" stroke="#047857" strokeWidth={0.7}/>
      <text x={x+w/2} y={y+14} fontSize={8.5} fontWeight={700} textAnchor="middle" fill="#065F46">{name}</text>
      {sub && <text x={x+w/2} y={y+h-4} fontSize={7} textAnchor="middle" fill="#047857" opacity={0.8}>{sub}</text>}
    </g>
  );
}
function BuildingShell({ vw, vy=20, vh=510, windows=24 }: { vw:number; vy?:number; vh?:number; windows?:number }) {
  return (
    <g>
      {HATCH}
      <rect x={12} y={vy} width={vw-24} height={vh} fill="#FAFAFA" stroke="#1F2937" strokeWidth={2}/>
      {Array.from({length:windows},(_,i)=>(<React.Fragment key={i}>
        <line x1={30+i*32} y1={vy} x2={30+i*32} y2={vy+8} stroke="#60A5FA" strokeWidth={2} opacity={0.45}/>
        <line x1={30+i*32} y1={vy+vh} x2={30+i*32} y2={vy+vh-8} stroke="#60A5FA" strokeWidth={2} opacity={0.45}/>
      </React.Fragment>))}
    </g>
  );
}

// =============================================================================
// 실제 도면 기반 렌더링 핵심 컴포넌트
// (AssetMapPanel 960×600 좌표계와 1:1 호환)
// =============================================================================

// 클러스터 정의 타입 (AssetMapPanel DeskCluster와 동일)
interface ClusterDef {
  x: number; y: number; w: number; h: number;
  rows: number; cols: number;
  rowCols?: number[];
}

// ─── 클러스터 기반 좌석 렌더러 (mkZoneFromClusters 호환) ─────────────────────
// 모든 신관/S빌딩 및 본관 2층에 사용
// 좌석 배치를 AssetMapPanel의 mkZoneFromClusters와 동일하게 계산
function ClusterZoneSeats({ zone, clusters, ctx, sw = 24, sh = 10 }: {
  zone: SketchZone;
  clusters: ClusterDef[];
  ctx: SketchCtx;
  sw?: number; sh?: number;
}) {
  const iPX = 8, iPY = 9;
  let si = 0;
  const els: React.ReactNode[] = [];
  for (const cl of clusters) {
    const cw = cl.w - iPX * 2;
    const ch = cl.h - iPY * 2;
    const dyC = cl.rows > 1 ? ch / (cl.rows - 1) : 0;
    for (let r = 0; r < cl.rows; r++) {
      const rC = cl.rowCols ? (cl.rowCols[r] ?? cl.cols) : cl.cols;
      const dxC = rC > 1 ? cw / (rC - 1) : 0;
      const orient: "down" | "up" = r === 0 ? "down" : "up";
      for (let c = 0; c < rC; c++) {
        const cx = cl.x + iPX + c * dxC;
        const cy = cl.y + iPY + r * dyC;
        const seat = zone.seats[si];
        if (seat) {
          els.push(
            <Seat key={si} x={cx - sw / 2} y={cy - sh / 2}
              w={sw} h={sh} orient={orient} seat={seat} ctx={ctx} />
          );
        }
        si++;
      }
    }
  }
  return <>{els}</>;
}

// ─── 격자 기반 좌석 렌더러 (mkZone 호환) ─────────────────────────────────────
// 본관 3층~9층 등 단순 그리드 배치 존에 사용
// AssetMapPanel의 mkSeatsWithGrid와 동일한 계산식
function GridZoneSeats({ zone, bounds, ctx, sw = 20, sh = 10, padX = 24, padY = 28 }: {
  zone: SketchZone;
  bounds: { x1: number; y1: number; x2: number; y2: number };
  ctx: SketchCtx;
  sw?: number; sh?: number; padX?: number; padY?: number;
}) {
  const total = zone.seats.length;
  const W = bounds.x2 - bounds.x1 - padX * 2;
  const H = bounds.y2 - bounds.y1 - padY * 2;
  const aspect = W / Math.max(H, 1);
  const cols = Math.min(12, Math.max(2, Math.round(Math.sqrt(total * aspect))));
  const dy = Math.ceil(total / cols) > 1 ? H / (Math.ceil(total / cols) - 1) : 0;
  const dx = cols > 1 ? W / (cols - 1) : 0;
  return (
    <>
      {zone.seats.map((seat, i) => {
        const cx = bounds.x1 + padX + (i % cols) * dx;
        const cy = bounds.y1 + padY + Math.floor(i / cols) * dy;
        const rowIdx = Math.floor(i / cols);
        const orient: "down" | "up" = rowIdx % 2 === 0 ? "down" : "up";
        return (
          <Seat key={seat.id} x={cx - sw / 2} y={cy - sh / 2}
            w={sw} h={sh} orient={orient} seat={seat} ctx={ctx} />
        );
      })}
    </>
  );
}

// ─── 공통: 도면 이미지 배경 (960×600, 65% 불투명) ────────────────────────────
function FloorBg({ src }: { src: string }) {
  return <image href={src} x={0} y={0} width={960} height={600} opacity={0.65} />;
}

// ─── 공통: 존 영역 강조 박스 ─────────────────────────────────────────────────
function ZoneBox({ x1, y1, x2, y2, color = "#93C5FD" }: {
  x1: number; y1: number; x2: number; y2: number; color?: string;
}) {
  return (
    <rect x={x1} y={y1} width={x2 - x1} height={y2 - y1} rx={3}
      fill={`${color}1A`} stroke={color} strokeWidth={1.2} strokeDasharray="5,3"
      style={{ pointerEvents: "none" }} />
  );
}

// ─── 공통: 존 라벨 ────────────────────────────────────────────────────────────
function ZoneLbl({ x, y, label, seats, color = "#1E3A8A" }: {
  x: number; y: number; label: string; seats: number; color?: string;
}) {
  return (
    <text x={x} y={y} fontSize={9} fontWeight={800} fill={color}
      style={{ pointerEvents: "none" }}>
      {label} — {seats}석
    </text>
  );
}

// =============================================================================
// 본관 (BONGWAN) 층별 스케치
// =============================================================================

// ─── 본관 2F ─── 서편 53석 ───────────────────────────────────────────────────
export function BW_2F_Sketch(ctx: SketchCtx) {
  const zW = ctx.zones.find(z => z.id === "bw2-w");
  if (!zW) return null;
  // 도면 좌표: 서편 x:118~323, y:136~492
  const clusters: ClusterDef[] = [
    { x: 118, y: 136, w: 205, h: 28, rows: 1, cols: 5 },
    { x: 118, y: 174, w: 205, h: 54, rows: 2, cols: 5 },
    { x: 118, y: 240, w: 205, h: 54, rows: 2, cols: 5, rowCols: [5, 4] },
    { x: 118, y: 306, w: 205, h: 54, rows: 2, cols: 5 },
    { x: 118, y: 372, w: 205, h: 54, rows: 2, cols: 5, rowCols: [5, 4] },
    { x: 118, y: 438, w: 205, h: 54, rows: 2, cols: 5 },
  ];
  return (
    <svg viewBox="0 0 960 600" style={{ width: "100%", height: "auto", display: "block" }}>
      <FloorBg src="/floor-plans/bongwan-2f.jpg" />
      <ZoneBox x1={100} y1={122} x2={344} y2={514} color="#93C5FD" />
      <ZoneLbl x={108} y={116} label={zW.label} seats={zW.seats.length} />
      <ClusterZoneSeats zone={zW} clusters={clusters} ctx={ctx} />
    </svg>
  );
}

// ─── 본관 3F ─── 서편 44석 · 동편 71석 ──────────────────────────────────────
export function BW_3F_Sketch(ctx: SketchCtx) {
  const zW = ctx.zones.find(z => z.id === "bw3-w");
  const zE = ctx.zones.find(z => z.id === "bw3-e");
  if (!zW || !zE) return null;
  // 서편 44석: 7열×7행 → back-to-back 3쌍+단열(2석)
  const cW: ClusterDef[] = [
    { x:68, y:171, w:254, h:55, rows:2, cols:7 },   // 14석
    { x:68, y:246, w:254, h:55, rows:2, cols:7 },   // 14석
    { x:68, y:320, w:254, h:55, rows:2, cols:7 },   // 14석
    { x:68, y:395, w: 56, h:28, rows:1, cols:2 },   //  2석
  ];
  // 동편 71석: 8열×9행 → back-to-back 4쌍+단열(7석)
  const cE: ClusterDef[] = [
    { x:544, y:171, w:337, h:63, rows:2, cols:8 },  // 16석
    { x:544, y:261, w:337, h:63, rows:2, cols:8 },  // 16석
    { x:544, y:351, w:337, h:63, rows:2, cols:8 },  // 16석
    { x:544, y:441, w:337, h:63, rows:2, cols:8 },  // 16석
    { x:544, y:531, w:291, h:28, rows:1, cols:7 },  //  7석
  ];
  return (
    <svg viewBox="0 0 960 600" style={{ width: "100%", height: "auto", display: "block" }}>
      <FloorBg src="/floor-plans/bongwan-3f.jpg" />
      <ZoneBox x1={52} y1={152} x2={338} y2={432} color="#93C5FD" />
      <ZoneLbl x={60} y={146} label={zW.label} seats={zW.seats.length} />
      <ClusterZoneSeats zone={zW} clusters={cW} ctx={ctx} sw={22} sh={10} />
      <ZoneBox x1={528} y1={152} x2={897} y2={568} color="#A78BFA" />
      <ZoneLbl x={536} y={146} label={zE.label} seats={zE.seats.length} color="#4C1D95" />
      <ClusterZoneSeats zone={zE} clusters={cE} ctx={ctx} sw={26} sh={10} />
    </svg>
  );
}

// ─── 본관 4F ─── 서편 74석 · 동편 49석 ──────────────────────────────────────
export function BW_4F_Sketch(ctx: SketchCtx) {
  const zW = ctx.zones.find(z => z.id === "bw4-w");
  const zE = ctx.zones.find(z => z.id === "bw4-e");
  if (!zW || !zE) return null;
  // 서편 74석: 11열×7행 → back-to-back 3쌍+단열(8석) — 열 조밀
  const cW: ClusterDef[] = [
    { x:68, y:219, w:254, h:43, rows:2, cols:11 },  // 22석
    { x:68, y:270, w:254, h:43, rows:2, cols:11 },  // 22석
    { x:68, y:320, w:254, h:43, rows:2, cols:11 },  // 22석
    { x:68, y:371, w:183, h:28, rows:1, cols: 8 },  //  8석
  ];
  // 동편 49석: 7열×7행 → back-to-back 3쌍+단열(7석)
  const cE: ClusterDef[] = [
    { x:544, y:171, w:337, h:78, rows:2, cols:7 },  // 14석
    { x:544, y:291, w:337, h:78, rows:2, cols:7 },  // 14석
    { x:544, y:411, w:337, h:78, rows:2, cols:7 },  // 14석
    { x:544, y:531, w:337, h:28, rows:1, cols:7 },  //  7석
  ];
  return (
    <svg viewBox="0 0 960 600" style={{ width: "100%", height: "auto", display: "block" }}>
      <FloorBg src="/floor-plans/bongwan-4f.jpg" />
      <ZoneBox x1={52} y1={200} x2={338} y2={408} color="#FCA5A5" />
      <ZoneLbl x={60} y={194} label={zW.label} seats={zW.seats.length} color="#B91C1C" />
      <ClusterZoneSeats zone={zW} clusters={cW} ctx={ctx} sw={16} sh={9} />
      <ZoneBox x1={528} y1={152} x2={897} y2={568} color="#93C5FD" />
      <ZoneLbl x={536} y={146} label={zE.label} seats={zE.seats.length} />
      <ClusterZoneSeats zone={zE} clusters={cE} ctx={ctx} sw={28} sh={10} />
    </svg>
  );
}

// ─── 본관 5F ─── 서편 74석 · 동편 49석 ──────────────────────────────────────
export function BW_5F_Sketch(ctx: SketchCtx) {
  const zW = ctx.zones.find(z => z.id === "bw5-w");
  const zE = ctx.zones.find(z => z.id === "bw5-e");
  if (!zW || !zE) return null;
  // 서편 74석: 7열×11행 → back-to-back 5쌍+단열(4석)
  const cW: ClusterDef[] = [
    { x:68, y:171, w:254, h:54, rows:2, cols:7 },   // 14석
    { x:68, y:243, w:254, h:54, rows:2, cols:7 },   // 14석
    { x:68, y:315, w:254, h:54, rows:2, cols:7 },   // 14석
    { x:68, y:387, w:254, h:54, rows:2, cols:7 },   // 14석
    { x:68, y:459, w:254, h:54, rows:2, cols:7 },   // 14석
    { x:68, y:531, w:135, h:28, rows:1, cols:4 },   //  4석
  ];
  // 동편 49석: 7열×7행 → back-to-back 3쌍+단열(7석)
  const cE: ClusterDef[] = [
    { x:544, y:171, w:337, h:78, rows:2, cols:7 },  // 14석
    { x:544, y:291, w:337, h:78, rows:2, cols:7 },  // 14석
    { x:544, y:411, w:337, h:78, rows:2, cols:7 },  // 14석
    { x:544, y:531, w:337, h:28, rows:1, cols:7 },  //  7석
  ];
  return (
    <svg viewBox="0 0 960 600" style={{ width: "100%", height: "auto", display: "block" }}>
      <FloorBg src="/floor-plans/bongwan-5f.jpg" />
      <ZoneBox x1={52} y1={152} x2={338} y2={568} color="#93C5FD" />
      <ZoneLbl x={60} y={146} label={zW.label} seats={zW.seats.length} />
      <ClusterZoneSeats zone={zW} clusters={cW} ctx={ctx} sw={22} sh={10} />
      <ZoneBox x1={528} y1={152} x2={897} y2={568} color="#A78BFA" />
      <ZoneLbl x={536} y={146} label={zE.label} seats={zE.seats.length} color="#4C1D95" />
      <ClusterZoneSeats zone={zE} clusters={cE} ctx={ctx} sw={28} sh={10} />
    </svg>
  );
}

// ─── 본관 6F ─── 서편(개발 34") 67석 · 동편 65석 ────────────────────────────
export function BW_6F_Sketch(ctx: SketchCtx) {
  const zW = ctx.zones.find(z => z.id === "bw6-w");
  const zE = ctx.zones.find(z => z.id === "bw6-e");
  if (!zW || !zE) return null;
  // 서편 67석 (개발 34"): 8열×9행 → back-to-back 4쌍+단열(3석)
  const cW: ClusterDef[] = [
    { x:68, y:264, w:254, h:51, rows:2, cols:8 },   // 16석
    { x:68, y:331, w:254, h:51, rows:2, cols:8 },   // 16석
    { x:68, y:398, w:254, h:51, rows:2, cols:8 },   // 16석
    { x:68, y:464, w:254, h:51, rows:2, cols:8 },   // 16석
    { x:68, y:531, w: 84, h:28, rows:1, cols:3 },   //  3석
  ];
  // 동편 65석: 8열×9행 → back-to-back 4쌍+단열(1석)
  const cE: ClusterDef[] = [
    { x:544, y:171, w:337, h:63, rows:2, cols:8 },  // 16석
    { x:544, y:261, w:337, h:63, rows:2, cols:8 },  // 16석
    { x:544, y:351, w:337, h:63, rows:2, cols:8 },  // 16석
    { x:544, y:441, w:337, h:63, rows:2, cols:8 },  // 16석
    { x:544, y:531, w: 26, h:28, rows:1, cols:1 },  //  1석
  ];
  return (
    <svg viewBox="0 0 960 600" style={{ width: "100%", height: "auto", display: "block" }}>
      <FloorBg src="/floor-plans/bongwan-6f.jpg" />
      <ZoneBox x1={52} y1={245} x2={338} y2={568} color="#C4B5FD" />
      <ZoneLbl x={60} y={239} label={zW.label} seats={zW.seats.length} color="#6D28D9" />
      <ClusterZoneSeats zone={zW} clusters={cW} ctx={ctx} sw={20} sh={10} />
      <ZoneBox x1={528} y1={152} x2={897} y2={568} color="#93C5FD" />
      <ZoneLbl x={536} y={146} label={zE.label} seats={zE.seats.length} />
      <ClusterZoneSeats zone={zE} clusters={cE} ctx={ctx} sw={26} sh={10} />
    </svg>
  );
}

// ─── 본관 7F ─── 서편 19석 · 나보타개발팀 28석 · 동편 57석 ──────────────────
export function BW_7F_Sketch(ctx: SketchCtx) {
  const zW  = ctx.zones.find(z => z.id === "bw7-w");
  const zNB = ctx.zones.find(z => z.id === "bw7-nb");
  const zE  = ctx.zones.find(z => z.id === "bw7-e");
  if (!zW || !zE) return null;
  // 서편 19석: 5열×4행 → back-to-back 2쌍(비대칭)
  const cW: ClusterDef[] = [
    { x:68, y:409, w:206, h:59, rows:2, cols:5 },                  // 10석
    { x:68, y:490, w:206, h:59, rows:2, cols:5, rowCols:[5,4] },   //  9석
  ];
  // 나보타개발팀 28석: 7열×4행 → back-to-back 2쌍 (전석 미설치)
  const cNB: ClusterDef[] = [
    { x:68, y:229, w:206, h:58, rows:2, cols:7 },  // 14석
    { x:68, y:308, w:206, h:58, rows:2, cols:7 },  // 14석
  ];
  // 동편 57석: 7열×9행 → back-to-back 4쌍+단열(1석)
  const cE: ClusterDef[] = [
    { x:544, y:171, w:337, h:63, rows:2, cols:7 },  // 14석
    { x:544, y:261, w:337, h:63, rows:2, cols:7 },  // 14석
    { x:544, y:351, w:337, h:63, rows:2, cols:7 },  // 14석
    { x:544, y:441, w:337, h:63, rows:2, cols:7 },  // 14석
    { x:544, y:531, w: 26, h:28, rows:1, cols:1 },  //  1석
  ];
  return (
    <svg viewBox="0 0 960 600" style={{ width: "100%", height: "auto", display: "block" }}>
      <FloorBg src="/floor-plans/bongwan-7f.jpg" />
      {/* 서편 스마트오피스 */}
      <ZoneBox x1={52} y1={390} x2={290} y2={568} color="#FCA5A5" />
      <ZoneLbl x={60} y={384} label={zW.label} seats={zW.seats.length} color="#B91C1C" />
      <ClusterZoneSeats zone={zW} clusters={cW} ctx={ctx} sw={22} sh={10} />
      {/* 나보타개발팀 (미설치) */}
      {zNB && <>
        <ZoneBox x1={52} y1={210} x2={290} y2={385} color="#FCD34D" />
        <ZoneLbl x={60} y={204} label={zNB.label} seats={zNB.seats.length} color="#92400E" />
        <ClusterZoneSeats zone={zNB} clusters={cNB} ctx={ctx} sw={18} sh={10} />
      </>}
      {/* 동편 */}
      <ZoneBox x1={528} y1={152} x2={897} y2={568} color="#93C5FD" />
      <ZoneLbl x={536} y={146} label={zE.label} seats={zE.seats.length} />
      <ClusterZoneSeats zone={zE} clusters={cE} ctx={ctx} sw={28} sh={10} />
    </svg>
  );
}

// ─── 본관 8F ─── 업무공간 28석 ───────────────────────────────────────────────
export function BW_8F_Sketch(ctx: SketchCtx) {
  const zM = ctx.zones.find(z => z.id === "bw8-w");
  if (!zM) return null;
  // 28석: 7열×4행 → back-to-back 2쌍
  const cM: ClusterDef[] = [
    { x:174, y:171, w:148, h:47, rows:2, cols:7 },  // 14석
    { x:174, y:229, w:148, h:47, rows:2, cols:7 },  // 14석
  ];
  return (
    <svg viewBox="0 0 960 600" style={{ width: "100%", height: "auto", display: "block" }}>
      <FloorBg src="/floor-plans/bongwan-8f.jpg" />
      <ZoneBox x1={158} y1={152} x2={338} y2={295} color="#93C5FD" />
      <ZoneLbl x={166} y={146} label={zM.label} seats={zM.seats.length} />
      <ClusterZoneSeats zone={zM} clusters={cM} ctx={ctx} sw={14} sh={9} />
    </svg>
  );
}

// ─── 본관 9F ─── 스튜디오 37석 · 홀(동편) 85석 ──────────────────────────────
export function BW_9F_Sketch(ctx: SketchCtx) {
  const zW = ctx.zones.find(z => z.id === "bw9-w");
  const zE = ctx.zones.find(z => z.id === "bw9-e");
  if (!zW || !zE) return null;
  // 서편 37석: 5열×8행 → back-to-back 4쌍(마지막 비대칭)
  const cW: ClusterDef[] = [
    { x:68, y:171, w:254, h:69, rows:2, cols:5 },                  // 10석
    { x:68, y:274, w:254, h:69, rows:2, cols:5 },                  // 10석
    { x:68, y:377, w:254, h:69, rows:2, cols:5 },                  // 10석
    { x:68, y:480, w:254, h:69, rows:2, cols:5, rowCols:[5,2] },   //  7석
  ];
  // 동편 85석: 9열×10행 → back-to-back 5쌍(마지막 비대칭)
  const cE: ClusterDef[] = [
    { x:544, y:171, w:337, h:58, rows:2, cols:9 },                  // 18석
    { x:544, y:251, w:337, h:58, rows:2, cols:9 },                  // 18석
    { x:544, y:331, w:337, h:58, rows:2, cols:9 },                  // 18석
    { x:544, y:411, w:337, h:58, rows:2, cols:9 },                  // 18석
    { x:544, y:491, w:337, h:58, rows:2, cols:9, rowCols:[9,4] },   // 13석
  ];
  return (
    <svg viewBox="0 0 960 600" style={{ width: "100%", height: "auto", display: "block" }}>
      <FloorBg src="/floor-plans/bongwan-9f.jpg" />
      <ZoneBox x1={52} y1={152} x2={338} y2={568} color="#FDE68A" />
      <ZoneLbl x={60} y={146} label={zW.label} seats={zW.seats.length} color="#92400E" />
      <ClusterZoneSeats zone={zW} clusters={cW} ctx={ctx} sw={26} sh={10} />
      <ZoneBox x1={528} y1={152} x2={897} y2={568} color="#93C5FD" />
      <ZoneLbl x={536} y={146} label={zE.label} seats={zE.seats.length} />
      <ClusterZoneSeats zone={zE} clusters={cE} ctx={ctx} sw={24} sh={10} />
    </svg>
  );
}

// =============================================================================
// 신관 (SINGWAN) 층별 스케치
// (모두 mkZoneFromClusters 기반 — 정밀한 클러스터 좌표 사용)
// =============================================================================

// ─── 신관 2F ─── 서편 31석 · 동편 48석 ──────────────────────────────────────
export function NS_2F_Sketch(ctx: SketchCtx) {
  const zW = ctx.zones.find(z => z.id === "ns2-w");
  const zE = ctx.zones.find(z => z.id === "ns2-e");
  if (!zW || !zE) return null;
  // 서편 클러스터: SN2_W {x1:262,y1:56,x2:578,y2:268}
  const cW: ClusterDef[] = [
    { x: 300, y: 71,  w: 240, h: 52, rows: 2, cols: 6, rowCols: [6, 5] },
    { x: 310, y: 133, w: 200, h: 52, rows: 2, cols: 5 },
    { x: 310, y: 195, w: 200, h: 52, rows: 2, cols: 5 },
  ];
  // 동편 클러스터: SN2_E {x1:264,y1:346,x2:732,y2:594}
  const cE: ClusterDef[] = [
    { x: 278, y: 361, w: 168, h: 52, rows: 2, cols: 4 },
    { x: 462, y: 361, w: 200, h: 52, rows: 2, cols: 5 },
    { x: 278, y: 421, w: 168, h: 52, rows: 2, cols: 4 },
    { x: 462, y: 421, w: 160, h: 52, rows: 2, cols: 4 },
    { x: 278, y: 481, w: 168, h: 52, rows: 2, cols: 4 },
    { x: 462, y: 481, w: 120, h: 52, rows: 2, cols: 3 },
  ];
  return (
    <svg viewBox="0 0 960 600" style={{ width: "100%", height: "auto", display: "block" }}>
      <FloorBg src="/floor-plans/singwan-2f.jpg" />
      <ZoneBox x1={262} y1={56}  x2={578} y2={268} color="#93C5FD" />
      <ZoneLbl x={270} y={50}   label={zW.label} seats={zW.seats.length} />
      <ClusterZoneSeats zone={zW} clusters={cW} ctx={ctx} />
      <ZoneBox x1={264} y1={346} x2={732} y2={594} color="#A78BFA" />
      <ZoneLbl x={272} y={340}  label={zE.label} seats={zE.seats.length} color="#4C1D95" />
      <ClusterZoneSeats zone={zE} clusters={cE} ctx={ctx} />
    </svg>
  );
}

// ─── 신관 3F ─── 서편 40석 · 동편 60석 ──────────────────────────────────────
export function NS_3F_Sketch(ctx: SketchCtx) {
  const zW = ctx.zones.find(z => z.id === "ns3-w");
  const zE = ctx.zones.find(z => z.id === "ns3-e");
  if (!zW || !zE) return null;
  // 서편 클러스터: SN3_W {x1:212,y1:315,x2:442,y2:580}
  const cW: ClusterDef[] = [
    { x: 227, y: 330, w: 200, h: 52, rows: 2, cols: 5 },
    { x: 227, y: 391, w: 200, h: 52, rows: 2, cols: 5 },
    { x: 227, y: 452, w: 200, h: 52, rows: 2, cols: 5 },
    { x: 227, y: 513, w: 200, h: 52, rows: 2, cols: 5 },
  ];
  // 동편 클러스터: SN3_E {x1:398,y1:96,x2:778,y2:298}
  const cE: ClusterDef[] = [
    { x: 408, y: 113, w: 170, h: 52, rows: 2, cols: 5 },
    { x: 408, y: 173, w: 170, h: 52, rows: 2, cols: 5 },
    { x: 408, y: 233, w: 170, h: 52, rows: 2, cols: 5 },
    { x: 590, y: 113, w: 170, h: 52, rows: 2, cols: 5 },
    { x: 590, y: 173, w: 170, h: 52, rows: 2, cols: 5 },
    { x: 590, y: 233, w: 170, h: 52, rows: 2, cols: 5 },
  ];
  return (
    <svg viewBox="0 0 960 600" style={{ width: "100%", height: "auto", display: "block" }}>
      <FloorBg src="/floor-plans/singwan-3f.jpg" />
      <ZoneBox x1={212} y1={315} x2={442} y2={580} color="#93C5FD" />
      <ZoneLbl x={220} y={309} label={zW.label} seats={zW.seats.length} />
      <ClusterZoneSeats zone={zW} clusters={cW} ctx={ctx} />
      <ZoneBox x1={398} y1={96}  x2={778} y2={298} color="#A78BFA" />
      <ZoneLbl x={406} y={90}   label={zE.label} seats={zE.seats.length} color="#4C1D95" />
      <ClusterZoneSeats zone={zE} clusters={cE} ctx={ctx} />
    </svg>
  );
}

// ─── 신관 4F ─── 서편 40석 · 동편 51석 ──────────────────────────────────────
export function NS_4F_Sketch(ctx: SketchCtx) {
  const zW = ctx.zones.find(z => z.id === "ns4-w");
  const zE = ctx.zones.find(z => z.id === "ns4-e");
  if (!zW || !zE) return null;
  // 서편 클러스터: SN4_W {x1:260,y1:56,x2:585,y2:275}
  const cW: ClusterDef[] = [
    { x: 322, y: 71,  w: 200, h: 44, rows: 2, cols: 5 },
    { x: 322, y: 120, w: 200, h: 44, rows: 2, cols: 5 },
    { x: 322, y: 169, w: 200, h: 44, rows: 2, cols: 5 },
    { x: 322, y: 218, w: 200, h: 44, rows: 2, cols: 5 },
  ];
  // 동편 클러스터: SN4_E {x1:262,y1:358,x2:734,y2:598}
  const cE: ClusterDef[] = [
    { x: 313, y: 373, w: 240, h: 40, rows: 2, cols: 6, rowCols: [6, 5] },
    { x: 323, y: 415, w: 210, h: 40, rows: 2, cols: 5 },
    { x: 323, y: 457, w: 210, h: 40, rows: 2, cols: 5 },
    { x: 323, y: 499, w: 210, h: 40, rows: 2, cols: 5 },
    { x: 323, y: 541, w: 210, h: 40, rows: 2, cols: 5 },
  ];
  return (
    <svg viewBox="0 0 960 600" style={{ width: "100%", height: "auto", display: "block" }}>
      <FloorBg src="/floor-plans/singwan-4f.jpg" />
      <ZoneBox x1={260} y1={56}  x2={585} y2={275} color="#93C5FD" />
      <ZoneLbl x={268} y={50}   label={zW.label} seats={zW.seats.length} />
      <ClusterZoneSeats zone={zW} clusters={cW} ctx={ctx} sw={24} sh={9} />
      <ZoneBox x1={262} y1={358} x2={734} y2={598} color="#A78BFA" />
      <ZoneLbl x={270} y={352}  label={zE.label} seats={zE.seats.length} color="#4C1D95" />
      <ClusterZoneSeats zone={zE} clusters={cE} ctx={ctx} sw={24} sh={9} />
    </svg>
  );
}

// ─── 신관 5F ─── 서편 35석 · 동편 48석 ──────────────────────────────────────
export function NS_5F_Sketch(ctx: SketchCtx) {
  const zW = ctx.zones.find(z => z.id === "ns5-w");
  const zE = ctx.zones.find(z => z.id === "ns5-e");
  if (!zW || !zE) return null;
  // 서편 클러스터: SN5_W {x1:253,y1:52,x2:582,y2:272}
  const cW: ClusterDef[] = [
    { x: 317, y: 67,  w: 200, h: 26, rows: 1, cols: 5 },
    { x: 317, y: 101, w: 200, h: 44, rows: 2, cols: 5 },
    { x: 317, y: 153, w: 200, h: 44, rows: 2, cols: 5 },
    { x: 317, y: 205, w: 200, h: 44, rows: 2, cols: 5 },
  ];
  // 동편 클러스터: SN5_E {x1:255,y1:352,x2:739,y2:598}
  const cE: ClusterDef[] = [
    { x: 377, y: 367, w: 240, h: 52, rows: 2, cols: 6 },
    { x: 377, y: 421, w: 240, h: 52, rows: 2, cols: 6 },
    { x: 377, y: 475, w: 240, h: 52, rows: 2, cols: 6 },
    { x: 377, y: 529, w: 240, h: 52, rows: 2, cols: 6 },
  ];
  return (
    <svg viewBox="0 0 960 600" style={{ width: "100%", height: "auto", display: "block" }}>
      <FloorBg src="/floor-plans/singwan-5f.jpg" />
      <ZoneBox x1={253} y1={52}  x2={582} y2={272} color="#93C5FD" />
      <ZoneLbl x={261} y={46}   label={zW.label} seats={zW.seats.length} />
      <ClusterZoneSeats zone={zW} clusters={cW} ctx={ctx} sw={24} sh={9} />
      <ZoneBox x1={255} y1={352} x2={739} y2={598} color="#A78BFA" />
      <ZoneLbl x={263} y={346}  label={zE.label} seats={zE.seats.length} color="#4C1D95" />
      <ClusterZoneSeats zone={zE} clusters={cE} ctx={ctx} />
    </svg>
  );
}

// =============================================================================
// S빌딩 층별 스케치
// (모두 mkZoneFromClusters 기반)
// =============================================================================

// ─── S빌딩 3F ─── Smart Office 1 (15석) · Smart Office 2 (32석) ──────────────
export function SB_3F_Sketch(ctx: SketchCtx) {
  const zA = ctx.zones.find(z => z.id === "sb3-a");
  const zB = ctx.zones.find(z => z.id === "sb3-b");
  if (!zA || !zB) return null;
  // SO1 클러스터: SB3_A {x1:222,y1:246,x2:450,y2:518}
  const cA: ClusterDef[] = [
    { x: 236, y: 338, w: 200, h: 52, rows: 2, cols: 5 },
    { x: 236, y: 400, w: 200, h: 26, rows: 1, cols: 5 },
  ];
  // SO2 클러스터: SB3_B {x1:454,y1:196,x2:814,y2:540}
  const cB: ClusterDef[] = [
    { x: 534, y: 218, w: 200, h: 52, rows: 2, cols: 5 },
    { x: 534, y: 280, w: 200, h: 52, rows: 2, cols: 5 },
    { x: 514, y: 342, w: 240, h: 52, rows: 2, cols: 6 },
  ];
  return (
    <svg viewBox="0 0 960 600" style={{ width: "100%", height: "auto", display: "block" }}>
      <FloorBg src="/floor-plans/sbldg-3f.jpg" />
      <ZoneBox x1={222} y1={246} x2={450} y2={518} color="#93C5FD" />
      <ZoneLbl x={230} y={240} label={zA.label} seats={zA.seats.length} />
      <ClusterZoneSeats zone={zA} clusters={cA} ctx={ctx} />
      <ZoneBox x1={454} y1={196} x2={814} y2={540} color="#A78BFA" />
      <ZoneLbl x={462} y={190} label={zB.label} seats={zB.seats.length} color="#4C1D95" />
      <ClusterZoneSeats zone={zB} clusters={cB} ctx={ctx} />
    </svg>
  );
}

// ─── S빌딩 4F ─── Casual Work Space (21석) · Open Office (40석) ──────────────
export function SB_4F_Sketch(ctx: SketchCtx) {
  const zW = ctx.zones.find(z => z.id === "sb4-w");
  const zE = ctx.zones.find(z => z.id === "sb4-e");
  if (!zW || !zE) return null;
  // Casual: SB4_W {x1:132,y1:262,x2:462,y2:543}
  const cW: ClusterDef[] = [
    { x: 177, y: 285, w: 240, h: 52, rows: 2, cols: 6, rowCols: [6, 5] },
    { x: 187, y: 347, w: 210, h: 52, rows: 2, cols: 5 },
  ];
  // Open Office: SB4_E {x1:496,y1:148,x2:886,y2:543}
  const cE: ClusterDef[] = [
    { x: 591, y: 163, w: 200, h: 52, rows: 2, cols: 5 },
    { x: 591, y: 225, w: 200, h: 52, rows: 2, cols: 5 },
    { x: 591, y: 287, w: 200, h: 52, rows: 2, cols: 5 },
    { x: 591, y: 349, w: 200, h: 52, rows: 2, cols: 5 },
  ];
  return (
    <svg viewBox="0 0 960 600" style={{ width: "100%", height: "auto", display: "block" }}>
      <FloorBg src="/floor-plans/sbldg-4f.jpg" />
      <ZoneBox x1={132} y1={262} x2={462} y2={543} color="#86EFAC" />
      <ZoneLbl x={140} y={256} label={zW.label} seats={zW.seats.length} color="#14532D" />
      <ClusterZoneSeats zone={zW} clusters={cW} ctx={ctx} />
      <ZoneBox x1={496} y1={148} x2={886} y2={543} color="#A78BFA" />
      <ZoneLbl x={504} y={142} label={zE.label} seats={zE.seats.length} color="#4C1D95" />
      <ClusterZoneSeats zone={zE} clusters={cE} ctx={ctx} />
    </svg>
  );
}

// ─── S빌딩 5F ─── 스마트오피스 (36석) ────────────────────────────────────────
export function SB_5F_Sketch(ctx: SketchCtx) {
  const zSO = ctx.zones.find(z => z.id === "sb5-so");
  if (!zSO) return null;
  // SB5 {x1:396,y1:158,x2:886,y2:535}
  const cSO: ClusterDef[] = [
    { x: 521, y: 178, w: 240, h: 52, rows: 2, cols: 6 },
    { x: 521, y: 240, w: 240, h: 52, rows: 2, cols: 6 },
    { x: 521, y: 302, w: 240, h: 52, rows: 2, cols: 6 },
  ];
  return (
    <svg viewBox="0 0 960 600" style={{ width: "100%", height: "auto", display: "block" }}>
      <FloorBg src="/floor-plans/sbldg-5f.jpg" />
      <ZoneBox x1={396} y1={158} x2={886} y2={535} color="#93C5FD" />
      <ZoneLbl x={404} y={152} label={zSO.label} seats={zSO.seats.length} />
      <ClusterZoneSeats zone={zSO} clusters={cSO} ctx={ctx} />
    </svg>
  );
}

// ─── 층별 스케치 레지스트리 ──────────────────────────────────────────────────
export const FLOOR_SKETCHES: Record<string, (ctx: SketchCtx) => React.ReactNode> = {
  "bw-bw2": BW_2F_Sketch,
  "bw-bw3": BW_3F_Sketch,
  "bw-bw4": BW_4F_Sketch,
  "bw-bw5": BW_5F_Sketch,
  "bw-bw6": BW_6F_Sketch,
  "bw-bw7": BW_7F_Sketch,
  "bw-bw8": BW_8F_Sketch,
  "bw-bw9": BW_9F_Sketch,
  "ns-ns2": NS_2F_Sketch,
  "ns-ns3": NS_3F_Sketch,
  "ns-ns4": NS_4F_Sketch,
  "ns-ns5": NS_5F_Sketch,
  "sb-sb3": SB_3F_Sketch,
  "sb-sb4": SB_4F_Sketch,
  "sb-sb5": SB_5F_Sketch,
};
