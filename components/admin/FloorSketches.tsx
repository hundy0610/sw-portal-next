"use client";
import React from "react";

// ─── 타입: AssetMapPanel과 느슨 결합 ─────────────────────────────
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

// ─── 공용 1-좌석 컴포넌트 ────────────────────────────────────────
// 도면 스타일: 책상(직사각형) + 의자(책상보다 약간 좁은 둥근 직사각형)
// orient: 의자가 책상 기준 어느 방향에 있는지
//   "up"   = 의자가 책상 위 (의자가 위에, 칸막이는 아래)
//   "down" = 의자가 책상 아래 (의자가 아래에, 칸막이는 위)
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

  // 의자: 책상보다 살짝 좁은 둥근 직사각형 (도면 표준 심볼)
  const chairH  = Math.max(6, Math.round(h * 0.65));  // 책상 높이의 65%
  const chairPad = 2;                                   // 좌우 여백
  const chairY   = orient === "up"
    ? y - chairH - 1    // 책상 위쪽에 의자
    : y + h + 1;        // 책상 아래쪽에 의자

  return (
    <g style={{ cursor: "pointer" }} onClick={() => !dimmed && ctx.onSelect(seat.id)}>
      {/* 의자 (둥근 직사각형 — 도면 표현 방식) */}
      <rect
        x={x + chairPad} y={chairY}
        width={w - chairPad * 2} height={chairH}
        rx={2.5}
        fill={dimmed ? "#F3F4F6" : "#E8EAED"}
        stroke={dimmed ? "#E2E8F0" : "#94A3B8"}
        strokeWidth={0.7}
      />
      {/* 책상 (모니터 상태 색) */}
      <rect
        x={x} y={y} width={w} height={h} rx={1.5}
        fill={deskFill} stroke={deskStroke}
        strokeWidth={isSel ? 1.5 : 0.7}
      />
      {/* 모니터 미설치 X */}
      {seat.type === "none" && !dimmed && (
        <>
          <line x1={x + 2} y1={y + 2} x2={x + w - 2} y2={y + h - 2} stroke="white" strokeWidth={1.3}/>
          <line x1={x + w - 2} y1={y + 2} x2={x + 2} y2={y + h - 2} stroke="white" strokeWidth={1.3}/>
        </>
      )}
      {/* 선택 표시 */}
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

// ─── 해치(빗금) 패턴 - 벽/코어 블록용 ───────────────────────────
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

// ─── 본관 2F 서편 — 도면 기반 정밀 스케치 v2 ───────────────────
// ┌─────────────────────────────────────────────────────────┐
// │ 스마트오피스(서편)   │미팅룸│ ELEV HALL │EPS·화장실│ VOID │
// │ 4클러스터×13석=52석  │A/B/C │ UP/EV/DN  │  창고     │      │
// └─────────────────────────────────────────────────────────┘
//
// 클러스터 구조: 윗줄 7석(orient=up) + 아랫줄 6석(orient=down)
// dx=46, dw=32 → 클러스터 너비 ≈ 310px (구역 340px 대부분 채움)
export function BW_2F_Sketch(ctx: SketchCtx) {
  const zone = ctx.zones.find(z => z.id === "bw2-w");
  if (!zone) return null;
  const seatAt = (i: number) => zone.seats[i];

  // ── 클러스터 렌더러 ──────────────────────────────────────────────
  // 도면 구조:
  //   [윗줄 책상 7개] ← 의자가 아래(칸막이 방향, orient=down)
  //   ─────────── 칸막이 ──────────
  //   [아랫줄 책상 6개] → 의자가 위(칸막이 방향, orient=up)
  //
  // dx=46(책상 중심간격), dw=36(책상폭), dh=14(책상높이)
  // 칸막이 포함 클러스터 내부 총 높이: 14(책상)+9(의자)+walkway+9(의자)+14(책상) ≈ 58px
  // 클러스터 총 너비: 6×46+36 = 312px
  const clusterAt = (cx: number, cy: number, base: number) => {
    const dx = 46, dw = 36, dh = 14;
    const chairH  = Math.round(dh * 0.65); // ≈9px
    const walkway = 16; // 두 의자 사이 복도
    // botY: 아랫줄 책상 top y
    // topDesk(14) + topChair(9) + gap(1) + walkway(16) + botChair(9) + gap(1) = 50
    const topY = cy;
    const botY = cy + dh + 1 + chairH + walkway + chairH + 1; // = cy + 50
    const topXs = [0,1,2,3,4,5,6].map(i => cx + i * dx);
    const botXs = [0,1,2,3,4,5].map(i => cx + dx / 2 + i * dx); // 반 칸 오프셋
    const clW = 6 * dx + dw;

    // 칸막이 위치: 두 의자의 정가운데
    const partitionY = topY + dh + 1 + chairH + walkway / 2;

    return (
      <g key={`cl${base}`}>
        {/* 클러스터 배경 */}
        <rect x={cx - 6} y={topY - 14} width={clW + 12} height={botY + dh + 14 - (topY - 14)} rx={4}
          fill="#F8FAFC" stroke="#CBD5E1" strokeDasharray="4,2" strokeWidth={0.9}/>
        {/* 중앙 칸막이 라인 */}
        <line x1={cx - 2} y1={partitionY} x2={cx + clW + 2} y2={partitionY}
          stroke="#94A3B8" strokeWidth={1}/>
        {/* 윗줄: 의자가 아래(칸막이 방향) orient=down */}
        {topXs.map((x, i) => (
          <Seat key={`t${base+i}`} x={x} y={topY} w={dw} h={dh}
            orient="down" seat={seatAt(base+i)} ctx={ctx}/>
        ))}
        {/* 아랫줄: 의자가 위(칸막이 방향) orient=up, 반 칸 오프셋 */}
        {botXs.map((x, i) => (
          <Seat key={`b${base+7+i}`} x={x} y={botY} w={dw} h={dh}
            orient="up" seat={seatAt(base+7+i)} ctx={ctx}/>
        ))}
      </g>
    );
  };

  // 미팅룸 내부 가구(간단 스케치)
  const MeetingRoom = ({ x, y, w, h, name, sub, kind }: {
    x: number; y: number; w: number; h: number; name: string; sub: string;
    kind: "small" | "long" | "lounge";
  }) => (
    <g>
      {/* 방 벽 (굵게) */}
      <rect x={x} y={y} width={w} height={h} fill="#ECFDF5" stroke="#047857" strokeWidth={1.4} />
      {/* 문 호(door arc) — 좌측에서 열림 */}
      <path d={`M ${x} ${y + h - 14} A 14 14 0 0 1 ${x + 14} ${y + h}`}
        fill="none" stroke="#047857" strokeWidth={0.8} />
      <line x1={x} y1={y + h - 14} x2={x} y2={y + h - 4} stroke="#047857" strokeWidth={1} />
      {/* 가구 */}
      {kind === "small" && (
        <>
          <rect x={x + w / 2 - 16} y={y + h / 2 - 10} width={32} height={20} rx={2}
            fill="#FDF6B2" stroke="#92400E" strokeWidth={0.6} />
          {[-20, 0, 20].map(dx => (
            <circle key={dx} cx={x + w / 2 + dx} cy={y + h / 2 - 16} r={3.5}
              fill="#F3F4F6" stroke="#94A3B8" strokeWidth={0.5} />
          ))}
          {[-20, 0, 20].map(dx => (
            <circle key={dx + "b"} cx={x + w / 2 + dx} cy={y + h / 2 + 16} r={3.5}
              fill="#F3F4F6" stroke="#94A3B8" strokeWidth={0.5} />
          ))}
        </>
      )}
      {kind === "long" && (
        <>
          <rect x={x + w / 2 - 32} y={y + h / 2 - 8} width={64} height={16} rx={2}
            fill="#FDF6B2" stroke="#92400E" strokeWidth={0.6} />
          {[-28, -14, 0, 14, 28].map(dx => (
            <circle key={dx} cx={x + w / 2 + dx} cy={y + h / 2 - 14} r={3.5}
              fill="#F3F4F6" stroke="#94A3B8" strokeWidth={0.5} />
          ))}
          {[-28, -14, 0, 14, 28].map(dx => (
            <circle key={dx + "b"} cx={x + w / 2 + dx} cy={y + h / 2 + 14} r={3.5}
              fill="#F3F4F6" stroke="#94A3B8" strokeWidth={0.5} />
          ))}
        </>
      )}
      {kind === "lounge" && (
        <>
          {/* 소파 L자 */}
          <rect x={x + 10} y={y + 20} width={40} height={10} rx={3}
            fill="#D1FAE5" stroke="#047857" strokeWidth={0.6} />
          <rect x={x + 10} y={y + 20} width={10} height={h - 30} rx={3}
            fill="#D1FAE5" stroke="#047857" strokeWidth={0.6} />
          <circle cx={x + 40} cy={y + h / 2 + 10} r={6}
            fill="#FEF3C7" stroke="#92400E" strokeWidth={0.6} />
        </>
      )}
      {/* 라벨 */}
      <text x={x + w / 2} y={y + 12} fontSize={8.5} fontWeight={700}
        textAnchor="middle" fill="#065F46">{name}</text>
      <text x={x + w / 2} y={y + h - 4} fontSize={7}
        textAnchor="middle" fill="#047857" opacity={0.85}>{sub}</text>
    </g>
  );

  // ── SVG 레이아웃 (도면 비율 기반) ──────────────────────────────
  // 전체 820px 분배:
  //  스마트오피스: x=14~354 (w=340, 41%)
  //  미팅룸: x=358~470 (w=112, 14%)
  //  ELEV HALL: x=474~562 (w=88, 11%)
  //  EPS·화장실·창고: x=566~636 (w=70, 9%)
  //  VOID: x=640~806 (w=166, 20%)
  return (
    <svg viewBox="0 0 820 540" style={{ width: "100%", maxWidth: 960, height: "auto", display: "block" }}>
      {HATCH}
      {/* 건물 외벽 */}
      <rect x={12} y={20} width={796} height={510} fill="#FAFAFA" stroke="#1F2937" strokeWidth={2}/>
      {Array.from({length:24},(_,i)=>(
        <line key={`wt${i}`} x1={30+i*32} y1={20} x2={30+i*32} y2={28} stroke="#60A5FA" strokeWidth={2} opacity={0.5}/>
      ))}
      {Array.from({length:24},(_,i)=>(
        <line key={`wb${i}`} x1={30+i*32} y1={530} x2={30+i*32} y2={522} stroke="#60A5FA" strokeWidth={2} opacity={0.5}/>
      ))}

      {/* ── 스마트오피스 프레임 (x=14, w=340) ── */}
      <rect x={14} y={28} width={340} height={492} rx={4}
        fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1.2} strokeDasharray="6,3}"/>
      <text x={184} y={44} fontSize={9.5} fontWeight={800} fill="#1E3A8A" textAnchor="middle">
        스마트오피스 (서편) — 90평 / 52석
      </text>

      {/* 4개 클러스터 — cy 기준 등간격 126px */}
      {/* 각 클러스터 총 높이(배경): 14+1+9+16+9+1+14+28 = 92px */}
      {/* 클러스터 간 통로: 126 - 92 = 34px */}
      {clusterAt(18,  55,  0)}
      {clusterAt(18, 181, 13)}
      {clusterAt(18, 307, 26)}
      {clusterAt(18, 433, 39)}

      {/* ── 미팅룸 4개 (x=358, w=112) ── */}
      {/* 미팅룸 A: 13.5㎡/4.1평 */}
      <MeetingRoom x={358} y={28}  w={112} h={100} name="미팅룸 A" sub="13.5㎡ · 4.1평" kind="small"/>
      {/* 미팅룸 B: 21.1㎡/6.4평 (가장 큼) */}
      <MeetingRoom x={358} y={133} w={112} h={130} name="미팅룸 B" sub="21.1㎡ · 6.4평" kind="long"/>
      {/* 미팅룸 C: 18.8㎡/5.7평 */}
      <MeetingRoom x={358} y={268} w={112} h={118} name="미팅룸 C" sub="18.8㎡ · 5.7평" kind="small"/>
      {/* 쇼룸: 15.2㎡/4.6평 */}
      <MeetingRoom x={358} y={391} w={112} h={109} name="쇼룸"     sub="15.2㎡ · 4.6평" kind="lounge"/>

      {/* ── ELEV HALL (x=474, w=88) ── */}
      {/* 상단 계단 UP */}
      <g>
        <rect x={474} y={28} width={88} height={88} fill="url(#hatchLight)" stroke="#475569" strokeWidth={1.2}/>
        {Array.from({length:7},(_,i)=>(
          <line key={i} x1={474} y1={38+i*11} x2={562} y2={38+i*11} stroke="#475569" strokeWidth={0.6}/>
        ))}
        <text x={480} y={40} fontSize={7} fill="#475569" fontWeight={700}>UP</text>
      </g>
      {/* 엘리베이터 2기 */}
      <g>
        <rect x={474} y={124} width={40} height={52} fill="#E2E8F0" stroke="#475569" strokeWidth={1.2}/>
        <line x1={474} y1={124} x2={514} y2={176} stroke="#475569" strokeWidth={0.5}/>
        <line x1={514} y1={124} x2={474} y2={176} stroke="#475569" strokeWidth={0.5}/>
        <text x={494} y={152} fontSize={7} fill="#475569" textAnchor="middle">EV</text>
        <rect x={522} y={124} width={40} height={52} fill="#E2E8F0" stroke="#475569" strokeWidth={1.2}/>
        <line x1={522} y1={124} x2={562} y2={176} stroke="#475569" strokeWidth={0.5}/>
        <line x1={562} y1={124} x2={522} y2={176} stroke="#475569" strokeWidth={0.5}/>
        <text x={542} y={152} fontSize={7} fill="#475569" textAnchor="middle">EV</text>
      </g>
      {/* ELEV HALL 공간 + 소파 */}
      <g>
        <rect x={474} y={184} width={88} height={95} fill="#FAFAFA" stroke="#475569" strokeWidth={1.2}/>
        <text x={518} y={228} fontSize={8} fontWeight={700} fill="#475569" textAnchor="middle">ELEV HALL</text>
        <rect x={480} y={252} width={22} height={18} rx={3} fill="#D1FAE5" stroke="#047857" strokeWidth={0.7}/>
        <rect x={540} y={252} width={22} height={18} rx={3} fill="#D1FAE5" stroke="#047857" strokeWidth={0.7}/>
      </g>
      {/* 하단 엘리베이터 */}
      <g>
        <rect x={474} y={287} width={40} height={52} fill="#E2E8F0" stroke="#475569" strokeWidth={1.2}/>
        <line x1={474} y1={287} x2={514} y2={339} stroke="#475569" strokeWidth={0.5}/>
        <line x1={514} y1={287} x2={474} y2={339} stroke="#475569" strokeWidth={0.5}/>
        <rect x={522} y={287} width={40} height={52} fill="#E2E8F0" stroke="#475569" strokeWidth={1.2}/>
        <line x1={522} y1={287} x2={562} y2={339} stroke="#475569" strokeWidth={0.5}/>
        <line x1={562} y1={287} x2={522} y2={339} stroke="#475569" strokeWidth={0.5}/>
      </g>
      {/* 하단 계단 DN */}
      <g>
        <rect x={474} y={348} width={88} height={95} fill="url(#hatchLight)" stroke="#475569" strokeWidth={1.2}/>
        {Array.from({length:7},(_,i)=>(
          <line key={i} x1={474} y1={358+i*11} x2={562} y2={358+i*11} stroke="#475569" strokeWidth={0.6}/>
        ))}
        <text x={548} y={440} fontSize={7} fill="#475569">DN</text>
      </g>
      {/* 화장실 라벨(ELEV HALL 구역에 표기) */}
      <rect x={474} y={450} width={88} height={70} fill="#F8FAFC" stroke="#475569" strokeWidth={1}/>
      <text x={518} y={482} fontSize={7} fill="#475569" textAnchor="middle">화장실(남)</text>

      {/* ── EPS·화장실·창고 (x=566, w=70) ── */}
      {/* 여자화장실 상단 */}
      <rect x={566} y={28} width={70} height={88} fill="#F5F3FF" stroke="#6B21A8" strokeWidth={1}/>
      <text x={601} y={68} fontSize={7.5} textAnchor="middle" fill="#6B21A8" fontWeight={700}>여자화장실</text>
      {[0,1].map(i=>(
        <rect key={i} x={572+i*28} y={36} width={20} height={14} rx={2}
          fill="#EDE9FE" stroke="#6B21A8" strokeWidth={0.5}/>
      ))}
      {/* EPS 상 */}
      <rect x={566} y={124} width={35} height={52} fill="url(#hatch)" stroke="#475569" strokeWidth={1}/>
      <text x={584} y={153} fontSize={7} textAnchor="middle" fill="#1F2937" fontWeight={700}>EPS</text>
      {/* 창고 2평 */}
      <rect x={566} y={184} width={70} height={95} fill="#F1F5F9" stroke="#475569" strokeWidth={1.2}/>
      <text x={601} y={230} fontSize={8} textAnchor="middle" fill="#475569" fontWeight={700}>창고 2평</text>
      {/* EPS 하 */}
      <rect x={566} y={287} width={35} height={52} fill="url(#hatch)" stroke="#475569" strokeWidth={1}/>
      <text x={584} y={316} fontSize={7} textAnchor="middle" fill="#1F2937" fontWeight={700}>EPS</text>
      {/* 남자화장실 하단 */}
      <rect x={566} y={348} width={70} height={95} fill="#EFF6FF" stroke="#1D4ED8" strokeWidth={1}/>
      <text x={601} y={392} fontSize={7.5} textAnchor="middle" fill="#1D4ED8" fontWeight={700}>남자화장실</text>
      {[0,1].map(i=>(
        <rect key={i} x={572+i*28} y={356} width={20} height={14} rx={2}
          fill="#DBEAFE" stroke="#1D4ED8" strokeWidth={0.5}/>
      ))}
      {/* PS (하단) */}
      <rect x={566} y={450} width={70} height={70} fill="#F8FAFC" stroke="#475569" strokeWidth={1}/>
      <text x={601} y={482} fontSize={7} textAnchor="middle" fill="#475569">P.S</text>

      {/* ── VOID (x=640, w=166) ── */}
      <g>
        <rect x={640} y={28} width={166} height={492} fill="url(#hatchLight)" stroke="#94A3B8" strokeWidth={1}/>
        <line x1={640} y1={28} x2={806} y2={520} stroke="#CBD5E1" strokeWidth={0.9}/>
        <line x1={806} y1={28} x2={640} y2={520} stroke="#CBD5E1" strokeWidth={0.9}/>
        <text x={723} y={274} fontSize={13} textAnchor="middle" fill="#475569" fontWeight={700}>VOID</text>
      </g>

      {/* 방향 레이블 */}
      <text x={20} y={16} fontSize={9.5} fontWeight={800} fill="#1F2937">← 서편 (WEST)</text>
      <text x={800} y={16} fontSize={9.5} fontWeight={800} fill="#1F2937" textAnchor="end">동편 (EAST) →</text>
      <text x={184} y={534} fontSize={7} fill="#94A3B8" textAnchor="middle">■=책상(모니터상태) ○=의자 / 초록=회의실 / 빗금=코어</text>
    </svg>
  );
}

// ─── 공통 헬퍼 ─────────────────────────────────────────────────
// 좌석 그리드 위치 계산
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
// 그룹 내 row 인덱스에 따라 의자 방향 결정 (상단 행 → 아래 의자, 하단 행 → 위 의자)
function orientOf(row: number, rowGroups: number[]): "down"|"up" {
  let gi = 0, ri = 0;
  for (let i = 0; i < row; i++) { ri++; if (ri >= (rowGroups[gi]||2)) { gi++; ri = 0; } }
  return ri === 0 ? "down" : "up";
}

// 재사용 DeskGrid
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

// 공통 코어 블록 (계단+EV+화장실)
function CoreBlock({ x, y, w, h, hasStairs=true }: { x:number;y:number;w:number;h:number;hasStairs?:boolean }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#F1F5F9" stroke="#475569" strokeWidth={1.2}/>
      {/* 계단 UP */}
      {hasStairs && <g>
        <rect x={x+4} y={y+8} width={w/2-8} height={h*0.18} fill="url(#hatchLight)" stroke="#475569" strokeWidth={0.8}/>
        {Array.from({length:5},(_,i)=><line key={i} x1={x+4} y1={y+12+i*7} x2={x+w/2-4} y2={y+12+i*7} stroke="#475569" strokeWidth={0.5}/>)}
        <text x={x+8} y={y+13} fontSize={7} fill="#475569">UP</text>
      </g>}
      {/* 엘리베이터 박스 */}
      <rect x={x+w/4} y={y+h*0.3} width={w/2} height={h*0.18} fill="#E2E8F0" stroke="#475569" strokeWidth={0.8}/>
      <line x1={x+w/4} y1={y+h*0.3} x2={x+3*w/4} y2={y+h*0.48} stroke="#475569" strokeWidth={0.5}/>
      <line x1={x+3*w/4} y1={y+h*0.3} x2={x+w/4} y2={y+h*0.48} stroke="#475569" strokeWidth={0.5}/>
      <text x={x+w/2} y={y+h*0.4} fontSize={7} fill="#475569" textAnchor="middle">EV</text>
      {/* 계단 DN */}
      {hasStairs && <g>
        <rect x={x+4} y={y+h*0.75} width={w/2-8} height={h*0.18} fill="url(#hatchLight)" stroke="#475569" strokeWidth={0.8}/>
        {Array.from({length:5},(_,i)=><line key={i} x1={x+4} y1={y+h*0.76+i*7} x2={x+w/2-4} y2={y+h*0.76+i*7} stroke="#475569" strokeWidth={0.5}/>)}
        <text x={x+8} y={y+h*0.77} fontSize={7} fill="#475569">DN</text>
      </g>}
      {/* EPS */}
      <rect x={x+w/2+4} y={y+h*0.5} width={w/2-8} height={h*0.18} fill="url(#hatch)" stroke="#475569" strokeWidth={0.7}/>
      <text x={x+3*w/4} y={y+h*0.6} fontSize={7} fill="#475569" textAnchor="middle">EPS</text>
    </g>
  );
}

// 공통 미팅룸
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

// 공통 빌딩 외곽 + 창문
function BuildingShell({ vw, vy=20, vh=510, windows=24 }: { vw:number; vy?:number; vh?:number; windows?:number }) {
  return (
    <g>
      {HATCH}
      <rect x={12} y={vy} width={vw-24} height={vh} fill="#FAFAFA" stroke="#1F2937" strokeWidth={2}/>
      {Array.from({length:windows},(_,i)=>(<>
        <line key={`t${i}`} x1={30+i*32} y1={vy} x2={30+i*32} y2={vy+8} stroke="#60A5FA" strokeWidth={2} opacity={0.45}/>
        <line key={`b${i}`} x1={30+i*32} y1={vy+vh} x2={30+i*32} y2={vy+vh-8} stroke="#60A5FA" strokeWidth={2} opacity={0.45}/>
      </>))}
    </g>
  );
}

// ─── 본관 3F ─── 서편 54석 · 동편 71석 ────────────────────────────
// 도면 분석:
//  서편(좌): G/B협업공간(상단) + 업무데스크 6×9=54석 + 미팅룸2개(하단)
//  코어(중): P.S. / 계단UP·DN / EPS(좌우) / CABINET / D.S.엘리베이터 / SOFA
//  동편(우): G/B+TV존(상단) + 업무데스크 8×9=71석
export function BW_3F_Sketch(ctx: SketchCtx) {
  const zW = ctx.zones.find(z=>z.id==="bw3-w");
  const zE = ctx.zones.find(z=>z.id==="bw3-e");
  if (!zW||!zE) return null;
  return (
    <svg viewBox="0 0 820 560" style={{ width:"100%", maxWidth:960, height:"auto", display:"block" }}>
      {HATCH}
      {/* 건물 외벽 */}
      <rect x={12} y={20} width={796} height={528} fill="#FAFAFA" stroke="#1F2937" strokeWidth={2}/>
      {Array.from({length:24},(_,i)=>(
        <line key={`t${i}`} x1={30+i*32} y1={20} x2={30+i*32} y2={28} stroke="#60A5FA" strokeWidth={2} opacity={0.5}/>
      ))}
      {Array.from({length:24},(_,i)=>(
        <line key={`b${i}`} x1={30+i*32} y1={548} x2={30+i*32} y2={540} stroke="#60A5FA" strokeWidth={2} opacity={0.5}/>
      ))}

      {/* ══ 서편 (x=14~300) ══════════════════════════════════════ */}
      {/* G/B 협업공간 (상단) */}
      <rect x={14} y={28} width={130} height={82} fill="#F0FDF4" stroke="#86EFAC" strokeWidth={1.4} rx={3}/>
      <text x={79} y={65} fontSize={8.5} textAnchor="middle" fill="#15803D" fontWeight={700}>G/B 협업공간</text>
      {/* 협업공간 내 원형 테이블 */}
      <circle cx={60} cy={50} r={12} fill="none" stroke="#86EFAC" strokeWidth={1}/>
      {[-16,0,16].map(d=><circle key={d} cx={60+d} cy={72} r={4} fill="#BBF7D0" stroke="#86EFAC" strokeWidth={0.6}/>)}

      {/* 서편 데스크 구역 — 54석 (6열×9행) */}
      <rect x={14} y={118} width={286} height={316} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2" rx={3}/>
      <text x={30} y={132} fontSize={9} fontWeight={800} fill="#1E3A8A">서편 — {zW.seats.length}석</text>
      <DeskGrid zone={zW} startX={22} startY={143} cols={6} rows={9}
        sw={28} sh={12} gx={9} gy={3} rowGroups={[2,2,2,3]} aisle={18} ctx={ctx}/>

      {/* CABINET AREA (서편-코어 경계) */}
      <rect x={270} y={140} width={36} height={60} fill="#F1F5F9" stroke="#94A3B8" strokeWidth={0.8}/>
      <text x={288} y={173} fontSize={6.5} textAnchor="middle" fill="#475569" fontWeight={700}>CAB</text>
      <rect x={270} y={340} width={36} height={60} fill="#F1F5F9" stroke="#94A3B8" strokeWidth={0.8}/>
      <text x={288} y={373} fontSize={6.5} textAnchor="middle" fill="#475569" fontWeight={700}>CAB</text>

      {/* 미팅룸 2개 (하단 좌) */}
      <MeetingBox x={14} y={444} w={138} h={100} name="미팅룸" sub="18.5m² / 5.6평"/>
      <MeetingBox x={158} y={444} w={138} h={100} name="미팅룸" sub="16.1m² / 4.9평"/>

      {/* ══ 코어 (x=308~490) ═════════════════════════════════════ */}
      {/* 코어 외벽 */}
      <rect x={308} y={28} width={182} height={520} fill="#E2E8F0" stroke="#475569" strokeWidth={1.5}/>

      {/* P.S. 상단 (좌우) */}
      <rect x={310} y={30} width={32} height={30} fill="#F1F5F9" stroke="#94A3B8" strokeWidth={0.8}/>
      <text x={326} y={48} fontSize={6} textAnchor="middle" fill="#475569" fontWeight={700}>P.S.</text>
      <rect x={456} y={30} width={32} height={30} fill="#F1F5F9" stroke="#94A3B8" strokeWidth={0.8}/>
      <text x={472} y={48} fontSize={6} textAnchor="middle" fill="#475569" fontWeight={700}>P.S.</text>

      {/* 상단 계단 UP·DN */}
      <rect x={348} y={28} width={102} height={85} fill="url(#hatchLight)" stroke="#475569" strokeWidth={1.2}/>
      {Array.from({length:7},(_,i)=>(
        <line key={i} x1={350} y1={38+i*10} x2={448} y2={38+i*10} stroke="#475569" strokeWidth={0.6}/>
      ))}
      <text x={356} y={40} fontSize={7} fill="#475569" fontWeight={700}>UP</text>
      <text x={432} y={108} fontSize={7} fill="#475569" fontWeight={700}>DN</text>

      {/* EPS 좌·우 */}
      <rect x={310} y={122} width={34} height={52} fill="url(#hatch)" stroke="#475569" strokeWidth={1}/>
      <text x={327} y={151} fontSize={7} textAnchor="middle" fill="#1F2937" fontWeight={700}>EPS</text>
      <rect x={454} y={122} width={34} height={52} fill="url(#hatch)" stroke="#475569" strokeWidth={1}/>
      <text x={471} y={151} fontSize={7} textAnchor="middle" fill="#1F2937" fontWeight={700}>EPS</text>

      {/* D.S. 엘리베이터 (대형, X패턴) */}
      <rect x={330} y={185} width={138} height={108} fill="#D1D5DB" stroke="#475569" strokeWidth={1.2}/>
      <line x1={330} y1={185} x2={468} y2={293} stroke="#94A3B8" strokeWidth={1}/>
      <line x1={468} y1={185} x2={330} y2={293} stroke="#94A3B8" strokeWidth={1}/>
      <text x={399} y={243} fontSize={8.5} textAnchor="middle" fill="#475569" fontWeight={700}>D.S.</text>

      {/* SOFA 구역 */}
      <rect x={320} y={305} width={158} height={62} fill="#FAFAFA" stroke="#475569" strokeWidth={1}/>
      <text x={399} y={330} fontSize={8} textAnchor="middle" fill="#475569" fontWeight={700}>SOFA</text>
      {/* 소파 심볼 */}
      <rect x={328} y={336} width={50} height={22} rx={4} fill="#D1FAE5" stroke="#047857" strokeWidth={0.8}/>
      <rect x={418} y={336} width={50} height={22} rx={4} fill="#D1FAE5" stroke="#047857" strokeWidth={0.8}/>

      {/* EPS 하단 좌·우 */}
      <rect x={310} y={378} width={34} height={52} fill="url(#hatch)" stroke="#475569" strokeWidth={1}/>
      <text x={327} y={407} fontSize={7} textAnchor="middle" fill="#1F2937" fontWeight={700}>EPS</text>
      <rect x={454} y={378} width={34} height={52} fill="url(#hatch)" stroke="#475569" strokeWidth={1}/>
      <text x={471} y={407} fontSize={7} textAnchor="middle" fill="#1F2937" fontWeight={700}>EPS</text>

      {/* 하단 계단 DN·UP */}
      <rect x={348} y={440} width={102} height={95} fill="url(#hatchLight)" stroke="#475569" strokeWidth={1.2}/>
      {Array.from({length:7},(_,i)=>(
        <line key={i} x1={350} y1={450+i*11} x2={448} y2={450+i*11} stroke="#475569" strokeWidth={0.6}/>
      ))}
      <text x={356} y={452} fontSize={7} fill="#475569" fontWeight={700}>UP</text>
      <text x={432} y={530} fontSize={7} fill="#475569" fontWeight={700}>DN</text>

      {/* P.S. 하단 (좌우) */}
      <rect x={310} y={516} width={32} height={28} fill="#F1F5F9" stroke="#94A3B8" strokeWidth={0.8}/>
      <text x={326} y={533} fontSize={6} textAnchor="middle" fill="#475569">P.S.</text>
      <rect x={456} y={516} width={32} height={28} fill="#F1F5F9" stroke="#94A3B8" strokeWidth={0.8}/>
      <text x={472} y={533} fontSize={6} textAnchor="middle" fill="#475569">P.S.</text>

      {/* ══ 동편 (x=494~806) ═════════════════════════════════════ */}
      {/* G/B + TV 구역 상단 (도면에 TV 심볼 2개 보임) */}
      <rect x={494} y={28} width={130} height={82} fill="#F0FDF4" stroke="#86EFAC" strokeWidth={1.4} rx={3}/>
      <text x={559} y={62} fontSize={8.5} textAnchor="middle" fill="#15803D" fontWeight={700}>G/B</text>
      {/* TV 심볼 */}
      <rect x={506} y={34} width={28} height={18} rx={2} fill="#1F2937" stroke="#475569" strokeWidth={0.8}/>
      <text x={520} y={46} fontSize={6} textAnchor="middle" fill="white">TV</text>
      <rect x={542} y={34} width={28} height={18} rx={2} fill="#1F2937" stroke="#475569" strokeWidth={0.8}/>
      <text x={556} y={46} fontSize={6} textAnchor="middle" fill="white">TV</text>

      <rect x={632} y={28} width={82} height={82} fill="#F0FDF4" stroke="#86EFAC" strokeWidth={1.2} rx={3}/>
      <text x={673} y={62} fontSize={8} textAnchor="middle" fill="#15803D" fontWeight={700}>G/B</text>
      <rect x={722} y={28} width={82} height={82} fill="#F0FDF4" stroke="#86EFAC" strokeWidth={1.2} rx={3}/>
      <text x={763} y={62} fontSize={8} textAnchor="middle" fill="#15803D" fontWeight={700}>G/B</text>

      {/* CABINET AREA (코어-동편 경계) */}
      <rect x={492} y={140} width={36} height={60} fill="#F1F5F9" stroke="#94A3B8" strokeWidth={0.8}/>
      <text x={510} y={173} fontSize={6.5} textAnchor="middle" fill="#475569" fontWeight={700}>CAB</text>
      <rect x={492} y={340} width={36} height={60} fill="#F1F5F9" stroke="#94A3B8" strokeWidth={0.8}/>
      <text x={510} y={373} fontSize={6.5} textAnchor="middle" fill="#475569" fontWeight={700}>CAB</text>

      {/* 동편 데스크 구역 — 71석 (8열×9행) */}
      <rect x={532} y={118} width={272} height={370} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2" rx={3}/>
      <text x={548} y={132} fontSize={9} fontWeight={800} fill="#1E3A8A">동편 — {zE.seats.length}석</text>
      <DeskGrid zone={zE} startX={540} startY={143} cols={8} rows={9}
        sw={24} sh={12} gx={6} gy={3} rowGroups={[2,2,2,3]} aisle={18} ctx={ctx}/>

      {/* 방향 레이블 */}
      <text x={20} y={16} fontSize={9.5} fontWeight={800} fill="#1F2937">← 서편 (삼성역 방면)</text>
      <text x={800} y={16} fontSize={9.5} fontWeight={800} fill="#1F2937" textAnchor="end">동편 (탄천 방면) →</text>
      <text x={399} y={556} fontSize={7} fill="#94A3B8" textAnchor="middle">■=책상(모니터상태) ○=의자 / 초록=협업공간·미팅룸 / 빗금=코어</text>
    </svg>
  );
}

// ─── 본관 4F ─── 서편 74석 · 동편 49석 ────────────────────────────
// 원본 코드 기준: bw4-w=74석, bw4-e=49석
// 그리드: W(7×11=77, 74석 사용), E(7×7=49)
export function BW_4F_Sketch(ctx: SketchCtx) {
  const zW = ctx.zones.find(z=>z.id==="bw4-w");
  const zE = ctx.zones.find(z=>z.id==="bw4-e");
  if (!zW||!zE) return null;
  const wNone = zW.seats.filter(s=>s.type==="none").length;
  const eNone = zE.seats.filter(s=>s.type==="none").length;
  return (
    <svg viewBox="0 0 820 580" style={{ width:"100%", maxWidth:960, height:"auto", display:"block" }}>
      <BuildingShell vw={820} vh={550}/>

      {/* 서편 업무 구역 — 74석 (7×11) */}
      <rect x={20} y={28} width={285} height={390} fill="#FFF1F2" stroke="#FCA5A5" strokeWidth={1.2} strokeDasharray="5,2" rx={3}/>
      <text x={38} y={44} fontSize={9} fontWeight={800} fill="#B91C1C">서편 — {zW.seats.length}석{wNone>0?` (미설치 ${wNone})`:""}</text>
      <DeskGrid zone={zW} startX={30} startY={56} cols={7} rows={11}
        sw={22} sh={12} gx={6} gy={3} rowGroups={[2,2,2,2,3]} aisle={16} ctx={ctx}/>

      {/* 서편 하단 미팅룸 */}
      <MeetingBox x={20} y={430} w={90} h={105} name="스마트2" sub="5.6평"/>
      <MeetingBox x={118} y={430} w={90} h={105} name="스마트3" sub="5.6평"/>
      <MeetingBox x={216} y={430} w={90} h={105} name="라운지" sub="10.7평"/>

      {/* 코어 (중앙) + 화장실 */}
      <CoreBlock x={318} y={28} w={185} h={515}/>
      <rect x={355} y={35} width={110} height={55} fill="#F5F3FF" stroke="#6B21A8" strokeWidth={0.8}/>
      <text x={410} y={60} fontSize={7.5} textAnchor="middle" fill="#6B21A8" fontWeight={700}>여자화장실</text>
      <rect x={355} y={478} width={110} height={55} fill="#EFF6FF" stroke="#1D4ED8" strokeWidth={0.8}/>
      <text x={410} y={503} fontSize={7.5} textAnchor="middle" fill="#1D4ED8" fontWeight={700}>남자화장실</text>

      {/* 동편 업무 구역 — 49석 (7×7) */}
      <rect x={515} y={28} width={297} height={260} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2" rx={3}/>
      <text x={533} y={44} fontSize={9} fontWeight={800} fill="#1E3A8A">동편 — {zE.seats.length}석{eNone>0?` (미설치 ${eNone})`:""}</text>
      <DeskGrid zone={zE} startX={525} startY={56} cols={7} rows={7}
        sw={28} sh={12} gx={6} gy={3} rowGroups={[2,2,3]} aisle={18} ctx={ctx}/>
      <MeetingBox x={620} y={300} w={192} h={110} name="8인 미팅룸" sub=""/>

      <text x={30} y={16} fontSize={9} fontWeight={800} fill="#B91C1C">← 서편 (미설치 주의)</text>
      <text x={790} y={16} fontSize={9} fontWeight={800} fill="#1F2937" textAnchor="end">동편 →</text>
    </svg>
  );
}

// ─── 본관 5F ─── 서편 74석 · 동편 49석 ────────────────────────────
// 원본 코드 기준: bw5-w=74석, bw5-e=49석 (4층과 동일)
// 그리드: W(7×11=77, 74석 사용), E(7×7=49)
export function BW_5F_Sketch(ctx: SketchCtx) {
  const zW = ctx.zones.find(z=>z.id==="bw5-w");
  const zE = ctx.zones.find(z=>z.id==="bw5-e");
  if (!zW||!zE) return null;
  return (
    <svg viewBox="0 0 820 580" style={{ width:"100%", maxWidth:960, height:"auto", display:"block" }}>
      <BuildingShell vw={820} vh={550}/>

      {/* 서편 업무 구역 — 74석 (7×11) */}
      <rect x={20} y={28} width={285} height={510} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2" rx={3}/>
      <text x={38} y={44} fontSize={9} fontWeight={800} fill="#1E3A8A">서편 — {zW.seats.length}석</text>
      <DeskGrid zone={zW} startX={30} startY={56} cols={7} rows={11}
        sw={22} sh={12} gx={6} gy={3} rowGroups={[2,2,2,2,3]} aisle={16} ctx={ctx}/>

      {/* 코어 (중앙, 하단에 미팅룸) */}
      <CoreBlock x={318} y={28} w={185} h={400}/>
      <MeetingBox x={330} y={438} w={162} h={90} name="미팅룸" sub="6.6m² / 2.0평"/>

      {/* 동편: 상단 라운지/바 + 하단 업무 49석(7×7) */}
      <rect x={515} y={28} width={297} height={115} fill="#FEF3C7" stroke="#FCD34D" strokeWidth={1.2} rx={3}/>
      <text x={663} y={82} fontSize={9} fontWeight={800} textAnchor="middle" fill="#92400E">라운지 / 바 (Bar Table)</text>

      <rect x={515} y={150} width={297} height={265} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2" rx={3}/>
      <text x={533} y={166} fontSize={9} fontWeight={800} fill="#1E3A8A">동편 — {zE.seats.length}석</text>
      <DeskGrid zone={zE} startX={525} startY={178} cols={7} rows={7}
        sw={28} sh={12} gx={6} gy={3} rowGroups={[2,2,3]} aisle={18} ctx={ctx}/>

      <text x={30} y={16} fontSize={9} fontWeight={800} fill="#1F2937">← 서편 (WEST)</text>
      <text x={790} y={16} fontSize={9} fontWeight={800} fill="#1F2937" textAnchor="end">동편 (라운지+업무) →</text>
    </svg>
  );
}

// ─── 본관 6F ─── 서편(개발 34") 67석 · 동편 65석 ──────────────────
// 원본 코드 기준: bw6-w=67석, bw6-e=65석
// 그리드: W(7×10=70, 67석 사용), E(8×9=72, 65석 사용)
export function BW_6F_Sketch(ctx: SketchCtx) {
  const zW = ctx.zones.find(z=>z.id==="bw6-w");
  const zE = ctx.zones.find(z=>z.id==="bw6-e");
  if (!zW||!zE) return null;
  const wDev = zW.seats.filter(s=>s.type==="dev34").length;
  return (
    <svg viewBox="0 0 820 560" style={{ width:"100%", maxWidth:960, height:"auto", display:"block" }}>
      <BuildingShell vw={820} vh={530}/>

      {/* 서편 개발자 구역 — 67석 (7×10) */}
      <rect x={20} y={28} width={285} height={494} fill="#F5F3FF" stroke="#C4B5FD" strokeWidth={1.5} rx={3}/>
      <text x={38} y={44} fontSize={9} fontWeight={800} fill="#6D28D9">서편 (개발 34") — {zW.seats.length}석{wDev>0?` / 34" ${wDev}`:""}</text>
      <DeskGrid zone={zW} startX={30} startY={58} cols={7} rows={10}
        sw={22} sh={12} gx={6} gy={3} rowGroups={[2,2,2,2,2]} aisle={18} ctx={ctx}/>

      {/* 코어 */}
      <CoreBlock x={318} y={28} w={185} h={514}/>

      {/* 동편 업무 구역 — 65석 (8×9) */}
      <rect x={515} y={28} width={297} height={494} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2" rx={3}/>
      <text x={533} y={44} fontSize={9} fontWeight={800} fill="#1E3A8A">동편 — {zE.seats.length}석</text>
      <DeskGrid zone={zE} startX={525} startY={58} cols={8} rows={9}
        sw={24} sh={12} gx={6} gy={3} rowGroups={[2,2,2,3]} aisle={18} ctx={ctx}/>

      <text x={30} y={16} fontSize={9} fontWeight={800} fill="#6D28D9">← 서편 (개발자 34" 전용)</text>
      <text x={790} y={16} fontSize={9} fontWeight={800} fill="#1F2937" textAnchor="end">동편 →</text>
    </svg>
  );
}

// ─── 본관 7F ─── 서편 19석 · 동편 57석 ────────────────────────────
// 원본 코드 기준: bw7-w=19석 (좁은 구역), bw7-e=57석
// 그리드: W(4×5=20, 19석 사용), E(7×9=63, 57석 사용)
// ※ 7층 서편은 실제 도면에서 매우 좁은 구역 (원본 x2=240, 일반 x2=338 vs)
export function BW_7F_Sketch(ctx: SketchCtx) {
  const zW = ctx.zones.find(z=>z.id==="bw7-w");
  const zE = ctx.zones.find(z=>z.id==="bw7-e");
  if (!zW||!zE) return null;
  const wNone = zW.seats.filter(s=>s.type==="none").length;
  return (
    <svg viewBox="0 0 820 560" style={{ width:"100%", maxWidth:960, height:"auto", display:"block" }}>
      <BuildingShell vw={820} vh={530}/>

      {/* 서편 — 19석 (4×5, 좁은 구역) */}
      <rect x={20} y={28} width={175} height={200} fill="#FFF1F2" stroke="#FCA5A5" strokeWidth={1.2} strokeDasharray="5,2" rx={3}/>
      <text x={38} y={44} fontSize={9} fontWeight={800} fill="#B91C1C">서편 — {zW.seats.length}석{wNone>0?` (미설치 ${wNone})`:""}</text>
      <DeskGrid zone={zW} startX={30} startY={58} cols={4} rows={5}
        sw={26} sh={12} gx={8} gy={3} rowGroups={[2,3]} aisle={18} ctx={ctx}/>

      {/* 로커 구역 (서편 하단) */}
      <rect x={20} y={238} width={285} height={115} fill="#F1F5F9" stroke="#CBD5E1" strokeWidth={1.2} rx={3}/>
      <text x={163} y={292} fontSize={9} textAnchor="middle" fill="#475569" fontWeight={700}>LOCKER 구역</text>
      {Array.from({length:8},(_,i)=>(
        <rect key={i} x={30+i*30} y={252} width={22} height={40} fill="#E2E8F0" stroke="#94A3B8" strokeWidth={0.7} rx={1}/>
      ))}

      {/* 코어 */}
      <CoreBlock x={318} y={28} w={185} h={514}/>

      {/* 동편 업무 구역 — 57석 (7×9) */}
      <rect x={515} y={28} width={297} height={494} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2" rx={3}/>
      <text x={533} y={44} fontSize={9} fontWeight={800} fill="#1E3A8A">동편 — {zE.seats.length}석</text>
      <DeskGrid zone={zE} startX={525} startY={58} cols={7} rows={9}
        sw={28} sh={12} gx={6} gy={3} rowGroups={[2,2,2,3]} aisle={18} ctx={ctx}/>

      <text x={30} y={16} fontSize={9} fontWeight={800} fill="#B91C1C">← 서편 (소규모/미설치 주의)</text>
      <text x={790} y={16} fontSize={9} fontWeight={800} fill="#1F2937" textAnchor="end">동편 →</text>
    </svg>
  );
}

// ─── 본관 8F ─── 회의실 중심 · 업무공간 28석 ──────────────────────
// 원본 코드 기준: bw8-w=28석
// 그리드: M(7×4=28)
export function BW_8F_Sketch(ctx: SketchCtx) {
  const zM = ctx.zones.find(z=>z.id==="bw8-w");
  return (
    <svg viewBox="0 0 820 540" style={{ width:"100%", maxWidth:960, height:"auto", display:"block" }}>
      <BuildingShell vw={820}/>

      {/* 좌측 회의실 3개 */}
      <MeetingBox x={20} y={35} w={155} h={145} name="회의실/미팅룸-1" sub="13.5㎡ / 4.1인"/>
      <MeetingBox x={20} y={188} w={155} h={145} name="회의실/미팅룸-2" sub="13.5㎡ / 4.1인"/>
      <MeetingBox x={20} y={341} w={155} h={145} name="미팅룸" sub="13.5㎡ / 7.6인"/>

      {/* 중앙 소규모 업무공간 — 28석 (7×4) */}
      <rect x={185} y={88} width={120} height={130} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2" rx={3}/>
      <text x={245} y={104} fontSize={8} fontWeight={800} textAnchor="middle" fill="#1E3A8A">업무공간</text>
      <text x={245} y={114} fontSize={7} textAnchor="middle" fill="#64748B">{zM?.seats.length ?? 28}석</text>
      {zM && <DeskGrid zone={zM} startX={192} startY={124} cols={7} rows={4}
        sw={13} sh={12} gx={3} gy={3} rowGroups={[2,2]} aisle={18} ctx={ctx}/>}

      {/* 코어 (CANTEEN) */}
      <CoreBlock x={318} y={28} w={185} h={405} hasStairs={true}/>
      <rect x={330} y={435} width={162} height={75} fill="#FEF9C3" stroke="#EAB308" strokeWidth={1}/>
      <text x={411} y={468} fontSize={9} textAnchor="middle" fill="#713F12" fontWeight={700}>CANTEEN</text>

      {/* 우측 컨퍼런스룸 */}
      <MeetingBox x={515} y={35} w={297} h={155} name="Conference-1" sub="13.5㎡ / 17.9인"/>
      <MeetingBox x={515} y={198} w={297} h={115} name="회의실/멀티룸" sub="13.5㎡ / 13.8인"/>
      <MeetingBox x={515} y={321} w={297} h={155} name="Conference-2" sub="13.5㎡ / 19.5인"/>

      <text x={30} y={16} fontSize={9} fontWeight={800} fill="#15803D">← 회의실 구역</text>
      <text x={790} y={16} fontSize={9} fontWeight={800} fill="#15803D" textAnchor="end">컨퍼런스룸 구역 →</text>
    </svg>
  );
}

// ─── 본관 9F ─── 스튜디오 37석 · 홀(동편) 85석 ──────────────────
// 원본 코드 기준: bw9-w=37석, bw9-e=85석
// 그리드: W(5×8=40, 37석 사용), E(9×10=90, 85석 사용)
export function BW_9F_Sketch(ctx: SketchCtx) {
  const zW = ctx.zones.find(z=>z.id==="bw9-w");
  const zE = ctx.zones.find(z=>z.id==="bw9-e");
  if (!zW||!zE) return null;
  return (
    <svg viewBox="0 0 820 600" style={{ width:"100%", maxWidth:960, height:"auto", display:"block" }}>
      <BuildingShell vw={820} vh={570}/>

      {/* 스튜디오/라이브러리 (서편 상단) */}
      <rect x={20} y={28} width={285} height={120} fill="#FEF3C7" stroke="#F6CE4A" strokeWidth={1.2} rx={3}/>
      <text x={163} y={48} fontSize={9} fontWeight={800} textAnchor="middle" fill="#92400E">스튜디오 / 도서관</text>
      {Array.from({length:6},(_,i)=>(
        <rect key={i} x={28+i*42} y={56} width={35} height={65} fill="#FDE68A" stroke="#D97706" strokeWidth={0.7} rx={1}/>
      ))}
      {/* 스탠딩 데스크 */}
      <rect x={20} y={156} width={285} height={70} fill="#FFFBEB" stroke="#FCD34D" strokeWidth={1} strokeDasharray="4,2" rx={3}/>
      <text x={163} y={191} fontSize={8} textAnchor="middle" fill="#78350F" fontWeight={700}>스탠딩 데스크</text>

      {/* 서편 업무 좌석 — 37석 (5×8) */}
      <rect x={20} y={234} width={285} height={328} fill="#FFF7E6" stroke="#F6CE4A" strokeWidth={1} strokeDasharray="5,2" rx={3}/>
      <text x={38} y={250} fontSize={9} fontWeight={800} fill="#92400E">스튜디오 (서편) — {zW.seats.length}석</text>
      <DeskGrid zone={zW} startX={30} startY={262} cols={5} rows={8}
        sw={32} sh={12} gx={9} gy={3} rowGroups={[2,2,2,2]} aisle={18} ctx={ctx}/>

      {/* 코어 */}
      <CoreBlock x={318} y={28} w={185} h={534}/>

      {/* 동편 홀 — 85석 (9×10) */}
      <rect x={515} y={28} width={297} height={534} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2" rx={3}/>
      <text x={533} y={44} fontSize={9} fontWeight={800} fill="#1E3A8A">홀 (동편) — {zE.seats.length}석</text>
      <DeskGrid zone={zE} startX={525} startY={58} cols={9} rows={10}
        sw={21} sh={12} gx={5} gy={3} rowGroups={[2,2,2,2,2]} aisle={16} ctx={ctx}/>

      <text x={30} y={16} fontSize={9} fontWeight={800} fill="#92400E">← 서편 (스튜디오/라이브러리)</text>
      <text x={790} y={16} fontSize={9} fontWeight={800} fill="#1F2937" textAnchor="end">동편 (홀 85석) →</text>
    </svg>
  );
}

// ─── 신관 2F — 서편 31석 · 동편 48석 ────────────────────────────────
export function NS_2F_Sketch(ctx: SketchCtx) {
  const zW = ctx.zones.find(z=>z.id==="ns2-w");
  const zE = ctx.zones.find(z=>z.id==="ns2-e");
  if (!zW||!zE) return null;
  return (
    <svg viewBox="0 0 820 560" style={{ width:"100%", maxWidth:960, height:"auto", display:"block" }}>
      {HATCH}
      {/* 건물 외벽 */}
      <rect x={12} y={20} width={796} height={528} fill="#FAFAFA" stroke="#1F2937" strokeWidth={2}/>
      {/* 서편 데스크 구역 — 상단 */}
      <rect x={20} y={28} width={520} height={210} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2" rx={3}/>
      <text x={36} y={44} fontSize={9} fontWeight={800} fill="#1E3A8A">서편 (스마트오피스) — {zW.seats.length}석</text>
      <DeskGrid zone={zW} startX={28} startY={54} cols={6} rows={6}
        sw={26} sh={12} gx={8} gy={3} rowGroups={[2,2,2]} aisle={16} ctx={ctx}/>
      {/* 코어 (중앙 복도) */}
      <CoreBlock x={548} y={28} w={160} h={510} hasStairs={true}/>
      <text x={628} y={290} fontSize={8} textAnchor="middle" fill="#475569" fontWeight={700}>E/V</text>
      {/* 동편 데스크 구역 — 하단 */}
      <rect x={20} y={258} width={520} height={270} fill="#F5F3FF" stroke="#A78BFA" strokeWidth={1} strokeDasharray="5,2" rx={3}/>
      <text x={36} y={274} fontSize={9} fontWeight={800} fill="#4C1D95">동편 (스마트오피스) — {zE.seats.length}석</text>
      <DeskGrid zone={zE} startX={28} startY={284} cols={8} rows={6}
        sw={24} sh={12} gx={6} gy={3} rowGroups={[2,2,2]} aisle={16} ctx={ctx}/>
      {/* VOID */}
      <rect x={716} y={28} width={92} height={510} fill="url(#hatch)" stroke="#CBD5E1" strokeWidth={1} rx={2}/>
      <text x={762} y={290} fontSize={9} textAnchor="middle" fill="#94A3B8" fontWeight={700}>VOID</text>
      <text x={20} y={16} fontSize={9} fontWeight={800} fill="#1F2937">← 신관 2층 서편</text>
      <text x={800} y={16} textAnchor="end" fontSize={9} fontWeight={800} fill="#1F2937">동편 →</text>
    </svg>
  );
}

// ─── 신관 3F — 서편 40석 · 동편 60석 ────────────────────────────────
export function NS_3F_Sketch(ctx: SketchCtx) {
  const zW = ctx.zones.find(z=>z.id==="ns3-w");
  const zE = ctx.zones.find(z=>z.id==="ns3-e");
  if (!zW||!zE) return null;
  return (
    <svg viewBox="0 0 820 560" style={{ width:"100%", maxWidth:960, height:"auto", display:"block" }}>
      {HATCH}
      <rect x={12} y={20} width={796} height={528} fill="#FAFAFA" stroke="#1F2937" strokeWidth={2}/>
      <rect x={20} y={28} width={520} height={240} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2" rx={3}/>
      <text x={36} y={44} fontSize={9} fontWeight={800} fill="#1E3A8A">서편 (스마트오피스) — {zW.seats.length}석</text>
      <DeskGrid zone={zW} startX={28} startY={54} cols={5} rows={8}
        sw={28} sh={12} gx={9} gy={3} rowGroups={[2,2,2,2]} aisle={16} ctx={ctx}/>
      <CoreBlock x={548} y={28} w={160} h={510} hasStairs={true}/>
      <text x={628} y={290} fontSize={8} textAnchor="middle" fill="#475569" fontWeight={700}>E/V</text>
      <rect x={20} y={288} width={520} height={250} fill="#F5F3FF" stroke="#A78BFA" strokeWidth={1} strokeDasharray="5,2" rx={3}/>
      <text x={36} y={304} fontSize={9} fontWeight={800} fill="#4C1D95">동편 (스마트오피스) — {zE.seats.length}석</text>
      <DeskGrid zone={zE} startX={28} startY={314} cols={6} rows={10}
        sw={26} sh={12} gx={7} gy={3} rowGroups={[2,2,2,2,2]} aisle={16} ctx={ctx}/>
      <rect x={716} y={28} width={92} height={510} fill="url(#hatch)" stroke="#CBD5E1" strokeWidth={1} rx={2}/>
      <text x={762} y={290} fontSize={9} textAnchor="middle" fill="#94A3B8" fontWeight={700}>VOID</text>
      <text x={20} y={16} fontSize={9} fontWeight={800} fill="#1F2937">← 신관 3층 서편</text>
      <text x={800} y={16} textAnchor="end" fontSize={9} fontWeight={800} fill="#1F2937">동편 →</text>
    </svg>
  );
}

// ─── 신관 4F — 서편 40석 · 동편 51석 ────────────────────────────────
export function NS_4F_Sketch(ctx: SketchCtx) {
  const zW = ctx.zones.find(z=>z.id==="ns4-w");
  const zE = ctx.zones.find(z=>z.id==="ns4-e");
  if (!zW||!zE) return null;
  return (
    <svg viewBox="0 0 820 560" style={{ width:"100%", maxWidth:960, height:"auto", display:"block" }}>
      {HATCH}
      <rect x={12} y={20} width={796} height={528} fill="#FAFAFA" stroke="#1F2937" strokeWidth={2}/>
      <rect x={20} y={28} width={520} height={240} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2" rx={3}/>
      <text x={36} y={44} fontSize={9} fontWeight={800} fill="#1E3A8A">서편 (스마트오피스) — {zW.seats.length}석</text>
      <DeskGrid zone={zW} startX={28} startY={54} cols={5} rows={8}
        sw={28} sh={12} gx={9} gy={3} rowGroups={[2,2,2,2]} aisle={16} ctx={ctx}/>
      <CoreBlock x={548} y={28} w={160} h={510} hasStairs={true}/>
      <text x={628} y={290} fontSize={8} textAnchor="middle" fill="#475569" fontWeight={700}>E/V</text>
      <rect x={20} y={288} width={520} height={250} fill="#F5F3FF" stroke="#A78BFA" strokeWidth={1} strokeDasharray="5,2" rx={3}/>
      <text x={36} y={304} fontSize={9} fontWeight={800} fill="#4C1D95">동편 (스마트오피스) — {zE.seats.length}석</text>
      <DeskGrid zone={zE} startX={28} startY={314} cols={6} rows={9}
        sw={26} sh={12} gx={7} gy={3} rowGroups={[2,2,2,3]} aisle={16} ctx={ctx}/>
      <rect x={716} y={28} width={92} height={510} fill="url(#hatch)" stroke="#CBD5E1" strokeWidth={1} rx={2}/>
      <text x={762} y={290} fontSize={9} textAnchor="middle" fill="#94A3B8" fontWeight={700}>VOID</text>
      <text x={20} y={16} fontSize={9} fontWeight={800} fill="#1F2937">← 신관 4층 서편</text>
      <text x={800} y={16} textAnchor="end" fontSize={9} fontWeight={800} fill="#1F2937">동편 →</text>
    </svg>
  );
}

// ─── 신관 5F — 서편 35석 · 동편 48석 ────────────────────────────────
export function NS_5F_Sketch(ctx: SketchCtx) {
  const zW = ctx.zones.find(z=>z.id==="ns5-w");
  const zE = ctx.zones.find(z=>z.id==="ns5-e");
  if (!zW||!zE) return null;
  return (
    <svg viewBox="0 0 820 560" style={{ width:"100%", maxWidth:960, height:"auto", display:"block" }}>
      {HATCH}
      <rect x={12} y={20} width={796} height={528} fill="#FAFAFA" stroke="#1F2937" strokeWidth={2}/>
      <rect x={20} y={28} width={520} height={220} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2" rx={3}/>
      <text x={36} y={44} fontSize={9} fontWeight={800} fill="#1E3A8A">서편 (스마트오피스) — {zW.seats.length}석</text>
      <DeskGrid zone={zW} startX={28} startY={54} cols={5} rows={7}
        sw={28} sh={12} gx={9} gy={3} rowGroups={[2,2,3]} aisle={16} ctx={ctx}/>
      <CoreBlock x={548} y={28} w={160} h={510} hasStairs={true}/>
      <text x={628} y={290} fontSize={8} textAnchor="middle" fill="#475569" fontWeight={700}>E/V</text>
      <rect x={20} y={268} width={520} height={270} fill="#F5F3FF" stroke="#A78BFA" strokeWidth={1} strokeDasharray="5,2" rx={3}/>
      <text x={36} y={284} fontSize={9} fontWeight={800} fill="#4C1D95">동편 (스마트오피스) — {zE.seats.length}석</text>
      <DeskGrid zone={zE} startX={28} startY={294} cols={8} rows={6}
        sw={24} sh={12} gx={6} gy={3} rowGroups={[2,2,2]} aisle={16} ctx={ctx}/>
      <rect x={716} y={28} width={92} height={510} fill="url(#hatch)" stroke="#CBD5E1" strokeWidth={1} rx={2}/>
      <text x={762} y={290} fontSize={9} textAnchor="middle" fill="#94A3B8" fontWeight={700}>VOID</text>
      <text x={20} y={16} fontSize={9} fontWeight={800} fill="#1F2937">← 신관 5층 서편</text>
      <text x={800} y={16} textAnchor="end" fontSize={9} fontWeight={800} fill="#1F2937">동편 →</text>
    </svg>
  );
}

// ─── S빌딩 3F — Smart Office 1 (15석) · Smart Office 2 (32석) ─────
export function SB_3F_Sketch(ctx: SketchCtx) {
  const zA = ctx.zones.find(z=>z.id==="sb3-a");
  const zB = ctx.zones.find(z=>z.id==="sb3-b");
  if (!zA||!zB) return null;
  return (
    <svg viewBox="0 0 820 560" style={{ width:"100%", maxWidth:960, height:"auto", display:"block" }}>
      {HATCH}
      <rect x={12} y={20} width={796} height={528} fill="#FAFAFA" stroke="#1F2937" strokeWidth={2}/>
      {/* Smart Office 1 — 좌측 */}
      <rect x={20} y={28} width={340} height={510} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2" rx={3}/>
      <text x={36} y={44} fontSize={9} fontWeight={800} fill="#1E3A8A">Smart Office 1 — {zA.seats.length}석</text>
      <DeskGrid zone={zA} startX={28} startY={58} cols={5} rows={3}
        sw={28} sh={12} gx={9} gy={3} rowGroups={[1,2]} aisle={18} ctx={ctx}/>
      {/* 코어 (중앙) */}
      <CoreBlock x={368} y={28} w={120} h={510} hasStairs={true}/>
      {/* Smart Office 2 — 우측 */}
      <rect x={496} y={28} width={312} height={510} fill="#F5F3FF" stroke="#A78BFA" strokeWidth={1} strokeDasharray="5,2" rx={3}/>
      <text x={512} y={44} fontSize={9} fontWeight={800} fill="#4C1D95">Smart Office 2 — {zB.seats.length}석</text>
      <DeskGrid zone={zB} startX={504} startY={58} cols={5} rows={7}
        sw={28} sh={12} gx={9} gy={3} rowGroups={[2,2,3]} aisle={16} ctx={ctx}/>
      <text x={20} y={16} fontSize={9} fontWeight={800} fill="#1F2937">S빌딩 3층</text>
    </svg>
  );
}

// ─── S빌딩 4F — Casual Work Space (21석) · Open Office (40석) ──────
export function SB_4F_Sketch(ctx: SketchCtx) {
  const zW = ctx.zones.find(z=>z.id==="sb4-w");
  const zE = ctx.zones.find(z=>z.id==="sb4-e");
  if (!zW||!zE) return null;
  return (
    <svg viewBox="0 0 820 560" style={{ width:"100%", maxWidth:960, height:"auto", display:"block" }}>
      {HATCH}
      <rect x={12} y={20} width={796} height={528} fill="#FAFAFA" stroke="#1F2937" strokeWidth={2}/>
      <rect x={20} y={28} width={330} height={510} fill="#ECFDF5" stroke="#86EFAC" strokeWidth={1} strokeDasharray="5,2" rx={3}/>
      <text x={36} y={44} fontSize={9} fontWeight={800} fill="#14532D">Casual Work Space — {zW.seats.length}석</text>
      <DeskGrid zone={zW} startX={28} startY={58} cols={6} rows={4}
        sw={26} sh={12} gx={8} gy={3} rowGroups={[2,2]} aisle={18} ctx={ctx}/>
      <CoreBlock x={358} y={28} w={120} h={510} hasStairs={true}/>
      <rect x={486} y={28} width={322} height={510} fill="#F5F3FF" stroke="#A78BFA" strokeWidth={1} strokeDasharray="5,2" rx={3}/>
      <text x={502} y={44} fontSize={9} fontWeight={800} fill="#4C1D95">Open Office — {zE.seats.length}석</text>
      <DeskGrid zone={zE} startX={494} startY={58} cols={5} rows={8}
        sw={28} sh={12} gx={9} gy={3} rowGroups={[2,2,2,2]} aisle={16} ctx={ctx}/>
      <text x={20} y={16} fontSize={9} fontWeight={800} fill="#1F2937">S빌딩 4층</text>
    </svg>
  );
}

// ─── S빌딩 5F — 스마트오피스 (36석) ────────────────────────────────
export function SB_5F_Sketch(ctx: SketchCtx) {
  const zSO = ctx.zones.find(z=>z.id==="sb5-so");
  if (!zSO) return null;
  return (
    <svg viewBox="0 0 820 560" style={{ width:"100%", maxWidth:960, height:"auto", display:"block" }}>
      {HATCH}
      <rect x={12} y={20} width={796} height={528} fill="#FAFAFA" stroke="#1F2937" strokeWidth={2}/>
      {/* 좌측 void */}
      <rect x={20} y={28} width={200} height={510} fill="url(#hatch)" stroke="#CBD5E1" strokeWidth={1} rx={2}/>
      <text x={120} y={290} fontSize={9} textAnchor="middle" fill="#94A3B8" fontWeight={700}>코어</text>
      {/* 스마트오피스 */}
      <rect x={228} y={28} width={580} height={510} fill="#EFF6FF" stroke="#93C5FD" strokeWidth={1} strokeDasharray="5,2" rx={3}/>
      <text x={244} y={44} fontSize={9} fontWeight={800} fill="#1E3A8A">스마트오피스 — {zSO.seats.length}석</text>
      <DeskGrid zone={zSO} startX={236} startY={58} cols={6} rows={6}
        sw={28} sh={12} gx={9} gy={3} rowGroups={[2,2,2]} aisle={18} ctx={ctx}/>
      <text x={20} y={16} fontSize={9} fontWeight={800} fill="#1F2937">S빌딩 5층</text>
    </svg>
  );
}

// ─── 층별 스케치 레지스트리 ──────────────────────────────────────
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
