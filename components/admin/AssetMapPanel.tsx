"use client";
import { useState, useMemo, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type MonitorType = "large" | "standard";
// large    = 34인치 개발자 모니터
// standard = 24 / 27인치 표준 모니터

interface SeatDef {
  id: string;
  monitor: MonitorType;
  x: number; // canvas pixel (0-960)
  y: number; // canvas pixel (0-600)
}

interface ZoneDef {
  id: string;
  label: string;
  dir: "west" | "east" | "single";
  x1: number; y1: number; x2: number; y2: number;
  seats: SeatDef[];
}

interface ElevatorDef {
  id: string;
  x: number; y: number;
  label: string;
}

interface FloorDef {
  id: string;
  label: string;
  imageSrc: string;
  zones: ZoneDef[];
  elevators: ElevatorDef[];
  noImage?: boolean;
}

interface BuildingDef {
  id: string;
  label: string;
  floors: FloorDef[];
}

// ─────────────────────────────────────────────────────────────────────────────
// SEAT GRID GENERATOR
// image canvas = 960 × 600px (matches viewBox "0 0 960 600")
// ─────────────────────────────────────────────────────────────────────────────
function mkSeats(
  zone: { x1: number; y1: number; x2: number; y2: number },
  total: number,
  pfx: string,
  largeCnt: number,
  pad = 20
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
    monitor: i < largeCnt ? "large" : "standard",
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

// ─────────────────────────────────────────────────────────────────────────────
// COORDINATE REFERENCE
// All values are in canvas pixels (960×600).
// Floor-plan images are 960×600 JPEGs composited from PPTX slides at 96 DPI.
// ─────────────────────────────────────────────────────────────────────────────

// 본관 standard floor image bounds (3F–9F): x=48 y=147 w=852 h=424
const BW_W = { x1: 52,  y1: 152, x2: 338, y2: 568 }; // 서편 smart office
const BW_E = { x1: 528, y1: 152, x2: 897, y2: 568 }; // 동편 smart office
const BW_EV: ElevatorDef[] = [
  { id: "ev-w", x: 384, y: 300, label: "서편 E/V" },
  { id: "ev-e", x: 494, y: 300, label: "동편 E/V" },
];

// 신관 — each floor's image sits at a slightly different position
// 2F: image 477×556 @ (256,44) → spans x:256–732, y:44–600
const SN2_W = { x1: 262, y1: 56,  x2: 578, y2: 268 }; // 서편 (diagonal)
const SN2_E = { x1: 264, y1: 346, x2: 732, y2: 594 }; // 동편 (rectangular)
const SN2_EV: ElevatorDef[] = [{ id: "ev", x: 500, y: 296, label: "E/V" }];

// 3F: image 568×489 @ (210,94) → spans x:210–778, y:94–583
const SN3_W = { x1: 212, y1: 315, x2: 442, y2: 580 }; // 서편 (diagonal lower)
const SN3_E = { x1: 398, y1: 96,  x2: 778, y2: 298 }; // 동편 (upper rectangular)
const SN3_EV: ElevatorDef[] = [{ id: "ev", x: 300, y: 258, label: "E/V" }];

// 4F: image 477×571 @ (259,50) → spans x:259–735, y:50–621(clip 600)
const SN4_W = { x1: 260, y1: 56,  x2: 585, y2: 275 }; // 서편
const SN4_E = { x1: 262, y1: 358, x2: 734, y2: 598 }; // 동편
const SN4_EV: ElevatorDef[] = [{ id: "ev", x: 500, y: 302, label: "E/V" }];

// 5F: image 489×577 @ (251,47) → spans x:251–740, y:47–624(clip 600)
const SN5_W = { x1: 253, y1: 52,  x2: 582, y2: 272 }; // 서편
const SN5_E = { x1: 255, y1: 352, x2: 739, y2: 598 }; // 동편
const SN5_EV: ElevatorDef[] = [{ id: "ev", x: 494, y: 298, label: "E/V" }];

// S빌딩 — image 673×490 @ (143,66) for 3F; 757×489 @ (130,65) for 4F & 5F
const SB3_A = { x1: 222, y1: 246, x2: 450, y2: 518 }; // Smart Office 1 (서편)
const SB3_B = { x1: 454, y1: 196, x2: 814, y2: 540 }; // Smart Office 2 (동편)
const SB3_EV: ElevatorDef[] = [{ id: "ev", x: 208, y: 162, label: "E/V" }];

const SB4_W = { x1: 132, y1: 262, x2: 462, y2: 543 }; // Casual Work Space (서편)
const SB4_E = { x1: 496, y1: 148, x2: 886, y2: 543 }; // Open Office (동편)
const SB4_EV: ElevatorDef[] = [{ id: "ev", x: 204, y: 148, label: "E/V" }];

const SB5   = { x1: 396, y1: 158, x2: 886, y2: 535 }; // Work Space
const SB5_EV: ElevatorDef[] = [{ id: "ev", x: 204, y: 148, label: "E/V" }];

// ─────────────────────────────────────────────────────────────────────────────
// BUILDING / FLOOR DATA
// ─────────────────────────────────────────────────────────────────────────────
const BUILDINGS: BuildingDef[] = [
  // ── 본관 ──────────────────────────────────────────────────────────────────
  {
    id: "bw", label: "본관",
    floors: [
      {
        id: "bw2", label: "2층",
        imageSrc: "/floor-plans/bongwan-2f.jpg",
        zones: [
          mkZone("bw2-w", "스마트오피스 (서편)", "west",
            { x1: 110, y1: 128, x2: 448, y2: 512 }, 52, "BW2-", 20),
        ],
        elevators: [{ id: "ev", x: 558, y: 328, label: "서/동편 E/V" }],
      },
      {
        id: "bw3", label: "3층", imageSrc: "/floor-plans/bongwan-3f.jpg",
        zones: [
          mkZone("bw3-w", "스마트오피스 (서편)", "west",  BW_W, 54, "BW3W-", 22),
          mkZone("bw3-e", "스마트오피스 (동편)", "east",  BW_E, 71, "BW3E-", 32),
        ],
        elevators: BW_EV,
      },
      {
        id: "bw4", label: "4층", imageSrc: "/floor-plans/bongwan-4f.jpg",
        zones: [
          mkZone("bw4-w", "스마트오피스 (서편)", "west",  BW_W, 74, "BW4W-", 36),
          mkZone("bw4-e", "스마트오피스 (동편)", "east",  BW_E, 49, "BW4E-", 22),
        ],
        elevators: BW_EV,
      },
      {
        id: "bw5", label: "5층", imageSrc: "/floor-plans/bongwan-5f.jpg",
        zones: [
          mkZone("bw5-w", "스마트오피스 (서편)", "west",  BW_W, 74, "BW5W-", 36),
          mkZone("bw5-e", "스마트오피스 (동편)", "east",  BW_E, 49, "BW5E-", 22),
        ],
        elevators: BW_EV,
      },
      {
        id: "bw6", label: "6층", imageSrc: "/floor-plans/bongwan-6f.jpg",
        zones: [
          mkZone("bw6-w", "스마트오피스 (서편)", "west",  BW_W, 67, "BW6W-", 30),
          mkZone("bw6-e", "스마트오피스 (동편)", "east",  BW_E, 65, "BW6E-", 30),
        ],
        elevators: BW_EV,
      },
      {
        id: "bw7", label: "7층",
        imageSrc: "/floor-plans/bongwan-6f.jpg", // 구조 동일 참고
        noImage: true,
        zones: [
          mkZone("bw7-w", "스마트오피스 (서편)", "west",
            { x1: 52, y1: 152, x2: 240, y2: 568 }, 19, "BW7W-", 8),
          mkZone("bw7-e", "스마트오피스 (동편)", "east",  BW_E, 57, "BW7E-", 26),
        ],
        elevators: BW_EV,
      },
      {
        id: "bw8", label: "8층", imageSrc: "/floor-plans/bongwan-8f.jpg",
        zones: [
          mkZone("bw8-w", "스마트오피스 (서편)", "west",  BW_W, 28, "BW8W-", 12),
        ],
        elevators: BW_EV,
      },
      {
        id: "bw9", label: "9층", imageSrc: "/floor-plans/bongwan-9f.jpg",
        zones: [
          mkZone("bw9-w", "스마트오피스 (서편)", "west",  BW_W, 37, "BW9W-", 18),
          mkZone("bw9-e", "스마트오피스 (동편)", "east",  BW_E, 85, "BW9E-", 40),
        ],
        elevators: BW_EV,
      },
    ],
  },

  // ── 신관 ──────────────────────────────────────────────────────────────────
  {
    id: "ns", label: "신관",
    floors: [
      {
        id: "ns2", label: "2층", imageSrc: "/floor-plans/singwan-2f.jpg",
        zones: [
          mkZone("ns2-w", "스마트오피스 (서편)", "west",  SN2_W, 31, "NS2W-", 14),
          mkZone("ns2-e", "스마트오피스 (동편)", "east",  SN2_E, 48, "NS2E-", 22),
        ],
        elevators: SN2_EV,
      },
      {
        id: "ns3", label: "3층", imageSrc: "/floor-plans/singwan-3f.jpg",
        zones: [
          mkZone("ns3-w", "스마트오피스 (서편)", "west",  SN3_W, 40, "NS3W-", 18),
          mkZone("ns3-e", "스마트오피스 (동편)", "east",  SN3_E, 60, "NS3E-", 28),
        ],
        elevators: SN3_EV,
      },
      {
        id: "ns4", label: "4층", imageSrc: "/floor-plans/singwan-4f.jpg",
        zones: [
          mkZone("ns4-w", "스마트오피스 (서편)", "west",  SN4_W, 40, "NS4W-", 18),
          mkZone("ns4-e", "스마트오피스 (동편)", "east",  SN4_E, 51, "NS4E-", 24),
        ],
        elevators: SN4_EV,
      },
      {
        id: "ns5", label: "5층", imageSrc: "/floor-plans/singwan-5f.jpg",
        zones: [
          mkZone("ns5-w", "스마트오피스 (서편)", "west",  SN5_W, 35, "NS5W-", 16),
          mkZone("ns5-e", "스마트오피스 (동편)", "east",  SN5_E, 48, "NS5E-", 22),
        ],
        elevators: SN5_EV,
      },
    ],
  },

  // ── S빌딩 ─────────────────────────────────────────────────────────────────
  {
    id: "sb", label: "S빌딩",
    floors: [
      {
        id: "sb3", label: "3층", imageSrc: "/floor-plans/sbldg-3f.jpg",
        zones: [
          mkZone("sb3-a", "스마트오피스 1 (서편)", "west",   SB3_A, 19, "SB3A-", 8),
          mkZone("sb3-b", "스마트오피스 2 (동편)", "east",   SB3_B, 32, "SB3B-", 16),
        ],
        elevators: SB3_EV,
      },
      {
        id: "sb4", label: "4층", imageSrc: "/floor-plans/sbldg-4f.jpg",
        zones: [
          mkZone("sb4-w", "Casual Work (서편)", "west",  SB4_W, 21, "SB4W-", 10),
          mkZone("sb4-e", "Open Office (동편)",  "east",  SB4_E, 40, "SB4E-", 20),
        ],
        elevators: SB4_EV,
      },
      {
        id: "sb5", label: "5층", imageSrc: "/floor-plans/sbldg-5f.jpg",
        zones: [
          mkZone("sb5-so", "스마트오피스", "single", SB5, 36, "SB5-", 18),
        ],
        elevators: SB5_EV,
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// MONITOR ICON COMPONENTS
// 34인치 = widescreen rectangle  /  24/27인치 = standard rectangle
// ─────────────────────────────────────────────────────────────────────────────
function MonitorIcon({
  x, y, type, selected, faded,
  onClick,
}: {
  x: number; y: number;
  type: MonitorType;
  selected: boolean;
  faded: boolean;
  onClick: () => void;
}) {
  const isLarge = type === "large";
  // Widescreen 34": 18×11  /  Standard 24/27": 13×11
  const sw = isLarge ? 18 : 13;
  const sh = 11;
  const standH = 4;
  const baseW = isLarge ? 10 : 8;

  const screenColor = selected
    ? "#F59E0B"
    : isLarge
    ? "rgba(167,139,250,0.92)"   // violet-400
    : "rgba(96,165,250,0.92)";   // blue-400

  const borderColor = selected
    ? "#D97706"
    : isLarge ? "rgba(139,92,246,0.9)" : "rgba(37,99,235,0.9)";

  const opacity = faded ? 0.18 : 1;

  return (
    <g
      transform={`translate(${x},${y})`}
      opacity={opacity}
      style={{ cursor: faded ? "default" : "pointer", pointerEvents: faded ? "none" : "all" }}
      onClick={!faded ? onClick : undefined}
    >
      {/* Screen */}
      <rect
        x={-sw / 2} y={-sh / 2 - standH}
        width={sw} height={sh}
        rx={1.5}
        fill={screenColor}
        stroke={borderColor}
        strokeWidth={selected ? 1.8 : 1}
      />
      {/* Screen shine */}
      {!faded && (
        <rect
          x={-sw / 2 + 1.5} y={-sh / 2 - standH + 1.5}
          width={sw * 0.35} height={1.8}
          rx={0.8}
          fill="rgba(255,255,255,0.5)"
        />
      )}
      {/* Stand */}
      <line
        x1={0} y1={sh / 2 - standH}
        x2={0} y2={sh / 2 - standH + standH}
        stroke={borderColor} strokeWidth={1.2}
      />
      {/* Base */}
      <line
        x1={-baseW / 2} y1={sh / 2}
        x2={baseW / 2}  y2={sh / 2}
        stroke={borderColor} strokeWidth={1.5} strokeLinecap="round"
      />
      {/* Selected ring */}
      {selected && (
        <circle cx={0} cy={0} r={sw / 2 + 4}
          fill="none" stroke="#F59E0B" strokeWidth={2}
          strokeDasharray="3 2" opacity={0.8}
        />
      )}
    </g>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ELEVATOR MARKER
// ─────────────────────────────────────────────────────────────────────────────
function ElevatorMarker({ ev }: { ev: ElevatorDef }) {
  return (
    <g transform={`translate(${ev.x},${ev.y})`} style={{ pointerEvents: "none" }}>
      {/* Background pill */}
      <rect x={-22} y={-13} width={44} height={26} rx={5}
        fill="rgba(15,23,42,0.82)" stroke="rgba(251,191,36,0.8)" strokeWidth={1.2}
      />
      {/* Arrow up/down symbols */}
      <text x={-14} y={4} fontSize={9} fill="#fbbf24" fontWeight="700">▲▼</text>
      {/* Label */}
      <text x={2} y={4} fontSize={7} fill="#fef9c3" fontWeight="600"
        textAnchor="start" dominantBaseline="middle">
        {ev.label.replace(" E/V","").replace("E/V","")}
      </text>
    </g>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ZONE DIRECTION BADGE  (서편 삼성역 / 동편 탄천)
// ─────────────────────────────────────────────────────────────────────────────
function DirectionBadge({ zone }: { zone: ZoneDef }) {
  if (zone.dir === "single") return null;
  const isWest = zone.dir === "west";
  const bgColor  = isWest  ? "rgba(59,130,246,0.18)"  : "rgba(139,92,246,0.18)";
  const txtColor = isWest  ? "#93C5FD"                : "#C4B5FD";
  const arrow    = isWest  ? "◀ 삼성역"               : "탄천 ▶";
  const cx       = (zone.x1 + zone.x2) / 2;
  const cy       = zone.y1 + 12;
  const textLen  = arrow.length * 5.5;
  return (
    <g style={{ pointerEvents: "none" }}>
      <rect x={cx - textLen / 2 - 4} y={cy - 8} width={textLen + 8} height={14}
        rx={3} fill={bgColor}
      />
      <text x={cx} y={cy + 1} textAnchor="middle" fontSize={8.5}
        fill={txtColor} fontWeight={700}
      >
        {arrow}
      </text>
    </g>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FLOOR MAP  (full plan + SVG overlay with masking)
// ─────────────────────────────────────────────────────────────────────────────
function FloorMap({
  floor,
  selectedSeatId,
  filterMode,
  onSelect,
}: {
  floor: FloorDef;
  selectedSeatId: string | null;
  filterMode: "all" | "large" | "standard";
  onSelect: (seat: SeatDef, zone: ZoneDef) => void;
}) {
  const maskId = `mask-${floor.id}`;
  const allSeats = useMemo(
    () => floor.zones.flatMap(z => z.seats.map(s => ({ seat: s, zone: z }))),
    [floor]
  );
  const visibleSet = useMemo(() => {
    if (filterMode === "all") return new Set(allSeats.map(s => s.seat.id));
    return new Set(allSeats.filter(s => s.seat.monitor === filterMode).map(s => s.seat.id));
  }, [allSeats, filterMode]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-gray-200 shadow-inner bg-gray-900"
      style={{ aspectRatio: "960/600" }}
    >
      {/* Floor plan background image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={floor.imageSrc}
        alt={`${floor.label} 도면`}
        className="absolute inset-0 w-full h-full object-cover select-none"
        draggable={false}
      />

      {/* 7층 warning banner */}
      {floor.noImage && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20
          bg-amber-500/90 text-white text-xs font-semibold px-3 py-1 rounded-full shadow">
          ⚠ 7층 전용 도면 미포함 — 건물 구조 참고용 표시
        </div>
      )}

      {/* SVG overlay */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 960 600"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Mask = white blocks dark overlay / black = hole (floor plan shows through) */}
          <mask id={maskId}>
            <rect width="960" height="600" fill="white" />
            {/* Punch holes for smart office zones */}
            {floor.zones.map(z => (
              <rect key={z.id}
                x={z.x1 - 3} y={z.y1 - 3}
                width={z.x2 - z.x1 + 6} height={z.y2 - z.y1 + 6}
                rx={6} fill="black"
              />
            ))}
            {/* Punch holes for elevator areas */}
            {floor.elevators.map(ev => (
              <ellipse key={ev.id} cx={ev.x} cy={ev.y} rx={52} ry={38} fill="black" />
            ))}
          </mask>
        </defs>

        {/* Dark overlay — leaves zone and elevator areas bright */}
        <rect width="960" height="600"
          fill="rgba(8, 14, 38, 0.68)"
          mask={`url(#${maskId})`}
        />

        {/* Zone highlight borders */}
        {floor.zones.map(z => {
          const isWest = z.dir === "west";
          const borderColor = isWest ? "rgba(96,165,250,0.55)" : "rgba(167,139,250,0.55)";
          const fillColor   = isWest ? "rgba(59,130,246,0.04)" : "rgba(139,92,246,0.04)";
          return (
            <g key={z.id}>
              <rect
                x={z.x1} y={z.y1}
                width={z.x2 - z.x1} height={z.y2 - z.y1}
                fill={fillColor}
                stroke={borderColor}
                strokeWidth={2}
                rx={5}
                style={{ pointerEvents: "none" }}
              />
              {/* Zone label */}
              <text
                x={z.x1 + 7} y={z.y1 + 15}
                fontSize={9.5} fill={isWest ? "rgba(147,197,253,0.9)" : "rgba(196,181,253,0.9)"}
                fontWeight={700}
                style={{ pointerEvents: "none" }}
              >
                {z.label}  ({z.seats.length}석)
              </text>
              {/* Direction badge */}
              <DirectionBadge zone={z} />
            </g>
          );
        })}

        {/* Elevator markers */}
        {floor.elevators.map(ev => (
          <ElevatorMarker key={ev.id} ev={ev} />
        ))}

        {/* Seat icons */}
        {floor.zones.flatMap(zone =>
          zone.seats.map(seat => {
            const isVisible = visibleSet.has(seat.id);
            const isSelected = seat.id === selectedSeatId;
            return (
              <MonitorIcon
                key={seat.id}
                x={seat.x} y={seat.y}
                type={seat.monitor}
                selected={isSelected}
                faded={!isVisible}
                onClick={() => onSelect(seat, zone)}
              />
            );
          })
        )}
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SEAT INFO PANEL
// ─────────────────────────────────────────────────────────────────────────────
function InfoPanel({
  seat, zone, floor, building,
  onClose,
}: {
  seat: SeatDef;
  zone: ZoneDef;
  floor: FloorDef;
  building: BuildingDef;
  onClose: () => void;
}) {
  const isLarge = seat.monitor === "large";
  return (
    <div className="flex flex-col h-full text-sm">
      {/* Header */}
      <div className={`px-5 py-4 text-white flex items-start justify-between ${
        isLarge ? "bg-violet-700" : "bg-blue-600"
      }`}>
        <div>
          <div className="text-xs opacity-70 mb-0.5">좌석 정보</div>
          <div className="text-2xl font-extrabold tracking-widest leading-tight">{seat.id}</div>
          <div className="text-xs opacity-80 mt-1">
            {building.label} · {floor.label} · {zone.label}
          </div>
        </div>
        <button onClick={onClose} className="opacity-70 hover:opacity-100 text-xl mt-0.5">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Monitor spec card */}
        <div className={`rounded-xl p-4 border ${
          isLarge
            ? "bg-violet-50 border-violet-200"
            : "bg-blue-50 border-blue-200"
        }`}>
          <div className="flex items-center gap-3">
            {/* Mini monitor visual */}
            <svg width="44" height="38" viewBox="0 0 44 38">
              {isLarge ? (
                // 34인치 — wide
                <>
                  <rect x="2" y="4" width="40" height="24" rx="2.5"
                    fill={isLarge ? "#7c3aed" : "#2563eb"} opacity={0.85}/>
                  <rect x="4" y="6" width="14" height="3" rx="1" fill="rgba(255,255,255,0.4)"/>
                  <line x1="22" y1="28" x2="22" y2="34" stroke="#7c3aed" strokeWidth="2"/>
                  <line x1="14" y1="34" x2="30" y2="34" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round"/>
                </>
              ) : (
                // 24/27인치 — standard
                <>
                  <rect x="6" y="4" width="32" height="24" rx="2.5"
                    fill="#2563eb" opacity={0.85}/>
                  <rect x="8" y="6" width="11" height="3" rx="1" fill="rgba(255,255,255,0.4)"/>
                  <line x1="22" y1="28" x2="22" y2="34" stroke="#2563eb" strokeWidth="2"/>
                  <line x1="15" y1="34" x2="29" y2="34" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round"/>
                </>
              )}
            </svg>
            <div>
              <div className={`text-lg font-extrabold ${isLarge ? "text-violet-800" : "text-blue-800"}`}>
                {isLarge ? "34인치" : "24 / 27인치"}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {isLarge ? "개발자 와이드 모니터" : "표준형 업무 모니터"}
              </div>
            </div>
          </div>
        </div>

        {/* Location info */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
          <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">위치 정보</div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">건물</span>
              <span className="font-semibold text-gray-800">{building.label}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">층</span>
              <span className="font-semibold text-gray-800">{floor.label}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">구역</span>
              <span className="font-semibold text-gray-800">{zone.label}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">방향</span>
              <span className="font-semibold text-gray-800">
                {zone.dir === "west" ? "서편 (삼성역 방면)" : zone.dir === "east" ? "동편 (탄천 방면)" : "-"}
              </span>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="rounded-xl border border-gray-100 p-4">
          <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">범례</div>
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <svg width="22" height="16" viewBox="0 0 22 16">
                <rect x="1" y="1" width="20" height="12" rx="1.5" fill="rgba(139,92,246,0.85)" stroke="rgba(109,40,217,0.9)" strokeWidth="1"/>
              </svg>
              <span className="text-xs text-gray-600">34인치 — 개발자 모니터</span>
            </div>
            <div className="flex items-center gap-2.5">
              <svg width="18" height="16" viewBox="0 0 18 16">
                <rect x="1" y="1" width="16" height="12" rx="1.5" fill="rgba(96,165,250,0.85)" stroke="rgba(37,99,235,0.9)" strokeWidth="1"/>
              </svg>
              <span className="text-xs text-gray-600">24/27인치 — 표준형 모니터</span>
            </div>
            <div className="flex items-center gap-2.5">
              <svg width="18" height="16" viewBox="0 0 18 16">
                <rect x="1" y="1" width="16" height="12" rx="1.5" fill="#F59E0B" stroke="#D97706" strokeWidth="1"/>
              </svg>
              <span className="text-xs text-gray-600">선택된 좌석</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OVERVIEW / HISTORY TABS  (우측 패널, 좌석 미선택 시)
// ─────────────────────────────────────────────────────────────────────────────
function OverviewSidePanel({
  building, floor,
}: {
  building: BuildingDef;
  floor: FloorDef;
}) {
  const [tab, setTab] = useState<"stats" | "legend">("stats");

  const allSeats  = floor.zones.flatMap(z => z.seats);
  const largeN    = allSeats.filter(s => s.monitor === "large").length;
  const standardN = allSeats.length - largeN;

  return (
    <div className="flex flex-col h-full text-sm">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-800 text-white">
        <div className="text-xs opacity-60 mb-0.5">현황</div>
        <div className="font-bold">{building.label} {floor.label}</div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-100 bg-white">
        {([ ["stats","📊 현황"], ["legend","ℹ 안내"] ] as const).map(([t, l]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              tab === t
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {tab === "stats" && (
          <div className="space-y-3">
            {/* KPI cards */}
            <div className="grid grid-cols-1 gap-2">
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <div className="text-xs text-gray-400">전체 좌석</div>
                <div className="text-2xl font-extrabold text-gray-800 mt-0.5">{allSeats.length}석</div>
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
                  <div className="text-xl font-extrabold text-blue-700">{standardN}석</div>
                </div>
                <svg width="22" height="20" viewBox="0 0 22 20">
                  <rect x="1" y="1" width="20" height="15" rx="2" fill="rgba(96,165,250,0.8)"/>
                  <rect x="3" y="3" width="7" height="2.5" rx="1" fill="rgba(255,255,255,0.45)"/>
                  <line x1="11" y1="16" x2="11" y2="19" stroke="#2563eb" strokeWidth="2"/>
                  <line x1="7" y1="19" x2="15" y2="19" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </div>
            </div>

            {/* Zone breakdown */}
            <div className="bg-white border border-gray-100 rounded-lg p-3">
              <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">구역별 현황</div>
              {floor.zones.map(z => {
                const lg = z.seats.filter(s => s.monitor === "large").length;
                const st = z.seats.length - lg;
                return (
                  <div key={z.id} className="mb-3 last:mb-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-xs font-semibold text-gray-700">{z.label}</span>
                      <span className="text-xs text-gray-400">{z.seats.length}석</span>
                    </div>
                    <div className="flex gap-1.5">
                      <span className="inline-flex items-center gap-1 text-[10px] bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded font-medium">
                        ▬ 34인치 {lg}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">
                        ▬ 표준 {st}
                      </span>
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
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <svg width="28" height="22" viewBox="0 0 28 22">
                    <rect x="1" y="1" width="26" height="16" rx="2" fill="rgba(139,92,246,0.85)" stroke="rgba(109,40,217,0.9)" strokeWidth="1"/>
                    <rect x="3" y="3" width="9" height="2.5" rx="1" fill="rgba(255,255,255,0.4)"/>
                    <line x1="14" y1="17" x2="14" y2="21" stroke="#7c3aed" strokeWidth="2"/>
                    <line x1="9" y1="21" x2="19" y2="21" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round"/>
                  </svg>
                  <div>
                    <div className="text-xs font-semibold text-violet-700">34인치 모니터</div>
                    <div className="text-[10px] text-gray-400">개발자 와이드 모니터 (Wide)</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <svg width="22" height="22" viewBox="0 0 22 22">
                    <rect x="1" y="1" width="20" height="16" rx="2" fill="rgba(96,165,250,0.85)" stroke="rgba(37,99,235,0.9)" strokeWidth="1"/>
                    <rect x="3" y="3" width="7" height="2.5" rx="1" fill="rgba(255,255,255,0.4)"/>
                    <line x1="11" y1="17" x2="11" y2="21" stroke="#2563eb" strokeWidth="2"/>
                    <line x1="7" y1="21" x2="15" y2="21" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round"/>
                  </svg>
                  <div>
                    <div className="text-xs font-semibold text-blue-700">24 / 27인치 모니터</div>
                    <div className="text-[10px] text-gray-400">표준형 업무 모니터</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-7 h-5 bg-amber-100 rounded flex items-center justify-center border border-amber-300">
                    <span className="text-[10px] text-amber-700 font-bold">▲▼</span>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-700">엘리베이터 (E/V)</div>
                    <div className="text-[10px] text-gray-400">서편 = 삼성역 방면 / 동편 = 탄천 방면</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="text-xs font-semibold text-amber-700 mb-1">📍 찾아가는 방법</div>
              <div className="text-[10px] text-amber-600 leading-relaxed space-y-1">
                <p>• <strong>서편</strong> : 삼성역 방면 엘리베이터 이용</p>
                <p>• <strong>동편</strong> : 탄천 방면 엘리베이터 이용</p>
                <p>• 스마트오피스 구역 외 공간은 표시 제한 (대외비)</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PANEL
// ─────────────────────────────────────────────────────────────────────────────
export default function AssetMapPanel() {
  const [buildingId, setBuildingId] = useState<string>("bw");
  const [floorId,    setFloorId]    = useState<string>("bw3");
  const [filterMode, setFilterMode] = useState<"all" | "large" | "standard">("all");
  const [selected,   setSelected]   = useState<{ seat: SeatDef; zone: ZoneDef } | null>(null);

  const building = useMemo(() => BUILDINGS.find(b => b.id === buildingId)!, [buildingId]);
  const floor    = useMemo(
    () => building.floors.find(f => f.id === floorId) ?? building.floors[0],
    [building, floorId]
  );

  // Global stats (current floor)
  const allSeats   = useMemo(() => floor.zones.flatMap(z => z.seats), [floor]);
  const largeCount = allSeats.filter(s => s.monitor === "large").length;
  const stdCount   = allSeats.length - largeCount;

  const handleBuildingChange = useCallback((bid: string) => {
    setBuildingId(bid);
    const b = BUILDINGS.find(x => x.id === bid)!;
    setFloorId(b.floors[0].id);
    setSelected(null);
  }, []);

  const handleFloorChange = useCallback((fid: string) => {
    setFloorId(fid);
    setSelected(null);
  }, []);

  const handleSelect = useCallback((seat: SeatDef, zone: ZoneDef) => {
    setSelected(prev => prev?.seat.id === seat.id ? null : { seat, zone });
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-50"
      style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
    >

      {/* ── TOP BAR ───────────────────────────────────────────────────────── */}
      <div className="flex-none bg-white border-b px-5 py-3 flex flex-wrap items-center gap-3 shadow-sm">
        <div className="shrink-0">
          <div className="text-xs text-gray-400">스마트오피스</div>
          <div className="text-base font-bold text-slate-800">모니터 자산 맵</div>
        </div>

        {/* Floor stat chips */}
        <div className="flex gap-1.5 flex-wrap">
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs
            bg-gray-100 text-gray-600 border border-gray-200">
            <span className="w-2 h-2 rounded-sm bg-gray-400"/>
            총 {allSeats.length}석
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs
            bg-violet-50 text-violet-700 border border-violet-200 font-medium">
            <svg width="10" height="8" viewBox="0 0 10 8">
              <rect x="0" y="0" width="10" height="6" rx="1" fill="rgba(139,92,246,0.8)"/>
            </svg>
            34인치 {largeCount}석
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs
            bg-blue-50 text-blue-700 border border-blue-200 font-medium">
            <svg width="8" height="8" viewBox="0 0 8 8">
              <rect x="0" y="0" width="8" height="6" rx="1" fill="rgba(96,165,250,0.8)"/>
            </svg>
            24/27인치 {stdCount}석
          </span>
        </div>

        {/* Building selector */}
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white">
            {BUILDINGS.map(b => (
              <button key={b.id}
                onClick={() => handleBuildingChange(b.id)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors border-r border-gray-200 last:border-0 ${
                  b.id === buildingId
                    ? "bg-slate-800 text-white"
                    : "text-slate-600 hover:bg-gray-50"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>

          {/* Floor selector */}
          <div className="flex gap-1 flex-wrap">
            {building.floors.map(f => (
              <button key={f.id}
                onClick={() => handleFloorChange(f.id)}
                title={`${f.label} 스마트오피스`}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                  f.id === floorId
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-white text-slate-500 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                }`}
              >
                {f.label.replace("층", "F")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── FILTER BAR ────────────────────────────────────────────────────── */}
      <div className="flex-none bg-white border-b px-5 py-2 flex items-center gap-4">
        {/* Filter buttons */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {([
            ["all",      "전체 보기",     ""],
            ["large",    "34인치만",      "bg-violet-100 text-violet-700"],
            ["standard", "24/27인치만",   "bg-blue-100 text-blue-700"],
          ] as [string, string, string][]).map(([mode, label, _]) => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode as typeof filterMode)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                filterMode === mode
                  ? "bg-white shadow text-slate-800 font-semibold"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Visual legend row */}
        <div className="flex items-center gap-4 text-xs text-gray-500 ml-2">
          <span className="flex items-center gap-1.5">
            <svg width="14" height="10" viewBox="0 0 14 10">
              <rect x="0" y="0" width="14" height="8" rx="1" fill="rgba(139,92,246,0.8)"/>
            </svg>
            34인치
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="11" height="10" viewBox="0 0 11 10">
              <rect x="0" y="0" width="11" height="8" rx="1" fill="rgba(96,165,250,0.8)"/>
            </svg>
            24/27인치
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="11" height="10" viewBox="0 0 11 10">
              <rect x="0" y="0" width="11" height="8" rx="1" fill="#F59E0B"/>
            </svg>
            선택됨
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-3.5 bg-yellow-900/60 rounded text-center leading-3.5 text-[8px] text-yellow-200 font-bold">E/V</span>
            엘리베이터
          </span>
        </div>

        <div className="ml-auto text-xs text-gray-400">
          ● 아이콘 클릭 시 좌석 정보 확인
        </div>
      </div>

      {/* ── MAIN CONTENT ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* Map area */}
        <div className="flex-1 min-w-0 p-4 overflow-auto">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-slate-700">{building.label} {floor.label}</span>
            {floor.zones.map(z => (
              <span key={z.id}
                className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${
                  z.dir === "west"
                    ? "bg-blue-50 text-blue-600 border-blue-200"
                    : z.dir === "east"
                    ? "bg-violet-50 text-violet-600 border-violet-200"
                    : "bg-gray-50 text-gray-600 border-gray-200"
                }`}
              >
                {z.label}: {z.seats.length}석
              </span>
            ))}
            {selected && (
              <span className="ml-auto text-xs text-amber-600 font-semibold animate-pulse">
                선택: {selected.seat.id}
              </span>
            )}
          </div>

          <FloorMap
            floor={floor}
            selectedSeatId={selected?.seat.id ?? null}
            filterMode={filterMode}
            onSelect={handleSelect}
          />
        </div>

        {/* Right panel */}
        <div
          className={`flex-none border-l bg-white overflow-hidden transition-all duration-300 ${
            selected ? "w-72" : "w-64"
          }`}
          style={{ minWidth: selected ? 288 : 256 }}
        >
          {selected ? (
            <InfoPanel
              seat={selected.seat}
              zone={selected.zone}
              floor={floor}
              building={building}
              onClose={() => setSelected(null)}
            />
          ) : (
            <OverviewSidePanel building={building} floor={floor} />
          )}
        </div>
      </div>
    </div>
  );
}
