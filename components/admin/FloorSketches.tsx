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
  const deskFill = dimmed ? "#E5E7EB" : meta.color + (seat.type === "unk" ? "66" : "D9");
  const deskStroke = dimmed ? "#D1D5DB" : "#1F2937";
  const chairH = Math.max(6, Math.round(h * 0.65));
  const chairPad = 2;
  const chairY = orient === "up" ? y - chairH - 1 : y + h + 1;
  return (
    <g style={{ cursor:"pointer" }} onClick={() => !dimmed && ctx.onSelect(seat.id)}>
      <rect x={x+chairPad} y={chairY} width={w-chairPad*2} height={chairH} rx={2.5}
        fill={dimmed?"#F3F4F6":"#E8EAED"} stroke={dimmed?"#E2E8F0":"#94A3B8"} strokeWidth={0.7}/>
      <rect x={x} y={y} width={w} height={h} rx={1.5}
        fill={deskFill} stroke={deskStroke} strokeWidth={isSel?1.5:0.7}/>
      {seat.type==="none" && !dimmed && (<>
        <line x1={x+2} y1={y+2} x2={x+w-2} y2={y+h-2} stroke="white" strokeWidth={1.3}/>
        <line x1={x+w-2} y1={y+2} x2={x+2} y2={y+h-2} stroke="white" strokeWidth={1.3}/>
      </>)}
      {isSel && <rect x={x-2} y={Math.min(chairY,y)-1} width={w+4} height={h+chairH+3}
        rx={2.5} fill="none" stroke={meta.color} strokeWidth={1.6} opacity={0.9}
        style={{pointerEvents:"none"}}/>}
      <title>{seat.id} · {seat.type}</title>
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

  // 공유 테이블 단위: 큰 테이블 rect 하나 + 그 위에 모니터들
  // 의자는 테이블 바깥(Seat 컴포넌트가 orient에 따라 자동 배치)
  const dw=38, dh=11, dx=48, tpad=4, igap=14, chairH=8;
  const x0=20;
  const maxCols=5;
  const tw=2*tpad+(maxCols-1)*dx+dw; // =238

  // tableGroup: 단면(topBase만) 또는 양면(botBase 포함) 공유 테이블
  // y0 = 테이블 rect 상단, topBase/botBase = zone.seats 시작 인덱스
  const tableGroup=(y0:number,topBase:number,topN:number,botBase?:number,botN?:number)=>{
    const isDouble=botBase!==undefined;
    const th=isDouble?2*dh+2*tpad+igap:dh+2*tpad;  // 단=19, 양=44
    const topY=y0+tpad;
    const botY=isDouble?y0+th-dh-tpad:0;
    const topOrient:("up"|"down")=isDouble?"up":"down";
    const xs=(n:number)=>Array.from({length:n},(_,i)=>x0+tpad+i*dx);
    return (<g>
      {/* 테이블 면 (공유 테이블 하나) */}
      <rect x={x0} y={y0} width={tw} height={th} rx={3}
        fill="#F5F0E8" stroke="#8B7355" strokeWidth={1.4}/>
      {/* 양면일 때 중앙 분리선 */}
      {isDouble&&<line x1={x0+4} y1={y0+tpad+dh+igap/2} x2={x0+tw-4} y2={y0+tpad+dh+igap/2}
        stroke="#C4B49A" strokeWidth={0.8}/>}
      {/* 상단 모니터 + 의자 */}
      {xs(topN).map((x,i)=>{
        const seat=zone.seats[topBase+i];
        if(!seat) return null;
        return <Seat key={seat.id} x={x} y={topY} w={dw} h={dh} orient={topOrient} seat={seat} ctx={ctx}/>;
      })}
      {/* 하단 모니터 + 의자 (양면만) */}
      {isDouble&&xs(botN!).map((x,i)=>{
        const seat=zone.seats[botBase!+i];
        if(!seat) return null;
        return <Seat key={seat.id} x={x} y={botY} w={dw} h={dh} orient="down" seat={seat} ctx={ctx}/>;
      })}
    </g>);
  };

  // Y 레이아웃 (각 그룹 사이 간격: 의자 포함 영역 기준 gap=14)
  // 단면 tableH=19, 양면 tableH=44, chairH=8
  // T1 단독5석: table y=54..73, 의자아래 y=73+1+8=82
  // T2 10석양면: top-chair at clAy-9; want ≥82+14=96 → clAy=105; bottom y=105+44+9=158
  // T3  9석양면: clBy-9≥158+14=172 → clBy=181; bottom=181+44+9=234
  // T4 10석양면: clCy-9≥234+14=248 → clCy=257; bottom=257+44+9=310
  // T5  9석양면: clDy-9≥310+14=324 → clDy=333; bottom=333+44+9=386
  // T6 10석양면: clEy-9≥386+14=400 → clEy=409; bottom=409+44+9=462

  return (
    <svg viewBox="0 0 820 540" style={{width:"100%",maxWidth:960,height:"auto",display:"block"}}>
      {HATCH}
      <rect x={12} y={20} width={796} height={510} fill="#FAFAFA" stroke="#1F2937" strokeWidth={2}/>
      {Array.from({length:24},(_,i)=><line key={`t${i}`} x1={30+i*32} y1={20} x2={30+i*32} y2={28} stroke="#60A5FA" strokeWidth={2} opacity={0.5}/>)}
      {Array.from({length:24},(_,i)=><line key={`b${i}`} x1={30+i*32} y1={530} x2={30+i*32} y2={522} stroke="#60A5FA" strokeWidth={2} opacity={0.5}/>)}
      {/* 스마트오피스 프레임 */}
      <rect x={14} y={28} width={340} height={492} rx={4} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1.2} strokeDasharray="6,3"/>
      <text x={184} y={44} fontSize={9.5} fontWeight={800} fill="#1E3A8A" textAnchor="middle">스마트오피스 (서편) — 52석</text>

      {/* 테이블1: 단독 5석 (seats 0-4, 단면) */}
      {tableGroup(54, 0, 5)}

      {/* 테이블2: 10석 5+5 (seats 5-14, 양면) */}
      {tableGroup(105, 5, 5, 10, 5)}

      {/* 테이블3: 9석 5+4 (seats 15-23, 양면) */}
      {tableGroup(181, 15, 5, 20, 4)}

      {/* 테이블4: 10석 5+5 (seats 24-33, 양면) */}
      {tableGroup(257, 24, 5, 29, 5)}

      {/* 테이블5: 9석 5+4 (seats 34-42, 양면) */}
      {tableGroup(333, 34, 5, 39, 4)}

      {/* 테이블6: 10석 5+5 (seats 43-51+빈슬롯, 양면) */}
      {tableGroup(409, 43, 5, 48, 5)}
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
  return (
    <svg viewBox="0 0 820 560" style={{width:"100%",maxWidth:960,height:"auto",display:"block"}}>
      {HATCH}
      <rect x={12} y={20} width={796} height={528} fill="#FAFAFA" stroke="#1F2937" strokeWidth={2}/>
      {Array.from({length:24},(_,i)=><line key={`t${i}`} x1={30+i*32} y1={20} x2={30+i*32} y2={28} stroke="#60A5FA" strokeWidth={2} opacity={0.5}/>)}
      {Array.from({length:24},(_,i)=><line key={`b${i}`} x1={30+i*32} y1={548} x2={30+i*32} y2={540} stroke="#60A5FA" strokeWidth={2} opacity={0.5}/>)}
      {/* 서편 */}
      <rect x={14} y={20} width={290} height={528} rx={3} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2"/>
      <text x={22} y={38} fontSize={8.5} fontWeight={800} fill="#1E3A8A">서편 — {zW.seats.length}석</text>
      {/* G/B 협업공간 상단 */}
      <rect x={14} y={20} width={130} height={78} fill="#F0FDF4" stroke="#86EFAC" strokeWidth={1.2} rx={3}/>
      <text x={79} y={58} fontSize={8} textAnchor="middle" fill="#15803D" fontWeight={700}>G/B 협업공간</text>
      <circle cx={58} cy={48} r={11} fill="none" stroke="#86EFAC" strokeWidth={1}/>
      {[-12,0,12].map(d=><circle key={d} cx={58+d} cy={68} r={3.5} fill="#BBF7D0" stroke="#86EFAC" strokeWidth={0.6}/>)}
      {/* 서편 데스크 6×9=54석 */}
      <DeskGrid zone={zW} startX={20} startY={108} cols={6} rows={9} sw={28} sh={12} gx={8} gy={3} rowGroups={[2,2,2,3]} aisle={16} ctx={ctx}/>
      {/* 미팅룸 하단 */}
      <MeetingBox x={14} y={444} w={140} h={100} name="미팅룸" sub="18.5m²"/>
      <MeetingBox x={158} y={444} w={148} h={100} name="미팅룸" sub="16.1m²"/>
      {/* 코어 */}
      <BW_Core y0={20} y1={548}/>
      {/* 동편 */}
      <rect x={494} y={20} width={314} height={528} rx={3} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2"/>
      <text x={502} y={38} fontSize={8.5} fontWeight={800} fill="#1E3A8A">동편 — {zE.seats.length}석</text>
      {/* G/B+TV 상단 */}
      <rect x={494} y={20} width={140} height={78} fill="#F0FDF4" stroke="#86EFAC" strokeWidth={1.2} rx={3}/>
      <text x={564} y={50} fontSize={8} textAnchor="middle" fill="#15803D" fontWeight={700}>G/B+TV</text>
      <rect x={502} y={28} width={28} height={18} rx={2} fill="#1F2937" stroke="#475569" strokeWidth={0.8}/>
      <text x={516} y={40} fontSize={6} textAnchor="middle" fill="white">TV</text>
      <rect x={536} y={28} width={28} height={18} rx={2} fill="#1F2937" stroke="#475569" strokeWidth={0.8}/>
      <text x={550} y={40} fontSize={6} textAnchor="middle" fill="white">TV</text>
      {/* 동편 데스크 8×9=72(71석) */}
      <DeskGrid zone={zE} startX={500} startY={108} cols={8} rows={9} sw={26} sh={12} gx={7} gy={3} rowGroups={[2,2,2,3]} aisle={16} ctx={ctx}/>
      <text x={20} y={16} fontSize={9} fontWeight={800} fill="#1F2937">← 서편</text>
      <text x={800} y={16} fontSize={9} fontWeight={800} fill="#1F2937" textAnchor="end">동편 →</text>
    </svg>
  );
}

// ── 본관 4F: 서편 74석 + 동편 49석 ────────────────────────────────
export function BW_4F_Sketch(ctx: SketchCtx) {
  const zW=ctx.zones.find(z=>z.id==="W"), zE=ctx.zones.find(z=>z.id==="E");
  if(!zW||!zE) return null;
  return (
    <svg viewBox="0 0 820 580" style={{width:"100%",maxWidth:960,height:"auto",display:"block"}}>
      {HATCH}
      <rect x={12} y={20} width={796} height={548} fill="#FAFAFA" stroke="#1F2937" strokeWidth={2}/>
      {Array.from({length:24},(_,i)=><line key={`t${i}`} x1={30+i*32} y1={20} x2={30+i*32} y2={28} stroke="#60A5FA" strokeWidth={2} opacity={0.5}/>)}
      {Array.from({length:24},(_,i)=><line key={`b${i}`} x1={30+i*32} y1={568} x2={30+i*32} y2={560} stroke="#60A5FA" strokeWidth={2} opacity={0.5}/>)}
      {/* 서편 */}
      <rect x={14} y={20} width={290} height={548} rx={3} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2"/>
      <text x={22} y={38} fontSize={8.5} fontWeight={800} fill="#1E3A8A">서편 — {zW.seats.length}석</text>
      {/* 화상회의실 상단 */}
      <rect x={14} y={20} width={140} height={80} fill="#FEF9C3" stroke="#D97706" strokeWidth={1.2} rx={3}/>
      <text x={84} y={52} fontSize={8} textAnchor="middle" fill="#92400E" fontWeight={700}>화상회의실</text>
      <rect x={26} y={56} width={50} height={28} rx={2} fill="#FEF3C7" stroke="#D97706" strokeWidth={0.7}/>
      {[-14,0,14].map(d=><circle key={d} cx={51+d} cy={50} r={4} fill="#FDE68A" stroke="#D97706" strokeWidth={0.5}/>)}
      {/* 협업공간 */}
      <rect x={158} y={20} width={148} height={80} fill="#F0FDF4" stroke="#86EFAC" strokeWidth={1.2} rx={3}/>
      <text x={232} y={58} fontSize={8} textAnchor="middle" fill="#15803D" fontWeight={700}>협업공간</text>
      {/* 서편 데스크 7×11=77(74석) */}
      <DeskGrid zone={zW} startX={18} startY={110} cols={7} rows={11} sw={26} sh={11} gx={8} gy={3} rowGroups={[2,2,3,2,2]} aisle={14} ctx={ctx}/>
      {/* 코어 */}
      <BW_Core y0={20} y1={568}/>
      {/* 동편 */}
      <rect x={494} y={20} width={314} height={548} rx={3} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2"/>
      <text x={502} y={38} fontSize={8.5} fontWeight={800} fill="#1E3A8A">동편 — {zE.seats.length}석</text>
      {/* 동편 데스크 7×7=49석 */}
      <DeskGrid zone={zE} startX={502} startY={50} cols={7} rows={7} sw={30} sh={13} gx={9} gy={3} rowGroups={[2,2,3]} aisle={18} ctx={ctx}/>
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
  return (
    <svg viewBox="0 0 820 580" style={{width:"100%",maxWidth:960,height:"auto",display:"block"}}>
      {HATCH}
      <rect x={12} y={20} width={796} height={548} fill="#FAFAFA" stroke="#1F2937" strokeWidth={2}/>
      {Array.from({length:24},(_,i)=><line key={`t${i}`} x1={30+i*32} y1={20} x2={30+i*32} y2={28} stroke="#60A5FA" strokeWidth={2} opacity={0.5}/>)}
      {Array.from({length:24},(_,i)=><line key={`b${i}`} x1={30+i*32} y1={568} x2={30+i*32} y2={560} stroke="#60A5FA" strokeWidth={2} opacity={0.5}/>)}
      {/* 서편 */}
      <rect x={14} y={20} width={290} height={548} rx={3} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2"/>
      <text x={22} y={38} fontSize={8.5} fontWeight={800} fill="#1E3A8A">서편 — {zW.seats.length}석</text>
      <rect x={14} y={20} width={290} height={78} fill="#F0FDF4" stroke="#86EFAC" strokeWidth={1.2} rx={3}/>
      <text x={159} y={56} fontSize={8.5} textAnchor="middle" fill="#15803D" fontWeight={700}>협업공간 / G·B Zone</text>
      <DeskGrid zone={zW} startX={18} startY={110} cols={7} rows={11} sw={26} sh={11} gx={8} gy={3} rowGroups={[2,2,3,2,2]} aisle={14} ctx={ctx}/>
      {/* 미팅룸 하단 */}
      <MeetingBox x={14} y={460} w={140} h={108} name="미팅룸" sub="18.5m²"/>
      <MeetingBox x={158} y={460} w={148} h={108} name="미팅룸" sub="16.1m²"/>
      {/* 코어 */}
      <BW_Core y0={20} y1={568}/>
      {/* 동편 */}
      <rect x={494} y={20} width={314} height={548} rx={3} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2"/>
      <text x={502} y={38} fontSize={8.5} fontWeight={800} fill="#1E3A8A">동편 — {zE.seats.length}석</text>
      <DeskGrid zone={zE} startX={502} startY={50} cols={7} rows={7} sw={30} sh={13} gx={9} gy={3} rowGroups={[2,2,3]} aisle={18} ctx={ctx}/>
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
  return (
    <svg viewBox="0 0 820 580" style={{width:"100%",maxWidth:960,height:"auto",display:"block"}}>
      {HATCH}
      <rect x={12} y={20} width={796} height={548} fill="#FAFAFA" stroke="#1F2937" strokeWidth={2}/>
      {Array.from({length:24},(_,i)=><line key={`t${i}`} x1={30+i*32} y1={20} x2={30+i*32} y2={28} stroke="#60A5FA" strokeWidth={2} opacity={0.5}/>)}
      {Array.from({length:24},(_,i)=><line key={`b${i}`} x1={30+i*32} y1={568} x2={30+i*32} y2={560} stroke="#60A5FA" strokeWidth={2} opacity={0.5}/>)}
      {/* 서편: 개발 34" 모니터 존 */}
      <rect x={14} y={20} width={290} height={548} rx={3} fill="#FFF7ED" stroke="#FB923C" strokeWidth={1} strokeDasharray="5,2"/>
      <text x={22} y={36} fontSize={8} fontWeight={800} fill="#C2410C">서편 — {zW.seats.length}석 (개발 34")</text>
      <rect x={14} y={20} width={290} height={60} fill="#FFEDD5" stroke="#FB923C" strokeWidth={1} rx={3}/>
      <text x={159} y={46} fontSize={8} textAnchor="middle" fill="#9A3412" fontWeight={700}>개발 34" 모니터 구역</text>
      <text x={159} y={58} fontSize={7} textAnchor="middle" fill="#9A3412" opacity={0.8}>전 좌석 34인치 듀얼모니터</text>
      <DeskGrid zone={zW} startX={18} startY={92} cols={7} rows={10} sw={26} sh={11} gx={8} gy={3} rowGroups={[2,2,3,3]} aisle={14} ctx={ctx}/>
      {/* 코어 */}
      <BW_Core y0={20} y1={568}/>
      {/* 동편 */}
      <rect x={494} y={20} width={314} height={548} rx={3} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2"/>
      <text x={502} y={38} fontSize={8.5} fontWeight={800} fill="#1E3A8A">동편 — {zE.seats.length}석</text>
      <DeskGrid zone={zE} startX={500} startY={50} cols={8} rows={9} sw={26} sh={12} gx={7} gy={3} rowGroups={[2,2,2,3]} aisle={16} ctx={ctx}/>
      <text x={20} y={16} fontSize={9} fontWeight={800} fill="#1F2937">← 서편</text>
      <text x={800} y={16} fontSize={9} fontWeight={800} fill="#1F2937" textAnchor="end">동편 →</text>
    </svg>
  );
}

// ── 본관 7F: 서편 19석(소규모+미팅룸) + 동편 57석 ────────────────
export function BW_7F_Sketch(ctx: SketchCtx) {
  const zW=ctx.zones.find(z=>z.id==="W"), zE=ctx.zones.find(z=>z.id==="E");
  if(!zW||!zE) return null;
  return (
    <svg viewBox="0 0 820 560" style={{width:"100%",maxWidth:960,height:"auto",display:"block"}}>
      {HATCH}
      <rect x={12} y={20} width={796} height={528} fill="#FAFAFA" stroke="#1F2937" strokeWidth={2}/>
      {Array.from({length:24},(_,i)=><line key={`t${i}`} x1={30+i*32} y1={20} x2={30+i*32} y2={28} stroke="#60A5FA" strokeWidth={2} opacity={0.5}/>)}
      {Array.from({length:24},(_,i)=><line key={`b${i}`} x1={30+i*32} y1={548} x2={30+i*32} y2={540} stroke="#60A5FA" strokeWidth={2} opacity={0.5}/>)}
      {/* 서편: 미팅룸 다수 + 소규모 스마트오피스 19석 */}
      <rect x={14} y={20} width={290} height={528} rx={3} fill="#F8FAFC" stroke="#94A3B8" strokeWidth={1}/>
      {/* 미팅룸 상단 4개 */}
      <MeetingBox x={14} y={20}  w={140} h={120} name="미팅룸 A" sub="22.3m²"/>
      <MeetingBox x={158} y={20}  w={148} h={120} name="미팅룸 B" sub="20.1m²"/>
      <MeetingBox x={14} y={144} w={140} h={110} name="세미나실" sub="35.6m²"/>
      <MeetingBox x={158} y={144} w={148} h={110} name="회의실"   sub="18.4m²"/>
      {/* 스마트오피스 19석 */}
      <rect x={14} y={258} width={290} height={130} rx={3} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="4,2"/>
      <text x={22} y={274} fontSize={8} fontWeight={800} fill="#1E3A8A">스마트오피스 — {zW.seats.length}석</text>
      <DeskGrid zone={zW} startX={20} startY={282} cols={4} rows={5} sw={28} sh={12} gx={9} gy={3} rowGroups={[2,3]} aisle={16} ctx={ctx}/>
      {/* 하단 미팅룸 */}
      <MeetingBox x={14} y={392} w={140} h={156} name="임원실" sub="28.0m²"/>
      <MeetingBox x={158} y={392} w={148} h={156} name="회의실" sub="22.1m²"/>
      {/* 코어 */}
      <BW_Core y0={20} y1={548}/>
      {/* 동편: 57석 */}
      <rect x={494} y={20} width={314} height={528} rx={3} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2"/>
      <text x={502} y={38} fontSize={8.5} fontWeight={800} fill="#1E3A8A">동편 — {zE.seats.length}석</text>
      <DeskGrid zone={zE} startX={500} startY={50} cols={7} rows={9} sw={28} sh={12} gx={8} gy={3} rowGroups={[2,2,2,3]} aisle={16} ctx={ctx}/>
      <text x={20} y={16} fontSize={9} fontWeight={800} fill="#1F2937">← 서편</text>
      <text x={800} y={16} fontSize={9} fontWeight={800} fill="#1F2937" textAnchor="end">동편 →</text>
    </svg>
  );
}

// ── 본관 8F: 스마트오피스 28석 + 미팅룸 6개 ────────────────────────
export function BW_8F_Sketch(ctx: SketchCtx) {
  const zM=ctx.zones.find(z=>z.id==="M");
  if(!zM) return null;
  return (
    <svg viewBox="0 0 820 500" style={{width:"100%",maxWidth:960,height:"auto",display:"block"}}>
      {HATCH}
      <rect x={12} y={20} width={796} height={468} fill="#FAFAFA" stroke="#1F2937" strokeWidth={2}/>
      {Array.from({length:24},(_,i)=><line key={`t${i}`} x1={30+i*32} y1={20} x2={30+i*32} y2={28} stroke="#60A5FA" strokeWidth={2} opacity={0.5}/>)}
      {Array.from({length:24},(_,i)=><line key={`b${i}`} x1={30+i*32} y1={488} x2={30+i*32} y2={480} stroke="#60A5FA" strokeWidth={2} opacity={0.5}/>)}
      {/* 서편: 스마트오피스 28석 */}
      <rect x={14} y={20} width={290} height={250} rx={3} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2"/>
      <text x={22} y={38} fontSize={8.5} fontWeight={800} fill="#1E3A8A">스마트오피스 — {zM.seats.length}석</text>
      <DeskGrid zone={zM} startX={18} startY={50} cols={7} rows={4} sw={28} sh={13} gx={8} gy={3} rowGroups={[2,2]} aisle={18} ctx={ctx}/>
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
  return (
    <svg viewBox="0 0 880 600" style={{width:"100%",maxWidth:1050,height:"auto",display:"block"}}>
      {HATCH}
      <rect x={12} y={20} width={856} height={568} fill="#FAFAFA" stroke="#1F2937" strokeWidth={2}/>
      {Array.from({length:26},(_,i)=><line key={`t${i}`} x1={30+i*32} y1={20} x2={30+i*32} y2={28} stroke="#60A5FA" strokeWidth={2} opacity={0.5}/>)}
      {Array.from({length:26},(_,i)=><line key={`b${i}`} x1={30+i*32} y1={588} x2={30+i*32} y2={580} stroke="#60A5FA" strokeWidth={2} opacity={0.5}/>)}
      {/* 서편: 스튜디오 37석 */}
      <rect x={14} y={20} width={290} height={568} rx={3} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2"/>
      <text x={22} y={38} fontSize={8.5} fontWeight={800} fill="#1E3A8A">스튜디오 서편 — {zW.seats.length}석</text>
      {/* 스튜디오 특수 장비 구역 */}
      <rect x={14} y={20} width={290} height={90} fill="#F3E8FF" stroke="#9333EA" strokeWidth={1.2} rx={3}/>
      <text x={159} y={60} fontSize={8} textAnchor="middle" fill="#7E22CE" fontWeight={700}>스튜디오 장비 구역</text>
      <rect x={30} y={34} width={50} height={36} rx={2} fill="#E9D5FF" stroke="#9333EA" strokeWidth={0.7}/>
      <text x={55} y={55} fontSize={6} textAnchor="middle" fill="#7E22CE">카메라</text>
      <rect x={90} y={34} width={50} height={36} rx={2} fill="#E9D5FF" stroke="#9333EA" strokeWidth={0.7}/>
      <text x={115} y={55} fontSize={6} textAnchor="middle" fill="#7E22CE">조명</text>
      <DeskGrid zone={zW} startX={18} startY={122} cols={5} rows={8} sw={30} sh={13} gx={9} gy={3} rowGroups={[2,2,2,2]} aisle={14} ctx={ctx}/>
      {/* 코어 */}
      <BW_Core y0={20} y1={588}/>
      {/* 동편: 홀 85석 */}
      <rect x={494} y={20} width={374} height={568} rx={3} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2"/>
      <text x={502} y={38} fontSize={8.5} fontWeight={800} fill="#1E3A8A">홀 동편 — {zE.seats.length}석</text>
      <DeskGrid zone={zE} startX={500} startY={52} cols={9} rows={10} sw={26} sh={11} gx={7} gy={3} rowGroups={[2,2,2,2,2]} aisle={14} ctx={ctx}/>
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
      {/* 미팅룸들 */}
      <MeetingBox x={608} y={340} w={155} h={110} name="미팅룸 1" sub="7.9m²"/>
      <MeetingBox x={608} y={454} w={155} h={110} name="미팅룸 2" sub="7.9m²"/>
      <MeetingBox x={768} y={220} w={160} h={145} name="회의실" sub="18.5m²"/>
      <MeetingBox x={768} y={370} w={160} h={145} name="라운지" sub="15.2m²"/>
      <MeetingBox x={768} y={520} w={160} h={145} name="포커스룸" sub="8.1m²"/>
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
      {/* 포커스룸 + 라운지 */}
      <MeetingBox x={608} y={340} w={155} h={90} name="포커스룸 1" sub="5.0m²"/>
      <MeetingBox x={608} y={434} w={155} h={90} name="포커스룸 2" sub="5.0m²"/>
      <MeetingBox x={608} y={528} w={155} h={140} name="라운지" sub="20.0m²"/>
      <MeetingBox x={768} y={220} w={160} h={145} name="미팅룸" sub="18.5m²"/>
      <MeetingBox x={768} y={370} w={160} h={145} name="세미나실" sub="25.0m²"/>
      <MeetingBox x={768} y={520} w={160} h={148} name="포커스룸 3" sub="5.0m²"/>
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
      {/* 포커스 오피스 */}
      {["포커스 1","포커스 2","포커스 3"].map((n,i)=>(
        <MeetingBox key={n} x={608} y={340+i*110} w={155} h={106} name={n} sub="5.0m²"/>
      ))}
      {["포커스 4","포커스 5"].map((n,i)=>(
        <MeetingBox key={n} x={768} y={220+i*130} w={160} h={126} name={n} sub="5.0m²"/>
      ))}
      <rect x={768} y={480} width={160} height={188} fill="#FEF3C7" stroke="#D97706" strokeWidth={1.2}/>
      <text x={848} y={570} fontSize={8} textAnchor="middle" fill="#92400E" fontWeight={700}>라운지</text>
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
      {/* 5F: Focus RM + Counter + Meeting RMs */}
      <MeetingBox x={608} y={340} w={155} h={110} name="Focus RM 1" sub="6.1m²"/>
      <MeetingBox x={608} y={454} w={155} h={110} name="카운터" sub="5.0m²"/>
      <MeetingBox x={608} y={568} w={155} h={100} name="Work Space" sub="20.0m²"/>
      <MeetingBox x={768} y={220} w={160} h={145} name="Meeting RM 1" sub="7.9m²"/>
      <MeetingBox x={768} y={370} w={160} h={145} name="Meeting RM 2" sub="7.9m²"/>
      <rect x={768} y={520} width={160} height={148} fill="#FEF3C7" stroke="#D97706" strokeWidth={1.2}/>
      <text x={848} y={594} fontSize={8.5} textAnchor="middle" fill="#92400E" fontWeight={700}>라운지</text>
      <rect x={786} y={555} width={50} height={22} rx={5} fill="#FDE68A" stroke="#D97706" strokeWidth={0.7}/>
      <rect x={848} y={555} width={50} height={22} rx={5} fill="#FDE68A" stroke="#D97706" strokeWidth={0.7}/>
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
