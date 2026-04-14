"use client";
import { useState, useMemo, useCallback, useEffect } from "react";

// =============================================================================
// INTERFACES  — API-ready: swap localStorage calls with fetch()/SWR later
// =============================================================================
export type MonitorType = "large" | "standard" | "empty";
// large    = 34" 개발자 와이드 모니터  (blue O in floor plan)
// standard = 24/27" 표준형 모니터     (unmarked in floor plan)
// empty    = 미설치 / 설치 필요       (red X in floor plan)

export type HistoryEntryType = "install" | "repair" | "replace" | "note";

export interface HistoryEntry {
  id: string;
  date: string;            // ISO 8601
  entryType: HistoryEntryType;
  content: string;
  author: string;
}

export interface SeatState {
  seatId: string;
  monitorType: MonitorType;
  isRepairing: boolean;
  history: HistoryEntry[];
}

// ─── Raw geometry types (internal) ───────────────────────────────────────────
interface SeatDef {
  id: string;
  monitor: MonitorType;
  x: number; y: number;
}
interface ZoneDef {
  id: string; label: string;
  dir: "west" | "east" | "single";
  x1: number; y1: number; x2: number; y2: number;
  seats: SeatDef[];
}
interface ElevatorDef { id: string; x: number; y: number; label: string; }
interface FloorDef {
  id: string; label: string; imageSrc: string;
  zones: ZoneDef[]; elevators: ElevatorDef[];
  noImage?: boolean;
}
interface BuildingDef { id: string; label: string; floors: FloorDef[]; }

// =============================================================================
// LOCAL-STORAGE STATE LAYER
// To migrate to API: replace loadAllStates/persistStates with async fetchers
// =============================================================================
const STORAGE_KEY = "sw-portal-monitor-v2";

function loadAllStates(): Record<string, SeatState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, SeatState>) : {};
  } catch { return {}; }
}
function persistStates(s: Record<string, SeatState>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

// =============================================================================
// SEAT GRID GENERATOR  (unchanged logic from original)
// =============================================================================
function mkSeats(
  zone: { x1: number; y1: number; x2: number; y2: number },
  total: number, pfx: string, largeCnt: number, pad = 20
): SeatDef[] {
  const W = zone.x2 - zone.x1 - pad * 2;
  const H = zone.y2 - zone.y1 - pad * 2;
  const aspect = W / Math.max(H, 1);
  const cols = Math.max(2, Math.round(Math.sqrt(total * aspect)));
  const rows = Math.ceil(total / cols);
  const dx = cols > 1 ? W / (cols - 1) : 0;
  const dy = rows > 1 ? H / (rows - 1) : 0;
  return Array.from({ length: total }, (_, i) => ({
    id: `${pfx}${String(i + 1).padStart(2, "0")}`,
    monitor: (i < largeCnt ? "large" : "standard") as MonitorType,
    x: zone.x1 + pad + (i % cols) * dx,
    y: zone.y1 + pad + Math.floor(i / cols) * dy,
  }));
}
function mkZone(
  id: string, label: string, dir: ZoneDef["dir"],
  bounds: { x1: number; y1: number; x2: number; y2: number },
  total: number, pfx: string, largeCnt: number
): ZoneDef {
  return { id, label, dir, ...bounds, seats: mkSeats(bounds, total, pfx, largeCnt) };
}

// =============================================================================
// COORDINATE REFERENCE  (960×600 canvas pixel coords)
// =============================================================================
const BW_W = { x1: 52,  y1: 152, x2: 338, y2: 568 };
const BW_E = { x1: 528, y1: 152, x2: 897, y2: 568 };
const BW_EV: ElevatorDef[] = [
  { id: "ev-w", x: 384, y: 300, label: "서편 E/V" },
  { id: "ev-e", x: 494, y: 300, label: "동편 E/V" },
];
const SN2_W = { x1: 262, y1: 56,  x2: 578, y2: 268 };
const SN2_E = { x1: 264, y1: 346, x2: 732, y2: 594 };
const SN2_EV: ElevatorDef[] = [{ id: "ev", x: 500, y: 296, label: "E/V" }];
const SN3_W = { x1: 212, y1: 315, x2: 442, y2: 580 };
const SN3_E = { x1: 398, y1: 96,  x2: 778, y2: 298 };
const SN3_EV: ElevatorDef[] = [{ id: "ev", x: 300, y: 258, label: "E/V" }];
const SN4_W = { x1: 260, y1: 56,  x2: 585, y2: 275 };
const SN4_E = { x1: 262, y1: 358, x2: 734, y2: 598 };
const SN4_EV: ElevatorDef[] = [{ id: "ev", x: 500, y: 302, label: "E/V" }];
const SN5_W = { x1: 253, y1: 52,  x2: 582, y2: 272 };
const SN5_E = { x1: 255, y1: 352, x2: 739, y2: 598 };
const SN5_EV: ElevatorDef[] = [{ id: "ev", x: 494, y: 298, label: "E/V" }];
const SB3_A = { x1: 222, y1: 246, x2: 450, y2: 518 };
const SB3_B = { x1: 454, y1: 196, x2: 814, y2: 540 };
const SB3_EV: ElevatorDef[] = [{ id: "ev", x: 208, y: 162, label: "E/V" }];
const SB4_W = { x1: 132, y1: 262, x2: 462, y2: 543 };
const SB4_E = { x1: 496, y1: 148, x2: 886, y2: 543 };
const SB4_EV: ElevatorDef[] = [{ id: "ev", x: 204, y: 148, label: "E/V" }];
const SB5   = { x1: 396, y1: 158, x2: 886, y2: 535 };
const SB5_EV: ElevatorDef[] = [{ id: "ev", x: 204, y: 148, label: "E/V" }];

// =============================================================================
// BUILDINGS DATA  (identical seat counts & coordinates to original)
// =============================================================================
const BUILDINGS: BuildingDef[] = [
  {
    id: "bw", label: "본관",
    floors: [
      { id: "bw2", label: "2층", imageSrc: "/floor-plans/bongwan-2f.jpg",
        zones: [mkZone("bw2-w","스마트오피스 (서편)","west",{x1:110,y1:128,x2:448,y2:512},52,"BW2-",20)],
        elevators: [{ id:"ev", x:558, y:328, label:"서/동편 E/V" }] },
      { id: "bw3", label: "3층", imageSrc: "/floor-plans/bongwan-3f.jpg",
        zones: [mkZone("bw3-w","스마트오피스 (서편)","west",BW_W,54,"BW3W-",22),
                mkZone("bw3-e","스마트오피스 (동편)","east",BW_E,71,"BW3E-",32)],
        elevators: BW_EV },
      { id: "bw4", label: "4층", imageSrc: "/floor-plans/bongwan-4f.jpg",
        zones: [mkZone("bw4-w","스마트오피스 (서편)","west",BW_W,74,"BW4W-",36),
                mkZone("bw4-e","스마트오피스 (동편)","east",BW_E,49,"BW4E-",22)],
        elevators: BW_EV },
      { id: "bw5", label: "5층", imageSrc: "/floor-plans/bongwan-5f.jpg",
        zones: [mkZone("bw5-w","스마트오피스 (서편)","west",BW_W,74,"BW5W-",36),
                mkZone("bw5-e","스마트오피스 (동편)","east",BW_E,49,"BW5E-",22)],
        elevators: BW_EV },
      { id: "bw6", label: "6층", imageSrc: "/floor-plans/bongwan-6f.jpg",
        zones: [mkZone("bw6-w","스마트오피스 (서편)","west",BW_W,67,"BW6W-",30),
                mkZone("bw6-e","스마트오피스 (동편)","east",BW_E,65,"BW6E-",30)],
        elevators: BW_EV },
      { id: "bw7", label: "7층", imageSrc: "/floor-plans/bongwan-6f.jpg", noImage: true,
        zones: [mkZone("bw7-w","스마트오피스 (서편)","west",{x1:52,y1:152,x2:240,y2:568},19,"BW7W-",8),
                mkZone("bw7-e","스마트오피스 (동편)","east",BW_E,57,"BW7E-",26)],
        elevators: BW_EV },
      { id: "bw8", label: "8층", imageSrc: "/floor-plans/bongwan-8f.jpg",
        zones: [mkZone("bw8-w","스마트오피스 (서편)","west",BW_W,28,"BW8W-",12)],
        elevators: BW_EV },
      { id: "bw9", label: "9층", imageSrc: "/floor-plans/bongwan-9f.jpg",
        zones: [mkZone("bw9-w","스마트오피스 (서편)","west",BW_W,37,"BW9W-",18),
                mkZone("bw9-e","스마트오피스 (동편)","east",BW_E,85,"BW9E-",40)],
        elevators: BW_EV },
    ],
  },
  {
    id: "ns", label: "신관",
    floors: [
      { id:"ns2", label:"2층", imageSrc:"/floor-plans/singwan-2f.jpg",
        zones:[mkZone("ns2-w","스마트오피스 (서편)","west",SN2_W,31,"NS2W-",14),
               mkZone("ns2-e","스마트오피스 (동편)","east",SN2_E,48,"NS2E-",22)],
        elevators:SN2_EV },
      { id:"ns3", label:"3층", imageSrc:"/floor-plans/singwan-3f.jpg",
        zones:[mkZone("ns3-w","스마트오피스 (서편)","west",SN3_W,40,"NS3W-",18),
               mkZone("ns3-e","스마트오피스 (동편)","east",SN3_E,60,"NS3E-",28)],
        elevators:SN3_EV },
      { id:"ns4", label:"4층", imageSrc:"/floor-plans/singwan-4f.jpg",
        zones:[mkZone("ns4-w","스마트오피스 (서편)","west",SN4_W,40,"NS4W-",18),
               mkZone("ns4-e","스마트오피스 (동편)","east",SN4_E,51,"NS4E-",24)],
        elevators:SN4_EV },
      { id:"ns5", label:"5층", imageSrc:"/floor-plans/singwan-5f.jpg",
        zones:[mkZone("ns5-w","스마트오피스 (서편)","west",SN5_W,35,"NS5W-",16),
               mkZone("ns5-e","스마트오피스 (동편)","east",SN5_E,48,"NS5E-",22)],
        elevators:SN5_EV },
    ],
  },
  {
    id: "sb", label: "S빌딩",
    floors: [
      { id:"sb3", label:"3층", imageSrc:"/floor-plans/sbldg-3f.jpg",
        zones:[mkZone("sb3-a","스마트오피스 1 (서편)","west",SB3_A,19,"SB3A-",8),
               mkZone("sb3-b","스마트오피스 2 (동편)","east",SB3_B,32,"SB3B-",16)],
        elevators:SB3_EV },
      { id:"sb4", label:"4층", imageSrc:"/floor-plans/sbldg-4f.jpg",
        zones:[mkZone("sb4-w","Casual Work (서편)","west",SB4_W,21,"SB4W-",10),
               mkZone("sb4-e","Open Office (동편)","east",SB4_E,40,"SB4E-",20)],
        elevators:SB4_EV },
      { id:"sb5", label:"5층", imageSrc:"/floor-plans/sbldg-5f.jpg",
        zones:[mkZone("sb5-so","스마트오피스","single",SB5,36,"SB5-",18)],
        elevators:SB5_EV },
    ],
  },
];

// Helper: all seats across all buildings
function getAllSeats() {
  return BUILDINGS.flatMap(b => b.floors.flatMap(f => f.zones.flatMap(z => z.seats)));
}

// =============================================================================
// FEATURE 1 & 4: MONITOR ICON  (large / standard / empty / repairing)
// =============================================================================
function MonitorIcon({
  x, y, type, selected, faded, isRepairing, onClick,
}: {
  x: number; y: number;
  type: MonitorType; selected: boolean; faded: boolean;
  isRepairing: boolean; onClick: () => void;
}) {
  const isLarge = type === "large";
  const isEmpty = type === "empty";
  const sw = isLarge ? 18 : 13;
  const sh = 11;
  const standH = 4;
  const baseW = isLarge ? 10 : 8;

  // FEATURE 4: empty seat — dashed outline with X
  if (isEmpty) {
    return (
      <g transform={`translate(${x},${y})`} style={{ cursor: "pointer" }} onClick={onClick}>
        <rect
          x={-sw/2} y={-sh/2-standH} width={sw} height={sh} rx={1.5}
          fill="none" stroke="rgba(239,68,68,0.65)"
          strokeWidth={1.2} strokeDasharray="3 2"
        />
        <line x1={-sw/2+2} y1={-sh/2-standH+2} x2={sw/2-2} y2={-sh/2-standH+sh-2}
          stroke="rgba(239,68,68,0.6)" strokeWidth={0.9}/>
        <line x1={sw/2-2} y1={-sh/2-standH+2} x2={-sw/2+2} y2={-sh/2-standH+sh-2}
          stroke="rgba(239,68,68,0.6)" strokeWidth={0.9}/>
        <line x1={0} y1={sh/2-standH} x2={0} y2={sh/2}
          stroke="rgba(239,68,68,0.5)" strokeWidth={1.2} strokeDasharray="2 1"/>
        <line x1={-baseW/2} y1={sh/2} x2={baseW/2} y2={sh/2}
          stroke="rgba(239,68,68,0.5)" strokeWidth={1.5} strokeLinecap="round"/>
        {selected && (
          <circle cx={0} cy={0} r={sw/2+4}
            fill="none" stroke="#F59E0B" strokeWidth={2} strokeDasharray="3 2" opacity={0.8}/>
        )}
      </g>
    );
  }

  const screenColor = selected ? "#F59E0B"
    : isLarge ? "rgba(167,139,250,0.92)" : "rgba(96,165,250,0.92)";
  const borderColor = isRepairing ? "#ef4444"
    : selected ? "#D97706"
    : isLarge ? "rgba(139,92,246,0.9)" : "rgba(37,99,235,0.9)";
  const opacity = faded ? 0.18 : 1;

  return (
    <g
      transform={`translate(${x},${y})`}
      opacity={opacity}
      style={{ cursor: faded ? "default" : "pointer", pointerEvents: faded ? "none" : "all" }}
      onClick={!faded ? onClick : undefined}
    >
      {/* FEATURE 3: repair — pulsing red ring */}
      {isRepairing && !faded && (
        <circle cx={0} cy={0} r={sw/2+6}
          fill="none" stroke="rgba(239,68,68,0.5)" strokeWidth={2}
          style={{ animation: "ping 1.2s cubic-bezier(0,0,0.2,1) infinite" }}/>
      )}
      {isRepairing && !faded && (
        <circle cx={0} cy={0} r={sw/2+4}
          fill="none" stroke="rgba(239,68,68,0.85)" strokeWidth={1.8}/>
      )}

      {/* Screen */}
      <rect
        x={-sw/2} y={-sh/2-standH} width={sw} height={sh} rx={1.5}
        fill={screenColor}
        stroke={borderColor}
        strokeWidth={isRepairing || selected ? 1.8 : 1}
      />
      {/* Shine */}
      {!faded && (
        <rect x={-sw/2+1.5} y={-sh/2-standH+1.5} width={sw*0.35} height={1.8}
          rx={0.8} fill="rgba(255,255,255,0.5)"/>
      )}
      {/* Stand */}
      <line x1={0} y1={sh/2-standH} x2={0} y2={sh/2}
        stroke={borderColor} strokeWidth={1.2}/>
      {/* Base */}
      <line x1={-baseW/2} y1={sh/2} x2={baseW/2} y2={sh/2}
        stroke={borderColor} strokeWidth={1.5} strokeLinecap="round"/>

      {/* Selected ring */}
      {selected && !isRepairing && (
        <circle cx={0} cy={0} r={sw/2+4}
          fill="none" stroke="#F59E0B" strokeWidth={2}
          strokeDasharray="3 2" opacity={0.8}/>
      )}
      {/* FEATURE 3: repair badge (red ! on top-right) */}
      {isRepairing && !faded && (
        <g transform={`translate(${sw/2+1},${-sh/2-standH-2})`}>
          <circle cx={0} cy={0} r={4} fill="#ef4444" stroke="#fff" strokeWidth={0.8}/>
          <text x={0} y={1.2} textAnchor="middle" dominantBaseline="middle"
            fontSize={4.5} fill="white" fontWeight="900">!</text>
        </g>
      )}
    </g>
  );
}

// =============================================================================
// ELEVATOR & DIRECTION BADGE  (unchanged)
// =============================================================================
function ElevatorMarker({ ev }: { ev: ElevatorDef }) {
  return (
    <g transform={`translate(${ev.x},${ev.y})`} style={{ pointerEvents: "none" }}>
      <rect x={-22} y={-13} width={44} height={26} rx={5}
        fill="rgba(15,23,42,0.82)" stroke="rgba(251,191,36,0.8)" strokeWidth={1.2}/>
      <text x={-14} y={4} fontSize={9} fill="#fbbf24" fontWeight="700">▲▼</text>
      <text x={2} y={4} fontSize={7} fill="#fef9c3" fontWeight="600"
        textAnchor="start" dominantBaseline="middle">
        {ev.label.replace(" E/V","").replace("E/V","")}
      </text>
    </g>
  );
}

function DirectionBadge({ zone }: { zone: ZoneDef }) {
  if (zone.dir === "single") return null;
  const isWest = zone.dir === "west";
  const bgColor  = isWest ? "rgba(59,130,246,0.18)" : "rgba(139,92,246,0.18)";
  const txtColor = isWest ? "#93C5FD" : "#C4B5FD";
  const arrow    = isWest ? "◀ 삼성역" : "탄천 ▶";
  const cx = (zone.x1 + zone.x2) / 2;
  const cy = zone.y1 + 12;
  const textLen = arrow.length * 5.5;
  return (
    <g style={{ pointerEvents: "none" }}>
      <rect x={cx-textLen/2-4} y={cy-8} width={textLen+8} height={14} rx={3} fill={bgColor}/>
      <text x={cx} y={cy+1} textAnchor="middle" fontSize={8.5} fill={txtColor} fontWeight={700}>
        {arrow}
      </text>
    </g>
  );
}

// =============================================================================
// FLOOR MAP
// =============================================================================
function FloorMap({
  floor, selectedSeatId, filterMode, seatStates, onSelect,
}: {
  floor: FloorDef;
  selectedSeatId: string | null;
  filterMode: "all" | "large" | "standard" | "empty" | "repair";
  seatStates: Record<string, SeatState>;
  onSelect: (seat: SeatDef, zone: ZoneDef) => void;
}) {
  const maskId = `mask-${floor.id}`;

  const getEffectiveType = (seat: SeatDef): MonitorType =>
    seatStates[seat.id]?.monitorType ?? seat.monitor;

  const isVisible = (seat: SeatDef): boolean => {
    if (filterMode === "all") return true;
    if (filterMode === "repair") return !!(seatStates[seat.id]?.isRepairing);
    return getEffectiveType(seat) === filterMode;
  };

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-gray-200 shadow-inner bg-gray-900"
      style={{ aspectRatio: "960/600" }}>
      {/* CSS for repair animation */}
      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
      `}</style>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={floor.imageSrc} alt={`${floor.label} 도면`}
        className="absolute inset-0 w-full h-full object-cover select-none" draggable={false}/>

      {floor.noImage && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20
          bg-amber-500/90 text-white text-xs font-semibold px-3 py-1 rounded-full shadow">
          ⚠ 7층 전용 도면 미포함 — 건물 구조 참고용 표시
        </div>
      )}

      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 960 600"
        preserveAspectRatio="xMidYMid meet">
        <defs>
          <mask id={maskId}>
            <rect width="960" height="600" fill="white"/>
            {floor.zones.map(z => (
              <rect key={z.id} x={z.x1-3} y={z.y1-3}
                width={z.x2-z.x1+6} height={z.y2-z.y1+6} rx={6} fill="black"/>
            ))}
            {floor.elevators.map(ev => (
              <ellipse key={ev.id} cx={ev.x} cy={ev.y} rx={52} ry={38} fill="black"/>
            ))}
          </mask>
        </defs>

        <rect width="960" height="600" fill="rgba(8,14,38,0.68)" mask={`url(#${maskId})`}/>

        {floor.zones.map(z => {
          const isWest = z.dir === "west";
          return (
            <g key={z.id}>
              <rect x={z.x1} y={z.y1} width={z.x2-z.x1} height={z.y2-z.y1}
                fill={isWest ? "rgba(59,130,246,0.04)" : "rgba(139,92,246,0.04)"}
                stroke={isWest ? "rgba(96,165,250,0.55)" : "rgba(167,139,250,0.55)"}
                strokeWidth={2} rx={5} style={{ pointerEvents:"none" }}/>
              <text x={z.x1+7} y={z.y1+15} fontSize={9.5}
                fill={isWest ? "rgba(147,197,253,0.9)" : "rgba(196,181,253,0.9)"}
                fontWeight={700} style={{ pointerEvents:"none" }}>
                {z.label}  ({z.seats.length}석)
              </text>
              <DirectionBadge zone={z}/>
            </g>
          );
        })}

        {floor.elevators.map(ev => <ElevatorMarker key={ev.id} ev={ev}/>)}

        {floor.zones.flatMap(zone =>
          zone.seats.map(seat => {
            const visible = isVisible(seat);
            const effectiveType = getEffectiveType(seat);
            const repairing = !!(seatStates[seat.id]?.isRepairing);
            return (
              <MonitorIcon
                key={seat.id}
                x={seat.x} y={seat.y}
                type={effectiveType}
                selected={seat.id === selectedSeatId}
                faded={!visible}
                isRepairing={repairing}
                onClick={() => onSelect(seat, zone)}
              />
            );
          })
        )}
      </svg>
    </div>
  );
}

// =============================================================================
// FEATURE 2 + 3: SEAT DETAIL MODAL (History + Repair Request)
// =============================================================================
const ENTRY_TYPE_LABELS: Record<HistoryEntryType, string> = {
  install: "설치", repair: "수리", replace: "교체", note: "메모",
};
const ENTRY_TYPE_COLORS: Record<HistoryEntryType, string> = {
  install: "bg-green-100 text-green-700 border-green-200",
  repair:  "bg-red-100 text-red-700 border-red-200",
  replace: "bg-amber-100 text-amber-700 border-amber-200",
  note:    "bg-gray-100 text-gray-600 border-gray-200",
};

function SeatDetailModal({
  seat, zone, floor, building, seatState,
  onClose, onUpdateType, onToggleRepair, onAddHistory,
}: {
  seat: SeatDef; zone: ZoneDef; floor: FloorDef; building: BuildingDef;
  seatState: SeatState;
  onClose: () => void;
  onUpdateType: (type: MonitorType) => void;
  onToggleRepair: () => void;
  onAddHistory: (entry: Omit<HistoryEntry, "id">) => void;
}) {
  const [newContent, setNewContent] = useState("");
  const [newAuthor,  setNewAuthor]  = useState("");
  const [newType,    setNewType]    = useState<HistoryEntryType>("note");

  const handleSubmit = () => {
    if (!newContent.trim()) return;
    onAddHistory({
      date: new Date().toISOString(),
      entryType: newType,
      content: newContent.trim(),
      author: newAuthor.trim() || "관리자",
    });
    setNewContent(""); setNewAuthor("");
  };

  const curType = seatState.monitorType;

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">

        {/* Modal Header */}
        <div className={`px-6 py-4 flex items-start justify-between ${
          curType === "large" ? "bg-violet-700"
          : curType === "empty" ? "bg-red-600" : "bg-blue-600"
        } text-white`}>
          <div>
            <div className="text-xs opacity-70 mb-0.5">좌석 상세 정보</div>
            <div className="text-2xl font-extrabold tracking-widest">{seat.id}</div>
            <div className="text-xs opacity-80 mt-1">
              {building.label} · {floor.label} · {zone.label}
            </div>
          </div>
          <button onClick={onClose} className="text-xl opacity-70 hover:opacity-100 mt-0.5">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* FEATURE 1: Monitor Type Toggle */}
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">모니터 타입 변경</div>
            <div className="flex gap-2">
              {([
                { type: "standard" as MonitorType, label: "표준형 (24/27\")", color: "blue" },
                { type: "large"    as MonitorType, label: "개발자용 (34\")",   color: "violet" },
                { type: "empty"    as MonitorType, label: "빈자리 (설치 필요)", color: "red" },
              ]).map(opt => (
                <button key={opt.type}
                  onClick={() => onUpdateType(opt.type)}
                  className={`flex-1 py-2 px-2 rounded-xl border-2 text-xs font-semibold transition-all ${
                    curType === opt.type
                      ? opt.color === "blue"   ? "border-blue-500 bg-blue-50 text-blue-700"
                      : opt.color === "violet" ? "border-violet-500 bg-violet-50 text-violet-700"
                      :                          "border-red-500 bg-red-50 text-red-700"
                      : "border-gray-200 text-gray-400 hover:border-gray-300"
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* FEATURE 3: Repair Request Toggle */}
          <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-3">
            <div className="flex-1">
              <div className="text-sm font-semibold text-gray-700">수리 요청 (긴급)</div>
              <div className="text-xs text-gray-400">활성화 시 맵에서 붉은색 경고 표시</div>
            </div>
            <button
              onClick={onToggleRepair}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                seatState.isRepairing ? "bg-red-500" : "bg-gray-200"
              }`}>
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                seatState.isRepairing ? "translate-x-6" : "translate-x-1"
              }`}/>
            </button>
            {seatState.isRepairing && (
              <span className="text-xs text-red-600 font-semibold animate-pulse">● 수리 요청 중</span>
            )}
          </div>

          {/* FEATURE 2: Add History Entry */}
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">작업 이력 추가</div>
            <div className="flex gap-2 mb-2">
              {(Object.keys(ENTRY_TYPE_LABELS) as HistoryEntryType[]).map(t => (
                <button key={t} onClick={() => setNewType(t)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                    newType === t
                      ? ENTRY_TYPE_COLORS[t] + " border-opacity-100"
                      : "border-gray-200 text-gray-400 hover:border-gray-300"
                  }`}>
                  {ENTRY_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
            <textarea
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
              rows={2} placeholder="작업 내용을 입력하세요..."
              value={newContent} onChange={e => setNewContent(e.target.value)}
            />
            <div className="flex gap-2 mt-2">
              <input
                className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="담당자 이름"
                value={newAuthor} onChange={e => setNewAuthor(e.target.value)}
              />
              <button
                onClick={handleSubmit}
                disabled={!newContent.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl
                  hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                등록
              </button>
            </div>
          </div>

          {/* FEATURE 2: History Timeline */}
          <div className="px-6 py-4">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              이력 타임라인 ({seatState.history.length}건)
            </div>
            {seatState.history.length === 0 ? (
              <div className="text-center py-6 text-gray-300 text-sm">이력이 없습니다</div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-100"/>
                <div className="space-y-4">
                  {seatState.history.map((entry, idx) => (
                    <div key={entry.id} className="relative pl-9">
                      {/* Dot */}
                      <div className={`absolute left-1 top-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center ${
                        entry.entryType === "repair"   ? "bg-red-400"
                        : entry.entryType === "replace" ? "bg-amber-400"
                        : entry.entryType === "install" ? "bg-green-400"
                        : "bg-gray-300"
                      }`}/>
                      <div className="flex items-start gap-2 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${ENTRY_TYPE_COLORS[entry.entryType]}`}>
                          {ENTRY_TYPE_LABELS[entry.entryType]}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {new Date(entry.date).toLocaleDateString("ko-KR", {
                            year:"numeric", month:"2-digit", day:"2-digit",
                            hour:"2-digit", minute:"2-digit"
                          })}
                        </span>
                        {entry.author && (
                          <span className="text-[10px] text-gray-500 font-medium">{entry.author}</span>
                        )}
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
// FEATURE 5: ADMIN DASHBOARD PANEL
// =============================================================================
function DashboardPanel({
  seatStates,
  onNavigate,
}: {
  seatStates: Record<string, SeatState>;
  onNavigate: (buildingId: string, floorId?: string) => void;
}) {
  // Compute global stats
  const stats = useMemo(() => {
    const allSeats = getAllSeats();
    let totalSeats = 0, totalLarge = 0, totalStandard = 0, totalEmpty = 0, totalRepair = 0;

    const byBuilding = BUILDINGS.map(b => {
      let bSeats = 0, bLarge = 0, bStandard = 0, bEmpty = 0, bRepair = 0;
      b.floors.forEach(f => f.zones.forEach(z => z.seats.forEach(s => {
        const st = seatStates[s.id];
        const type = st?.monitorType ?? s.monitor;
        bSeats++;
        if (type === "large")    bLarge++;
        else if (type === "standard") bStandard++;
        else if (type === "empty")    bEmpty++;
        if (st?.isRepairing) bRepair++;
      })));
      totalSeats    += bSeats;
      totalLarge    += bLarge;
      totalStandard += bStandard;
      totalEmpty    += bEmpty;
      totalRepair   += bRepair;
      return { building: b, seats: bSeats, large: bLarge, standard: bStandard, empty: bEmpty, repair: bRepair };
    });

    return { totalSeats, totalLarge, totalStandard, totalEmpty, totalRepair, byBuilding };
  }, [seatStates]);

  // Repair list
  const repairSeats = useMemo(() => {
    const results: { seatId: string; buildingLabel: string; floorLabel: string; buildingId: string; floorId: string }[] = [];
    BUILDINGS.forEach(b => b.floors.forEach(f => f.zones.forEach(z => z.seats.forEach(s => {
      if (seatStates[s.id]?.isRepairing) {
        results.push({ seatId: s.id, buildingLabel: b.label, floorLabel: f.label, buildingId: b.id, floorId: f.id });
      }
    }))));
    return results;
  }, [seatStates]);

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Title */}
        <div>
          <h2 className="text-xl font-extrabold text-slate-800">전사 자산 현황 대시보드</h2>
          <p className="text-sm text-gray-500 mt-1">본관 · 신관 · S빌딩 전체 모니터 자산 통합 현황</p>
        </div>

        {/* Global KPI Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label: "전체 좌석", value: stats.totalSeats, unit: "석", color: "bg-slate-700", text: "text-white" },
            { label: "표준형 (24/27\")", value: stats.totalStandard, unit: "대", color: "bg-blue-600", text: "text-white" },
            { label: "개발자용 (34\")", value: stats.totalLarge, unit: "대", color: "bg-violet-600", text: "text-white" },
            { label: "수리 필요", value: stats.totalRepair, unit: "대", color: "bg-red-500", text: "text-white" },
            { label: "설치 가능 빈자리", value: stats.totalEmpty, unit: "석", color: "bg-amber-500", text: "text-white" },
          ].map(card => (
            <div key={card.label} className={`${card.color} rounded-2xl p-4 shadow-sm`}>
              <div className={`text-xs font-medium opacity-80 ${card.text}`}>{card.label}</div>
              <div className={`text-3xl font-extrabold mt-1 ${card.text}`}>{card.value}</div>
              <div className={`text-xs opacity-70 ${card.text}`}>{card.unit}</div>
            </div>
          ))}
        </div>

        {/* Building-by-building breakdown */}
        <div className="grid gap-4 sm:grid-cols-3">
          {stats.byBuilding.map(({ building, seats, large, standard, empty, repair }) => (
            <div key={building.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Building header — clickable navigation */}
              <button
                className="w-full px-5 py-3 bg-slate-800 text-white flex items-center justify-between hover:bg-slate-700 transition-colors"
                onClick={() => onNavigate(building.id)}>
                <span className="text-sm font-bold">{building.label}</span>
                <span className="text-xs opacity-60">맵 보기 →</span>
              </button>

              <div className="p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">전체 좌석</span>
                  <span className="font-bold text-gray-800">{seats}석</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-blue-500">표준형 (24/27")</span>
                  <span className="font-bold text-blue-700">{standard}대</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-violet-500">개발자용 (34")</span>
                  <span className="font-bold text-violet-700">{large}대</span>
                </div>
                {empty > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-amber-500">빈자리 (설치 필요)</span>
                    <span className="font-bold text-amber-600">{empty}석</span>
                  </div>
                )}
                {repair > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-red-500">수리 요청</span>
                    <button
                      className="font-bold text-red-600 underline hover:text-red-700"
                      onClick={() => onNavigate(building.id)}>
                      {repair}대 →
                    </button>
                  </div>
                )}

                {/* Floor navigation chips */}
                <div className="pt-2 border-t border-gray-100">
                  <div className="text-xs text-gray-400 mb-1.5">층별 이동</div>
                  <div className="flex flex-wrap gap-1">
                    {building.floors.map(f => {
                      const fRepair = f.zones.flatMap(z=>z.seats).filter(s=>seatStates[s.id]?.isRepairing).length;
                      return (
                        <button key={f.id}
                          onClick={() => onNavigate(building.id, f.id)}
                          className={`px-2 py-0.5 rounded text-xs font-semibold border transition-colors ${
                            fRepair > 0
                              ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                              : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                          }`}>
                          {f.label}{fRepair > 0 ? ` ⚠${fRepair}` : ""}
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
        {repairSeats.length > 0 && (
          <div className="bg-white rounded-2xl border border-red-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-red-50 border-b border-red-100 flex items-center gap-2">
              <span className="text-sm font-bold text-red-700">🔧 수리 요청 현황</span>
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {repairSeats.length}건
              </span>
            </div>
            <div className="divide-y divide-gray-50">
              {repairSeats.map(r => (
                <div key={r.seatId} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse"/>
                  <div className="flex-1">
                    <span className="font-mono text-sm font-bold text-gray-800">{r.seatId}</span>
                    <span className="text-xs text-gray-400 ml-2">{r.buildingLabel} {r.floorLabel}</span>
                  </div>
                  <button
                    onClick={() => onNavigate(r.buildingId, r.floorId)}
                    className="text-xs text-blue-600 underline hover:text-blue-700">
                    지도에서 보기
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// OVERVIEW SIDE PANEL  (floor stats, no seat selected)
// =============================================================================
function OverviewSidePanel({
  building, floor, seatStates,
}: {
  building: BuildingDef; floor: FloorDef;
  seatStates: Record<string, SeatState>;
}) {
  const [tab, setTab] = useState<"stats"|"legend">("stats");
  const allSeats = floor.zones.flatMap(z => z.seats);
  const largeN    = allSeats.filter(s => (seatStates[s.id]?.monitorType ?? s.monitor) === "large").length;
  const stdN      = allSeats.filter(s => (seatStates[s.id]?.monitorType ?? s.monitor) === "standard").length;
  const emptyN    = allSeats.filter(s => (seatStates[s.id]?.monitorType ?? s.monitor) === "empty").length;
  const repairN   = allSeats.filter(s => seatStates[s.id]?.isRepairing).length;

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
        {tab === "stats" && (
          <div className="space-y-2">
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <div className="text-xs text-gray-400">전체 좌석</div>
              <div className="text-2xl font-extrabold text-gray-800">{allSeats.length}석</div>
            </div>
            <div className="bg-violet-50 rounded-lg p-3 border border-violet-100 flex items-center gap-3">
              <div className="flex-1">
                <div className="text-xs text-violet-400">34인치 (개발자)</div>
                <div className="text-xl font-extrabold text-violet-700">{largeN}석</div>
              </div>
              <svg width="28" height="20" viewBox="0 0 28 20">
                <rect x="1" y="1" width="26" height="15" rx="2" fill="rgba(139,92,246,0.8)"/>
                <rect x="3" y="3" width="9" height="2.5" rx="1" fill="rgba(255,255,255,0.45)"/>
                <line x1="14" y1="16" x2="14" y2="19" stroke="#7c3aed" strokeWidth="2"/>
                <line x1="9" y1="19" x2="19" y2="19" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-100 flex items-center gap-3">
              <div className="flex-1">
                <div className="text-xs text-blue-400">24/27인치 (표준)</div>
                <div className="text-xl font-extrabold text-blue-700">{stdN}석</div>
              </div>
              <svg width="22" height="20" viewBox="0 0 22 20">
                <rect x="1" y="1" width="20" height="15" rx="2" fill="rgba(96,165,250,0.8)"/>
                <rect x="3" y="3" width="7" height="2.5" rx="1" fill="rgba(255,255,255,0.45)"/>
                <line x1="11" y1="16" x2="11" y2="19" stroke="#2563eb" strokeWidth="2"/>
                <line x1="7" y1="19" x2="15" y2="19" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            {emptyN > 0 && (
              <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                <div className="text-xs text-amber-500">빈자리 (설치 필요)</div>
                <div className="text-xl font-extrabold text-amber-600">{emptyN}석</div>
              </div>
            )}
            {repairN > 0 && (
              <div className="bg-red-50 rounded-lg p-3 border border-red-200 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse"/>
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
                const lg = z.seats.filter(s => (seatStates[s.id]?.monitorType ?? s.monitor) === "large").length;
                const st = z.seats.filter(s => (seatStates[s.id]?.monitorType ?? s.monitor) === "standard").length;
                const em = z.seats.filter(s => (seatStates[s.id]?.monitorType ?? s.monitor) === "empty").length;
                return (
                  <div key={z.id} className="mb-3 last:mb-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-xs font-semibold text-gray-700">{z.label}</span>
                      <span className="text-xs text-gray-400">{z.seats.length}석</span>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      <span className="text-[10px] bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded font-medium">34" {lg}</span>
                      <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">표준 {st}</span>
                      {em > 0 && <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded font-medium">빈자리 {em}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "legend" && (
          <div className="space-y-3">
            <div className="bg-white border border-gray-100 rounded-lg p-3">
              <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2.5">아이콘 범례</div>
              <div className="space-y-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <svg width="28" height="22" viewBox="0 0 28 22">
                    <rect x="1" y="1" width="26" height="16" rx="2" fill="rgba(139,92,246,0.85)" stroke="rgba(109,40,217,0.9)" strokeWidth="1"/>
                    <rect x="3" y="3" width="9" height="2.5" rx="1" fill="rgba(255,255,255,0.4)"/>
                    <line x1="14" y1="17" x2="14" y2="21" stroke="#7c3aed" strokeWidth="2"/>
                    <line x1="9" y1="21" x2="19" y2="21" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round"/>
                  </svg>
                  <div><div className="font-semibold text-violet-700">34인치 모니터</div><div className="text-gray-400">개발자 와이드</div></div>
                </div>
                <div className="flex items-center gap-2.5">
                  <svg width="22" height="22" viewBox="0 0 22 22">
                    <rect x="1" y="1" width="20" height="16" rx="2" fill="rgba(96,165,250,0.85)" stroke="rgba(37,99,235,0.9)" strokeWidth="1"/>
                    <rect x="3" y="3" width="7" height="2.5" rx="1" fill="rgba(255,255,255,0.4)"/>
                    <line x1="11" y1="17" x2="11" y2="21" stroke="#2563eb" strokeWidth="2"/>
                    <line x1="7" y1="21" x2="15" y2="21" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round"/>
                  </svg>
                  <div><div className="font-semibold text-blue-700">24/27인치 모니터</div><div className="text-gray-400">표준형 업무</div></div>
                </div>
                <div className="flex items-center gap-2.5">
                  <svg width="22" height="22" viewBox="0 0 22 22">
                    <rect x="1" y="1" width="20" height="16" rx="2" fill="none" stroke="rgba(239,68,68,0.7)" strokeWidth="1.5" strokeDasharray="3 2"/>
                    <line x1="3" y1="3" x2="19" y2="15" stroke="rgba(239,68,68,0.6)" strokeWidth="1"/>
                    <line x1="19" y1="3" x2="3" y2="15" stroke="rgba(239,68,68,0.6)" strokeWidth="1"/>
                  </svg>
                  <div><div className="font-semibold text-red-600">빈자리 (설치 필요)</div><div className="text-gray-400">점선 윤곽선 + X</div></div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="relative w-7 h-5 flex items-center justify-center">
                    <div className="w-5 h-3.5 rounded bg-blue-400 opacity-80"/>
                    <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 flex items-center justify-center">
                      <span className="text-[7px] text-white font-black">!</span>
                    </div>
                  </div>
                  <div><div className="font-semibold text-red-600">수리 요청 중</div><div className="text-gray-400">붉은 배지 + 깜빡이는 테두리</div></div>
                </div>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="text-xs font-semibold text-amber-700 mb-1">📍 찾아가는 방법</div>
              <div className="text-[10px] text-amber-600 leading-relaxed space-y-1">
                <p>• <strong>서편</strong> : 삼성역 방면 엘리베이터 이용</p>
                <p>• <strong>동편</strong> : 탄천 방면 엘리베이터 이용</p>
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
  const [buildingId, setBuildingId] = useState<string>("bw");
  const [floorId,    setFloorId]    = useState<string>("bw3");
  const [filterMode, setFilterMode] = useState<"all"|"large"|"standard"|"empty"|"repair">("all");
  const [selected,   setSelected]   = useState<{ seat: SeatDef; zone: ZoneDef } | null>(null);
  const [modalOpen,  setModalOpen]  = useState(false);

  // ── State management ────────────────────────────────────────────────────────
  const [seatStates, setSeatStates] = useState<Record<string, SeatState>>({});
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
  }, []);

  const toggleRepair = useCallback((seatId: string, defaultType: MonitorType) => {
    setSeatStates(prev => {
      const ex = prev[seatId] ?? { seatId, monitorType: defaultType, isRepairing: false, history: [] };
      const next = { ...prev, [seatId]: { ...ex, isRepairing: !ex.isRepairing } };
      persistStates(next); return next;
    });
  }, []);

  const addHistory = useCallback((seatId: string, defaultType: MonitorType, entry: Omit<HistoryEntry,"id">) => {
    setSeatStates(prev => {
      const ex = prev[seatId] ?? { seatId, monitorType: defaultType, isRepairing: false, history: [] };
      const newE: HistoryEntry = { ...entry, id: `h-${Date.now()}-${Math.random().toString(36).slice(2,7)}` };
      const next = { ...prev, [seatId]: { ...ex, history: [newE, ...ex.history] } };
      persistStates(next); return next;
    });
  }, []);

  // ── Building / floor navigation ─────────────────────────────────────────────
  const building = useMemo(() => BUILDINGS.find(b => b.id === buildingId)!, [buildingId]);
  const floor    = useMemo(
    () => building.floors.find(f => f.id === floorId) ?? building.floors[0],
    [building, floorId]
  );

  const handleBuildingChange = useCallback((bid: string, fid?: string) => {
    setBuildingId(bid);
    const b = BUILDINGS.find(x => x.id === bid)!;
    setFloorId(fid ?? b.floors[0].id);
    setSelected(null); setModalOpen(false); setView("map");
  }, []);

  const handleSelect = useCallback((seat: SeatDef, zone: ZoneDef) => {
    setSelected({ seat, zone });
    setModalOpen(true);
  }, []);

  // Floor-level stats (reflects overrides)
  const allSeats   = useMemo(() => floor.zones.flatMap(z => z.seats), [floor]);
  const largeCount = allSeats.filter(s => (seatStates[s.id]?.monitorType ?? s.monitor) === "large").length;
  const stdCount   = allSeats.filter(s => (seatStates[s.id]?.monitorType ?? s.monitor) === "standard").length;
  const emptyCount = allSeats.filter(s => (seatStates[s.id]?.monitorType ?? s.monitor) === "empty").length;
  const repairCount = allSeats.filter(s => seatStates[s.id]?.isRepairing).length;

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-50"
      style={{ fontFamily: "system-ui,-apple-system,sans-serif" }}>

      {/* ── TOP BAR ─────────────────────────────────────────────────────────── */}
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

        {/* Floor-level stat chips (map view only) */}
        {view === "map" && (
          <div className="flex gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs bg-gray-100 text-gray-600 border border-gray-200">
              총 {allSeats.length}석
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs bg-violet-50 text-violet-700 border border-violet-200 font-medium">
              34" {largeCount}석
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 font-medium">
              표준 {stdCount}석
            </span>
            {emptyCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                빈자리 {emptyCount}석
              </span>
            )}
            {repairCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs bg-red-50 text-red-700 border border-red-200 font-semibold animate-pulse">
                🔧 수리 {repairCount}건
              </span>
            )}
          </div>
        )}

        {/* Building + Floor selectors (map view only) */}
        {view === "map" && (
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
                <button key={f.id} onClick={() => { setFloorId(f.id); setSelected(null); setModalOpen(false); }}
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

      {/* Dashboard View */}
      {view === "dashboard" && (
        <DashboardPanel
          seatStates={seatStates}
          onNavigate={(bid, fid) => handleBuildingChange(bid, fid)}
        />
      )}

      {/* Map View */}
      {view === "map" && (
        <>
          {/* FILTER BAR */}
          <div className="flex-none bg-white border-b px-5 py-2 flex items-center gap-4 flex-wrap">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
              {([
                ["all",      "전체"],
                ["large",    "34인치"],
                ["standard", "표준형"],
                ["empty",    "빈자리"],
                ["repair",   "수리 요청"],
              ] as const).map(([mode, label]) => (
                <button key={mode} onClick={() => setFilterMode(mode)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    filterMode===mode
                      ? `bg-white shadow font-semibold ${
                          mode==="repair" ? "text-red-600"
                          : mode==="empty" ? "text-amber-600"
                          : "text-slate-800"
                        }`
                      : "text-slate-500 hover:text-slate-700"
                  }`}>{label}</button>
              ))}
            </div>

            <div className="flex items-center gap-4 text-xs text-gray-500 ml-2 flex-wrap">
              <span className="flex items-center gap-1.5">
                <svg width="14" height="10" viewBox="0 0 14 10"><rect x="0" y="0" width="14" height="8" rx="1" fill="rgba(139,92,246,0.8)"/></svg>
                34인치
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="11" height="10" viewBox="0 0 11 10"><rect x="0" y="0" width="11" height="8" rx="1" fill="rgba(96,165,250,0.8)"/></svg>
                표준형
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="11" height="10" viewBox="0 0 11 10">
                  <rect x="0" y="0" width="11" height="8" rx="1" fill="none" stroke="rgba(239,68,68,0.7)" strokeWidth="1" strokeDasharray="2 1"/>
                </svg>
                빈자리
              </span>
              <span className="flex items-center gap-1.5 text-red-500">
                <svg width="11" height="10" viewBox="0 0 11 10">
                  <rect x="0" y="0" width="11" height="8" rx="1" fill="rgba(96,165,250,0.8)" stroke="#ef4444" strokeWidth="1.5"/>
                  <circle cx="10" cy="1" r="2.5" fill="#ef4444"/>
                </svg>
                수리 요청
              </span>
            </div>
            <div className="ml-auto text-xs text-gray-400">● 아이콘 클릭 → 상세/편집</div>
          </div>

          {/* MAIN CONTENT */}
          <div className="flex-1 flex min-h-0 overflow-hidden">
            <div className="flex-1 min-w-0 p-4 overflow-auto">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-slate-700">{building.label} {floor.label}</span>
                {floor.zones.map(z => (
                  <span key={z.id} className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${
                    z.dir==="west" ? "bg-blue-50 text-blue-600 border-blue-200"
                    : z.dir==="east" ? "bg-violet-50 text-violet-600 border-violet-200"
                    : "bg-gray-50 text-gray-600 border-gray-200"
                  }`}>
                    {z.label}: {z.seats.length}석
                  </span>
                ))}
              </div>

              <FloorMap
                floor={floor}
                selectedSeatId={selected?.seat.id ?? null}
                filterMode={filterMode}
                seatStates={seatStates}
                onSelect={handleSelect}
              />
            </div>

            {/* Right panel */}
            <div className="flex-none border-l bg-white overflow-hidden w-64">
              <OverviewSidePanel
                building={building}
                floor={floor}
                seatStates={seatStates}
              />
            </div>
          </div>
        </>
      )}

      {/* FEATURE 2 + 3: Seat Detail Modal */}
      {modalOpen && selected && (
        <SeatDetailModal
          seat={selected.seat}
          zone={selected.zone}
          floor={floor}
          building={building}
          seatState={getSeatState(selected.seat.id, selected.seat.monitor)}
          onClose={() => { setModalOpen(false); setSelected(null); }}
          onUpdateType={type => updateMonitorType(selected.seat.id, selected.seat.monitor, type)}
          onToggleRepair={() => toggleRepair(selected.seat.id, selected.seat.monitor)}
          onAddHistory={entry => addHistory(selected.seat.id, selected.seat.monitor, entry)}
        />
      )}
    </div>
  );
}