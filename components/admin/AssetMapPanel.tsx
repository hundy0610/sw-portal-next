"use client";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";

// =============================================================================
// TYPES
// =============================================================================
type MonitorType = "large" | "standard" | "empty";
type HistoryEntryType = "install" | "repair" | "replace" | "note";

interface HistoryEntry {
  id: string; date: string;
  entryType: HistoryEntryType; content: string; author: string;
}
interface SeatState {
  seatId: string; monitorType: MonitorType;
  isRepairing: boolean; repairStartedAt?: string;
  history: HistoryEntry[];
}

interface SeatDef { id: string; monitor: MonitorType; x: number; y: number; }
// 책상 클러스터 — 도면의 실제 데스크 묶음 (대개 back-to-back 2열)
interface DeskCluster {
  id: string;
  x: number; y: number; w: number; h: number;
  rows: number; cols: number;            // 기본 격자 크기 (행 × 최대 열)
  rowCols?: number[];                    // 행별 열 수 재정의 — 비대칭 back-to-back용 (예: [5,4]=9석)
  emptyIdx?: number[];                   // 미설치(X) 좌석 인덱스 (0-base, 행 우선 순번)
  largeIdx?: number[];                   // 대형(34") 좌석 인덱스 (0-base)
}
interface ZoneDef {
  id: string; label: string; dir: "west" | "east" | "single";
  x1: number; y1: number; x2: number; y2: number;
  seats: SeatDef[]; rows: number; cols: number;
  dx: number; dy: number; padX: number; padY: number;
  desks?: DeskCluster[];                 // 있으면 책상 사각형도 렌더
}
interface ElevatorDef { id: string; x: number; y: number; label: string; }
interface RoomElement {
  id: string; x: number; y: number; w: number; h: number;
  kind: "meeting"|"lounge"|"showroom"|"conference"|"storage";
  label: string; sublabel?: string;
}
interface FloorDef {
  id: string; label: string; imageSrc: string;
  zones: ZoneDef[]; elevators: ElevatorDef[]; noImage?: boolean;
  rooms?: RoomElement[];
}
interface BuildingDef { id: string; label: string; floors: FloorDef[]; }

// =============================================================================
// TOAST
// =============================================================================
interface Toast { id: string; message: string; type: "success" | "error" | "info"; }
function ToastContainer({ toasts }: { toasts: Toast[] }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium text-white ${
          t.type === "success" ? "bg-emerald-600" : t.type === "error" ? "bg-red-600" : "bg-slate-700"
        }`}>
          {t.type === "success" ? "✓" : t.type === "error" ? "✕" : "ℹ"} {t.message}
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// LOCAL STORAGE — 모니터 상태 (타입·수리 이력)
// =============================================================================
const STORAGE_KEY = "sw-portal-monitor-v2";
function loadAllStates(): Record<string, SeatState> {
  if (typeof window === "undefined") return {};
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : {}; }
  catch { return {}; }
}
function persistStates(s: Record<string, SeatState>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

// =============================================================================
// LAYOUT STORAGE — 아이콘 위치·회전·추가 좌석 (관리자 직접 배치)
// =============================================================================
const LAYOUT_KEY = "sw-portal-layout-v1";

interface SeatLayout { x: number; y: number; rot: number; }   // 드래그 오버라이드
interface ExtraSeat {                                           // 관리자가 추가한 좌석
  id: string; floorId: string;
  x: number; y: number; rot: number; type: MonitorType;
}
interface LayoutStore {
  pos: Record<string, SeatLayout>;  // seatId → 변경된 위치·회전
  extra: ExtraSeat[];               // 추가 생성된 아이콘
}

function loadLayout(): LayoutStore {
  if (typeof window === "undefined") return { pos: {}, extra: [] };
  try {
    const r = localStorage.getItem(LAYOUT_KEY);
    return r ? JSON.parse(r) : { pos: {}, extra: [] };
  } catch { return { pos: {}, extra: [] }; }
}
function persistLayout(l: LayoutStore) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(l));
}

// =============================================================================
// SEAT GRID GENERATOR — explicit rows/cols for coordinate system
// =============================================================================
function mkSeatsWithGrid(
  zone: { x1: number; y1: number; x2: number; y2: number },
  total: number, pfx: string, largeCnt: number,
  padX = 24, padY = 28
) {
  const W = zone.x2 - zone.x1 - padX * 2;
  const H = zone.y2 - zone.y1 - padY * 2;
  const aspect = W / Math.max(H, 1);
  const cols = Math.min(12, Math.max(2, Math.round(Math.sqrt(total * aspect))));
  const rows = Math.ceil(total / cols);
  const dx = cols > 1 ? W / (cols - 1) : 0;
  const dy = rows > 1 ? H / (rows - 1) : 0;
  const seats: SeatDef[] = Array.from({ length: total }, (_, i) => ({
    id: `${pfx}${String(i + 1).padStart(2, "0")}`,
    monitor: (i < largeCnt ? "large" : "standard") as MonitorType,
    x: zone.x1 + padX + (i % cols) * dx,
    y: zone.y1 + padY + Math.floor(i / cols) * dy,
  }));
  return { seats, rows, cols, dx, dy, padX, padY };
}

function mkZone(
  id: string, label: string, dir: ZoneDef["dir"],
  bounds: { x1: number; y1: number; x2: number; y2: number },
  total: number, pfx: string, largeCnt: number
): ZoneDef {
  const { seats, rows, cols, dx, dy, padX, padY } = mkSeatsWithGrid(bounds, total, pfx, largeCnt);
  return { id, label, dir, ...bounds, seats, rows, cols, dx, dy, padX, padY };
}

// Creates a zone where ALL seats are empty (no monitor installed) — e.g. 나보타개발팀
function mkZoneAllEmpty(
  id: string, label: string, dir: ZoneDef["dir"],
  bounds: { x1: number; y1: number; x2: number; y2: number },
  total: number, pfx: string
): ZoneDef {
  const { seats, rows, cols, dx, dy, padX, padY } = mkSeatsWithGrid(bounds, total, pfx, 0);
  const emptySeats = seats.map(s => ({ ...s, monitor: "empty" as MonitorType }));
  return { id, label, dir, ...bounds, seats: emptySeats, rows, cols, dx, dy, padX, padY };
}

// 클러스터(책상 묶음) 기반 존 생성 — 도면 그대로의 데스크 배치 재현용
// rowCols 지원: 행마다 열 수가 다른 비대칭 back-to-back 클러스터 (예: [5,4]=9석)
function mkZoneFromClusters(
  id: string, label: string, dir: ZoneDef["dir"], pfx: string,
  clusters: DeskCluster[]
): ZoneDef {
  const seats: SeatDef[] = [];
  let n = 0;
  for (const c of clusters) {
    const innerPadX = 8, innerPadY = 9;
    const cw = c.w - innerPadX * 2;
    const ch = c.h - innerPadY * 2;
    const dyC = c.rows > 1 ? ch / (c.rows - 1) : 0;
    let seatIdx = 0;
    for (let r = 0; r < c.rows; r++) {
      // rowCols가 지정된 경우 해당 행의 열 수 사용, 아니면 c.cols
      const rCols = c.rowCols ? (c.rowCols[r] ?? c.cols) : c.cols;
      const dxC = rCols > 1 ? cw / (rCols - 1) : 0;
      for (let col = 0; col < rCols; col++) {
        const isEmpty = c.emptyIdx?.includes(seatIdx);
        const isLarge = c.largeIdx?.includes(seatIdx);
        n++;
        seats.push({
          id: `${pfx}${String(n).padStart(2, "0")}`,
          monitor: isEmpty ? "empty" : isLarge ? "large" : "standard",
          x: c.x + innerPadX + col * dxC,
          y: c.y + innerPadY + r * dyC,
        });
        seatIdx++;
      }
    }
  }
  // bounds = clusters를 모두 감싸는 사각형 (마스크/줌용)
  const x1 = Math.min(...clusters.map(c => c.x));
  const y1 = Math.min(...clusters.map(c => c.y));
  const x2 = Math.max(...clusters.map(c => c.x + c.w));
  const y2 = Math.max(...clusters.map(c => c.y + c.h));
  const rows = Math.max(...clusters.map(c => c.rows));
  const cols = Math.max(...clusters.map(c => c.cols));
  return {
    id, label, dir, x1, y1, x2, y2,
    seats, rows, cols,
    dx: 0, dy: 0, padX: 0, padY: 0,
    desks: clusters,
  };
}

// =============================================================================
// COORDINATE DATA  (960×600 SVG canvas)
// =============================================================================
const BW_W = { x1: 52, y1: 152, x2: 338, y2: 568 };
const BW_E = { x1: 528, y1: 152, x2: 897, y2: 568 };
const BW_EV: ElevatorDef[] = [
  { id: "ev-w", x: 384, y: 300, label: "서편 E/V" },
  { id: "ev-e", x: 494, y: 300, label: "동편 E/V" },
];
const SN2_W = { x1: 262, y1: 56, x2: 578, y2: 268 };
const SN2_E = { x1: 264, y1: 346, x2: 732, y2: 594 };
const SN3_W = { x1: 212, y1: 315, x2: 442, y2: 580 };
const SN3_E = { x1: 398, y1: 96, x2: 778, y2: 298 };
const SN4_W = { x1: 260, y1: 56, x2: 585, y2: 275 };
const SN4_E = { x1: 262, y1: 358, x2: 734, y2: 598 };
const SN5_W = { x1: 253, y1: 52, x2: 582, y2: 272 };
const SN5_E = { x1: 255, y1: 352, x2: 739, y2: 598 };
const SB3_A = { x1: 222, y1: 246, x2: 450, y2: 518 };
const SB3_B = { x1: 454, y1: 196, x2: 814, y2: 540 };
const SB4_W = { x1: 132, y1: 262, x2: 462, y2: 543 };
const SB4_E = { x1: 496, y1: 148, x2: 886, y2: 543 };
const SB5 = { x1: 396, y1: 158, x2: 886, y2: 535 };
const SB_EV3: ElevatorDef[] = [{ id: "ev", x: 208, y: 162, label: "E/V" }];
const SB_EV4: ElevatorDef[] = [{ id: "ev", x: 204, y: 148, label: "E/V" }];

// =============================================================================
// BUILDINGS
// =============================================================================
const BUILDINGS: BuildingDef[] = [
  {
    id: "bw", label: "본관",
    floors: [
      // ─── 본관 2층 ─────────────────────────────────────────────────────────
      // 서편 90평: 도면 기준 6개 클러스터 구조 (상단→하단)
      //   C1: 1행 × 5열 = 5석  (단열, 상단 벽 근처)
      //   C2: 2행 × 5열 = 10석 (back-to-back)
      //   C3: 2행, [5,4]열 = 9석 (back-to-back 비대칭, X 마크 포함)
      //   C4: 2행 × 5열 = 10석
      //   C5: 2행, [5,4]열 = 9석 (back-to-back 비대칭)
      //   C6: 2행 × 5열 = 10석
      // 합계: 5+10+9+10+9+10 = 53석 (X 마크 1석 = 미설치 포함)
      { id:"bw2", label:"2층", imageSrc:"/floor-plans/bongwan-2f.jpg",
        zones:[mkZoneFromClusters("bw2-w","스마트오피스 (서편)","west","BW2-",[
          // C1: 1행 × 5열 = 5석 (상단 단열 — 벽 쪽)
          { id:"c1", x:118, y:136, w:205, h:28,
            rows:1, cols:5 },
          // C2: 2행 × 5열 = 10석 (back-to-back)
          { id:"c2", x:118, y:174, w:205, h:54,
            rows:2, cols:5 },
          // C3: 비대칭 9석 — 앞열 5석 + 뒷열 4석 (뒷열 맨왼쪽 = X 마크 미설치)
          { id:"c3", x:118, y:240, w:205, h:54,
            rows:2, cols:5, rowCols:[5,4], emptyIdx:[5] },
          // C4: 2행 × 5열 = 10석
          { id:"c4", x:118, y:306, w:205, h:54,
            rows:2, cols:5 },
          // C5: 비대칭 9석 — 앞열 5석 + 뒷열 4석
          { id:"c5", x:118, y:372, w:205, h:54,
            rows:2, cols:5, rowCols:[5,4] },
          // C6: 2행 × 5열 = 10석 (하단)
          { id:"c6", x:118, y:438, w:205, h:54,
            rows:2, cols:5 },
        ])],
        elevators:[{id:"ev",x:488,y:302,label:"E/V"}],
        rooms:[
          {id:"r1",x:352,y:130,w:96,h: 97,kind:"meeting",   label:"미팅룸 A",sublabel:"13.5㎡/4.1평"},
          {id:"r2",x:352,y:227,w:96,h:133,kind:"lounge",    label:"미팅룸 B",sublabel:"21.1㎡/6.4평"},
          {id:"r3",x:352,y:360,w:96,h: 93,kind:"meeting",   label:"미팅룸 C",sublabel:"18.8㎡/5.7평"},
          {id:"r4",x:352,y:453,w:96,h: 60,kind:"showroom",  label:"쇼룸",    sublabel:"15.2㎡/4.6평"},
        ]},

      // ─── 본관 3층 ─────────────────────────────────────────────────────────
      // 서편: 대웅바이오 44석, 동편: 대웅바이오 71석
      // 서편 하단 미팅룸 2개 (y:438~568 구간) → 좌석 존 y2=432로 축소
      { id:"bw3", label:"3층", imageSrc:"/floor-plans/bongwan-3f.jpg",
        zones:[mkZone("bw3-w","스마트오피스 (서편)","west",
          { x1:52, y1:152, x2:338, y2:432 }, 44, "BW3W-", 20),
               mkZone("bw3-e","스마트오피스 (동편)","east",BW_E,71,"BW3E-",32)],
        elevators:BW_EV,
        rooms:[
          {id:"w-r1",x: 52,y:436,w: 86,h: 66,kind:"meeting",label:"미팅룸", sublabel:"18.5㎡/5.6평"},
          {id:"w-r2",x: 52,y:502,w: 86,h: 66,kind:"meeting",label:"미팅룸", sublabel:"16.1㎡/4.9평"},
        ]},

      // ─── 본관 4층 ─────────────────────────────────────────────────────────
      // 서편: 스마트오피스 74석 + 포커스룸5개(6석), 동편: 49석 + 포커스룸5개(5석)
      // 서편 상단 미팅룸(3.4평) + 하단 회의실×2·라운지 → 좌석 존 y1=200, y2=408
      { id:"bw4", label:"4층", imageSrc:"/floor-plans/bongwan-4f.jpg",
        zones:[mkZone("bw4-w","스마트오피스 (서편)","west",
          { x1:52, y1:200, x2:338, y2:408 }, 74, "BW4W-", 36),
               mkZone("bw4-e","스마트오피스 (동편)","east",BW_E,49,"BW4E-",22)],
        elevators:BW_EV,
        rooms:[
          {id:"w-t1",x: 52,y:152,w: 88,h: 46,kind:"meeting",   label:"미팅룸",sublabel:"11.2㎡/3.4평"},
          {id:"w-b1",x: 52,y:410,w: 86,h: 56,kind:"conference",label:"회의실",sublabel:"18.4㎡/5.6평"},
          {id:"w-b2",x:138,y:410,w: 86,h: 56,kind:"conference",label:"회의실",sublabel:"18.4㎡/5.6평"},
          {id:"w-b3",x:224,y:410,w:114,h: 56,kind:"lounge",    label:"라운지",sublabel:"35.3㎡/10.7평"},
        ]},

      // ─── 본관 5층 ─────────────────────────────────────────────────────────
      // 서편: 74석 + 포커스룸5개(6석), 동편: 49석 + 포커스룸5개(5석)
      // 층 중앙(엘리베이터 동서 경계) 하단에 소형 미팅룸 2개
      { id:"bw5", label:"5층", imageSrc:"/floor-plans/bongwan-5f.jpg",
        zones:[mkZone("bw5-w","스마트오피스 (서편)","west",BW_W,74,"BW5W-",36),
               mkZone("bw5-e","스마트오피스 (동편)","east",BW_E,49,"BW5E-",22)],
        elevators:BW_EV,
        rooms:[
          {id:"c-r1",x:352,y:384,w: 88,h: 56,kind:"meeting",label:"미팅룸",sublabel:"6.6㎡/2평"},
          {id:"c-r2",x:352,y:440,w: 88,h: 56,kind:"meeting",label:"미팅룸",sublabel:"6.6㎡/2평"},
        ]},

      // ─── 본관 6층 ─────────────────────────────────────────────────────────
      // 서편: 67석 + 포커스룸3개(3석), 동편: 65석 + 포커스룸5개(7석)
      // 서편 좌상단: 라운지(14.2평) + 회의실(5.0평)
      { id:"bw6", label:"6층", imageSrc:"/floor-plans/bongwan-6f.jpg",
        zones:[mkZone("bw6-w","스마트오피스 (서편)","west",
          { x1:52, y1:245, x2:338, y2:568 }, 67, "BW6W-", 30),
               mkZone("bw6-e","스마트오피스 (동편)","east",BW_E,65,"BW6E-",30)],
        elevators:BW_EV,
        rooms:[
          {id:"w-t1",x: 52,y:152,w:168,h: 90,kind:"lounge",   label:"라운지",  sublabel:"13.5㎡/14.2평"},
          {id:"w-t2",x:220,y:152,w:118,h: 90,kind:"conference",label:"회의실",  sublabel:"13.5㎡/5.0평"},
        ]},

      // ─── 본관 7층 ─────────────────────────────────────────────────────────
      // 서편: 스마트오피스 19석 (하단) + 나보타개발팀 28석 (중단, 전석 미설치)
      // 동편: 스마트오피스 57석 + 포커스룸4개(5석)
      { id:"bw7", label:"7층", imageSrc:"/floor-plans/bongwan-7f.jpg",
        zones:[
          mkZone("bw7-w","스마트오피스 (서편)","west",
            { x1:52, y1:390, x2:290, y2:568 }, 19, "BW7W-", 0),
          mkZoneAllEmpty("bw7-nb","나보타개발팀","single",
            { x1:52, y1:210, x2:290, y2:385 }, 28, "BW7N-"),
          mkZone("bw7-e","스마트오피스 (동편)","east",BW_E,57,"BW7E-",26)],
        elevators:BW_EV,
        rooms:[
          {id:"w-t1",x: 52,y:152,w:176,h: 56,kind:"meeting",   label:"미팅룸",sublabel:"13.5㎡/4.1평"},
          {id:"w-t2",x:228,y:152,w:110,h: 56,kind:"conference",label:"회의실",sublabel:"13.5㎡/5.1평"},
          {id:"e-t1",x:528,y:152,w:176,h: 56,kind:"meeting",   label:"미팅룸",sublabel:"13.5㎡/3.7평"},
          {id:"e-t2",x:704,y:152,w:193,h: 56,kind:"lounge",    label:"라운지", sublabel:"13.5㎡/14.1평"},
        ]},

      // ─── 본관 8층 ─────────────────────────────────────────────────────────
      // 서편: 스마트오피스 28석 (중앙 상단), 동편: 컨퍼런스/멀티룸 (업무 좌석 없음)
      { id:"bw8", label:"8층", imageSrc:"/floor-plans/bongwan-8f.jpg",
        zones:[mkZone("bw8-w","스마트오피스 (서편)","west",
          { x1:158, y1:152, x2:338, y2:295 }, 28, "BW8W-", 12)],
        elevators:BW_EV,
        rooms:[
          {id:"w-m1",x: 52,y:152,w:104,h: 56,kind:"meeting",   label:"미팅룸",sublabel:"13.5㎡/7.6평"},
          {id:"w-m2",x: 52,y:152+56+4,w:104,h:56,kind:"meeting",label:"미팅룸-1",sublabel:"13.5㎡/4.1평"},
          {id:"w-m3",x: 52,y:152+56*2+8,w:104,h:56,kind:"meeting",label:"미팅룸-2",sublabel:"13.5㎡/4.1평"},
          {id:"e-c1",x:528,y:152,w:369,h:130,kind:"conference",label:"Conference-1",sublabel:"13.5㎡/17.9평"},
          {id:"e-lg",x:528,y:282,w:246,h:130,kind:"lounge",    label:"라운지",    sublabel:"66.3㎡/20평"},
          {id:"e-mt",x:774,y:282,w:123,h:130,kind:"conference",label:"멀티룸",    sublabel:"13.5㎡/13.8평"},
          {id:"e-c2",x:528,y:412,w:369,h:130,kind:"conference",label:"Conference-2",sublabel:"13.5㎡/19.5평"},
        ]},

      // ─── 본관 9층 ─────────────────────────────────────────────────────────
      // 서편: 35석 + 포커스룸1개(2석) = 37석, 동편: 80석+스탠딩5석+포커스룸2개(3석) = 85석
      { id:"bw9", label:"9층", imageSrc:"/floor-plans/bongwan-9f.jpg",
        zones:[mkZone("bw9-w","스마트오피스 (서편)","west",BW_W,37,"BW9W-",18),
               mkZone("bw9-e","스마트오피스 (동편)","east",BW_E,85,"BW9E-",40)],
        elevators:BW_EV,
        rooms:[
          {id:"w-l1",x: 52,y:152,w:220,h: 90,kind:"lounge",label:"라운지",sublabel:"13.5㎡/13.8평"},
          {id:"e-m1",x:528,y:152,w: 92,h: 56,kind:"meeting",label:"미팅룸",sublabel:"13.5㎡/2.4평"},
          {id:"e-m2",x:620,y:152,w: 92,h: 56,kind:"meeting",label:"미팅룸",sublabel:"13.5㎡/2.2평"},
        ]},
    ],
  },
  {
    id: "ns", label: "신관",
    floors: [
      { id:"ns2", label:"2층", imageSrc:"/floor-plans/singwan-2f.jpg",
        zones:[mkZone("ns2-w","스마트오피스 (서편)","west",SN2_W,31,"NS2W-",14),
               mkZone("ns2-e","스마트오피스 (동편)","east",SN2_E,48,"NS2E-",22)],
        elevators:[{id:"ev",x:500,y:296,label:"E/V"}] },
      { id:"ns3", label:"3층", imageSrc:"/floor-plans/singwan-3f.jpg",
        zones:[mkZone("ns3-w","스마트오피스 (서편)","west",SN3_W,40,"NS3W-",18),
               mkZone("ns3-e","스마트오피스 (동편)","east",SN3_E,60,"NS3E-",28)],
        elevators:[{id:"ev",x:300,y:258,label:"E/V"}] },
      { id:"ns4", label:"4층", imageSrc:"/floor-plans/singwan-4f.jpg",
        zones:[mkZone("ns4-w","스마트오피스 (서편)","west",SN4_W,40,"NS4W-",18),
               mkZone("ns4-e","스마트오피스 (동편)","east",SN4_E,51,"NS4E-",24)],
        elevators:[{id:"ev",x:500,y:302,label:"E/V"}] },
      { id:"ns5", label:"5층", imageSrc:"/floor-plans/singwan-5f.jpg",
        zones:[mkZone("ns5-w","스마트오피스 (서편)","west",SN5_W,35,"NS5W-",16),
               mkZone("ns5-e","스마트오피스 (동편)","east",SN5_E,48,"NS5E-",22)],
        elevators:[{id:"ev",x:494,y:298,label:"E/V"}] },
    ],
  },
  {
    id: "sb", label: "S빌딩",
    floors: [
      { id:"sb3", label:"3층", imageSrc:"/floor-plans/sbldg-3f.jpg",
        zones:[mkZone("sb3-a","Smart Office 1","west",SB3_A,15,"SB3A-",6),
               mkZone("sb3-b","Smart Office 2","east",SB3_B,32,"SB3B-",16)],
        elevators:SB_EV3 },
      { id:"sb4", label:"4층", imageSrc:"/floor-plans/sbldg-4f.jpg",
        zones:[mkZone("sb4-w","Casual Work Space","west",SB4_W,21,"SB4W-",10),
               mkZone("sb4-e","Open Office","east",SB4_E,40,"SB4E-",20)],
        elevators:SB_EV4 },
      { id:"sb5", label:"5층", imageSrc:"/floor-plans/sbldg-5f.jpg",
        zones:[mkZone("sb5-so","스마트오피스","single",SB5,36,"SB5-",18)],
        elevators:SB_EV4 },
    ],
  },
];

function getAllSeats() {
  return BUILDINGS.flatMap(b => b.floors.flatMap(f => f.zones.flatMap(z => z.seats)));
}

// Get seat grid position (for navigation guidance)
function getSeatGridPos(seat: SeatDef, zone: ZoneDef) {
  const idx = zone.seats.findIndex(s => s.id === seat.id);
  if (idx < 0) return null;
  const row = Math.floor(idx / zone.cols) + 1;
  const col = idx % zone.cols + 1;
  return { row, col, rowLabel: String(row), colLabel: String.fromCharCode(64 + col) };
}

// =============================================================================
// MONITOR ICON (SVG, used in floor overview map)
// =============================================================================
function MonitorIcon({
  x, y, type, selected, faded, isRepairing, showLabel, seatId,
  rotation, editMode, onClick, onDragStart,
}: {
  x: number; y: number; type: MonitorType;
  selected: boolean; faded: boolean; isRepairing: boolean;
  showLabel: boolean; seatId: string;
  rotation?: number;
  editMode?: boolean;
  onClick: () => void;
  onDragStart?: (e: React.MouseEvent) => void;
}) {
  const isLarge = type === "large";
  const isEmpty = type === "empty";
  const sw = isLarge ? 18 : 13;
  const sh = 11; const standH = 4; const baseW = isLarge ? 10 : 8;
  const numPart = seatId.split("-").pop() ?? seatId;
  const rot = rotation ?? 0;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (editMode && onDragStart) {
      e.stopPropagation();
      onDragStart(e);
    }
  };

  if (isEmpty) {
    return (
      <g transform={`translate(${x},${y}) rotate(${rot})`}
        style={{ cursor: editMode ? "grab" : "pointer" }}
        onClick={onClick} onMouseDown={handleMouseDown}>
        <rect x={-sw/2} y={-sh/2-standH} width={sw} height={sh} rx={1.5}
          fill="none" stroke="rgba(239,68,68,0.65)" strokeWidth={1.2} strokeDasharray="3 2"/>
        <line x1={-sw/2+2} y1={-sh/2-standH+2} x2={sw/2-2} y2={-sh/2-standH+sh-2}
          stroke="rgba(239,68,68,0.6)" strokeWidth={0.9}/>
        <line x1={sw/2-2} y1={-sh/2-standH+2} x2={-sw/2+2} y2={-sh/2-standH+sh-2}
          stroke="rgba(239,68,68,0.6)" strokeWidth={0.9}/>
        <line x1={0} y1={sh/2-standH} x2={0} y2={sh/2}
          stroke="rgba(239,68,68,0.5)" strokeWidth={1.2} strokeDasharray="2 1"/>
        <line x1={-baseW/2} y1={sh/2} x2={baseW/2} y2={sh/2}
          stroke="rgba(239,68,68,0.5)" strokeWidth={1.5} strokeLinecap="round"/>
        {selected && <circle cx={0} cy={0} r={sw/2+4} fill="none" stroke="#F59E0B" strokeWidth={2} strokeDasharray="3 2" opacity={0.8}/>}
        {editMode && selected && (
          <rect x={-sw/2-3} y={-sh/2-standH-3} width={sw+6} height={sh+standH+6} rx={3}
            fill="none" stroke="#F59E0B" strokeWidth={1.5} strokeDasharray="4 2"/>
        )}
        {showLabel && (
          <text x={0} y={sh/2+standH+6} textAnchor="middle" fontSize={5}
            fill="rgba(255,150,150,0.9)" style={{ pointerEvents:"none" }}>{numPart}</text>
        )}
      </g>
    );
  }

  const screenColor = selected ? "#F59E0B" : isLarge ? "rgba(167,139,250,0.92)" : "rgba(96,165,250,0.92)";
  const borderColor = isRepairing ? "#ef4444" : selected ? "#D97706"
    : isLarge ? "rgba(139,92,246,0.9)" : "rgba(37,99,235,0.9)";
  const opacity = faded ? 0.15 : 1;

  return (
    <g transform={`translate(${x},${y}) rotate(${rot})`} opacity={opacity}
      style={{ cursor: editMode ? "grab" : faded ? "default" : "pointer",
               pointerEvents: faded ? "none" : "all" }}
      onClick={!faded ? onClick : undefined}
      onMouseDown={!faded ? handleMouseDown : undefined}>
      {isRepairing && !faded && (
        <>
          <circle cx={0} cy={0} r={sw/2+6} fill="none" stroke="rgba(239,68,68,0.5)" strokeWidth={2}
            style={{ animation:"ping 1.2s cubic-bezier(0,0,0.2,1) infinite" }}/>
          <circle cx={0} cy={0} r={sw/2+4} fill="none" stroke="rgba(239,68,68,0.85)" strokeWidth={1.8}/>
        </>
      )}
      {editMode && selected && (
        <rect x={-sw/2-3} y={-sh/2-standH-3} width={sw+6} height={sh+standH+6} rx={3}
          fill="none" stroke="#F59E0B" strokeWidth={1.5} strokeDasharray="4 2"/>
      )}
      <rect x={-sw/2} y={-sh/2-standH} width={sw} height={sh} rx={1.5}
        fill={screenColor} stroke={borderColor} strokeWidth={isRepairing||selected ? 1.8 : 1}/>
      {!faded && <rect x={-sw/2+1.5} y={-sh/2-standH+1.5} width={sw*0.35} height={1.8} rx={0.8} fill="rgba(255,255,255,0.5)"/>}
      <line x1={0} y1={sh/2-standH} x2={0} y2={sh/2} stroke={borderColor} strokeWidth={1.2}/>
      <line x1={-baseW/2} y1={sh/2} x2={baseW/2} y2={sh/2} stroke={borderColor} strokeWidth={1.5} strokeLinecap="round"/>
      {selected && !isRepairing && !editMode && (
        <circle cx={0} cy={0} r={sw/2+4} fill="none" stroke="#F59E0B" strokeWidth={2} strokeDasharray="3 2" opacity={0.8}/>
      )}
      {isRepairing && !faded && (
        <g transform={`translate(${sw/2+1},${-sh/2-standH-2})`}>
          <circle cx={0} cy={0} r={4} fill="#ef4444" stroke="#fff" strokeWidth={0.8}/>
          <text x={0} y={1.2} textAnchor="middle" dominantBaseline="middle" fontSize={4.5} fill="white" fontWeight="900">!</text>
        </g>
      )}
      {showLabel && !faded && (
        <text x={0} y={sh/2+standH+6} textAnchor="middle" fontSize={5}
          fill={isRepairing ? "rgba(252,165,165,0.95)" : isLarge ? "rgba(221,214,254,0.95)" : "rgba(191,219,254,0.95)"}
          style={{ pointerEvents:"none" }}>{numPart}</text>
      )}
    </g>
  );
}

function ElevatorMarker({ ev }: { ev: ElevatorDef }) {
  return (
    <g transform={`translate(${ev.x},${ev.y})`} style={{ pointerEvents:"none" }}>
      <rect x={-22} y={-13} width={44} height={26} rx={5}
        fill="rgba(15,23,42,0.82)" stroke="rgba(251,191,36,0.8)" strokeWidth={1.2}/>
      <text x={-14} y={4} fontSize={9} fill="#fbbf24" fontWeight="700">▲▼</text>
      <text x={2} y={4} fontSize={7} fill="#fef9c3" fontWeight="600" textAnchor="start" dominantBaseline="middle">
        {ev.label.replace(" E/V","").replace("E/V","")}
      </text>
    </g>
  );
}

function DirectionBadge({ zone }: { zone: ZoneDef }) {
  if (zone.dir === "single") return null;
  const isWest = zone.dir === "west";
  const bgColor = isWest ? "rgba(59,130,246,0.18)" : "rgba(139,92,246,0.18)";
  const txtColor = isWest ? "#93C5FD" : "#C4B5FD";
  const arrow = isWest ? "◀ 삼성역" : "탄천 ▶";
  const cx = (zone.x1+zone.x2)/2;
  const cy = zone.y1+12;
  const textLen = arrow.length*5.5;
  return (
    <g style={{ pointerEvents:"none" }}>
      <rect x={cx-textLen/2-4} y={cy-8} width={textLen+8} height={14} rx={3} fill={bgColor}/>
      <text x={cx} y={cy+1} textAnchor="middle" fontSize={8.5} fill={txtColor} fontWeight={700}>{arrow}</text>
    </g>
  );
}

// =============================================================================
// FLOOR OVERVIEW MAP (SVG, with zone-zoom buttons)
// =============================================================================
const FULL_VB = { x:0, y:0, w:960, h:600 };

function computeZoneViewBox(z: ZoneDef) {
  const PAD = 50;
  const zW = z.x2-z.x1+PAD*2, zH = z.y2-z.y1+PAD*2;
  const containerAR = 960/600;
  let vbW, vbH;
  if (zW/zH > containerAR) { vbW=zW; vbH=zW/containerAR; }
  else { vbH=zH; vbW=zH*containerAR; }
  const cx=(z.x1+z.x2)/2, cy=(z.y1+z.y2)/2;
  return {
    x: Math.max(0, Math.min(960-vbW, cx-vbW/2)),
    y: Math.max(0, Math.min(600-vbH, cy-vbH/2)),
    w: vbW, h: vbH,
  };
}

function FloorMap({
  floor, selectedSeatId, filterMode, searchQuery, seatStates,
  focusZoneId, editMode, layout, onSelect, onOpenZoneDetail,
  onLayoutChange, onAddSeat, onDeleteSeat,
}: {
  floor: FloorDef; selectedSeatId: string | null;
  filterMode: "all"|"large"|"standard"|"empty"|"repair";
  searchQuery: string; seatStates: Record<string,SeatState>;
  focusZoneId: string | null;
  editMode: boolean;
  layout: LayoutStore;
  onSelect: (seat: SeatDef, zone: ZoneDef | null) => void;
  onOpenZoneDetail: (zoneId: string) => void;
  onLayoutChange: (seatId: string, dx: number, dy: number, rot?: number) => void;
  onAddSeat: (x: number, y: number) => void;
  onDeleteSeat: (seatId: string) => void;
}) {
  const maskId = `mask-${floor.id}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const [vb, setVb] = useState(FULL_VB);
  const isZoomed = vb.w < 900;
  const zoomFactor = Math.round(960 / vb.w * 10) / 10;

  // 드래그 상태
  const [drag, setDrag] = useState<{
    seatId: string; startSvgX: number; startSvgY: number;
    origX: number; origY: number;
  } | null>(null);

  // 화면 좌표 → SVG viewBox 좌표 변환
  const toSVGCoord = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const inv = svg.getScreenCTM()?.inverse();
    if (!inv) return { x: 0, y: 0 };
    const p = pt.matrixTransform(inv);
    return { x: p.x, y: p.y };
  }, []);

  // 드래그 mousemove / mouseup
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => {
      const { x, y } = toSVGCoord(e.clientX, e.clientY);
      onLayoutChange(drag.seatId, x - drag.startSvgX, y - drag.startSvgY);
    };
    const onUp = () => setDrag(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, toSVGCoord, onLayoutChange]);

  // 드래그 시작 핸들러
  const startDrag = useCallback((seatId: string, origX: number, origY: number,
      e: React.MouseEvent) => {
    e.preventDefault();
    const { x, y } = toSVGCoord(e.clientX, e.clientY);
    setDrag({ seatId, startSvgX: x, startSvgY: y, origX, origY });
  }, [toSVGCoord]);

  // Auto-zoom when focusZoneId changes
  useEffect(() => {
    if (focusZoneId) {
      const z = floor.zones.find(z => z.id === focusZoneId);
      if (z) setVb(computeZoneViewBox(z));
    } else {
      setVb(FULL_VB);
    }
  }, [focusZoneId, floor]);

  // Reset zoom when floor changes
  useEffect(() => { setVb(FULL_VB); }, [floor.id]);

  const currentZone = isZoomed ? floor.zones.find(z => {
    const zvb = computeZoneViewBox(z);
    return Math.abs(zvb.x-vb.x)<5 && Math.abs(zvb.y-vb.y)<5;
  }) : null;

  const getSeatXY = (seat: SeatDef) => {
    const ov = layout.pos[seat.id];
    return ov ? { x: ov.x, y: ov.y } : { x: seat.x, y: seat.y };
  };
  const getSeatRot = (seatId: string) => layout.pos[seatId]?.rot ?? 0;

  const getEffectiveType = (seat: SeatDef): MonitorType =>
    seatStates[seat.id]?.monitorType ?? seat.monitor;

  const isVisible = (seat: SeatDef): boolean => {
    if (editMode) return true;
    if (searchQuery.trim()) return seat.id.toLowerCase().includes(searchQuery.toLowerCase());
    if (filterMode === "all") return true;
    if (filterMode === "repair") return !!(seatStates[seat.id]?.isRepairing);
    return getEffectiveType(seat) === filterMode;
  };

  const showLabels = isZoomed || editMode;

  // 편집 모드에서 SVG 클릭 → 빈 공간 클릭하면 새 아이콘 추가 (addMode)
  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!editMode || drag) return;
    if ((e.target as SVGElement).tagName !== "svg" &&
        !(e.target as SVGElement).closest?.("rect[data-floor-bg]")) return;
  };

  const floorExtraSeats = layout.extra.filter(s => s.floorId === floor.id);

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-gray-200 shadow-inner bg-gray-900"
      style={{ aspectRatio:"960/600" }}>
      <style>{`
        @keyframes ping { 75%,100%{transform:scale(2);opacity:0;} }
      `}</style>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={floor.imageSrc} alt={`${floor.label} 도면`}
        className="absolute inset-0 w-full h-full object-cover select-none" draggable={false}/>

      {floor.noImage && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 bg-amber-500/90 text-white text-xs font-semibold px-3 py-1 rounded-full shadow">
          ⚠ 7층 전용 도면 미포함 — 건물 구조 참고용
        </div>
      )}

      {/* Zoom controls overlay */}
      {isZoomed && !editMode && (
        <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5">
          <button onClick={() => setVb(FULL_VB)}
            className="flex items-center gap-1 bg-slate-900/90 hover:bg-slate-700 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-white/20 shadow transition-colors">
            ← 전체 도면
          </button>
          <span className="bg-blue-600/80 text-white text-[10px] font-bold px-2 py-1 rounded-lg">
            ×{zoomFactor}
          </span>
          {currentZone && (
            <span className="bg-slate-800/80 text-white text-[10px] px-2 py-1 rounded-lg flex items-center gap-1">
              📍 {currentZone.label}
            </span>
          )}
        </div>
      )}

      <svg ref={svgRef} className="absolute inset-0 w-full h-full"
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ cursor: editMode ? "crosshair" : "default" }}
        onClick={handleSvgClick}>
        <defs>
          <mask id={maskId}>
            <rect width="960" height="600" fill="white"/>
            {floor.zones.map(z => (
              <rect key={z.id} x={z.x1-3} y={z.y1-3} width={z.x2-z.x1+6} height={z.y2-z.y1+6} rx={6} fill="black"/>
            ))}
            {floor.elevators.map(ev => (
              <ellipse key={ev.id} cx={ev.x} cy={ev.y} rx={52} ry={38} fill="black"/>
            ))}
          </mask>
        </defs>

        <rect width="960" height="600" fill="rgba(8,14,38,0.68)" mask={`url(#${maskId})`}/>

        {floor.zones.map(z => {
          const isWest = z.dir === "west";
          const borderColor = isWest ? "rgba(96,165,250,0.55)" : "rgba(167,139,250,0.55)";
          const fillColor = isWest ? "rgba(59,130,246,0.04)" : "rgba(139,92,246,0.04)";
          const labelColor = isWest ? "rgba(147,197,253,0.9)" : "rgba(196,181,253,0.9)";

          return (
            <g key={z.id}>
              <rect x={z.x1} y={z.y1} width={z.x2-z.x1} height={z.y2-z.y1}
                fill={fillColor} stroke={borderColor} strokeWidth={2} rx={5}
                style={{ pointerEvents:"none" }}/>

              {/* Zone label */}
              <text x={z.x1+8} y={z.y1+16} fontSize={9.5} fill={labelColor} fontWeight={700}
                style={{ pointerEvents:"none" }}>
                {z.label}  ({z.seats.length}석)
              </text>

              {/* 격자/확대 버튼 — 일반 모드만 */}
              {!editMode && !isZoomed && (
                <>
                  <g style={{ cursor:"pointer" }} onClick={() => onOpenZoneDetail(z.id)}>
                    <rect x={z.x2-52} y={z.y1+4} width={48} height={14} rx={3}
                      fill="rgba(15,23,42,0.75)" stroke={borderColor} strokeWidth={0.8}/>
                    <text x={z.x2-28} y={z.y1+13} textAnchor="middle" fontSize={7}
                      fill="rgba(255,255,255,0.85)" fontWeight={600}>📋 격자 보기</text>
                  </g>
                  <g style={{ cursor:"zoom-in" }} onClick={() => setVb(computeZoneViewBox(z))}>
                    <rect x={z.x2-104} y={z.y1+4} width={48} height={14} rx={3}
                      fill="rgba(15,23,42,0.75)" stroke={borderColor} strokeWidth={0.8}/>
                    <text x={z.x2-80} y={z.y1+13} textAnchor="middle" fontSize={7}
                      fill="rgba(255,255,255,0.85)" fontWeight={600}>🔍 도면 확대</text>
                  </g>
                </>
              )}
              {!editMode && isZoomed && (
                <g style={{ cursor:"pointer" }} onClick={() => onOpenZoneDetail(z.id)}>
                  <rect x={z.x2-52} y={z.y1+4} width={48} height={14} rx={3}
                    fill="rgba(59,130,246,0.85)" stroke="rgba(147,197,253,0.5)" strokeWidth={0.8}/>
                  <text x={z.x2-28} y={z.y1+13} textAnchor="middle" fontSize={7}
                    fill="white" fontWeight={600}>📋 격자 보기</text>
                </g>
              )}

              <DirectionBadge zone={z}/>
            </g>
          );
        })}

        {/* ── 방(미팅룸·라운지 등) 오버레이 ─────────────────────────────── */}
        {(floor.rooms ?? []).map(room => {
          const fillColor =
            room.kind === "meeting"    ? "rgba(34,197,94,0.18)"
            : room.kind === "lounge"   ? "rgba(59,130,246,0.16)"
            : room.kind === "conference" ? "rgba(168,85,247,0.16)"
            : room.kind === "showroom" ? "rgba(234,179,8,0.16)"
            : "rgba(148,163,184,0.14)";
          const borderColor =
            room.kind === "meeting"    ? "rgba(34,197,94,0.65)"
            : room.kind === "lounge"   ? "rgba(96,165,250,0.65)"
            : room.kind === "conference" ? "rgba(192,132,252,0.65)"
            : room.kind === "showroom" ? "rgba(250,204,21,0.65)"
            : "rgba(148,163,184,0.55)";
          const textColor =
            room.kind === "meeting"    ? "#86efac"
            : room.kind === "lounge"   ? "#93c5fd"
            : room.kind === "conference" ? "#d8b4fe"
            : room.kind === "showroom" ? "#fde68a"
            : "#94a3b8";
          const midY = room.y + room.h / 2;
          return (
            <g key={room.id} style={{ pointerEvents:"none" }}>
              <rect x={room.x} y={room.y} width={room.w} height={room.h} rx={4}
                fill={fillColor} stroke={borderColor} strokeWidth={1.2}/>
              <text x={room.x + room.w/2} y={room.sublabel ? midY - 5 : midY + 3}
                textAnchor="middle" fontSize={8} fill={textColor} fontWeight={700}
                style={{ pointerEvents:"none" }}>{room.label}</text>
              {room.sublabel && (
                <text x={room.x + room.w/2} y={midY + 7}
                  textAnchor="middle" fontSize={6.5} fill={textColor} opacity={0.75}
                  style={{ pointerEvents:"none" }}>{room.sublabel}</text>
              )}
            </g>
          );
        })}

        {/* ── 책상 클러스터 테이블 ─────────────────────────────────────── */}
        {floor.zones.flatMap(zone => (zone.desks ?? []).map(c => {
          const isWest = zone.dir === "west";
          const tableFill = isWest ? "rgba(96,165,250,0.10)" : "rgba(167,139,250,0.10)";
          const tableStroke = isWest ? "rgba(147,197,253,0.55)" : "rgba(196,181,253,0.55)";
          return (
            <g key={`desk-${c.id}`} style={{ pointerEvents:"none" }}>
              <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={3}
                fill={tableFill} stroke={tableStroke} strokeWidth={1}/>
              {c.rows >= 2 && (
                <line x1={c.x+4} y1={c.y+c.h/2} x2={c.x+c.w-4} y2={c.y+c.h/2}
                  stroke={tableStroke} strokeWidth={0.6} strokeDasharray="3 2" opacity={0.6}/>
              )}
            </g>
          );
        }))}

        {floor.elevators.map(ev => <ElevatorMarker key={ev.id} ev={ev}/>)}

        {/* ── 기본 좌석 아이콘 ────────────────────────────────────────── */}
        {floor.zones.flatMap(zone =>
          zone.seats.map(seat => {
            const visible = isVisible(seat);
            const effectiveType = getEffectiveType(seat);
            const repairing = !!(seatStates[seat.id]?.isRepairing);
            const { x, y } = getSeatXY(seat);
            const rot = getSeatRot(seat.id);
            return (
              <MonitorIcon key={seat.id}
                x={x} y={y} type={effectiveType} rotation={rot}
                selected={seat.id === selectedSeatId}
                faded={!visible} isRepairing={repairing}
                showLabel={showLabels && visible}
                seatId={seat.id}
                editMode={editMode}
                onClick={() => !editMode && onSelect(seat, zone)}
                onDragStart={(e) => startDrag(seat.id, x, y, e)}
              />
            );
          })
        )}

        {/* ── 추가 생성된 아이콘 ─────────────────────────────────────── */}
        {floorExtraSeats.map(es => (
          <MonitorIcon key={es.id}
            x={es.x} y={es.y} type={es.type} rotation={es.rot}
            selected={es.id === selectedSeatId}
            faded={false} isRepairing={false}
            showLabel={showLabels}
            seatId={es.id}
            editMode={editMode}
            onClick={() => !editMode && onSelect(
              { id: es.id, monitor: es.type, x: es.x, y: es.y },
              null
            )}
            onDragStart={(e) => startDrag(es.id, es.x, es.y, e)}
          />
        ))}

        {/* ── 편집 모드: 선택된 아이콘 위에 회전·삭제 버튼 ───────────── */}
        {editMode && selectedSeatId && (() => {
          // 선택된 아이콘의 현재 위치 찾기
          let sx = 0, sy = 0;
          const regSeat = floor.zones.flatMap(z => z.seats).find(s => s.id === selectedSeatId);
          const extSeat = floorExtraSeats.find(s => s.id === selectedSeatId);
          if (regSeat) { const p = getSeatXY(regSeat); sx = p.x; sy = p.y; }
          else if (extSeat) { sx = extSeat.x; sy = extSeat.y; }
          else return null;
          const rot = getSeatRot(selectedSeatId);
          return (
            <g>
              {/* 회전 버튼 ↻ */}
              <g style={{ cursor:"pointer" }}
                onClick={(e) => { e.stopPropagation(); onLayoutChange(selectedSeatId, 0, 0, (rot + 90) % 360); }}>
                <circle cx={sx+18} cy={sy-18} r={9} fill="#3B82F6" stroke="white" strokeWidth={1.2}/>
                <text x={sx+18} y={sy-14.5} textAnchor="middle" fontSize={11} fill="white" fontWeight="900"
                  style={{ pointerEvents:"none" }}>↻</text>
              </g>
              {/* 삭제 버튼 × */}
              <g style={{ cursor:"pointer" }}
                onClick={(e) => { e.stopPropagation(); onDeleteSeat(selectedSeatId); }}>
                <circle cx={sx-18} cy={sy-18} r={9} fill="#EF4444" stroke="white" strokeWidth={1.2}/>
                <text x={sx-18} y={sy-14.5} textAnchor="middle" fontSize={11} fill="white" fontWeight="900"
                  style={{ pointerEvents:"none" }}>×</text>
              </g>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

// =============================================================================
// ZONE DETAIL GRID — 격자형 구역 상세뷰 (핵심 네비게이션 기능)
// =============================================================================
function ZoneDetailGrid({
  zone, floor, building, seatStates, searchQuery, filterMode, selectedSeatId,
  onSelect, onBack,
}: {
  zone: ZoneDef; floor: FloorDef; building: BuildingDef;
  seatStates: Record<string,SeatState>; searchQuery: string;
  filterMode: "all"|"large"|"standard"|"empty"|"repair";
  selectedSeatId: string | null;
  onSelect: (seat: SeatDef, zone: ZoneDef) => void;
  onBack: () => void;
}) {
  const { rows, cols } = zone;

  // Per-seat stats
  const typeCount = useMemo(() => {
    let large=0, std=0, empty=0, repair=0;
    zone.seats.forEach(s => {
      const t = seatStates[s.id]?.monitorType ?? s.monitor;
      if (t==="large") large++; else if (t==="standard") std++; else empty++;
      if (seatStates[s.id]?.isRepairing) repair++;
    });
    return { large, std, empty, repair };
  }, [zone, seatStates]);

  const isFiltered = (seat: SeatDef) => {
    if (searchQuery.trim()) return !seat.id.toLowerCase().includes(searchQuery.toLowerCase());
    if (filterMode === "all") return false;
    if (filterMode === "repair") return !(seatStates[seat.id]?.isRepairing);
    const t = seatStates[seat.id]?.monitorType ?? seat.monitor;
    return t !== filterMode;
  };

  // Compute cell sizes
  const containerRef = useRef<HTMLDivElement>(null);
  const [cellW, setCellW] = useState(80);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const available = el.clientWidth - 48 - 16; // minus row-label col and padding
    const w = Math.min(92, Math.max(64, Math.floor(available / cols)));
    setCellW(w);
  }, [cols]);
  const cellH = Math.round(cellW * 0.72);

  // Direction label
  const dirLabel = zone.dir === "west" ? { left: "창가 →", right: "← 복도", top: "엘리베이터 방향 ↑" }
    : zone.dir === "east" ? { left: "복도 →", right: "← 창가", top: "엘리베이터 방향 ↑" }
    : { left: "", right: "", top: "" };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white overflow-hidden">
      {/* Header */}
      <div className="flex-none flex items-center gap-3 px-4 py-3 bg-slate-800 border-b border-slate-700">
        <button onClick={onBack}
          className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors">
          ← 전체 도면
        </button>
        <div className="w-px h-5 bg-slate-600"/>
        <div>
          <div className="text-xs text-slate-400">{building.label} · {floor.label}</div>
          <div className="font-bold text-sm">{zone.label}</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] bg-violet-900/60 text-violet-300 border border-violet-700/50 px-2 py-0.5 rounded-full">34" {typeCount.large}</span>
          <span className="text-[10px] bg-blue-900/60 text-blue-300 border border-blue-700/50 px-2 py-0.5 rounded-full">표준 {typeCount.std}</span>
          {typeCount.empty>0 && <span className="text-[10px] bg-amber-900/60 text-amber-300 border border-amber-700/50 px-2 py-0.5 rounded-full">빈자리 {typeCount.empty}</span>}
          {typeCount.repair>0 && <span className="text-[10px] bg-red-900/60 text-red-300 border border-red-700/50 px-2 py-0.5 rounded-full animate-pulse">⚠ 수리 {typeCount.repair}</span>}
          <span className="text-xs text-slate-400">총 {zone.seats.length}석</span>
        </div>
      </div>

      {/* Navigation hint bar */}
      <div className="flex-none flex items-center justify-between px-4 py-1.5 bg-slate-800/50 text-[10px] text-slate-500 border-b border-slate-700/50">
        <span>📌 자리를 클릭하면 상세 정보 · 수리 등록 가능</span>
        <span className="flex items-center gap-3">
          {dirLabel.left && <><span className="text-slate-600">{dirLabel.left}</span><span className="text-slate-600">{dirLabel.right}</span></>}
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-2 bg-violet-500 rounded-sm"/>34인치
            <span className="inline-block w-3 h-2 bg-blue-500 rounded-sm ml-1"/>표준형
            <span className="inline-block w-3 h-2 border border-red-500 border-dashed rounded-sm ml-1"/>빈자리
          </span>
        </span>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto p-4" ref={containerRef}>
        <div className="inline-block min-w-full">
          {/* Column headers */}
          <div className="flex mb-1" style={{ paddingLeft: 44 }}>
            {Array.from({ length: cols }, (_, c) => (
              <div key={c}
                className="text-center text-xs text-slate-500 font-mono font-semibold select-none"
                style={{ width: cellW, flexShrink: 0 }}>
                열 {String.fromCharCode(65+c)}
              </div>
            ))}
          </div>

          {/* Rows */}
          {Array.from({ length: rows }, (_, r) => (
            <div key={r} className="flex items-center mb-1.5">
              {/* Row number */}
              <div className="text-xs text-slate-500 font-mono font-semibold text-right pr-2 select-none"
                style={{ width: 40, flexShrink:0 }}>
                {r+1}행
              </div>

              {/* Seats */}
              {Array.from({ length: cols }, (_, c) => {
                const idx = r * cols + c;
                const seat = zone.seats[idx];

                if (!seat) {
                  return <div key={c} style={{ width: cellW, flexShrink:0 }}/>;
                }

                const st = seatStates[seat.id];
                const type = st?.monitorType ?? seat.monitor;
                const isRepairing = !!st?.isRepairing;
                const isSelected = seat.id === selectedSeatId;
                const faded = isFiltered(seat);
                const histCount = st?.history?.length ?? 0;

                const bgClass = type === "large"
                  ? "bg-violet-950 border-violet-600 hover:bg-violet-900"
                  : type === "empty"
                  ? "bg-slate-900 border-red-600 border-dashed hover:bg-slate-800"
                  : "bg-blue-950 border-blue-600 hover:bg-blue-900";

                return (
                  <div key={c}
                    onClick={() => !faded && onSelect(seat, zone)}
                    style={{ width: cellW-6, height: cellH, flexShrink:0, marginRight:6 }}
                    className={`relative rounded-xl border-2 flex flex-col items-center justify-center transition-all select-none
                      ${faded ? "opacity-15 cursor-default" : "cursor-pointer"}
                      ${isSelected ? "ring-2 ring-amber-400 border-amber-400" : bgClass}
                      ${isRepairing && !faded ? "border-red-500 animate-pulse ring-1 ring-red-500/50" : ""}
                    `}>

                    {/* Seat ID */}
                    <div className={`font-mono text-[10px] font-bold leading-tight text-center ${
                      type==="large" ? "text-violet-200"
                      : type==="empty" ? "text-red-400"
                      : "text-blue-200"
                    }`}>
                      {seat.id}
                    </div>

                    {/* Type label */}
                    <div className={`text-[8px] mt-0.5 font-medium ${
                      type==="large" ? "text-violet-400"
                      : type==="empty" ? "text-red-500"
                      : "text-blue-400"
                    }`}>
                      {type==="large" ? '34"' : type==="empty" ? "빈자리" : '24/27"'}
                    </div>

                    {/* Repair badge */}
                    {isRepairing && !faded && (
                      <div className="text-[8px] text-red-400 font-bold leading-tight">⚠ 수리 중</div>
                    )}

                    {/* History dot */}
                    {histCount > 0 && !faded && (
                      <div className="absolute top-0.5 right-1 text-[7px] text-slate-500">
                        {histCount}건
                      </div>
                    )}

                    {/* Repair indicator top-left */}
                    {isRepairing && !faded && (
                      <div className="absolute top-0.5 left-1 w-1.5 h-1.5 rounded-full bg-red-400"/>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Bottom legend */}
          <div className="mt-4 text-[10px] text-slate-600 border-t border-slate-800 pt-2 flex items-center gap-4">
            <span>📍 {building.label} {floor.label} · {zone.label}</span>
            <span>행 = 창가↔복도 방향 · 열 A→Z = 좌→우 방향 (참고용 배치도)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SEAT DETAIL MODAL
// =============================================================================
const ENTRY_TYPE_LABELS: Record<HistoryEntryType,string> = {
  install:"설치", repair:"수리", replace:"교체", note:"메모",
};
const ENTRY_TYPE_COLORS: Record<HistoryEntryType,string> = {
  install:"bg-green-100 text-green-700 border-green-200",
  repair: "bg-red-100 text-red-700 border-red-200",
  replace:"bg-amber-100 text-amber-700 border-amber-200",
  note:   "bg-gray-100 text-gray-600 border-gray-200",
};

function SeatDetailModal({
  seat, zone, floor, building, seatState,
  onClose, onUpdateType, onToggleRepair, onAddHistory, onDeleteHistory, onSubmitRequest,
}: {
  seat: SeatDef; zone: ZoneDef; floor: FloorDef; building: BuildingDef;
  seatState: SeatState; onClose: () => void;
  onUpdateType: (t: MonitorType) => void; onToggleRepair: () => void;
  onAddHistory: (e: Omit<HistoryEntry,"id">) => void;
  onDeleteHistory: (id: string) => void;
  onSubmitRequest: (type: "repair" | "replace", note: string) => Promise<void>;
}) {
  const [newContent, setNewContent] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [newType, setNewType] = useState<HistoryEntryType>("note");
  const [deleteConfirm, setDeleteConfirm] = useState<string|null>(null);
  // 교체·수리 요청 폼 상태
  const [reqType, setReqType] = useState<"repair"|"replace">("repair");
  const [reqNote, setReqNote] = useState("");
  const [reqSubmitting, setReqSubmitting] = useState(false);
  const [reqDone, setReqDone] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key==="Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const handleSubmit = () => {
    if (!newContent.trim()) return;
    onAddHistory({ date: new Date().toISOString(), entryType: newType, content: newContent.trim(), author: newAuthor.trim() || "관리자" });
    setNewContent(""); setNewAuthor("");
  };

  const gridPos = getSeatGridPos(seat, zone);
  const curType = seatState.monitorType;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:"rgba(0,0,0,0.55)" }}
      onClick={e => { if (e.target===e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className={`px-6 py-4 flex items-start justify-between text-white ${
          curType==="large" ? "bg-violet-700" : curType==="empty" ? "bg-red-600" : "bg-blue-600"
        }`}>
          <div>
            <div className="text-xs opacity-70 mb-0.5">{building.label} · {floor.label} · {zone.label}</div>
            <div className="text-2xl font-extrabold tracking-widest">{seat.id}</div>
            {gridPos && (
              <div className="text-xs opacity-80 mt-1 flex items-center gap-2">
                <span className="bg-white/20 px-2 py-0.5 rounded-full">
                  📍 {gridPos.rowLabel}행 · {gridPos.colLabel}열
                </span>
                <span className="opacity-60">격자 위치 참고</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] opacity-50 hidden sm:block">ESC 닫기</span>
            <button onClick={onClose} className="text-xl opacity-70 hover:opacity-100 ml-2">✕</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Monitor Type */}
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">모니터 타입</div>
            <div className="grid grid-cols-3 gap-2">
              {([
                { type:"standard" as MonitorType, label:"표준형", sub:'24/27"', color:"blue" },
                { type:"large"    as MonitorType, label:"개발자용", sub:'34" 와이드', color:"violet" },
                { type:"empty"    as MonitorType, label:"빈자리",  sub:"설치 필요", color:"red" },
              ]).map(opt => (
                <button key={opt.type} onClick={() => onUpdateType(opt.type)}
                  className={`py-2.5 px-2 rounded-xl border-2 text-xs font-semibold transition-all flex flex-col items-center gap-0.5 ${
                    curType===opt.type
                      ? opt.color==="blue"   ? "border-blue-500 bg-blue-50 text-blue-700"
                      : opt.color==="violet" ? "border-violet-500 bg-violet-50 text-violet-700"
                      :                        "border-red-500 bg-red-50 text-red-700"
                      : "border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600"
                  }`}>
                  <span className="font-bold">{opt.label}</span>
                  <span className="opacity-60 text-[10px] font-normal">{opt.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 교체·수리 요청 제출 폼 */}
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">교체 · 수리 요청</div>
            {reqDone ? (
              <div className="flex items-center gap-2 py-2 px-3 bg-emerald-50 rounded-xl border border-emerald-200 text-sm text-emerald-700 font-medium">
                ✓ 요청이 접수되었습니다. 총무 관리자에게 알림이 전송됩니다.
              </div>
            ) : (
              <>
                {/* 수리 중 상태 표시 */}
                {seatState.isRepairing && (
                  <div className="mb-3 flex items-center gap-2 text-xs text-red-600 font-semibold bg-red-50 px-3 py-2 rounded-lg border border-red-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block"/>
                    수리 진행 중
                    {seatState.repairStartedAt && (
                      <span className="font-normal text-red-400 ml-1">
                        ({new Date(seatState.repairStartedAt).toLocaleDateString("ko-KR",{month:"2-digit",day:"2-digit"})})
                      </span>
                    )}
                    <button onClick={onToggleRepair} className="ml-auto text-red-400 hover:text-red-600 text-[10px] underline">해제</button>
                  </div>
                )}
                {/* 요청 유형 선택 */}
                <div className="flex gap-2 mb-3">
                  {(["repair","replace"] as const).map(t => (
                    <button key={t} onClick={() => setReqType(t)}
                      className={`flex-1 py-2 rounded-xl border-2 text-xs font-semibold transition-all ${
                        reqType===t
                          ? t==="repair" ? "border-red-500 bg-red-50 text-red-700" : "border-amber-500 bg-amber-50 text-amber-700"
                          : "border-gray-200 text-gray-400 hover:border-gray-300"
                      }`}>
                      {t==="repair" ? "🔧 수리 요청" : "🔄 교체 요청"}
                    </button>
                  ))}
                </div>
                {/* 비고 입력 */}
                <textarea rows={2} placeholder="증상 또는 교체 사유 (선택)"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-red-300 mb-2"
                  value={reqNote} onChange={e => setReqNote(e.target.value)} />
                <button
                  disabled={reqSubmitting}
                  onClick={async () => {
                    setReqSubmitting(true);
                    try {
                      await onSubmitRequest(reqType, reqNote.trim());
                      setReqDone(true);
                      setReqNote("");
                      // 로컬 수리 상태도 반영
                      if (reqType === "repair" && !seatState.isRepairing) onToggleRepair();
                    } finally {
                      setReqSubmitting(false);
                    }
                  }}
                  className="w-full py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {reqSubmitting ? "접수 중..." : "요청 접수"}
                </button>
              </>
            )}
          </div>

          {/* Add History */}
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">작업 이력 추가</div>
            <div className="flex gap-1.5 mb-2 flex-wrap">
              {(Object.keys(ENTRY_TYPE_LABELS) as HistoryEntryType[]).map(t => (
                <button key={t} onClick={() => setNewType(t)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                    newType===t ? ENTRY_TYPE_COLORS[t] : "border-gray-200 text-gray-400 hover:border-gray-300"
                  }`}>{ENTRY_TYPE_LABELS[t]}</button>
              ))}
            </div>
            <textarea rows={2} placeholder="작업 내용 입력..."
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
              value={newContent} onChange={e => setNewContent(e.target.value)}
              onKeyDown={e => { if (e.key==="Enter"&&(e.ctrlKey||e.metaKey)) handleSubmit(); }}/>
            <div className="flex gap-2 mt-2">
              <input placeholder="담당자 이름"
                className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
                value={newAuthor} onChange={e => setNewAuthor(e.target.value)}/>
              <button onClick={handleSubmit} disabled={!newContent.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors">
                등록
              </button>
            </div>
            <div className="text-[10px] text-gray-300 mt-1">Ctrl+Enter 빠른 등록</div>
          </div>

          {/* History Timeline */}
          <div className="px-6 py-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">이력 타임라인</div>
              {seatState.history.length > 0 && (
                <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-semibold">{seatState.history.length}건</span>
              )}
            </div>
            {seatState.history.length === 0 ? (
              <div className="text-center py-6 text-gray-300 text-sm">이력이 없습니다</div>
            ) : (
              <div className="relative">
                <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-100"/>
                <div className="space-y-4">
                  {seatState.history.map(entry => (
                    <div key={entry.id} className="relative pl-9 group">
                      <div className={`absolute left-1 top-1 w-4 h-4 rounded-full border-2 border-white ${
                        entry.entryType==="repair" ? "bg-red-400" : entry.entryType==="replace" ? "bg-amber-400"
                        : entry.entryType==="install" ? "bg-green-400" : "bg-gray-300"
                      }`}/>
                      <div className="flex items-start gap-2 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${ENTRY_TYPE_COLORS[entry.entryType]}`}>
                          {ENTRY_TYPE_LABELS[entry.entryType]}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {new Date(entry.date).toLocaleDateString("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})}
                        </span>
                        {entry.author && <span className="text-[10px] text-gray-500 font-medium">{entry.author}</span>}
                        <button onClick={() => {
                          if (deleteConfirm===entry.id) { onDeleteHistory(entry.id); setDeleteConfirm(null); }
                          else { setDeleteConfirm(entry.id); setTimeout(() => setDeleteConfirm(null), 3000); }
                        }}
                          className={`ml-auto text-[10px] px-2 py-0.5 rounded transition-colors ${
                            deleteConfirm===entry.id ? "bg-red-100 text-red-600 font-semibold"
                            : "text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100"
                          }`}>
                          {deleteConfirm===entry.id ? "삭제 확인" : "삭제"}
                        </button>
                      </div>
                      <p className="text-sm text-gray-700 mt-1 leading-snug">{entry.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// PROGRESS BAR
// =============================================================================
function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value/max)*100) : 0;
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width:`${pct}%` }}/>
      </div>
      <span className="text-[10px] text-gray-400 w-8 text-right">{pct}%</span>
    </div>
  );
}

// =============================================================================
// DASHBOARD PANEL
// =============================================================================
function DashboardPanel({ seatStates, onNavigate }: {
  seatStates: Record<string,SeatState>;
  onNavigate: (buildingId: string, floorId?: string, zoneId?: string) => void;
}) {
  const stats = useMemo(() => {
    let totalSeats=0, totalLarge=0, totalStandard=0, totalEmpty=0, totalRepair=0;
    const byBuilding = BUILDINGS.map(b => {
      let bS=0, bL=0, bSt=0, bE=0, bR=0;
      b.floors.forEach(f => f.zones.forEach(z => z.seats.forEach(s => {
        const t = seatStates[s.id]?.monitorType ?? s.monitor;
        bS++; if(t==="large") bL++; else if(t==="standard") bSt++; else bE++;
        if(seatStates[s.id]?.isRepairing) bR++;
      })));
      totalSeats+=bS; totalLarge+=bL; totalStandard+=bSt; totalEmpty+=bE; totalRepair+=bR;
      return { building:b, seats:bS, large:bL, standard:bSt, empty:bE, repair:bR };
    });
    return { totalSeats, totalLarge, totalStandard, totalEmpty, totalRepair, byBuilding };
  }, [seatStates]);

  const repairSeats = useMemo(() => {
    const results: { seatId:string; buildingLabel:string; floorLabel:string; zoneLabel:string; buildingId:string; floorId:string; zoneId:string; repairAt?:string }[] = [];
    BUILDINGS.forEach(b => b.floors.forEach(f => f.zones.forEach(z => z.seats.forEach(s => {
      if (seatStates[s.id]?.isRepairing) {
        results.push({ seatId:s.id, buildingLabel:b.label, floorLabel:f.label, zoneLabel:z.label, buildingId:b.id, floorId:f.id, zoneId:z.id, repairAt:seatStates[s.id]?.repairStartedAt });
      }
    }))));
    return results;
  }, [seatStates]);

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800">전사 자산 현황 대시보드</h2>
          <p className="text-sm text-gray-500 mt-1">본관 · 신관 · S빌딩 전체 모니터 자산 통합 현황</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label:"전체 좌석", value:stats.totalSeats, unit:"석", color:"bg-slate-700", pct:null },
            { label:'표준형 (24/27")', value:stats.totalStandard, unit:"대", color:"bg-blue-600", pct:stats.totalSeats },
            { label:'개발자용 (34")', value:stats.totalLarge, unit:"대", color:"bg-violet-600", pct:stats.totalSeats },
            { label:"수리 필요", value:stats.totalRepair, unit:"건", color:"bg-red-500", pct:stats.totalSeats },
            { label:"빈자리", value:stats.totalEmpty, unit:"석", color:"bg-amber-500", pct:stats.totalSeats },
          ].map(card => {
            const pct = card.pct ? Math.round((card.value/card.pct)*100) : null;
            return (
              <div key={card.label} className={`${card.color} rounded-2xl p-4 shadow-sm`}>
                <div className="text-xs font-medium opacity-80 text-white">{card.label}</div>
                <div className="text-3xl font-extrabold mt-1 text-white">{card.value}</div>
                <div className="text-xs opacity-70 text-white">{card.unit}</div>
                {pct!==null && (
                  <div className="mt-2">
                    <div className="bg-white/20 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full bg-white/60 rounded-full" style={{ width:`${pct}%` }}/>
                    </div>
                    <div className="text-[10px] text-white/70 mt-0.5">{pct}% of total</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Building cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          {stats.byBuilding.map(({ building, seats, large, standard, empty, repair }) => (
            <div key={building.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <button className="w-full px-5 py-3 bg-slate-800 text-white flex items-center justify-between hover:bg-slate-700 transition-colors"
                onClick={() => onNavigate(building.id)}>
                <span className="text-sm font-bold">{building.label}</span>
                <span className="text-xs opacity-60">맵 보기 →</span>
              </button>
              <div className="p-4 space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">전체 좌석</span>
                  <span className="font-bold text-gray-800">{seats}석</span>
                </div>
                <div>
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-500">표준형</span>
                    <span className="font-bold text-blue-700">{standard}대</span>
                  </div>
                  <ProgressBar value={standard} max={seats} color="bg-blue-400"/>
                </div>
                <div>
                  <div className="flex justify-between text-sm">
                    <span className="text-violet-500">개발자용 34"</span>
                    <span className="font-bold text-violet-700">{large}대</span>
                  </div>
                  <ProgressBar value={large} max={seats} color="bg-violet-400"/>
                </div>
                {empty>0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-amber-500">빈자리</span>
                    <span className="font-bold text-amber-600">{empty}석</span>
                  </div>
                )}
                {repair>0 && (
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-red-500 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse inline-block"/>수리 요청
                    </span>
                    <button className="font-bold text-red-600 underline hover:text-red-700 text-sm"
                      onClick={() => onNavigate(building.id)}>{repair}건 →</button>
                  </div>
                )}
                <div className="pt-2 border-t border-gray-100">
                  <div className="text-xs text-gray-400 mb-1.5">층별 이동</div>
                  <div className="flex flex-wrap gap-1">
                    {building.floors.map(f => {
                      const fR = f.zones.flatMap(z=>z.seats).filter(s=>seatStates[s.id]?.isRepairing).length;
                      return (
                        <button key={f.id} onClick={() => onNavigate(building.id, f.id)}
                          className={`px-2 py-0.5 rounded text-xs font-semibold border transition-colors ${
                            fR>0 ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                            : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                          }`}>
                          {f.label}{fR>0 ? ` ⚠${fR}` : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Repair Queue */}
        {repairSeats.length > 0 ? (
          <div className="bg-white rounded-2xl border border-red-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-red-50 border-b border-red-100 flex items-center gap-2">
              <span className="text-sm font-bold text-red-700">🔧 수리 요청 현황</span>
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{repairSeats.length}건</span>
            </div>
            <div className="divide-y divide-gray-50">
              {repairSeats.map(r => (
                <div key={r.seatId} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-sm font-bold text-gray-800">{r.seatId}</span>
                    <span className="text-xs text-gray-400 ml-2">{r.buildingLabel} {r.floorLabel} · {r.zoneLabel}</span>
                    {r.repairAt && (
                      <div className="text-[10px] text-gray-400">
                        요청: {new Date(r.repairAt).toLocaleDateString("ko-KR",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})}
                      </div>
                    )}
                  </div>
                  <button onClick={() => onNavigate(r.buildingId, r.floorId, r.zoneId)}
                    className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 transition-colors shrink-0 font-medium">
                    📋 격자 보기
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4 flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <div className="text-sm font-semibold text-emerald-700">수리 요청 없음</div>
              <div className="text-xs text-emerald-600">현재 수리 요청 중인 자산이 없습니다.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// OVERVIEW SIDE PANEL
// =============================================================================
function OverviewSidePanel({ building, floor, seatStates }: {
  building: BuildingDef; floor: FloorDef; seatStates: Record<string,SeatState>;
}) {
  const [tab, setTab] = useState<"stats"|"legend">("stats");
  const allSeats = floor.zones.flatMap(z => z.seats);
  const largeN  = allSeats.filter(s => (seatStates[s.id]?.monitorType??s.monitor)==="large").length;
  const stdN    = allSeats.filter(s => (seatStates[s.id]?.monitorType??s.monitor)==="standard").length;
  const emptyN  = allSeats.filter(s => (seatStates[s.id]?.monitorType??s.monitor)==="empty").length;
  const repairN = allSeats.filter(s => seatStates[s.id]?.isRepairing).length;
  const total   = allSeats.length;

  return (
    <div className="flex flex-col h-full text-sm">
      <div className="px-4 py-3 bg-slate-800 text-white">
        <div className="text-xs opacity-60 mb-0.5">현황</div>
        <div className="font-bold">{building.label} {floor.label}</div>
      </div>
      <div className="flex border-b border-gray-100 bg-white">
        {([["stats","📊 현황"],["legend","ℹ 안내"]] as const).map(([t,l]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              tab===t ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-400 hover:text-gray-600"
            }`}>{l}</button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {tab==="stats" && (
          <div className="space-y-2">
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <div className="text-xs text-gray-400">전체 좌석</div>
              <div className="text-2xl font-extrabold text-gray-800">{total}석</div>
            </div>
            <div className="bg-violet-50 rounded-lg p-3 border border-violet-100">
              <div className="flex justify-between items-baseline">
                <div className="text-xs text-violet-400">34인치 (개발자)</div>
                <div className="text-lg font-extrabold text-violet-700">{largeN}석</div>
              </div>
              <ProgressBar value={largeN} max={total} color="bg-violet-400"/>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
              <div className="flex justify-between items-baseline">
                <div className="text-xs text-blue-400">24/27인치 (표준)</div>
                <div className="text-lg font-extrabold text-blue-700">{stdN}석</div>
              </div>
              <ProgressBar value={stdN} max={total} color="bg-blue-400"/>
            </div>
            {emptyN>0 && (
              <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                <div className="flex justify-between items-baseline">
                  <div className="text-xs text-amber-500">빈자리</div>
                  <div className="text-lg font-extrabold text-amber-600">{emptyN}석</div>
                </div>
                <ProgressBar value={emptyN} max={total} color="bg-amber-400"/>
              </div>
            )}
            {repairN>0 && (
              <div className="bg-red-50 rounded-lg p-3 border border-red-200 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse shrink-0"/>
                <div>
                  <div className="text-xs text-red-400">수리 요청</div>
                  <div className="text-lg font-extrabold text-red-600">{repairN}건</div>
                </div>
              </div>
            )}
            {/* Zone breakdown */}
            <div className="bg-white border border-gray-100 rounded-lg p-3">
              <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">구역별 현황</div>
              {floor.zones.map(z => {
                const lg = z.seats.filter(s=>(seatStates[s.id]?.monitorType??s.monitor)==="large").length;
                const st = z.seats.filter(s=>(seatStates[s.id]?.monitorType??s.monitor)==="standard").length;
                const em = z.seats.filter(s=>(seatStates[s.id]?.monitorType??s.monitor)==="empty").length;
                return (
                  <div key={z.id} className="mb-3 last:mb-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-xs font-semibold text-gray-700 truncate flex-1 mr-1">{z.label}</span>
                      <span className="text-xs text-gray-400 shrink-0">{z.seats.length}석</span>
                    </div>
                    <div className="flex h-2 rounded-full overflow-hidden gap-px mb-1">
                      {lg>0 && <div className="bg-violet-400" style={{flex:lg}}/>}
                      {st>0 && <div className="bg-blue-400" style={{flex:st}}/>}
                      {em>0 && <div className="bg-amber-400" style={{flex:em}}/>}
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      <span className="text-[10px] bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded font-medium">34" {lg}</span>
                      <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">표준 {st}</span>
                      {em>0 && <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded font-medium">빈자리 {em}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {tab==="legend" && (
          <div className="space-y-3">
            <div className="bg-white border border-gray-100 rounded-lg p-3">
              <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2.5">아이콘 범례</div>
              <div className="space-y-3 text-xs">
                {[
                  { sw:26, sh:16, color:"rgba(139,92,246,0.85)", border:"rgba(109,40,217,0.9)", label:"34인치 모니터", sub:"개발자 와이드", tc:"text-violet-700" },
                  { sw:20, sh:16, color:"rgba(96,165,250,0.85)", border:"rgba(37,99,235,0.9)", label:"24/27인치 모니터", sub:"표준형 업무", tc:"text-blue-700" },
                ].map((m,i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <svg width={m.sw} height="22" viewBox={`0 0 ${m.sw} 22`}>
                      <rect x="1" y="1" width={m.sw-2} height={m.sh} rx="2" fill={m.color} stroke={m.border} strokeWidth="1"/>
                      <line x1={m.sw/2} y1={m.sh+1} x2={m.sw/2} y2="21" stroke={m.border} strokeWidth="1.5"/>
                      <line x1={m.sw/2-4} y1="21" x2={m.sw/2+4} y2="21" stroke={m.border} strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    <div><div className={`font-semibold ${m.tc}`}>{m.label}</div><div className="text-gray-400">{m.sub}</div></div>
                  </div>
                ))}
                <div className="flex items-center gap-2.5">
                  <svg width="22" height="22" viewBox="0 0 22 22">
                    <rect x="1" y="1" width="20" height="16" rx="2" fill="none" stroke="rgba(239,68,68,0.7)" strokeWidth="1.5" strokeDasharray="3 2"/>
                    <line x1="3" y1="3" x2="19" y2="15" stroke="rgba(239,68,68,0.6)" strokeWidth="1"/>
                    <line x1="19" y1="3" x2="3" y2="15" stroke="rgba(239,68,68,0.6)" strokeWidth="1"/>
                  </svg>
                  <div><div className="font-semibold text-red-600">빈자리</div><div className="text-gray-400">점선 + X</div></div>
                </div>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-xs font-semibold text-slate-600 mb-2">🗺 사용 방법</div>
              <div className="text-[10px] text-slate-500 space-y-1.5">
                <p>① 건물 · 층 선택 후 도면 확인</p>
                <p>② <strong>📋 격자 보기</strong> 클릭 → 구역별 행/열 좌석 목록</p>
                <p>③ <strong>🔍 도면 확대</strong> 클릭 → SVG 도면 확대</p>
                <p>④ 좌석 클릭 → 타입 변경 · 수리 등록 · 이력 추가</p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="text-xs font-semibold text-amber-700 mb-1">📍 찾아가는 방법</div>
              <div className="text-[10px] text-amber-600 leading-relaxed space-y-1">
                <p>• <strong>서편</strong> : 삼성역 방면 E/V 이용</p>
                <p>• <strong>동편</strong> : 탄천 방면 E/V 이용</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN PANEL
// =============================================================================
export default function AssetMapPanel() {
  const [view,       setView]       = useState<"map"|"dashboard">("map");
  const [buildingId, setBuildingId] = useState("bw");
  const [floorId,    setFloorId]    = useState("bw3");
  const [filterMode, setFilterMode] = useState<"all"|"large"|"standard"|"empty"|"repair">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selected,   setSelected]   = useState<{ seat: SeatDef; zone: ZoneDef } | null>(null);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [toasts,     setToasts]     = useState<Toast[]>([]);
  // Zone detail view state
  const [zoneDetailId, setZoneDetailId] = useState<string | null>(null);
  // Map focus zone (for search → auto-zoom on SVG)
  const [focusZoneId, setFocusZoneId] = useState<string | null>(null);

  // Toast helper
  const addToast = useCallback((message: string, type: Toast["type"] = "success") => {
    const id = `t-${Date.now()}`;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2500);
  }, []);

  // 편집 모드 + 레이아웃 상태
  const [editMode, setEditMode] = useState(false);
  const [layout,   setLayout]   = useState<LayoutStore>({ pos: {}, extra: [] });
  useEffect(() => { setLayout(loadLayout()); }, []);

  // 좌석 위치/회전 변경 핸들러 (드래그·회전)
  const handleLayoutChange = useCallback((seatId: string, dx: number, dy: number, rot?: number) => {
    setLayout(prev => {
      const existing = prev.pos[seatId];
      // 추가 아이콘인 경우
      const isExtra = prev.extra.some(e => e.id === seatId);
      if (isExtra) {
        const next: LayoutStore = {
          ...prev,
          extra: prev.extra.map(e => e.id === seatId
            ? { ...e, x: e.x + dx, y: e.y + dy, rot: rot !== undefined ? rot : e.rot }
            : e),
        };
        persistLayout(next);
        return next;
      }
      // 기본 좌석 위치 오버라이드
      const base = existing ?? { x: 0, y: 0, rot: 0 };
      const next: LayoutStore = {
        ...prev,
        pos: {
          ...prev.pos,
          [seatId]: {
            x: base.x + dx,
            y: base.y + dy,
            rot: rot !== undefined ? rot : base.rot,
          },
        },
      };
      persistLayout(next);
      return next;
    });
  }, []);

  // 첫 드래그 시 기본 좌석의 초기 위치를 layout.pos에 등록
  const ensureSeatInLayout = useCallback((seat: SeatDef) => {
    setLayout(prev => {
      if (prev.pos[seat.id]) return prev;
      const next: LayoutStore = {
        ...prev,
        pos: { ...prev.pos, [seat.id]: { x: seat.x, y: seat.y, rot: 0 } },
      };
      persistLayout(next);
      return next;
    });
  }, []);

  // 실제 드래그 시작 시 초기화 후 이동
  const handleDragStart = useCallback((seat: SeatDef) => {
    ensureSeatInLayout(seat);
  }, [ensureSeatInLayout]);

  // 새 아이콘 추가
  const handleAddSeat = useCallback((x: number, y: number) => {
    const id = `USR-${floor.id}-${Date.now()}`;
    setLayout(prev => {
      const next: LayoutStore = {
        ...prev,
        extra: [...prev.extra, { id, floorId: floor.id, x, y, rot: 0, type: "standard" }],
      };
      persistLayout(next);
      return next;
    });
    addToast("모니터 아이콘 추가됨", "info");
  }, [floor.id, addToast]);

  // 아이콘 삭제
  const handleDeleteSeat = useCallback((seatId: string) => {
    setLayout(prev => {
      const isExtra = prev.extra.some(e => e.id === seatId);
      const next: LayoutStore = isExtra
        ? { ...prev, extra: prev.extra.filter(e => e.id !== seatId) }
        : { ...prev, pos: Object.fromEntries(Object.entries(prev.pos).filter(([k]) => k !== seatId)) };
      persistLayout(next);
      return next;
    });
    setSelected(null);
    addToast("아이콘 삭제됨", "info");
  }, [addToast]);

  // State management
  const [seatStates, setSeatStates] = useState<Record<string,SeatState>>({});
  useEffect(() => { setSeatStates(loadAllStates()); }, []);

  const getSeatState = useCallback((seatId: string, defaultType: MonitorType): SeatState =>
    seatStates[seatId] ?? { seatId, monitorType: defaultType, isRepairing: false, history: [] },
    [seatStates]
  );

  const updateMonitorType = useCallback((seatId: string, defaultType: MonitorType, newType: MonitorType) => {
    setSeatStates(prev => {
      const ex = prev[seatId] ?? { seatId, monitorType: defaultType, isRepairing: false, history: [] };
      const next = { ...prev, [seatId]: { ...ex, monitorType: newType } };
      persistStates(next); return next;
    });
    const labels: Record<MonitorType,string> = { standard:'표준형 (24/27")', large:'개발자용 (34")', empty:"빈자리" };
    addToast(`${seatId} → ${labels[newType]} 변경`);
  }, [addToast]);

  const toggleRepair = useCallback((seatId: string, defaultType: MonitorType) => {
    setSeatStates(prev => {
      const ex = prev[seatId] ?? { seatId, monitorType: defaultType, isRepairing: false, history: [] };
      const nowRepairing = !ex.isRepairing;
      const repairStartedAt = nowRepairing ? new Date().toISOString() : undefined;
      const autoEntry: HistoryEntry | null = nowRepairing ? {
        id: `h-${Date.now()}-auto`, date: new Date().toISOString(),
        entryType: "repair", content: "수리 요청 등록", author: "시스템",
      } : null;
      const newHistory = autoEntry ? [autoEntry, ...ex.history] : ex.history;
      const next = { ...prev, [seatId]: { ...ex, isRepairing: nowRepairing, repairStartedAt, history: newHistory } };
      persistStates(next); return next;
    });
    addToast(seatStates[seatId]?.isRepairing ? `${seatId} 수리 요청 해제` : `${seatId} 수리 요청 등록`, "info");
  }, [addToast, seatStates]);

  const addHistory = useCallback((seatId: string, defaultType: MonitorType, entry: Omit<HistoryEntry,"id">) => {
    setSeatStates(prev => {
      const ex = prev[seatId] ?? { seatId, monitorType: defaultType, isRepairing: false, history: [] };
      const newE: HistoryEntry = { ...entry, id: `h-${Date.now()}-${Math.random().toString(36).slice(2,7)}` };
      const next = { ...prev, [seatId]: { ...ex, history: [newE, ...ex.history] } };
      persistStates(next); return next;
    });
    addToast("이력이 등록되었습니다");
  }, [addToast]);

  const deleteHistory = useCallback((seatId: string, entryId: string) => {
    setSeatStates(prev => {
      const ex = prev[seatId]; if (!ex) return prev;
      const next = { ...prev, [seatId]: { ...ex, history: ex.history.filter(h => h.id !== entryId) } };
      persistStates(next); return next;
    });
    addToast("이력 삭제 완료", "info");
  }, [addToast]);

  // 교체·수리 요청 API 제출
  const submitMonitorRequest = useCallback(async (
    seat: SeatDef, zone: ZoneDef, floor: FloorDef, building: BuildingDef,
    type: "repair" | "replace", note: string
  ) => {
    const body = {
      seatId:   seat.id,
      building: building.id,
      floor:    floor.id,
      zone:     zone.id,
      type,
      note,
    };
    const res = await fetch("/api/monitor-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "요청 실패");
    addToast(`${seat.id} ${type === "repair" ? "수리" : "교체"} 요청 접수 완료`);
  }, [addToast]);

  // Navigation
  const building = useMemo(() => BUILDINGS.find(b => b.id === buildingId)!, [buildingId]);
  const floor = useMemo(
    () => building.floors.find(f => f.id === floorId) ?? building.floors[0],
    [building, floorId]
  );

  const handleBuildingChange = useCallback((bid: string, fid?: string, zid?: string) => {
    setBuildingId(bid);
    const b = BUILDINGS.find(x => x.id === bid)!;
    const targetFloorId = fid ?? b.floors[0].id;
    setFloorId(targetFloorId);
    setSelected(null); setModalOpen(false); setView("map");
    setSearchQuery(""); setFocusZoneId(null);
    if (zid) {
      // Navigate to zone detail
      setZoneDetailId(zid);
    } else {
      setZoneDetailId(null);
    }
  }, []);

  const handleSelect = useCallback((seat: SeatDef, zone: ZoneDef | null) => {
    if (editMode) {
      // 편집 모드: 클릭으로 선택만 (모달 없음)
      setSelected(zone ? { seat, zone } : null);
      return;
    }
    if (zone) { setSelected({ seat, zone }); setModalOpen(true); }
  }, [editMode]);

  // Search → auto focus zone on SVG map
  useEffect(() => {
    setZoneDetailId(null); // clear zone detail on search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      for (const z of floor.zones) {
        if (z.seats.some(s => s.id.toLowerCase().includes(q))) {
          setFocusZoneId(z.id);
          return;
        }
      }
      setFocusZoneId(null);
    } else {
      setFocusZoneId(null);
    }
  }, [searchQuery, floor]);

  // Reset zone detail when floor changes
  useEffect(() => { setZoneDetailId(null); setFocusZoneId(null); }, [floor.id]);

  // Floor stats
  const allSeats   = useMemo(() => floor.zones.flatMap(z => z.seats), [floor]);
  const largeCount  = allSeats.filter(s => (seatStates[s.id]?.monitorType??s.monitor)==="large").length;
  const stdCount    = allSeats.filter(s => (seatStates[s.id]?.monitorType??s.monitor)==="standard").length;
  const emptyCount  = allSeats.filter(s => (seatStates[s.id]?.monitorType??s.monitor)==="empty").length;
  const repairCount = allSeats.filter(s => seatStates[s.id]?.isRepairing).length;

  // Zone detail zone
  const zoneDetail = zoneDetailId ? floor.zones.find(z => z.id === zoneDetailId) ?? null : null;

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-50" style={{ fontFamily:"system-ui,-apple-system,sans-serif" }}>

      {/* TOP BAR */}
      <div className="flex-none bg-white border-b px-5 py-3 flex flex-wrap items-center gap-3 shadow-sm">
        <div className="shrink-0">
          <div className="text-xs text-gray-400">스마트오피스</div>
          <div className="text-base font-bold text-slate-800">모니터 자산 맵</div>
        </div>

        {/* View toggle */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white">
          {([["map","🗺 맵 보기"],["dashboard","📊 대시보드"]] as const).map(([v,l]) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors border-r border-gray-200 last:border-0 ${
                view===v ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-gray-50"
              }`}>{l}</button>
          ))}
        </div>

        {/* Stats chips */}
        {view==="map" && (
          <div className="flex gap-1.5 flex-wrap">
            {[
              { label:`총 ${allSeats.length}석`, cls:"bg-gray-100 text-gray-600 border-gray-200" },
              { label:`34" ${largeCount}석`, cls:"bg-violet-50 text-violet-700 border-violet-200" },
              { label:`표준 ${stdCount}석`, cls:"bg-blue-50 text-blue-700 border-blue-200" },
              ...(emptyCount>0 ? [{ label:`빈자리 ${emptyCount}석`, cls:"bg-amber-50 text-amber-700 border-amber-200" }] : []),
              ...(repairCount>0 ? [{ label:`🔧 수리 ${repairCount}건`, cls:"bg-red-50 text-red-700 border-red-200 animate-pulse font-semibold" }] : []),
            ].map((c,i) => (
              <span key={i} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs border font-medium ${c.cls}`}>
                {c.label}
              </span>
            ))}
          </div>
        )}

        {/* Building + Floor selectors */}
        {view==="map" && (
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white">
              {BUILDINGS.map(b => (
                <button key={b.id} onClick={() => handleBuildingChange(b.id)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors border-r border-gray-200 last:border-0 ${
                    b.id===buildingId ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-gray-50"
                  }`}>{b.label}</button>
              ))}
            </div>
            <div className="flex gap-1 flex-wrap">
              {building.floors.map(f => (
                <button key={f.id}
                  onClick={() => { setFloorId(f.id); setSelected(null); setModalOpen(false); setSearchQuery(""); setZoneDetailId(null); setFocusZoneId(null); }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                    f.id===floorId
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : "bg-white text-slate-500 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                  }`}>{f.label.replace("층","F")}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dashboard */}
      {view==="dashboard" && (
        <DashboardPanel
          seatStates={seatStates}
          onNavigate={(bid, fid, zid) => handleBuildingChange(bid, fid, zid)}
        />
      )}

      {/* Map View */}
      {view==="map" && (
        <>
          {/* Filter + Search Bar */}
          <div className="flex-none bg-white border-b px-5 py-2 flex items-center gap-3 flex-wrap">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
              {([
                ["all","전체"],["large","34인치"],["standard","표준형"],["empty","빈자리"],["repair","수리 요청"],
              ] as const).map(([mode, label]) => (
                <button key={mode} onClick={() => { setFilterMode(mode); setSearchQuery(""); setZoneDetailId(null); }}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    filterMode===mode
                      ? `bg-white shadow font-semibold ${mode==="repair"?"text-red-600":mode==="empty"?"text-amber-600":"text-slate-800"}`
                      : "text-slate-500 hover:text-slate-700"
                  }`}>{label}</button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="좌석 ID 검색 (예: BW3W-14)"
                className="pl-7 pr-7 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 w-44"/>
              <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" viewBox="0 0 16 16" fill="currentColor">
                <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398l3.85 3.85a1 1 0 0 0 1.415-1.415l-3.868-3.833zm-5.242 1.656a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"/>
              </svg>
              {searchQuery && (
                <button onClick={() => { setSearchQuery(""); setFocusZoneId(null); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">✕</button>
              )}
            </div>

            {searchQuery && (
              <span className="text-xs text-blue-600 font-medium">
                {allSeats.filter(s => s.id.toLowerCase().includes(searchQuery.toLowerCase())).length}건 검색됨
              </span>
            )}

            {/* Zone detail breadcrumb */}
            {zoneDetail && (
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <button onClick={() => { setZoneDetailId(null); setFocusZoneId(null); }}
                  className="text-blue-600 hover:text-blue-800 font-medium">도면</button>
                <span className="text-gray-300">›</span>
                <span className="font-semibold text-slate-700">{zoneDetail.label} 격자</span>
              </div>
            )}

            {/* ── 배치 편집 모드 토글 버튼 ─────────────────────────── */}
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => { setEditMode(em => !em); setZoneDetailId(null); setSelected(null); }}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                  editMode
                    ? "bg-amber-500 text-white border-amber-600 shadow"
                    : "bg-white text-slate-600 border-gray-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300"
                }`}>
                {editMode ? "✏️ 편집 중 (클릭 시 종료)" : "✏️ 배치 편집"}
              </button>
              <span className="text-xs text-gray-400">
                {editMode ? "드래그로 아이콘 이동" : zoneDetail ? "● 자리 클릭 → 상세/편집" : "📋 격자 보기 → 행/열 좌표로 위치 확인"}
              </span>
            </div>
          </div>

          {/* MAIN CONTENT */}
          <div className="flex-1 flex min-h-0 overflow-hidden">
            <div className="flex-1 min-w-0 overflow-hidden">
              {zoneDetail ? (
                /* Zone Detail Grid View */
                <ZoneDetailGrid
                  zone={zoneDetail}
                  floor={floor}
                  building={building}
                  seatStates={seatStates}
                  searchQuery={searchQuery}
                  filterMode={filterMode}
                  selectedSeatId={selected?.seat.id ?? null}
                  onSelect={handleSelect}
                  onBack={() => { setZoneDetailId(null); setFocusZoneId(null); }}
                />
              ) : (
                /* Floor Map (SVG overview) */
                <div className="p-4 h-full overflow-auto">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-slate-700">{building.label} {floor.label}</span>
                    {floor.zones.map(z => (
                      <button key={z.id}
                        onClick={() => setZoneDetailId(z.id)}
                        className={`text-xs px-2.5 py-0.5 rounded-full border font-medium hover:bg-opacity-80 transition-colors ${
                          z.dir==="west" ? "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100"
                          : z.dir==="east" ? "bg-violet-50 text-violet-600 border-violet-200 hover:bg-violet-100"
                          : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                        }`}>
                        📋 {z.label} ({z.seats.length}석)
                      </button>
                    ))}
                  </div>
                  {/* 편집 모드 툴바 */}
                  {editMode && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl mb-2 flex-wrap">
                      <span className="text-xs font-bold text-amber-700">✏️ 배치 편집 모드</span>
                      <span className="text-xs text-amber-600">아이콘을 드래그해 이동 · ↻/× 버튼으로 회전·삭제</span>
                      <button
                        onClick={() => {
                          const cx = (floor.zones[0]?.x1 ?? 200) + 80;
                          const cy = (floor.zones[0]?.y1 ?? 200) + 60;
                          handleAddSeat(cx, cy);
                        }}
                        className="ml-auto text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg font-semibold transition-colors">
                        + 모니터 추가
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("이 층의 모든 아이콘 위치를 초기 배치로 되돌릴까요?")) {
                            setLayout(prev => {
                              const floorSeatIds = new Set(floor.zones.flatMap(z => z.seats.map(s => s.id)));
                              const next: LayoutStore = {
                                pos: Object.fromEntries(Object.entries(prev.pos).filter(([k]) => !floorSeatIds.has(k))),
                                extra: prev.extra.filter(e => e.floorId !== floor.id),
                              };
                              persistLayout(next);
                              return next;
                            });
                            addToast("이 층 배치 초기화됨", "info");
                          }
                        }}
                        className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1 rounded-lg font-semibold transition-colors">
                        이 층 초기화
                      </button>
                    </div>
                  )}
                  <FloorMap
                    floor={floor}
                    selectedSeatId={selected?.seat.id ?? null}
                    filterMode={filterMode}
                    searchQuery={searchQuery}
                    seatStates={seatStates}
                    focusZoneId={focusZoneId}
                    editMode={editMode}
                    layout={layout}
                    onSelect={handleSelect}
                    onOpenZoneDetail={setZoneDetailId}
                    onLayoutChange={(seatId, dx, dy, rot) => {
                      // 첫 드래그 시 기본 좌석 초기 위치 등록
                      const seat = floor.zones.flatMap(z => z.seats).find(s => s.id === seatId);
                      if (seat && !layout.pos[seatId]) ensureSeatInLayout(seat);
                      handleLayoutChange(seatId, dx, dy, rot);
                    }}
                    onAddSeat={handleAddSeat}
                    onDeleteSeat={handleDeleteSeat}
                  />
                </div>
              )}
            </div>

            {/* Right side panel */}
            {!zoneDetail && (
              <div className="flex-none border-l bg-white overflow-hidden w-64">
                <OverviewSidePanel building={building} floor={floor} seatStates={seatStates}/>
              </div>
            )}
          </div>
        </>
      )}

      {/* Seat Detail Modal */}
      {modalOpen && selected && (
        <SeatDetailModal
          seat={selected.seat} zone={selected.zone}
          floor={floor} building={building}
          seatState={getSeatState(selected.seat.id, selected.seat.monitor)}
          onClose={() => { setModalOpen(false); setSelected(null); }}
          onUpdateType={t => updateMonitorType(selected.seat.id, selected.seat.monitor, t)}
          onToggleRepair={() => toggleRepair(selected.seat.id, selected.seat.monitor)}
          onAddHistory={e => addHistory(selected.seat.id, selected.seat.monitor, e)}
          onDeleteHistory={id => deleteHistory(selected.seat.id, id)}
          onSubmitRequest={(type, note) =>
            submitMonitorRequest(selected.seat, selected.zone, floor, building, type, note)
          }
        />
      )}

      <ToastContainer toasts={toasts}/>
    </div>
  );
}
