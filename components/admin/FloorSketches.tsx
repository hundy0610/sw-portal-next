"use client";
import React from "react";

export type MonitorType = "std27" | "std24" | "dev34" | "none" | "unk";
export interface SketchSeat { id: string; type: MonitorType; }
export interface SketchZone { id: string; label: string; seats: SketchSeat[]; }
export interface SketchCtx {
  zones: SketchZone[];
  filter: MonitorType | "all";
  selectedId: string | null;
  onSelect: (seatId: string) => void;
  colorOf: (t: MonitorType) => { color: string; pale: string };
  // ── 편집 모드 ────────────────────────────────────────────────
  editMode?: boolean;
  pickedId?: string | null;
  onPickSeat?: (id: string | null) => void;
  onDropToSeat?: (targetId: string) => void;
  onDropToSlot?: (zoneId: string, idx: number) => void;
  onDeleteSeat?: (id: string) => void;
  onAddSeat?: (zoneId: string, idx: number) => void;
  // ── 테이블 내 좌석 편집 ─────────────────────────────────────
  tableSeats?: Record<string, { top: SketchSeat[]; bot?: SketchSeat[] }>;
  onTableSeatDelete?: (tableId: string, side: "top" | "bot", idx: number) => void;
  onTableSeatAdd?: (tableId: string, side: "top" | "bot") => void;
}

function Seat({ x, y, w=22, h=12, orient, seat, ctx }: {
  x:number; y:number; w?:number; h?:number;
  orient:"down"|"up"|"left"|"right";
  seat:SketchSeat|undefined; ctx:SketchCtx;
}) {
  if (!seat) return null;
  const meta = ctx.colorOf(seat.type);
  const dimmed = ctx.filter !== "all" && seat.type !== ctx.filter;
  const isSel = ctx.selectedId === seat.id;
  const em = ctx.editMode ?? false;
  const isPicked = em && ctx.pickedId === seat.id;
  const canDrop = em && !!ctx.pickedId && ctx.pickedId !== seat.id;

  const deskFill = dimmed ? "#E5E7EB"
    : isPicked ? "#FEF3C7"
    : meta.color + (seat.type === "unk" ? "66" : "D9");
  const deskStroke = dimmed ? "#D1D5DB"
    : isPicked ? "#F59E0B"
    : canDrop ? "#10B981"
    : "#1F2937";
  const deskSW = isPicked ? 2 : canDrop ? 1.5 : (isSel ? 1.5 : 0.7);
  const chairH = Math.max(6, Math.round(h * 0.65));
  const chairPad = 2;
  const chairY = orient === "up" ? y - chairH - 1 : y + h + 1;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (em) {
      if (!ctx.pickedId)           ctx.onPickSeat?.(seat.id);
      else if (ctx.pickedId === seat.id) ctx.onPickSeat?.(null);
      else                         ctx.onDropToSeat?.(seat.id);
    } else {
      !dimmed && ctx.onSelect(seat.id);
    }
  };

  return (
    <g style={{ cursor: em ? (isPicked ? "grabbing" : "grab") : "pointer" }}
       onClick={handleClick}>
      <rect x={x+chairPad} y={chairY} width={w-chairPad*2} height={chairH} rx={2.5}
        fill={dimmed?"#F3F4F6":isPicked?"#FDE68A":"#E8EAED"}
        stroke={dimmed?"#E2E8F0":isPicked?"#F59E0B":"#94A3B8"} strokeWidth={0.7}/>
      <rect x={x} y={y} width={w} height={h} rx={1.5}
        fill={deskFill} stroke={deskStroke} strokeWidth={deskSW}
        strokeDasharray={canDrop ? "3,2" : undefined}/>
      {seat.type==="none" && !dimmed && (<>
        <line x1={x+2} y1={y+2} x2={x+w-2} y2={y+h-2} stroke="white" strokeWidth={1.3}/>
        <line x1={x+w-2} y1={y+2} x2={x+2} y2={y+h-2} stroke="white" strokeWidth={1.3}/>
      </>)}
      {isSel && !em && <rect x={x-2} y={Math.min(chairY,y)-1} width={w+4} height={h+chairH+3}
        rx={2.5} fill="none" stroke={meta.color} strokeWidth={1.6} opacity={0.9}
        style={{pointerEvents:"none"}}/>}
      {isPicked && <rect x={x-2} y={Math.min(chairY,y)-1} width={w+4} height={h+chairH+3}
        rx={2.5} fill="none" stroke="#F59E0B" strokeWidth={2} opacity={0.9}
        style={{pointerEvents:"none"}}/>}
      {/* 삭제 버튼 — 집었을 때만 표시 */}
      {isPicked && (
        <g style={{cursor:"pointer"}}
           onClick={(e)=>{e.stopPropagation();ctx.onDeleteSeat?.(seat.id);}}>
          <circle cx={x+w} cy={y} r={5.5} fill="#EF4444" stroke="white" strokeWidth={1}/>
          <line x1={x+w-2.5} y1={y-2.5} x2={x+w+2.5} y2={y+2.5} stroke="white" strokeWidth={1.3}/>
          <line x1={x+w+2.5} y1={y-2.5} x2={x+w-2.5} y2={y+2.5} stroke="white" strokeWidth={1.3}/>
        </g>
      )}
      {/* 편집 모드 그립 힌트 */}
      {em && !isPicked && (
        <text x={x+1.5} y={y+h-1} fontSize={4} fill="#94A3B8" style={{pointerEvents:"none"}}>⠿</text>
      )}
      <title>{seat.id} · {seat.type}</title>
    </g>
  );
}

// 빈 슬롯 — 편집 모드에서 좌석이 없는 자리에 표시
function EmptySlot({x,y,w,h,zoneId,idx,ctx}:{
  x:number;y:number;w:number;h:number;zoneId:string;idx:number;ctx:SketchCtx;
}) {
  if (!ctx.editMode) return null;
  const hasPicked = !!ctx.pickedId;
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasPicked) ctx.onDropToSlot?.(zoneId, idx);
    else           ctx.onAddSeat?.(zoneId, idx);
  };
  return (
    <g style={{cursor:"pointer"}} onClick={handleClick}>
      <rect x={x} y={y} width={w} height={h} rx={1.5}
        fill={hasPicked ? "#DCFCE7" : "#F8FAFC"}
        stroke={hasPicked ? "#16A34A" : "#CBD5E1"}
        strokeWidth={1} strokeDasharray="3,2"/>
      <text x={x+w/2} y={y+h/2+2.5} fontSize={hasPicked?9:7} textAnchor="middle"
        fill={hasPicked?"#16A34A":"#CBD5E1"} style={{pointerEvents:"none"}}>+</text>
    </g>
  );
}

const HATCH = (
  <defs>
    <pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="5" stroke="#64748B" strokeWidth="0.6"/>
    </pattern>
    <pattern id="hatchLight" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="6" stroke="#CBD5E1" strokeWidth="0.5"/>
    </pattern>
  </defs>
);

// ══════════════════════════════════════════════════════════════════════════════
// 공유 테이블(pod) 렌더 — 본관 2F와 동일한 편집 체계
// 테이블 내 모니터(좌석) 추가/삭제 지원
// ══════════════════════════════════════════════════════════════════════════════
export type PodDef = {
  id: string;        // 테이블 식별자 (예: "t1", "t2", …)
  topN: number;      // 상단 모니터(좌석) 개수 — defaults from zone.seats
  botN?: number;     // 하단(양면) 모니터 개수 — undefined면 단면
};
export type FloorTableDef = {
  zoneId: string;    // 대상 zone id
  pods: PodDef[];    // 순서대로 zone.seats 배분
};
// 본관 각 층별 테이블 정의 (zone.seats 인덱스를 순차 배분)
export const BW_FLOOR_TABLES: Record<string, FloorTableDef[]> = {
  "2F": [{ zoneId:"SO", pods:[
    {id:"t1", topN:5},
    {id:"t2", topN:5, botN:5},
    {id:"t3", topN:5, botN:4},
    {id:"t4", topN:5, botN:5},
    {id:"t5", topN:5, botN:4},
    {id:"t6", topN:5, botN:5},
  ]}],
  "3F": [
    { zoneId:"W", pods:[
      {id:"w1", topN:6, botN:6},
      {id:"w2", topN:6, botN:6},
      {id:"w3", topN:6, botN:6},
      {id:"w4", topN:6, botN:6},
      {id:"w5", topN:6},
    ]},
    { zoneId:"E", pods:[
      {id:"e1", topN:8, botN:8},
      {id:"e2", topN:8, botN:8},
      {id:"e3", topN:8, botN:8},
      {id:"e4", topN:8, botN:8},
      {id:"e5", topN:7},
    ]},
  ],
  "4F": [
    { zoneId:"W", pods:[
      {id:"w1", topN:7, botN:7},
      {id:"w2", topN:7, botN:7},
      {id:"w3", topN:7, botN:7},
      {id:"w4", topN:7, botN:7},
      {id:"w5", topN:7, botN:7},
      {id:"w6", topN:4},
    ]},
    { zoneId:"E", pods:[
      {id:"e1", topN:7, botN:7},
      {id:"e2", topN:7, botN:7},
      {id:"e3", topN:7, botN:7},
      {id:"e4", topN:7},
    ]},
  ],
  "5F": [
    { zoneId:"W", pods:[
      {id:"w1", topN:7, botN:7},
      {id:"w2", topN:7, botN:7},
      {id:"w3", topN:7, botN:7},
      {id:"w4", topN:7, botN:7},
      {id:"w5", topN:7, botN:7},
      {id:"w6", topN:4},
    ]},
    { zoneId:"E", pods:[
      {id:"e1", topN:7, botN:7},
      {id:"e2", topN:7, botN:7},
      {id:"e3", topN:7, botN:7},
      {id:"e4", topN:7},
    ]},
  ],
  "6F": [
    { zoneId:"W", pods:[
      {id:"w1", topN:7, botN:7},
      {id:"w2", topN:7, botN:7},
      {id:"w3", topN:7, botN:7},
      {id:"w4", topN:7, botN:7},
      {id:"w5", topN:7, botN:4},
    ]},
    { zoneId:"E", pods:[
      {id:"e1", topN:8, botN:8},
      {id:"e2", topN:8, botN:8},
      {id:"e3", topN:8, botN:8},
      {id:"e4", topN:8, botN:8},
      {id:"e5", topN:1},
    ]},
  ],
  "7F": [
    { zoneId:"W", pods:[
      {id:"w1", topN:4, botN:4},
      {id:"w2", topN:4, botN:4},
      {id:"w3", topN:3},
    ]},
    { zoneId:"E", pods:[
      {id:"e1", topN:7, botN:7},
      {id:"e2", topN:7, botN:7},
      {id:"e3", topN:7, botN:7},
      {id:"e4", topN:7, botN:7},
      {id:"e5", topN:1},
    ]},
  ],
  "8F": [
    { zoneId:"M", pods:[
      {id:"m1", topN:7, botN:7},
      {id:"m2", topN:7, botN:7},
    ]},
  ],
  "9F": [
    { zoneId:"W", pods:[
      {id:"w1", topN:5, botN:5},
      {id:"w2", topN:5, botN:5},
      {id:"w3", topN:5, botN:5},
      {id:"w4", topN:5, botN:2},
    ]},
    { zoneId:"E", pods:[
      {id:"e1", topN:9, botN:9},
      {id:"e2", topN:9, botN:9},
      {id:"e3", topN:9, botN:9},
      {id:"e4", topN:9, botN:9},
      {id:"e5", topN:9, botN:4},
    ]},
  ],
};

/**
 * SharedTable — 본관 2F 테이블 그룹과 동일한 공유 테이블(pod) 렌더
 * 상단/하단(양면) 모니터 행을 공유 테이블 위에 배치하고,
 * 편집 모드에서 각 행 끝에 "+" 추가 버튼과 각 모니터 옆에 "✕" 삭제 버튼을 표시한다.
 */
export function SharedTable({
  ctx, zone, tableId, x0, y0,
  defTopBase, defTopN, defBotBase, defBotN,
  dw=38, dh=11, dx=48, tpad=4, igap=14,
  chairOutside=true,
}:{
  ctx: SketchCtx;
  zone: SketchZone;
  tableId: string;
  x0: number; y0: number;
  defTopBase: number; defTopN: number;
  defBotBase?: number; defBotN?: number;
  dw?: number; dh?: number; dx?: number;
  tpad?: number; igap?: number;
  chairOutside?: boolean;
}) {
  const stored = ctx.tableSeats?.[tableId];
  const topSeats: SketchSeat[] = stored
    ? stored.top
    : (Array.from({length: defTopN}, (_, i) => zone.seats[defTopBase+i]).filter(Boolean) as SketchSeat[]);
  const botSeats: SketchSeat[] | undefined = stored
    ? (stored.bot !== undefined ? stored.bot : undefined)
    : (defBotBase !== undefined
        ? (Array.from({length: defBotN!}, (_, i) => zone.seats[defBotBase+i]).filter(Boolean) as SketchSeat[])
        : undefined);
  const topN = topSeats.length;
  const botN = botSeats?.length ?? 0;
  const maxN = Math.max(topN, botN, 1);
  const isDouble = botSeats !== undefined;
  const th = isDouble ? 2*dh + 2*tpad + igap : dh + 2*tpad;
  const topY = y0 + tpad;
  const botY = isDouble ? y0 + th - dh - tpad : 0;
  const topOrient: ("up"|"down") = isDouble ? "up" : "down";
  const em = ctx.editMode ?? false;
  const tw = em ? 2*tpad + maxN*dx + dw : 2*tpad + (maxN-1)*dx + dw;
  return (
    <g>
      {/* 테이블 면 */}
      <rect x={x0} y={y0} width={tw} height={th} rx={3}
        fill="#F5F0E8" stroke="#8B7355" strokeWidth={1.4}/>
      {isDouble && (
        <line x1={x0+4} y1={y0+tpad+dh+igap/2} x2={x0+tw-4} y2={y0+tpad+dh+igap/2}
          stroke="#C4B49A" strokeWidth={0.8}/>
      )}
      {/* 상단 행 */}
      {topSeats.map((seat, i) => {
        const sx = x0 + tpad + i*dx;
        return (
          <g key={seat.id}>
            <Seat x={sx} y={topY} w={dw} h={dh} orient={topOrient} seat={seat} ctx={ctx}/>
            {em && (
              <g style={{cursor:"pointer"}}
                 onClick={(e)=>{e.stopPropagation(); ctx.onTableSeatDelete?.(tableId,"top",i);}}>
                <circle cx={sx+dw} cy={topY} r={5} fill="#EF4444" stroke="white" strokeWidth={1}/>
                <text x={sx+dw} y={topY+3.5} fontSize={7.5} textAnchor="middle" fill="white"
                  style={{pointerEvents:"none"}}>✕</text>
              </g>
            )}
          </g>
        );
      })}
      {/* 상단 + 버튼 */}
      {em && (
        <g style={{cursor:"pointer"}}
           onClick={(e)=>{e.stopPropagation(); ctx.onTableSeatAdd?.(tableId,"top");}}>
          <rect x={x0+tpad+topN*dx} y={topY} width={dw} height={dh} rx={1.5}
            fill="#DCFCE7" stroke="#16A34A" strokeWidth={1} strokeDasharray="3,2"/>
          <text x={x0+tpad+topN*dx+dw/2} y={topY+dh/2+2.5}
            fontSize={9} textAnchor="middle" fill="#16A34A" fontWeight="700"
            style={{pointerEvents:"none"}}>+</text>
        </g>
      )}
      {/* 하단 행 (양면만) */}
      {isDouble && botSeats && botSeats.map((seat, i) => {
        const sx = x0 + tpad + i*dx;
        return (
          <g key={seat.id}>
            <Seat x={sx} y={botY} w={dw} h={dh} orient="down" seat={seat} ctx={ctx}/>
            {em && (
              <g style={{cursor:"pointer"}}
                 onClick={(e)=>{e.stopPropagation(); ctx.onTableSeatDelete?.(tableId,"bot",i);}}>
                <circle cx={sx+dw} cy={botY} r={5} fill="#EF4444" stroke="white" strokeWidth={1}/>
                <text x={sx+dw} y={botY+3.5} fontSize={7.5} textAnchor="middle" fill="white"
                  style={{pointerEvents:"none"}}>✕</text>
              </g>
            )}
          </g>
        );
      })}
      {/* 하단 + 버튼 */}
      {isDouble && botSeats && em && (
        <g style={{cursor:"pointer"}}
           onClick={(e)=>{e.stopPropagation(); ctx.onTableSeatAdd?.(tableId,"bot");}}>
          <rect x={x0+tpad+botN*dx} y={botY} width={dw} height={dh} rx={1.5}
            fill="#DCFCE7" stroke="#16A34A" strokeWidth={1} strokeDasharray="3,2"/>
          <text x={x0+tpad+botN*dx+dw/2} y={botY+dh/2+2.5}
            fontSize={9} textAnchor="middle" fill="#16A34A" fontWeight="700"
            style={{pointerEvents:"none"}}>+</text>
        </g>
      )}
    </g>
  );
}

/**
 * SharedTableStack — zone의 seats를 순차 배분해 여러 공유 테이블을 세로로 쌓는다.
 * 각 pod의 상/하단 개수는 FloorTableDef 기준 기본값으로 사용하되,
 * ctx.tableSeats[podId]가 있으면 override(편집 반영).
 */
export function SharedTableStack({
  ctx, zone, pods, x0, y0,
  dw=38, dh=11, dx=48, tpad=4, igap=14, gap=22,
}:{
  ctx: SketchCtx;
  zone: SketchZone;
  pods: PodDef[];
  x0: number; y0: number;
  dw?: number; dh?: number; dx?: number;
  tpad?: number; igap?: number;
  gap?: number;
}) {
  let cursor = 0;
  let yCursor = y0;
  return (
    <g>
      {pods.map((p) => {
        const isDouble = p.botN !== undefined;
        const th = isDouble ? 2*dh + 2*tpad + igap : dh + 2*tpad;
        const node = (
          <SharedTable key={p.id}
            ctx={ctx} zone={zone} tableId={p.id}
            x0={x0} y0={yCursor}
            defTopBase={cursor} defTopN={p.topN}
            defBotBase={isDouble ? cursor + p.topN : undefined}
            defBotN={p.botN}
            dw={dw} dh={dh} dx={dx} tpad={tpad} igap={igap}/>
        );
        cursor += p.topN + (p.botN ?? 0);
        yCursor += th + gap;
        return node;
      })}
    </g>
  );
}


function gridPositions(startX:number,startY:number,cols:number,rows:number,sw:number,sh:number,gx:number,gy:number,rowGroups:number[],aisle:number) {
  const out:{x:number;y:number;row:number;col:number}[]=[];
  let rowY=startY,gi=0,ri=0;
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++) out.push({x:startX+c*(sw+gx),y:rowY,row:r,col:c});
    ri++; const gs=rowGroups[gi]||2;
    if(ri>=gs&&r<rows-1){rowY+=sh+gy+aisle;gi++;ri=0;}else rowY+=sh+gy;
  }
  return out;
}
function orientOf(row:number,rowGroups:number[]):"down"|"up" {
  let gi=0,ri=0;
  for(let i=0;i<row;i++){ri++;if(ri>=(rowGroups[gi]||2)){gi++;ri=0;}}
  return ri===0?"down":"up";
}
function DeskGrid({zone,startX,startY,cols,rows,sw,sh,gx,gy,rowGroups,aisle,ctx,startSeat=0}:{
  zone:SketchZone;startX:number;startY:number;cols:number;rows:number;
  sw:number;sh:number;gx:number;gy:number;rowGroups:number[];aisle:number;ctx:SketchCtx;startSeat?:number;
}) {
  const positions=gridPositions(startX,startY,cols,rows,sw,sh,gx,gy,rowGroups,aisle);
  return (<g>{positions.map((p,i)=>{
    const seat=zone.seats[i+startSeat]; if(!seat) return null;
    return <Seat key={seat.id} x={p.x} y={p.y} w={sw} h={sh} orient={orientOf(p.row,rowGroups)} seat={seat} ctx={ctx}/>;
  })}</g>);
}

function MeetingBox({x,y,w,h,name,sub}:{x:number;y:number;w:number;h:number;name:string;sub?:string}) {
  return (<g>
    <rect x={x} y={y} width={w} height={h} fill="#ECFDF5" stroke="#047857" strokeWidth={1.2}/>
    <path d={`M ${x} ${y+h-10} A 10 10 0 0 1 ${x+10} ${y+h}`} fill="none" stroke="#047857" strokeWidth={0.7}/>
    <text x={x+w/2} y={y+14} fontSize={8} fontWeight={700} textAnchor="middle" fill="#065F46">{name}</text>
    {sub&&<text x={x+w/2} y={y+h-4} fontSize={6.5} textAnchor="middle" fill="#047857" opacity={0.8}>{sub}</text>}
  </g>);
}

// 본관 3F–9F 공통 코어 블록 (도면 기반: PS×4 + 계단×2 + EPS×4 + DS엘리베이터 + SOFA)
function BW_Core({y0=20,y1=548}:{y0?:number;y1?:number}) {
  const cx=308, cw=182, h=y1-y0;
  const mid=y0+h/2;
  return (<g>
    <rect x={cx} y={y0} width={cw} height={h} fill="#E2E8F0" stroke="#475569" strokeWidth={1.5}/>
    {/* PS 상단 좌우 */}
    <rect x={cx} y={y0} width={32} height={26} fill="#F1F5F9" stroke="#94A3B8" strokeWidth={0.8}/>
    <text x={cx+16} y={y0+16} fontSize={6} textAnchor="middle" fill="#475569">P.S.</text>
    <rect x={cx+cw-32} y={y0} width={32} height={26} fill="#F1F5F9" stroke="#94A3B8" strokeWidth={0.8}/>
    <text x={cx+cw-16} y={y0+16} fontSize={6} textAnchor="middle" fill="#475569">P.S.</text>
    {/* UP 계단 */}
    <rect x={cx+34} y={y0} width={114} height={82} fill="url(#hatchLight)" stroke="#475569" strokeWidth={1.2}/>
    {Array.from({length:7},(_,i)=><line key={i} x1={cx+36} y1={y0+10+i*11} x2={cx+146} y2={y0+10+i*11} stroke="#475569" strokeWidth={0.6}/>)}
    <text x={cx+40} y={y0+12} fontSize={7} fill="#475569" fontWeight={700}>UP</text>
    <text x={cx+132} y={y0+80} fontSize={7} fill="#475569" fontWeight={700}>DN</text>
    {/* EPS 상단 좌우 */}
    <rect x={cx} y={y0+28} width={32} height={48} fill="url(#hatch)" stroke="#475569" strokeWidth={0.9}/>
    <text x={cx+16} y={y0+55} fontSize={6.5} textAnchor="middle" fill="#1F2937" fontWeight={700}>EPS</text>
    <rect x={cx+cw-32} y={y0+28} width={32} height={48} fill="url(#hatch)" stroke="#475569" strokeWidth={0.9}/>
    <text x={cx+cw-16} y={y0+55} fontSize={6.5} textAnchor="middle" fill="#1F2937" fontWeight={700}>EPS</text>
    {/* DS 엘리베이터 (X패턴) */}
    <rect x={cx+34} y={y0+86} width={114} height={100} fill="#D1D5DB" stroke="#475569" strokeWidth={1.2}/>
    <line x1={cx+34} y1={y0+86} x2={cx+148} y2={y0+186} stroke="#94A3B8" strokeWidth={1}/>
    <line x1={cx+148} y1={y0+86} x2={cx+34} y2={y0+186} stroke="#94A3B8" strokeWidth={1}/>
    <text x={cx+91} y={y0+139} fontSize={8} textAnchor="middle" fill="#475569" fontWeight={700}>D.S.</text>
    {/* SOFA 구역 */}
    <rect x={cx+6} y={y0+190} width={cw-12} height={52} fill="#FAFAFA" stroke="#475569" strokeWidth={0.8}/>
    <text x={cx+91} y={y0+214} fontSize={7.5} textAnchor="middle" fill="#475569" fontWeight={700}>SOFA</text>
    <rect x={cx+12} y={y0+218} width={44} height={16} rx={4} fill="#D1FAE5" stroke="#047857" strokeWidth={0.7}/>
    <rect x={cx+cw-56} y={y0+218} width={44} height={16} rx={4} fill="#D1FAE5" stroke="#047857" strokeWidth={0.7}/>
    {/* EPS 하단 좌우 */}
    <rect x={cx} y={y0+246} width={32} height={48} fill="url(#hatch)" stroke="#475569" strokeWidth={0.9}/>
    <text x={cx+16} y={y0+273} fontSize={6.5} textAnchor="middle" fill="#1F2937" fontWeight={700}>EPS</text>
    <rect x={cx+cw-32} y={y0+246} width={32} height={48} fill="url(#hatch)" stroke="#475569" strokeWidth={0.9}/>
    <text x={cx+cw-16} y={y0+273} fontSize={6.5} textAnchor="middle" fill="#1F2937" fontWeight={700}>EPS</text>
    {/* DN 계단 */}
    <rect x={cx+34} y={y0+298} width={114} height={h-324} fill="url(#hatchLight)" stroke="#475569" strokeWidth={1.2}/>
    {Array.from({length:6},(_,i)=><line key={i} x1={cx+36} y1={y0+308+i*13} x2={cx+146} y2={y0+308+i*13} stroke="#475569" strokeWidth={0.6}/>)}
    <text x={cx+40} y={y0+310} fontSize={7} fill="#475569" fontWeight={700}>DN</text>
    {/* PS 하단 좌우 */}
    <rect x={cx} y={y1-26} width={32} height={26} fill="#F1F5F9" stroke="#94A3B8" strokeWidth={0.8}/>
    <text x={cx+16} y={y1-10} fontSize={6} textAnchor="middle" fill="#475569">P.S.</text>
    <rect x={cx+cw-32} y={y1-26} width={32} height={26} fill="#F1F5F9" stroke="#94A3B8" strokeWidth={0.8}/>
    <text x={cx+cw-16} y={y1-10} fontSize={6} textAnchor="middle" fill="#475569">P.S.</text>
  </g>);
}

// ── 본관 2F ────────────────────────────────────────────────────────
export function BW_2F_Sketch(ctx: SketchCtx) {
  const zone = ctx.zones.find(z => z.id === "SO");
  if (!zone) return null;

  // Y 레이아웃 (각 그룹 사이 간격)
  // T1 단독5석: y=54
  // T2 10석양면: y=105
  // T3  9석양면: y=181
  // T4 10석양면: y=257
  // T5  9석양면: y=333
  // T6 10석양면: y=409
  const x0 = 20;

  return (
    <svg viewBox="0 0 820 540" style={{width:"100%",maxWidth:960,height:"auto",display:"block"}}
         onClick={()=>{if(ctx.editMode&&ctx.pickedId) ctx.onPickSeat?.(null);}}>
      {HATCH}
      <rect x={12} y={20} width={796} height={510} fill="#FAFAFA" stroke="#1F2937" strokeWidth={2}/>
      {Array.from({length:24},(_,i)=><line key={`t${i}`} x1={30+i*32} y1={20} x2={30+i*32} y2={28} stroke="#60A5FA" strokeWidth={2} opacity={0.5}/>)}
      {Array.from({length:24},(_,i)=><line key={`b${i}`} x1={30+i*32} y1={530} x2={30+i*32} y2={522} stroke="#60A5FA" strokeWidth={2} opacity={0.5}/>)}
      {/* 편집 모드 안내 배너 */}
      {ctx.editMode && (
        <rect x={14} y={20} width={796} height={8} rx={2} fill="#FEF3C7" opacity={0.8}/>
      )}
      {/* 스마트오피스 프레임 */}
      <rect x={14} y={28} width={340} height={492} rx={4} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1.2} strokeDasharray="6,3"/>
      <text x={184} y={44} fontSize={9.5} fontWeight={800} fill="#1E3A8A" textAnchor="middle">스마트오피스 (서편) — {zone.seats.length}석</text>

      {/* 테이블 1~6: 그룹별 좌석 추가/삭제 지원 */}
      <SharedTable ctx={ctx} zone={zone} tableId="t1" x0={x0} y0={54}  defTopBase={0}  defTopN={5}/>
      <SharedTable ctx={ctx} zone={zone} tableId="t2" x0={x0} y0={105} defTopBase={5}  defTopN={5} defBotBase={10} defBotN={5}/>
      <SharedTable ctx={ctx} zone={zone} tableId="t3" x0={x0} y0={181} defTopBase={15} defTopN={5} defBotBase={20} defBotN={4}/>
      <SharedTable ctx={ctx} zone={zone} tableId="t4" x0={x0} y0={257} defTopBase={24} defTopN={5} defBotBase={29} defBotN={5}/>
      <SharedTable ctx={ctx} zone={zone} tableId="t5" x0={x0} y0={333} defTopBase={34} defTopN={5} defBotBase={39} defBotN={4}/>
      <SharedTable ctx={ctx} zone={zone} tableId="t6" x0={x0} y0={409} defTopBase={43} defTopN={5} defBotBase={48} defBotN={5}/>
      {/* 미팅룸 */}
      <MeetingBox x={358} y={28}  w={112} h={100} name="미팅룸 A" sub="13.5㎡"/>
      <MeetingBox x={358} y={133} w={112} h={130} name="미팅룸 B" sub="21.1㎡"/>
      <MeetingBox x={358} y={268} w={112} h={118} name="미팅룸 C" sub="18.8㎡"/>
      <MeetingBox x={358} y={391} w={112} h={109} name="쇼룸"     sub="15.2㎡"/>
      {/* ELEV HALL */}
      <rect x={474} y={28} width={88} height={88} fill="url(#hatchLight)" stroke="#475569" strokeWidth={1.2}/>
      {Array.from({length:7},(_,i)=><line key={i} x1={474} y1={38+i*11} x2={562} y2={38+i*11} stroke="#475569" strokeWidth={0.6}/>)}
      <text x={480} y={40} fontSize={7} fill="#475569" fontWeight={700}>UP</text>
      <rect x={474} y={124} width={40} height={52} fill="#E2E8F0" stroke="#475569" strokeWidth={1.2}/>
      <line x1={474} y1={124} x2={514} y2={176} stroke="#475569" strokeWidth={0.5}/>
      <line x1={514} y1={124} x2={474} y2={176} stroke="#475569" strokeWidth={0.5}/>
      <text x={494} y={152} fontSize={7} fill="#475569" textAnchor="middle">EV</text>
      <rect x={522} y={124} width={40} height={52} fill="#E2E8F0" stroke="#475569" strokeWidth={1.2}/>
      <line x1={522} y1={124} x2={562} y2={176} stroke="#475569" strokeWidth={0.5}/>
      <line x1={562} y1={124} x2={522} y2={176} stroke="#475569" strokeWidth={0.5}/>
      <text x={542} y={152} fontSize={7} fill="#475569" textAnchor="middle">EV</text>
      <rect x={474} y={184} width={88} height={95} fill="#FAFAFA" stroke="#475569" strokeWidth={1.2}/>
      <text x={518} y={228} fontSize={8} fontWeight={700} fill="#475569" textAnchor="middle">ELEV HALL</text>
      <rect x={480} y={252} width={22} height={18} rx={3} fill="#D1FAE5" stroke="#047857" strokeWidth={0.7}/>
      <rect x={540} y={252} width={22} height={18} rx={3} fill="#D1FAE5" stroke="#047857" strokeWidth={0.7}/>
      <rect x={474} y={287} width={40} height={52} fill="#E2E8F0" stroke="#475569" strokeWidth={1.2}/>
      <line x1={474} y1={287} x2={514} y2={339} stroke="#475569" strokeWidth={0.5}/>
      <line x1={514} y1={287} x2={474} y2={339} stroke="#475569" strokeWidth={0.5}/>
      <rect x={522} y={287} width={40} height={52} fill="#E2E8F0" stroke="#475569" strokeWidth={1.2}/>
      <line x1={522} y1={287} x2={562} y2={339} stroke="#475569" strokeWidth={0.5}/>
      <line x1={562} y1={287} x2={522} y2={339} stroke="#475569" strokeWidth={0.5}/>
      <rect x={474} y={348} width={88} height={95} fill="url(#hatchLight)" stroke="#475569" strokeWidth={1.2}/>
      {Array.from({length:7},(_,i)=><line key={i} x1={474} y1={358+i*11} x2={562} y2={358+i*11} stroke="#475569" strokeWidth={0.6}/>)}
      <text x={548} y={440} fontSize={7} fill="#475569">DN</text>
      <rect x={474} y={450} width={88} height={70} fill="#F8FAFC" stroke="#475569" strokeWidth={1}/>
      <text x={518} y={482} fontSize={7} fill="#475569" textAnchor="middle">화장실(남)</text>
      {/* 우측: 화장실·EPS·라운지·창고 */}
      <rect x={566} y={28} width={70} height={88} fill="#F5F3FF" stroke="#6B21A8" strokeWidth={1}/>
      <text x={601} y={68} fontSize={7.5} textAnchor="middle" fill="#6B21A8" fontWeight={700}>화장실(여)</text>
      <rect x={566} y={124} width={35} height={52} fill="url(#hatch)" stroke="#475569" strokeWidth={1}/>
      <text x={584} y={153} fontSize={7} textAnchor="middle" fill="#1F2937" fontWeight={700}>EPS</text>
      <rect x={566} y={184} width={100} height={120} fill="#FEF3C7" stroke="#D97706" strokeWidth={1.4}/>
      <text x={616} y={200} fontSize={8} textAnchor="middle" fill="#92400E" fontWeight={700}>라운지</text>
      <rect x={576} y={220} width={22} height={10} rx={2} fill="#FDE68A" stroke="#D97706" strokeWidth={0.7}/>
      <rect x={602} y={220} width={22} height={10} rx={2} fill="#FDE68A" stroke="#D97706" strokeWidth={0.7}/>
      <rect x={566} y={312} width={100} height={67} fill="#F1F5F9" stroke="#475569" strokeWidth={1.2}/>
      <text x={616} y={348} fontSize={8} textAnchor="middle" fill="#475569" fontWeight={700}>창고 2평</text>
      <rect x={566} y={387} width={35} height={52} fill="url(#hatch)" stroke="#475569" strokeWidth={1}/>
      <text x={584} y={416} fontSize={7} textAnchor="middle" fill="#1F2937" fontWeight={700}>EPS</text>
      <rect x={566} y={447} width={70} height={73} fill="#EFF6FF" stroke="#1D4ED8" strokeWidth={1}/>
      <text x={601} y={482} fontSize={7.5} textAnchor="middle" fill="#1D4ED8" fontWeight={700}>화장실(남)</text>
      {/* VOID */}
      <rect x={670} y={28} width={136} height={492} fill="url(#hatchLight)" stroke="#94A3B8" strokeWidth={1}/>
      <line x1={670} y1={28} x2={806} y2={520} stroke="#CBD5E1" strokeWidth={0.9}/>
      <line x1={806} y1={28} x2={670} y2={520} stroke="#CBD5E1" strokeWidth={0.9}/>
      <text x={738} y={274} fontSize={13} textAnchor="middle" fill="#475569" fontWeight={700}>VOID</text>
      <text x={20} y={16} fontSize={9} fontWeight={800} fill="#1F2937">← 서편</text>
      <text x={800} y={16} fontSize={9} fontWeight={800} fill="#1F2937" textAnchor="end">동편 →</text>
    </svg>
  );
}

// ── 본관 3F: 서편 54석 + 동편 71석 ────────────────────────────────
export function BW_3F_Sketch(ctx: SketchCtx) {
  const zW=ctx.zones.find(z=>z.id==="W"), zE=ctx.zones.find(z=>z.id==="E");
  if(!zW||!zE) return null;
  const defs = BW_FLOOR_TABLES["3F"];
  const wPods = defs.find(d=>d.zoneId==="W")!.pods;
  const ePods = defs.find(d=>d.zoneId==="E")!.pods;
  return (
    <svg viewBox="0 0 820 560" style={{width:"100%",maxWidth:960,height:"auto",display:"block"}}
         onClick={()=>{if(ctx.editMode&&ctx.pickedId) ctx.onPickSeat?.(null);}}>
      {HATCH}
      <rect x={12} y={20} width={796} height={528} fill="#FAFAFA" stroke="#1F2937" strokeWidth={2}/>
      {Array.from({length:24},(_,i)=><line key={`t${i}`} x1={30+i*32} y1={20} x2={30+i*32} y2={28} stroke="#60A5FA" strokeWidth={2} opacity={0.5}/>)}
      {Array.from({length:24},(_,i)=><line key={`b${i}`} x1={30+i*32} y1={548} x2={30+i*32} y2={540} stroke="#60A5FA" strokeWidth={2} opacity={0.5}/>)}
      {ctx.editMode && <rect x={14} y={20} width={796} height={8} rx={2} fill="#FEF3C7" opacity={0.8}/>}
      {/* 서편 */}
      <rect x={14} y={20} width={290} height={528} rx={3} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2"/>
      <text x={22} y={38} fontSize={8.5} fontWeight={800} fill="#1E3A8A">서편 — {zW.seats.length}석</text>
      {/* G/B 협업공간 상단 */}
      <rect x={14} y={44} width={290} height={58} fill="#F0FDF4" stroke="#86EFAC" strokeWidth={1.2} rx={3}/>
      <text x={159} y={68} fontSize={8} textAnchor="middle" fill="#15803D" fontWeight={700}>G/B 협업공간</text>
      <circle cx={80} cy={82} r={9} fill="none" stroke="#86EFAC" strokeWidth={1}/>
      {[-12,0,12].map(d=><circle key={d} cx={80+d} cy={96} r={3} fill="#BBF7D0" stroke="#86EFAC" strokeWidth={0.6}/>)}
      <circle cx={238} cy={82} r={9} fill="none" stroke="#86EFAC" strokeWidth={1}/>
      {[-12,0,12].map(d=><circle key={d} cx={238+d} cy={96} r={3} fill="#BBF7D0" stroke="#86EFAC" strokeWidth={0.6}/>)}
      {/* 서편 공유 테이블 — 5 pods (w1-w4 양면 12석, w5 단면 6석) */}
      <SharedTableStack ctx={ctx} zone={zW} pods={wPods} x0={22} y0={112}
        dw={22} dh={10} dx={28} tpad={4} igap={12} gap={18}/>
      {/* 미팅룸 하단 */}
      <MeetingBox x={14} y={444} w={140} h={100} name="미팅룸" sub="18.5m²"/>
      <MeetingBox x={158} y={444} w={148} h={100} name="미팅룸" sub="16.1m²"/>
      {/* 코어 */}
      <BW_Core y0={20} y1={548}/>
      {/* 동편 */}
      <rect x={494} y={20} width={314} height={528} rx={3} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2"/>
      <text x={502} y={38} fontSize={8.5} fontWeight={800} fill="#1E3A8A">동편 — {zE.seats.length}석</text>
      {/* G/B+TV 상단 */}
      <rect x={494} y={44} width={314} height={58} fill="#F0FDF4" stroke="#86EFAC" strokeWidth={1.2} rx={3}/>
      <text x={651} y={86} fontSize={8} textAnchor="middle" fill="#15803D" fontWeight={700}>G/B+TV</text>
      <rect x={572} y={56} width={36} height={22} rx={2} fill="#1F2937" stroke="#475569" strokeWidth={0.8}/>
      <text x={590} y={70} fontSize={6.5} textAnchor="middle" fill="white">TV</text>
      <rect x={694} y={56} width={36} height={22} rx={2} fill="#1F2937" stroke="#475569" strokeWidth={0.8}/>
      <text x={712} y={70} fontSize={6.5} textAnchor="middle" fill="white">TV</text>
      {/* 동편 공유 테이블 — 5 pods (e1-e4 양면 16석, e5 단면 7석) */}
      <SharedTableStack ctx={ctx} zone={zE} pods={ePods} x0={500} y0={112}
        dw={22} dh={10} dx={28} tpad={4} igap={12} gap={18}/>
      <text x={20} y={16} fontSize={9} fontWeight={800} fill="#1F2937">← 서편</text>
      <text x={800} y={16} fontSize={9} fontWeight={800} fill="#1F2937" textAnchor="end">동편 →</text>
    </svg>
  );
}

// ── 본관 4F: 서편 74석 + 동편 49석 ────────────────────────────────
export function BW_4F_Sketch(ctx: SketchCtx) {
  const zW=ctx.zones.find(z=>z.id==="W"), zE=ctx.zones.find(z=>z.id==="E");
  if(!zW||!zE) return null;
  const defs = BW_FLOOR_TABLES["4F"];
  const wPods = defs.find(d=>d.zoneId==="W")!.pods;
  const ePods = defs.find(d=>d.zoneId==="E")!.pods;
  return (
    <svg viewBox="0 0 820 580" style={{width:"100%",maxWidth:960,height:"auto",display:"block"}}
         onClick={()=>{if(ctx.editMode&&ctx.pickedId) ctx.onPickSeat?.(null);}}>
      {HATCH}
      <rect x={12} y={20} width={796} height={548} fill="#FAFAFA" stroke="#1F2937" strokeWidth={2}/>
      {Array.from({length:24},(_,i)=><line key={`t${i}`} x1={30+i*32} y1={20} x2={30+i*32} y2={28} stroke="#60A5FA" strokeWidth={2} opacity={0.5}/>)}
      {Array.from({length:24},(_,i)=><line key={`b${i}`} x1={30+i*32} y1={568} x2={30+i*32} y2={560} stroke="#60A5FA" strokeWidth={2} opacity={0.5}/>)}
      {ctx.editMode && <rect x={14} y={20} width={796} height={8} rx={2} fill="#FEF3C7" opacity={0.8}/>}
      {/* 서편 */}
      <rect x={14} y={20} width={290} height={548} rx={3} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2"/>
      <text x={22} y={38} fontSize={8.5} fontWeight={800} fill="#1E3A8A">서편 — {zW.seats.length}석</text>
      {/* 화상회의실 상단 */}
      <rect x={14} y={44} width={140} height={58} fill="#FEF9C3" stroke="#D97706" strokeWidth={1.2} rx={3}/>
      <text x={84} y={72} fontSize={8} textAnchor="middle" fill="#92400E" fontWeight={700}>화상회의실</text>
      <rect x={46} y={78} width={76} height={18} rx={2} fill="#FEF3C7" stroke="#D97706" strokeWidth={0.7}/>
      {[-22,-8,6,20].map(d=><circle key={d} cx={84+d} cy={64} r={3.5} fill="#FDE68A" stroke="#D97706" strokeWidth={0.5}/>)}
      {/* 협업공간 */}
      <rect x={158} y={44} width={148} height={58} fill="#F0FDF4" stroke="#86EFAC" strokeWidth={1.2} rx={3}/>
      <text x={232} y={78} fontSize={8} textAnchor="middle" fill="#15803D" fontWeight={700}>협업공간</text>
      {/* 서편 공유 테이블 — 6 pods (w1-w5 양면 14석, w6 단면 4석 = 74) */}
      <SharedTableStack ctx={ctx} zone={zW} pods={wPods} x0={22} y0={112}
        dw={22} dh={10} dx={28} tpad={4} igap={12} gap={16}/>
      {/* 코어 */}
      <BW_Core y0={20} y1={568}/>
      {/* 동편 */}
      <rect x={494} y={20} width={314} height={548} rx={3} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2"/>
      <text x={502} y={38} fontSize={8.5} fontWeight={800} fill="#1E3A8A">동편 — {zE.seats.length}석</text>
      {/* 동편 공유 테이블 — 4 pods (e1-e3 양면 14석, e4 단면 7석 = 49) */}
      <SharedTableStack ctx={ctx} zone={zE} pods={ePods} x0={502} y0={50}
        dw={22} dh={10} dx={28} tpad={4} igap={12} gap={18}/>
      {/* 동편 하단 미팅룸 */}
      <MeetingBox x={494} y={440} w={150} h={128} name="미팅룸" sub="25.3m²"/>
      <MeetingBox x={648} y={440} w={158} h={128} name="라운지" sub="20.4m²"/>
      <text x={20} y={16} fontSize={9} fontWeight={800} fill="#1F2937">← 서편</text>
      <text x={800} y={16} fontSize={9} fontWeight={800} fill="#1F2937" textAnchor="end">동편 →</text>
    </svg>
  );
}

// ── 본관 5F: 서편 74석 + 동편 49석 ────────────────────────────────
export function BW_5F_Sketch(ctx: SketchCtx) {
  const zW=ctx.zones.find(z=>z.id==="W"), zE=ctx.zones.find(z=>z.id==="E");
  if(!zW||!zE) return null;
  const defs = BW_FLOOR_TABLES["5F"];
  const wPods = defs.find(d=>d.zoneId==="W")!.pods;
  const ePods = defs.find(d=>d.zoneId==="E")!.pods;
  return (
    <svg viewBox="0 0 820 580" style={{width:"100%",maxWidth:960,height:"auto",display:"block"}}
         onClick={()=>{if(ctx.editMode&&ctx.pickedId) ctx.onPickSeat?.(null);}}>
      {HATCH}
      <rect x={12} y={20} width={796} height={548} fill="#FAFAFA" stroke="#1F2937" strokeWidth={2}/>
      {Array.from({length:24},(_,i)=><line key={`t${i}`} x1={30+i*32} y1={20} x2={30+i*32} y2={28} stroke="#60A5FA" strokeWidth={2} opacity={0.5}/>)}
      {Array.from({length:24},(_,i)=><line key={`b${i}`} x1={30+i*32} y1={568} x2={30+i*32} y2={560} stroke="#60A5FA" strokeWidth={2} opacity={0.5}/>)}
      {ctx.editMode && <rect x={14} y={20} width={796} height={8} rx={2} fill="#FEF3C7" opacity={0.8}/>}
      {/* 서편 */}
      <rect x={14} y={20} width={290} height={548} rx={3} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2"/>
      <text x={22} y={38} fontSize={8.5} fontWeight={800} fill="#1E3A8A">서편 — {zW.seats.length}석</text>
      <rect x={14} y={44} width={290} height={58} fill="#F0FDF4" stroke="#86EFAC" strokeWidth={1.2} rx={3}/>
      <text x={159} y={76} fontSize={8.5} textAnchor="middle" fill="#15803D" fontWeight={700}>협업공간 / G·B Zone</text>
      {/* 서편 공유 테이블 — 6 pods (w1-w5 양면 14석, w6 단면 4석 = 74) */}
      <SharedTableStack ctx={ctx} zone={zW} pods={wPods} x0={22} y0={112}
        dw={22} dh={10} dx={28} tpad={4} igap={12} gap={16}/>
      {/* 미팅룸 하단 */}
      <MeetingBox x={14} y={460} w={140} h={108} name="미팅룸" sub="18.5m²"/>
      <MeetingBox x={158} y={460} w={148} h={108} name="미팅룸" sub="16.1m²"/>
      {/* 코어 */}
      <BW_Core y0={20} y1={568}/>
      {/* 동편 */}
      <rect x={494} y={20} width={314} height={548} rx={3} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2"/>
      <text x={502} y={38} fontSize={8.5} fontWeight={800} fill="#1E3A8A">동편 — {zE.seats.length}석</text>
      {/* 동편 공유 테이블 — 4 pods (e1-e3 양면 14석, e4 단면 7석 = 49) */}
      <SharedTableStack ctx={ctx} zone={zE} pods={ePods} x0={502} y0={50}
        dw={22} dh={10} dx={28} tpad={4} igap={12} gap={18}/>
      <MeetingBox x={494} y={440} w={314} h={128} name="대회의실" sub="45.2m²"/>
      <text x={20} y={16} fontSize={9} fontWeight={800} fill="#1F2937">← 서편</text>
      <text x={800} y={16} fontSize={9} fontWeight={800} fill="#1F2937" textAnchor="end">동편 →</text>
    </svg>
  );
}

// ── 본관 6F: 서편 67석(개발 34" 모니터) + 동편 65석 ────────────────
export function BW_6F_Sketch(ctx: SketchCtx) {
  const zW=ctx.zones.find(z=>z.id==="W"), zE=ctx.zones.find(z=>z.id==="E");
  if(!zW||!zE) return null;
  const defs = BW_FLOOR_TABLES["6F"];
  const wPods = defs.find(d=>d.zoneId==="W")!.pods;
  const ePods = defs.find(d=>d.zoneId==="E")!.pods;
  return (
    <svg viewBox="0 0 820 580" style={{width:"100%",maxWidth:960,height:"auto",display:"block"}}
         onClick={()=>{if(ctx.editMode&&ctx.pickedId) ctx.onPickSeat?.(null);}}>
      {HATCH}
      <rect x={12} y={20} width={796} height={548} fill="#FAFAFA" stroke="#1F2937" strokeWidth={2}/>
      {Array.from({length:24},(_,i)=><line key={`t${i}`} x1={30+i*32} y1={20} x2={30+i*32} y2={28} stroke="#60A5FA" strokeWidth={2} opacity={0.5}/>)}
      {Array.from({length:24},(_,i)=><line key={`b${i}`} x1={30+i*32} y1={568} x2={30+i*32} y2={560} stroke="#60A5FA" strokeWidth={2} opacity={0.5}/>)}
      {ctx.editMode && <rect x={14} y={20} width={796} height={8} rx={2} fill="#FEF3C7" opacity={0.8}/>}
      {/* 서편: 개발 34" 모니터 존 */}
      <rect x={14} y={20} width={290} height={548} rx={3} fill="#FFF7ED" stroke="#FB923C" strokeWidth={1} strokeDasharray="5,2"/>
      <text x={22} y={36} fontSize={8} fontWeight={800} fill="#C2410C">서편 — {zW.seats.length}석 (개발 34")</text>
      <rect x={14} y={44} width={290} height={58} fill="#FFEDD5" stroke="#FB923C" strokeWidth={1} rx={3}/>
      <text x={159} y={70} fontSize={8} textAnchor="middle" fill="#9A3412" fontWeight={700}>개발 34" 모니터 구역</text>
      <text x={159} y={84} fontSize={7} textAnchor="middle" fill="#9A3412" opacity={0.8}>전 좌석 34인치 듀얼모니터</text>
      {/* 서편 공유 테이블 — 5 pods (w1-w4 양면 14석, w5 양면 7+4=11 = 67) */}
      <SharedTableStack ctx={ctx} zone={zW} pods={wPods} x0={22} y0={112}
        dw={22} dh={10} dx={28} tpad={4} igap={12} gap={18}/>
      {/* 코어 */}
      <BW_Core y0={20} y1={568}/>
      {/* 동편 */}
      <rect x={494} y={20} width={314} height={548} rx={3} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2"/>
      <text x={502} y={38} fontSize={8.5} fontWeight={800} fill="#1E3A8A">동편 — {zE.seats.length}석</text>
      {/* 동편 공유 테이블 — 5 pods (e1-e4 양면 16석, e5 단면 1석 = 65) */}
      <SharedTableStack ctx={ctx} zone={zE} pods={ePods} x0={500} y0={50}
        dw={22} dh={10} dx={28} tpad={4} igap={12} gap={18}/>
      <text x={20} y={16} fontSize={9} fontWeight={800} fill="#1F2937">← 서편</text>
      <text x={800} y={16} fontSize={9} fontWeight={800} fill="#1F2937" textAnchor="end">동편 →</text>
    </svg>
  );
}

// ── 본관 7F: 서편 19석(소규모+미팅룸) + 동편 57석 ────────────────
export function BW_7F_Sketch(ctx: SketchCtx) {
  const zW=ctx.zones.find(z=>z.id==="W"), zE=ctx.zones.find(z=>z.id==="E");
  if(!zW||!zE) return null;
  const defs = BW_FLOOR_TABLES["7F"];
  const wPods = defs.find(d=>d.zoneId==="W")!.pods;
  const ePods = defs.find(d=>d.zoneId==="E")!.pods;
  return (
    <svg viewBox="0 0 820 580" style={{width:"100%",maxWidth:960,height:"auto",display:"block"}}
         onClick={()=>{if(ctx.editMode&&ctx.pickedId) ctx.onPickSeat?.(null);}}>
      {HATCH}
      <rect x={12} y={20} width={796} height={548} fill="#FAFAFA" stroke="#1F2937" strokeWidth={2}/>
      {Array.from({length:24},(_,i)=><line key={`t${i}`} x1={30+i*32} y1={20} x2={30+i*32} y2={28} stroke="#60A5FA" strokeWidth={2} opacity={0.5}/>)}
      {Array.from({length:24},(_,i)=><line key={`b${i}`} x1={30+i*32} y1={568} x2={30+i*32} y2={560} stroke="#60A5FA" strokeWidth={2} opacity={0.5}/>)}
      {ctx.editMode && <rect x={14} y={20} width={796} height={8} rx={2} fill="#FEF3C7" opacity={0.8}/>}
      {/* 서편: G/B 협업공간 + 스마트오피스 19석 + 미팅룸 */}
      <rect x={14} y={20} width={290} height={548} rx={3} fill="#F8FAFC" stroke="#94A3B8" strokeWidth={1}/>
      {/* G/B 협업공간 상단 2개 (도면 기준: 원탁 협업 구역) */}
      <rect x={14} y={32} width={140} height={100} fill="#F0FDF4" stroke="#86EFAC" strokeWidth={1.2} rx={3}/>
      <text x={84} y={72} fontSize={8} textAnchor="middle" fill="#15803D" fontWeight={700}>G/B 협업 A</text>
      <text x={84} y={84} fontSize={7} textAnchor="middle" fill="#15803D">22.3m²</text>
      <circle cx={84} cy={56} r={14} fill="none" stroke="#86EFAC" strokeWidth={1.2}/>
      <circle cx={84} cy={56} r={6} fill="#D1FAE5" stroke="#86EFAC" strokeWidth={0.8}/>
      {[-14,0,14].map(d=><rect key={d} x={84+d-5} y={104} width={10} height={10} rx={2} fill="#BBF7D0" stroke="#86EFAC" strokeWidth={0.5}/>)}
      <rect x={158} y={32} width={148} height={100} fill="#F0FDF4" stroke="#86EFAC" strokeWidth={1.2} rx={3}/>
      <text x={232} y={72} fontSize={8} textAnchor="middle" fill="#15803D" fontWeight={700}>G/B 협업 B</text>
      <text x={232} y={84} fontSize={7} textAnchor="middle" fill="#15803D">20.1m²</text>
      <circle cx={232} cy={56} r={14} fill="none" stroke="#86EFAC" strokeWidth={1.2}/>
      <circle cx={232} cy={56} r={6} fill="#D1FAE5" stroke="#86EFAC" strokeWidth={0.8}/>
      {[-14,0,14].map(d=><rect key={d} x={232+d-5} y={104} width={10} height={10} rx={2} fill="#BBF7D0" stroke="#86EFAC" strokeWidth={0.5}/>)}
      <MeetingBox x={14} y={138} w={140} h={100} name="세미나실" sub="35.6m²"/>
      <MeetingBox x={158} y={138} w={148} h={100} name="회의실"   sub="18.4m²"/>
      {/* 스마트오피스 19석 */}
      <rect x={14} y={244} width={290} height={160} rx={3} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="4,2"/>
      <text x={22} y={260} fontSize={8} fontWeight={800} fill="#1E3A8A">스마트오피스 — {zW.seats.length}석</text>
      {/* 서편 공유 테이블 — 3 pods (w1,w2 양면 8석, w3 단면 3석 = 19) */}
      <SharedTableStack ctx={ctx} zone={zW} pods={wPods} x0={38} y0={268}
        dw={22} dh={10} dx={28} tpad={4} igap={12} gap={14}/>
      {/* 하단 미팅룸 */}
      <MeetingBox x={14} y={412} w={140} h={156} name="임원실" sub="28.0m²"/>
      <MeetingBox x={158} y={412} w={148} h={156} name="회의실" sub="22.1m²"/>
      {/* 코어 */}
      <BW_Core y0={20} y1={568}/>
      {/* 동편: 57석 */}
      <rect x={494} y={20} width={314} height={548} rx={3} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2"/>
      <text x={502} y={38} fontSize={8.5} fontWeight={800} fill="#1E3A8A">동편 — {zE.seats.length}석</text>
      {/* 동편 공유 테이블 — 5 pods (e1-e4 양면 14석, e5 단면 1석 = 57) */}
      <SharedTableStack ctx={ctx} zone={zE} pods={ePods} x0={502} y0={50}
        dw={22} dh={10} dx={28} tpad={4} igap={12} gap={18}/>
      <text x={20} y={16} fontSize={9} fontWeight={800} fill="#1F2937">← 서편</text>
      <text x={800} y={16} fontSize={9} fontWeight={800} fill="#1F2937" textAnchor="end">동편 →</text>
    </svg>
  );
}

// ── 본관 8F: 스마트오피스 28석 + 미팅룸 6개 ────────────────────────
export function BW_8F_Sketch(ctx: SketchCtx) {
  const zM=ctx.zones.find(z=>z.id==="M");
  if(!zM) return null;
  const defs = BW_FLOOR_TABLES["8F"];
  const mPods = defs.find(d=>d.zoneId==="M")!.pods;
  return (
    <svg viewBox="0 0 820 500" style={{width:"100%",maxWidth:960,height:"auto",display:"block"}}
         onClick={()=>{if(ctx.editMode&&ctx.pickedId) ctx.onPickSeat?.(null);}}>
      {HATCH}
      <rect x={12} y={20} width={796} height={468} fill="#FAFAFA" stroke="#1F2937" strokeWidth={2}/>
      {Array.from({length:24},(_,i)=><line key={`t${i}`} x1={30+i*32} y1={20} x2={30+i*32} y2={28} stroke="#60A5FA" strokeWidth={2} opacity={0.5}/>)}
      {Array.from({length:24},(_,i)=><line key={`b${i}`} x1={30+i*32} y1={488} x2={30+i*32} y2={480} stroke="#60A5FA" strokeWidth={2} opacity={0.5}/>)}
      {ctx.editMode && <rect x={14} y={20} width={796} height={8} rx={2} fill="#FEF3C7" opacity={0.8}/>}
      {/* 서편: 스마트오피스 28석 */}
      <rect x={14} y={20} width={290} height={250} rx={3} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2"/>
      <text x={22} y={38} fontSize={8.5} fontWeight={800} fill="#1E3A8A">스마트오피스 — {zM.seats.length}석</text>
      {/* 서편 공유 테이블 — 2 pods (m1, m2 양면 14석 = 28) */}
      <SharedTableStack ctx={ctx} zone={zM} pods={mPods} x0={22} y0={50}
        dw={22} dh={10} dx={28} tpad={4} igap={12} gap={18}/>
      {/* 라운지·휴게 */}
      <rect x={14} y={278} width={290} height={208} rx={3} fill="#FEF9C3" stroke="#D97706" strokeWidth={1.2}/>
      <text x={159} y={298} fontSize={8.5} textAnchor="middle" fill="#92400E" fontWeight={700}>라운지 / 휴게공간</text>
      {/* 소파 배치 심볼 */}
      <rect x={30} y={316} width={70} height={28} rx={6} fill="#FDE68A" stroke="#D97706" strokeWidth={0.8}/>
      <rect x={30} y={316} width={12} height={60} rx={4} fill="#FDE68A" stroke="#D97706" strokeWidth={0.8}/>
      <rect x={140} y={316} width={70} height={28} rx={6} fill="#FDE68A" stroke="#D97706" strokeWidth={0.8}/>
      <rect x={198} y={316} width={12} height={60} rx={4} fill="#FDE68A" stroke="#D97706" strokeWidth={0.8}/>
      <circle cx={159} cy={380} r={18} fill="#FEF3C7" stroke="#D97706" strokeWidth={0.8}/>
      {/* 코어 */}
      <BW_Core y0={20} y1={488}/>
      {/* 동편: 미팅룸 6개 (2열×3행) */}
      <rect x={494} y={20} width={314} height={468} rx={3} fill="#F8FAFC" stroke="#94A3B8" strokeWidth={1}/>
      <text x={502} y={36} fontSize={8.5} fontWeight={800} fill="#475569">미팅룸</text>
      <MeetingBox x={494} y={44} w={152} h={138} name="미팅룸-1"    sub="7.9m²"/>
      <MeetingBox x={650} y={44} w={158} h={138} name="미팅룸-2"    sub="7.9m²"/>
      <MeetingBox x={494} y={186} w={152} h={138} name="미팅룸"     sub="10.5m²"/>
      <MeetingBox x={650} y={186} w={158} h={138} name="멀티룸"     sub="12.1m²"/>
      <MeetingBox x={494} y={328} w={152} h={160} name="Conference-1" sub="21.3m²"/>
      <MeetingBox x={650} y={328} w={158} h={160} name="Conference-2" sub="21.3m²"/>
      <text x={20} y={16} fontSize={9} fontWeight={800} fill="#1F2937">← 서편</text>
      <text x={800} y={16} fontSize={9} fontWeight={800} fill="#1F2937" textAnchor="end">동편 (미팅룸) →</text>
    </svg>
  );
}

// ── 본관 9F: 스튜디오 서편 37석 + 홀 동편 85석 ────────────────────
export function BW_9F_Sketch(ctx: SketchCtx) {
  const zW=ctx.zones.find(z=>z.id==="W"), zE=ctx.zones.find(z=>z.id==="E");
  if(!zW||!zE) return null;
  const defs = BW_FLOOR_TABLES["9F"];
  const wPods = defs.find(d=>d.zoneId==="W")!.pods;
  const ePods = defs.find(d=>d.zoneId==="E")!.pods;
  return (
    <svg viewBox="0 0 880 600" style={{width:"100%",maxWidth:1050,height:"auto",display:"block"}}
         onClick={()=>{if(ctx.editMode&&ctx.pickedId) ctx.onPickSeat?.(null);}}>
      {HATCH}
      <rect x={12} y={20} width={856} height={568} fill="#FAFAFA" stroke="#1F2937" strokeWidth={2}/>
      {Array.from({length:26},(_,i)=><line key={`t${i}`} x1={30+i*32} y1={20} x2={30+i*32} y2={28} stroke="#60A5FA" strokeWidth={2} opacity={0.5}/>)}
      {Array.from({length:26},(_,i)=><line key={`b${i}`} x1={30+i*32} y1={588} x2={30+i*32} y2={580} stroke="#60A5FA" strokeWidth={2} opacity={0.5}/>)}
      {ctx.editMode && <rect x={14} y={20} width={856} height={8} rx={2} fill="#FEF3C7" opacity={0.8}/>}
      {/* 서편: 스튜디오 37석 */}
      <rect x={14} y={20} width={290} height={568} rx={3} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2"/>
      <text x={22} y={38} fontSize={8.5} fontWeight={800} fill="#1E3A8A">스튜디오 서편 — {zW.seats.length}석</text>
      {/* 도서관 / 라이브러리 구역 (도면 기준: 무대 높이 단계 + 서가) */}
      <rect x={14} y={44} width={290} height={80} fill="#FEF9C3" stroke="#D97706" strokeWidth={1.2} rx={3}/>
      <text x={159} y={60} fontSize={8} textAnchor="middle" fill="#92400E" fontWeight={700}>스튜디오 무대 / 라이브러리</text>
      {/* 무대 단 (높이 단계 심볼) */}
      {[0,1,2,3].map(i=>(
        <rect key={i} x={20+i*16} y={66+i*6} width={258-i*32} height={48-i*6}
          fill="none" stroke="#D97706" strokeWidth={0.7} rx={1} opacity={0.7}/>
      ))}
      <text x={159} y={98} fontSize={6.5} textAnchor="middle" fill="#92400E">▼ 무대 단 / BOOK SHELF</text>
      {/* 스탠딩 데스크 구역 */}
      <rect x={14} y={128} width={290} height={22} fill="#FFF7E6" stroke="#F59E0B" strokeWidth={0.8} rx={2}/>
      <text x={159} y={143} fontSize={7} textAnchor="middle" fill="#92400E">스탠딩 데스크 구역</text>
      {/* 서편 공유 테이블 — 4 pods (w1-w3 양면 10석, w4 양면 5+2=7 = 37) */}
      <SharedTableStack ctx={ctx} zone={zW} pods={wPods} x0={52} y0={160}
        dw={22} dh={10} dx={28} tpad={4} igap={12} gap={18}/>
      {/* 코어 */}
      <BW_Core y0={20} y1={588}/>
      {/* 동편: 홀 85석 */}
      <rect x={494} y={20} width={374} height={568} rx={3} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2"/>
      <text x={502} y={38} fontSize={8.5} fontWeight={800} fill="#1E3A8A">홀 동편 — {zE.seats.length}석</text>
      {/* 동편 공유 테이블 — 5 pods (e1-e4 양면 18석, e5 양면 9+4=13 = 85) */}
      <SharedTableStack ctx={ctx} zone={zE} pods={ePods} x0={502} y0={52}
        dw={22} dh={10} dx={28} tpad={4} igap={12} gap={18}/>
      <text x={20} y={16} fontSize={9} fontWeight={800} fill="#1F2937">← 서편 (스튜디오)</text>
      <text x={860} y={16} fontSize={9} fontWeight={800} fill="#1F2937" textAnchor="end">동편 (홀) →</text>
    </svg>
  );
}

// ══════════════════════════════════════════════════════════════════
// 신관 (NS) — L자형 평면 (기울어진 팔 + 직사각 우측 섹션)
// 건물 폴리곤: "60,290 600,100 940,100 940,680 600,680 600,220 94,410"
// 팔 기울기: atan(190/540) ≈ 19°
// 팔 안 책상: rotate(-19, 60, 290) 변환 그룹 안에 DeskGrid
// ══════════════════════════════════════════════════════════════════
function NS_Shell() {
  return (<g>
    {/* L자형 건물 외벽 */}
    <polygon points="60,290 600,100 940,100 940,680 600,680 600,220 94,410"
      fill="#FAFAFA" stroke="#1F2937" strokeWidth={2.5}/>
    {/* 팔(arm) 창문 — 상단 엣지를 따라 */}
    <g transform="rotate(-19, 60, 290)">
      {Array.from({length:17},(_,i)=><line key={`aw${i}`}
        x1={80+i*32} y1={290} x2={80+i*32} y2={298}
        stroke="#60A5FA" strokeWidth={2} opacity={0.45}/>)}
      {Array.from({length:17},(_,i)=><line key={`ab${i}`}
        x1={80+i*32} y1={408} x2={80+i*32} y2={400}
        stroke="#60A5FA" strokeWidth={2} opacity={0.45}/>)}
    </g>
    {/* 우측 섹션 창문 */}
    {Array.from({length:10},(_,i)=><line key={`rt${i}`}
      x1={620+i*32} y1={100} x2={620+i*32} y2={108}
      stroke="#60A5FA" strokeWidth={2} opacity={0.45}/>)}
    {Array.from({length:10},(_,i)=><line key={`rb${i}`}
      x1={620+i*32} y1={680} x2={620+i*32} y2={672}
      stroke="#60A5FA" strokeWidth={2} opacity={0.45}/>)}
  </g>);
}

// 신관 우측 섹션 공통: 계단 + 홀
function NS_RightCore() {
  return (<g>
    {/* 계단 블록 */}
    <rect x={608} y={108} width={130} height={100} fill="url(#hatchLight)" stroke="#475569" strokeWidth={1.2}/>
    {Array.from({length:7},(_,i)=><line key={i} x1={610} y1={118+i*13} x2={736} y2={118+i*13} stroke="#475569" strokeWidth={0.6}/>)}
    <text x={614} y={120} fontSize={7} fill="#475569" fontWeight={700}>UP</text>
    <text x={722} y={206} fontSize={7} fill="#475569" fontWeight={700}>DN</text>
    {/* HALL */}
    <rect x={608} y={212} width={110} height={68} fill="#F8FAFC" stroke="#475569" strokeWidth={1}/>
    <text x={663} y={248} fontSize={8} textAnchor="middle" fill="#475569" fontWeight={700}>HALL</text>
    {/* EPS */}
    <rect x={608} y={284} width={48} height={46} fill="url(#hatch)" stroke="#475569" strokeWidth={0.9}/>
    <text x={632} y={310} fontSize={7} textAnchor="middle" fill="#1F2937" fontWeight={700}>EPS</text>
  </g>);
}

// ── 신관 2F ───────────────────────────────────────────────────────
export function NS_2F_Sketch(ctx: SketchCtx) {
  const zone=ctx.zones.find(z=>z.id==="M"); if(!zone) return null;
  return (
    <svg viewBox="0 0 960 700" style={{width:"100%",maxWidth:1100,height:"auto",display:"block"}}>
      {HATCH}
      <NS_Shell/>
      {/* 팔(arm) 안 — 19° 회전 */}
      <g transform="rotate(-19, 60, 290)">
        <rect x={68} y={296} width={548} height={106} rx={3}
          fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2"/>
        <text x={74} y={310} fontSize={8} fontWeight={800} fill="#1E3A8A">OPEN OFFICE — {zone.seats.length}석</text>
        <DeskGrid zone={zone} startX={74} startY={316} cols={8} rows={6}
          sw={26} sh={11} gx={9} gy={3} rowGroups={[2,2,2]} aisle={14} ctx={ctx}/>
      </g>
      {/* 우측 섹션 */}
      <NS_RightCore/>
      {/* 화장실 */}
      <rect x={722} y={108} width={80} height={48} fill="#F5F3FF" stroke="#6B21A8" strokeWidth={1}/>
      <text x={762} y={133} fontSize={7} textAnchor="middle" fill="#6B21A8" fontWeight={700}>화장실(여)</text>
      <rect x={722} y={160} width={80} height={48} fill="#EFF6FF" stroke="#1D4ED8" strokeWidth={1}/>
      <text x={762} y={185} fontSize={7} textAnchor="middle" fill="#1D4ED8" fontWeight={700}>화장실(남)</text>
      <rect x={808} y={108} width={120} height={100} fill="#E2E8F0" stroke="#475569" strokeWidth={1}/>
      <line x1={808} y1={108} x2={928} y2={208} stroke="#94A3B8" strokeWidth={0.8}/>
      <line x1={928} y1={108} x2={808} y2={208} stroke="#94A3B8" strokeWidth={0.8}/>
      <text x={868} y={160} fontSize={7} textAnchor="middle" fill="#475569">EV홀</text>
      {/* 2F: 포커스룸 2실 + 미팅룸 + 라운지 */}
      <MeetingBox x={608} y={340} w={155} h={100} name="포커스룸 1" sub="5.0m²"/>
      <MeetingBox x={608} y={444} w={155} h={100} name="포커스룸 2" sub="5.0m²"/>
      <rect x={608} y={548} width={155} height={120} rx={3} fill="#FEF3C7" stroke="#D97706" strokeWidth={1.2}/>
      <text x={685} y={608} fontSize={8} textAnchor="middle" fill="#92400E" fontWeight={700}>라운지</text>
      <rect x={626} y={568} width={50} height={20} rx={4} fill="#FDE68A" stroke="#D97706" strokeWidth={0.7}/>
      <rect x={686} y={568} width={50} height={20} rx={4} fill="#FDE68A" stroke="#D97706" strokeWidth={0.7}/>
      <MeetingBox x={768} y={220} w={160} h={140} name="미팅룸" sub="18.5m²"/>
      <rect x={768} y={364} width={160} height={304} rx={3} fill="#ECFDF5" stroke="#047857" strokeWidth={1.2}/>
      <text x={848} y={510} fontSize={8.5} textAnchor="middle" fill="#065F46" fontWeight={700}>라운지</text>
      <circle cx={848} cy={470} r={22} fill="none" stroke="#86EFAC" strokeWidth={1.2}/>
      {[-18,0,18].map(d=><rect key={d} x={830+d} y={536} width={36} height={14} rx={4} fill="#BBF7D0" stroke="#86EFAC" strokeWidth={0.6}/>)}
    </svg>
  );
}

// ── 신관 3F ───────────────────────────────────────────────────────
export function NS_3F_Sketch(ctx: SketchCtx) {
  const zone=ctx.zones.find(z=>z.id==="M"); if(!zone) return null;
  return (
    <svg viewBox="0 0 960 700" style={{width:"100%",maxWidth:1100,height:"auto",display:"block"}}>
      {HATCH}
      <NS_Shell/>
      <g transform="rotate(-19, 60, 290)">
        <rect x={68} y={296} width={548} height={106} rx={3}
          fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2"/>
        <text x={74} y={310} fontSize={8} fontWeight={800} fill="#1E3A8A">OPEN OFFICE — {zone.seats.length}석</text>
        <DeskGrid zone={zone} startX={74} startY={316} cols={8} rows={6}
          sw={26} sh={11} gx={9} gy={3} rowGroups={[2,2,2]} aisle={14} ctx={ctx}/>
      </g>
      <NS_RightCore/>
      {/* 화장실 */}
      <rect x={722} y={108} width={80} height={48} fill="#F5F3FF" stroke="#6B21A8" strokeWidth={1}/>
      <text x={762} y={133} fontSize={7} textAnchor="middle" fill="#6B21A8" fontWeight={700}>화장실(여)</text>
      <rect x={722} y={160} width={80} height={48} fill="#EFF6FF" stroke="#1D4ED8" strokeWidth={1}/>
      <text x={762} y={185} fontSize={7} textAnchor="middle" fill="#1D4ED8" fontWeight={700}>화장실(남)</text>
      <rect x={808} y={108} width={120} height={100} fill="#E2E8F0" stroke="#475569" strokeWidth={1}/>
      <line x1={808} y1={108} x2={928} y2={208} stroke="#94A3B8" strokeWidth={0.8}/>
      <line x1={928} y1={108} x2={808} y2={208} stroke="#94A3B8" strokeWidth={0.8}/>
      <text x={868} y={160} fontSize={7} textAnchor="middle" fill="#475569">EV홀</text>
      {/* 3F: 포커스룸 2실 + 라운지 + 미팅룸 + 세미나실 + 미팅홀 */}
      <MeetingBox x={608} y={340} w={155} h={90} name="포커스룸 1" sub="5.0m²"/>
      <MeetingBox x={608} y={434} w={155} h={90} name="포커스룸 2" sub="5.0m²"/>
      <rect x={608} y={528} width={155} height={140} rx={3} fill="#FEF3C7" stroke="#D97706" strokeWidth={1.2}/>
      <text x={685} y={598} fontSize={8} textAnchor="middle" fill="#92400E" fontWeight={700}>라운지</text>
      <rect x={626} y={546} width={44} height={18} rx={4} fill="#FDE68A" stroke="#D97706" strokeWidth={0.7}/>
      <rect x={680} y={546} width={44} height={18} rx={4} fill="#FDE68A" stroke="#D97706" strokeWidth={0.7}/>
      <MeetingBox x={768} y={220} w={160} h={140} name="미팅룸" sub="18.5m²"/>
      <MeetingBox x={768} y={364} w={160} h={140} name="세미나실" sub="25.0m²"/>
      <rect x={768} y={508} width={160} height={160} rx={3} fill="#ECFDF5" stroke="#047857" strokeWidth={1.4}/>
      <text x={848} y={582} fontSize={8.5} textAnchor="middle" fill="#065F46" fontWeight={800}>미팅홀</text>
      <text x={848} y={596} fontSize={7} textAnchor="middle" fill="#047857">30.0m² / 9.1평</text>
      {[-30,-10,10,30].map(d=><circle key={d} cx={848+d} cy={552} r={8} fill="#F0FDF4" stroke="#86EFAC" strokeWidth={0.7}/>)}
    </svg>
  );
}

// ── 신관 4F ───────────────────────────────────────────────────────
export function NS_4F_Sketch(ctx: SketchCtx) {
  const zone=ctx.zones.find(z=>z.id==="M"); if(!zone) return null;
  return (
    <svg viewBox="0 0 960 700" style={{width:"100%",maxWidth:1100,height:"auto",display:"block"}}>
      {HATCH}
      <NS_Shell/>
      <g transform="rotate(-19, 60, 290)">
        <rect x={68} y={296} width={548} height={106} rx={3}
          fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2"/>
        <text x={74} y={310} fontSize={8} fontWeight={800} fill="#1E3A8A">OPEN OFFICE — {zone.seats.length}석</text>
        <DeskGrid zone={zone} startX={74} startY={316} cols={8} rows={6}
          sw={26} sh={11} gx={9} gy={3} rowGroups={[2,2,2]} aisle={14} ctx={ctx}/>
      </g>
      <NS_RightCore/>
      {/* 화장실 */}
      <rect x={722} y={108} width={80} height={48} fill="#F5F3FF" stroke="#6B21A8" strokeWidth={1}/>
      <text x={762} y={133} fontSize={7} textAnchor="middle" fill="#6B21A8" fontWeight={700}>화장실(여)</text>
      <rect x={722} y={160} width={80} height={48} fill="#EFF6FF" stroke="#1D4ED8" strokeWidth={1}/>
      <text x={762} y={185} fontSize={7} textAnchor="middle" fill="#1D4ED8" fontWeight={700}>화장실(남)</text>
      <rect x={808} y={108} width={120} height={100} fill="#E2E8F0" stroke="#475569" strokeWidth={1}/>
      <line x1={808} y1={108} x2={928} y2={208} stroke="#94A3B8" strokeWidth={0.8}/>
      <line x1={928} y1={108} x2={808} y2={208} stroke="#94A3B8" strokeWidth={0.8}/>
      <text x={868} y={160} fontSize={7} textAnchor="middle" fill="#475569">EV홀</text>
      {/* 4F: 포커스 1~5 + 라운지 (실도면 기준: 포커스4가 상단 대형룸) */}
      <MeetingBox x={608} y={340} w={155} h={95} name="포커스 1" sub="5.0m²"/>
      <MeetingBox x={608} y={439} w={155} h={95} name="포커스 2" sub="5.0m²"/>
      <MeetingBox x={608} y={538} w={155} h={130} name="포커스 3" sub="5.0m²"/>
      <MeetingBox x={768} y={220} w={160} h={155} name="포커스 4" sub="8.0m²"/>
      <MeetingBox x={768} y={379} w={160} h={95} name="포커스 5" sub="5.0m²"/>
      <rect x={768} y={478} width={160} height={190} rx={3} fill="#FEF3C7" stroke="#D97706" strokeWidth={1.4}/>
      <text x={848} y={572} fontSize={8.5} textAnchor="middle" fill="#92400E" fontWeight={800}>라운지</text>
      <text x={848} y={586} fontSize={7} textAnchor="middle" fill="#92400E" opacity={0.8}>20.0m²</text>
      <circle cx={820} cy={536} r={13} fill="#FEF9C3" stroke="#D97706" strokeWidth={0.8}/>
      <circle cx={876} cy={536} r={13} fill="#FEF9C3" stroke="#D97706" strokeWidth={0.8}/>
    </svg>
  );
}

// ── 신관 5F ───────────────────────────────────────────────────────
export function NS_5F_Sketch(ctx: SketchCtx) {
  const zone=ctx.zones.find(z=>z.id==="M"); if(!zone) return null;
  return (
    <svg viewBox="0 0 960 700" style={{width:"100%",maxWidth:1100,height:"auto",display:"block"}}>
      {HATCH}
      <NS_Shell/>
      <g transform="rotate(-19, 60, 290)">
        <rect x={68} y={296} width={548} height={106} rx={3}
          fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2"/>
        <text x={74} y={310} fontSize={8} fontWeight={800} fill="#1E3A8A">OPEN OFFICE — {zone.seats.length}석</text>
        <DeskGrid zone={zone} startX={74} startY={316} cols={8} rows={6}
          sw={26} sh={11} gx={9} gy={3} rowGroups={[2,2,2]} aisle={14} ctx={ctx}/>
      </g>
      <NS_RightCore/>
      {/* 화장실 */}
      <rect x={722} y={108} width={80} height={48} fill="#F5F3FF" stroke="#6B21A8" strokeWidth={1}/>
      <text x={762} y={133} fontSize={7} textAnchor="middle" fill="#6B21A8" fontWeight={700}>화장실(여)</text>
      <rect x={722} y={160} width={80} height={48} fill="#EFF6FF" stroke="#1D4ED8" strokeWidth={1}/>
      <text x={762} y={185} fontSize={7} textAnchor="middle" fill="#1D4ED8" fontWeight={700}>화장실(남)</text>
      <rect x={808} y={108} width={120} height={100} fill="#E2E8F0" stroke="#475569" strokeWidth={1}/>
      <line x1={808} y1={108} x2={928} y2={208} stroke="#94A3B8" strokeWidth={0.8}/>
      <line x1={928} y1={108} x2={808} y2={208} stroke="#94A3B8" strokeWidth={0.8}/>
      <text x={868} y={160} fontSize={7} textAnchor="middle" fill="#475569">EV홀</text>
      {/* 5F: Focus RM + 라운지 + Work Space / Meeting RM 1·2 + 라운지 */}
      <MeetingBox x={608} y={340} w={155} h={105} name="포커스룸 1" sub="6.1m²"/>
      <rect x={608} y={449} width={155} height={105} rx={3} fill="#FEF3C7" stroke="#D97706" strokeWidth={1.2}/>
      <text x={685} y={500} fontSize={8} textAnchor="middle" fill="#92400E" fontWeight={700}>라운지</text>
      <rect x={622} y={516} width={44} height={18} rx={4} fill="#FDE68A" stroke="#D97706" strokeWidth={0.7}/>
      <rect x={676} y={516} width={44} height={18} rx={4} fill="#FDE68A" stroke="#D97706" strokeWidth={0.7}/>
      <rect x={608} y={558} width={155} height={110} rx={3} fill="#F0FDF4" stroke="#86EFAC" strokeWidth={1.2}/>
      <text x={685} y={612} fontSize={8} textAnchor="middle" fill="#065F46" fontWeight={700}>Work Space</text>
      {[636,682,728].map(x=><rect key={x} x={x} y={576} width={28} height={14} rx={3} fill="#DCFCE7" stroke="#86EFAC" strokeWidth={0.6}/>)}
      <MeetingBox x={768} y={220} w={160} h={145} name="Meeting RM 1" sub="7.9m²"/>
      <MeetingBox x={768} y={369} w={160} h={145} name="Meeting RM 2" sub="7.9m²"/>
      <rect x={768} y={518} width={160} height={150} rx={3} fill="#FEF3C7" stroke="#D97706" strokeWidth={1.4}/>
      <text x={848} y={592} fontSize={8.5} textAnchor="middle" fill="#92400E" fontWeight={800}>라운지</text>
      <circle cx={820} cy={553} r={13} fill="#FEF9C3" stroke="#D97706" strokeWidth={0.8}/>
      <circle cx={876} cy={553} r={13} fill="#FEF9C3" stroke="#D97706" strokeWidth={0.8}/>
    </svg>
  );
}

// ══════════════════════════════════════════════════════════════════
// S빌딩 (SB) — 사선 코너 + 층별 레이아웃
// 건물: 직사각형 메인 + 상단 좌측 사선 코너
// ══════════════════════════════════════════════════════════════════
function SB_Shell() {
  return (<g>
    {/* 메인 건물 (상단 좌측 사선 커팅) */}
    <polygon points="210,90 880,90 880,620 80,620 80,300 210,90"
      fill="#FAFAFA" stroke="#1F2937" strokeWidth={2.5}/>
    {/* 창문 상단 */}
    {Array.from({length:20},(_,i)=><line key={`t${i}`}
      x1={220+i*32} y1={90} x2={220+i*32} y2={98}
      stroke="#60A5FA" strokeWidth={2} opacity={0.45}/>)}
    {/* 창문 하단 */}
    {Array.from({length:24},(_,i)=><line key={`b${i}`}
      x1={90+i*32} y1={620} x2={90+i*32} y2={612}
      stroke="#60A5FA" strokeWidth={2} opacity={0.45}/>)}
    {/* 창문 우측 */}
    {Array.from({length:15},(_,i)=><line key={`r${i}`}
      x1={880} y1={110+i*34} x2={872} y2={110+i*34}
      stroke="#60A5FA" strokeWidth={2} opacity={0.45}/>)}
  </g>);
}

// ── S빌딩 3F: Smart Office 1(15席) + Smart Office 2(32席/zone M 40석) ──
export function SB_3F_Sketch(ctx: SketchCtx) {
  const zone=ctx.zones.find(z=>z.id==="M"); if(!zone) return null;
  return (
    <svg viewBox="0 0 960 680" style={{width:"100%",maxWidth:1100,height:"auto",display:"block"}}>
      {HATCH}
      <SB_Shell/>
      {/* 상단 좌측: 계단/EV 블록 */}
      <rect x={80} y={90} width={130} height={100} fill="url(#hatchLight)" stroke="#475569" strokeWidth={1.2}/>
      {Array.from({length:6},(_,i)=><line key={i} x1={82} y1={100+i*14} x2={208} y2={100+i*14} stroke="#475569" strokeWidth={0.6}/>)}
      <text x={86} y={102} fontSize={7} fill="#475569" fontWeight={700}>DN</text>
      <text x={194} y={188} fontSize={7} fill="#475569" fontWeight={700}>UP</text>
      {/* EPS */}
      <rect x={80} y={194} width={48} height={42} fill="url(#hatch)" stroke="#475569" strokeWidth={0.9}/>
      <text x={104} y={218} fontSize={7} textAnchor="middle" fill="#1F2937" fontWeight={700}>EPS</text>
      {/* LOCKER */}
      <rect x={132} y={194} width={78} height={42} fill="#F1F5F9" stroke="#94A3B8" strokeWidth={0.8}/>
      <text x={171} y={218} fontSize={7} textAnchor="middle" fill="#475569" fontWeight={700}>LOCKER</text>
      {/* 상단 우측: 화장실 + 미팅룸 */}
      <rect x={450} y={90} width={80} height={90} fill="#F5F3FF" stroke="#6B21A8" strokeWidth={1}/>
      <text x={490} y={135} fontSize={7} textAnchor="middle" fill="#6B21A8" fontWeight={700}>화장실(M)</text>
      <rect x={534} y={90} width={60} height={90} fill="#EFF6FF" stroke="#1D4ED8" strokeWidth={1}/>
      <text x={564} y={135} fontSize={7} textAnchor="middle" fill="#1D4ED8" fontWeight={700}>화장실(F)</text>
      <MeetingBox x={598} y={90} w={90} h={90} name="Meeting RM.1" sub="7.9m²"/>
      <MeetingBox x={692} y={90} w={90} h={90} name="Meeting RM.2" sub="7.9m²"/>
      <MeetingBox x={786} y={90} w={90} h={90} name="Meeting RM.3" sub="7.9m²"/>
      {/* 유리벽 구분선 */}
      <line x1={210} y1={244} x2={880} y2={244} stroke="#60A5FA" strokeWidth={1.5} strokeDasharray="6,3"/>
      <text x={540} y={240} fontSize={7} fill="#3B82F6" textAnchor="middle">— 유리벽 —</text>
      {/* Smart Office 1: 15석 (정적 표시) */}
      <rect x={80} y={258} width={260} height={280} rx={3} fill="#F1F5F9" stroke="#94A3B8" strokeWidth={1} strokeDasharray="4,2"/>
      <text x={210} y={276} fontSize={9} textAnchor="middle" fill="#475569" fontWeight={700}>Smart Office 1</text>
      <text x={210} y={290} fontSize={8} textAnchor="middle" fill="#94A3B8">84.4㎡ · 25.5평 · 15석</text>
      {/* 정적 책상 그리드 (15석 표시용) */}
      {Array.from({length:3},(_,row)=>Array.from({length:5},(_,col)=>(
        <rect key={`so1-${row}-${col}`}
          x={96+col*46} y={308+row*66} width={34} height={14} rx={2}
          fill="#E2E8F0" stroke="#94A3B8" strokeWidth={0.6}/>
      )))}
      {/* Smart Office 2: zone M (40석 인터랙티브) */}
      <rect x={344} y={258} width={532} height={300} rx={3} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2"/>
      <text x={610} y={276} fontSize={9} textAnchor="middle" fill="#1E3A8A" fontWeight={700}>Smart Office 2 — {zone.seats.length}석</text>
      <text x={610} y={290} fontSize={7.5} textAnchor="middle" fill="#3B82F6">142.8㎡ · 43.2평</text>
      <DeskGrid zone={zone} startX={352} startY={302} cols={8} rows={5}
        sw={36} sh={13} gx={10} gy={3} rowGroups={[2,3]} aisle={18} ctx={ctx}/>
      {/* 하단 */}
      <rect x={344} y={562} width={260} height={48} fill="#FEF9C3" stroke="#D97706" strokeWidth={1}/>
      <text x={474} y={588} fontSize={7.5} textAnchor="middle" fill="#92400E" fontWeight={700}>탕비공간</text>
      <rect x={608} y={562} width={100} height={48} fill="#F1F5F9" stroke="#94A3B8" strokeWidth={1}/>
      <text x={658} y={588} fontSize={7.5} textAnchor="middle" fill="#475569" fontWeight={700}>서버실</text>
      <rect x={712} y={562} width={164} height={48} fill="#ECFDF5" stroke="#047857" strokeWidth={1}/>
      <text x={794} y={588} fontSize={7.5} textAnchor="middle" fill="#065F46" fontWeight={700}>발코니</text>
    </svg>
  );
}

// ── S빌딩 4F: Focus Offices + CASUAL + MEETING RM + OPEN OFFICE ──
export function SB_4F_Sketch(ctx: SketchCtx) {
  const zone=ctx.zones.find(z=>z.id==="M"); if(!zone) return null;
  return (
    <svg viewBox="0 0 960 680" style={{width:"100%",maxWidth:1100,height:"auto",display:"block"}}>
      {HATCH}
      <SB_Shell/>
      {/* 상단: 계단 */}
      <rect x={80} y={90} width={130} height={100} fill="url(#hatchLight)" stroke="#475569" strokeWidth={1.2}/>
      {Array.from({length:6},(_,i)=><line key={i} x1={82} y1={100+i*14} x2={208} y2={100+i*14} stroke="#475569" strokeWidth={0.6}/>)}
      <text x={86} y={102} fontSize={7} fill="#475569" fontWeight={700}>DN/UP</text>
      {/* 화장실 + 샤워 */}
      <rect x={215} y={90} width={70} height={90} fill="#F5F3FF" stroke="#6B21A8" strokeWidth={1}/>
      <text x={250} y={135} fontSize={7} textAnchor="middle" fill="#6B21A8" fontWeight={700}>화장실</text>
      <rect x={289} y={90} width={70} height={90} fill="#EFF6FF" stroke="#1D4ED8" strokeWidth={1}/>
      <text x={324} y={135} fontSize={7} textAnchor="middle" fill="#1D4ED8" fontWeight={700}>샤워실</text>
      {/* LOCKER */}
      <rect x={363} y={90} width={80} height={90} fill="#F1F5F9" stroke="#94A3B8" strokeWidth={1}/>
      <text x={403} y={135} fontSize={7} textAnchor="middle" fill="#475569" fontWeight={700}>LOCKER</text>
      {/* Focus Offices 상단 5개 */}
      {["Focus 1","Focus 2","Focus 3","Focus 4","Focus 5"].map((n,i)=>(
        <MeetingBox key={n} x={447+i*87} y={90} w={83} h={90} name={n} sub="5.0m²"/>
      ))}
      {/* 유리벽 */}
      <line x1={210} y1={192} x2={880} y2={192} stroke="#60A5FA" strokeWidth={1.5} strokeDasharray="6,3"/>
      {/* CASUAL WORK SPACE */}
      <rect x={80} y={206} width={260} height={340} rx={3} fill="#FEF9C3" stroke="#D97706" strokeWidth={1.2}/>
      <text x={210} y={228} fontSize={9} textAnchor="middle" fill="#92400E" fontWeight={700}>CASUAL WORK SPACE</text>
      {/* 캐주얼 가구 심볼 */}
      {[[100,260,100,40],[100,320,100,40],[100,380,100,40]].map(([x,y,w,h],i)=>(
        <rect key={i} x={x} y={y} width={w} height={h} rx={6}
          fill="#FDE68A" stroke="#D97706" strokeWidth={0.8}/>
      ))}
      {/* MEETING RM */}
      <rect x={344} y={206} width={170} height={340} rx={3} fill="#ECFDF5" stroke="#047857" strokeWidth={1.2}/>
      <text x={429} y={226} fontSize={8.5} textAnchor="middle" fill="#065F46" fontWeight={700}>MEETING RM</text>
      <rect x={360} y={250} width={140} height={80} rx={3} fill="#FDF6B2" stroke="#92400E" strokeWidth={0.8}/>
      {[-40,-20,0,20,40].map(d=><circle key={d} cx={430+d} cy={248} r={9} fill="#F3F4F6" stroke="#94A3B8" strokeWidth={0.6}/>)}
      {[-40,-20,0,20,40].map(d=><circle key={d+"b"} cx={430+d} cy={342} r={9} fill="#F3F4F6" stroke="#94A3B8" strokeWidth={0.6}/>)}
      {/* OPEN OFFICE (zone M) */}
      <rect x={518} y={206} width={358} height={340} rx={3} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2"/>
      <text x={697} y={224} fontSize={9} textAnchor="middle" fill="#1E3A8A" fontWeight={700}>OPEN OFFICE — {zone.seats.length}석</text>
      <DeskGrid zone={zone} startX={526} startY={236} cols={8} rows={5}
        sw={30} sh={13} gx={8} gy={3} rowGroups={[2,3]} aisle={18} ctx={ctx}/>
      {/* 하단 */}
      <rect x={80} y={550} width={260} height={60} fill="#FEF9C3" stroke="#D97706" strokeWidth={1}/>
      <text x={210} y={582} fontSize={7.5} textAnchor="middle" fill="#92400E" fontWeight={700}>탕비공간</text>
    </svg>
  );
}

// ── S빌딩 5F: Focus RM + Counter + Meeting RM + Lounge + Work Space ──
export function SB_5F_Sketch(ctx: SketchCtx) {
  const zone=ctx.zones.find(z=>z.id==="M"); if(!zone) return null;
  return (
    <svg viewBox="0 0 960 680" style={{width:"100%",maxWidth:1100,height:"auto",display:"block"}}>
      {HATCH}
      <SB_Shell/>
      {/* 상단: 계단 */}
      <rect x={80} y={90} width={130} height={100} fill="url(#hatchLight)" stroke="#475569" strokeWidth={1.2}/>
      {Array.from({length:6},(_,i)=><line key={i} x1={82} y1={100+i*14} x2={208} y2={100+i*14} stroke="#475569" strokeWidth={0.6}/>)}
      <text x={86} y={102} fontSize={7} fill="#475569" fontWeight={700}>DN/UP</text>
      {/* 상단 룸들 */}
      <MeetingBox x={215} y={90} w={110} h={90} name="Focus RM 1" sub="6.1m²"/>
      <rect x={329} y={90} width={80} height={90} fill="#F1F5F9" stroke="#94A3B8" strokeWidth={1}/>
      <text x={369} y={138} fontSize={7.5} textAnchor="middle" fill="#475569" fontWeight={700}>카운터</text>
      <MeetingBox x={413} y={90} w={110} h={90} name="Meeting RM.1" sub="7.9m²"/>
      <MeetingBox x={527} y={90} w={110} h={90} name="Meeting RM.2" sub="7.9m²"/>
      {/* 화장실 */}
      <rect x={641} y={90} width={80} height={44} fill="#F5F3FF" stroke="#6B21A8" strokeWidth={1}/>
      <text x={681} y={116} fontSize={7} textAnchor="middle" fill="#6B21A8" fontWeight={700}>화장실(여)</text>
      <rect x={641} y={138} width={80} height={42} fill="#EFF6FF" stroke="#1D4ED8" strokeWidth={1}/>
      <text x={681} y={162} fontSize={7} textAnchor="middle" fill="#1D4ED8" fontWeight={700}>화장실(남)</text>
      <rect x={725} y={90} width={151} height={90} fill="#E2E8F0" stroke="#475569" strokeWidth={1}/>
      <line x1={725} y1={90} x2={876} y2={180} stroke="#94A3B8" strokeWidth={0.8}/>
      <line x1={876} y1={90} x2={725} y2={180} stroke="#94A3B8" strokeWidth={0.8}/>
      <text x={800} y={140} fontSize={7} textAnchor="middle" fill="#475569">EV홀</text>
      {/* 유리벽 */}
      <line x1={210} y1={192} x2={880} y2={192} stroke="#60A5FA" strokeWidth={1.5} strokeDasharray="6,3"/>
      {/* 라운지 */}
      <rect x={80} y={206} width={220} height={350} rx={3} fill="#FEF3C7" stroke="#D97706" strokeWidth={1.2}/>
      <text x={190} y={228} fontSize={9} textAnchor="middle" fill="#92400E" fontWeight={700}>Lounge</text>
      <rect x={96} y={248} width={80} height={30} rx={6} fill="#FDE68A" stroke="#D97706" strokeWidth={0.8}/>
      <rect x={96} y={248} width={16} height={70} rx={4} fill="#FDE68A" stroke="#D97706" strokeWidth={0.8}/>
      <circle cx={190} cy={320} r={20} fill="#FEF9C3" stroke="#D97706" strokeWidth={0.8}/>
      {/* Work Space */}
      <rect x={304} y={206} width={220} height={350} rx={3} fill="#F0FDF4" stroke="#86EFAC" strokeWidth={1.2}/>
      <text x={414} y={228} fontSize={9} textAnchor="middle" fill="#15803D" fontWeight={700}>Work Space</text>
      {[[320,252,80,30],[320,306,80,30],[320,360,80,30],[320,414,80,30]].map(([x,y,w,h],i)=>(
        <rect key={i} x={x} y={y} width={w} height={h} rx={3}
          fill="#DCFCE7" stroke="#86EFAC" strokeWidth={0.7}/>
      ))}
      {/* OPEN OFFICE (zone M) */}
      <rect x={528} y={206} width={348} height={350} rx={3} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2"/>
      <text x={702} y={224} fontSize={9} textAnchor="middle" fill="#1E3A8A" fontWeight={700}>OPEN OFFICE — {zone.seats.length}석</text>
      <DeskGrid zone={zone} startX={536} startY={238} cols={8} rows={5}
        sw={30} sh={13} gx={7} gy={3} rowGroups={[2,3]} aisle={18} ctx={ctx}/>
      {/* 탕비공간 */}
      <rect x={80} y={560} width={220} height={50} fill="#FEF9C3" stroke="#D97706" strokeWidth={1}/>
      <text x={190} y={588} fontSize={7.5} textAnchor="middle" fill="#92400E" fontWeight={700}>탕비공간</text>
    </svg>
  );
}

// ── 레지스트리 ──────────────────────────────────────────────────────
export const FLOOR_SKETCHES: Record<string,(ctx:SketchCtx)=>React.ReactNode> = {
  "bw-2F": BW_2F_Sketch,
  "bw-3F": BW_3F_Sketch,
  "bw-4F": BW_4F_Sketch,
  "bw-5F": BW_5F_Sketch,
  "bw-6F": BW_6F_Sketch,
  "bw-7F": BW_7F_Sketch,
  "bw-8F": BW_8F_Sketch,
  "bw-9F": BW_9F_Sketch,
  "ns-2F": NS_2F_Sketch,
  "ns-3F": NS_3F_Sketch,
  "ns-4F": NS_4F_Sketch,
  "ns-5F": NS_5F_Sketch,
  "sb-3F": SB_3F_Sketch,
  "sb-4F": SB_4F_Sketch,
  "sb-5F": SB_5F_Sketch,
};
