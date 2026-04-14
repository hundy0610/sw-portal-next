"use client";
import { useState, useEffect, useMemo, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type MonitorType = "24" | "27" | "34" | "none" | null;
// null  = 미확인 (not yet recorded)
// "24"  = 24인치
// "27"  = 27인치
// "34"  = 34인치
// "none"= 미설치 (no monitor)

interface ZoneDef {
  id: string;
  label: string;
  rows: number;
  cols: number;
  totalSeats: number; // may be < rows×cols for irregular zones
}

interface FloorDef {
  id: string;
  label: string;
  zones: ZoneDef[];
}

interface BuildingDef {
  id: string;
  label: string;
  color: string; // tailwind bg class for accent
  floors: FloorDef[];
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILDING / FLOOR / ZONE DATA  (derived from floor plan analysis)
// ─────────────────────────────────────────────────────────────────────────────
const BUILDINGS: BuildingDef[] = [
  {
    id: "bw", label: "본관", color: "bg-sky-600",
    floors: [
      { id: "bw2",  label: "2층",  zones: [{ id: "main", label: "스마트오피스", rows: 4,  cols: 13, totalSeats: 52 }] },
      { id: "bw3",  label: "3층",  zones: [
        { id: "w", label: "서편", rows: 6, cols: 9,  totalSeats: 54 },
        { id: "e", label: "동편", rows: 6, cols: 10, totalSeats: 60 },
      ]},
      { id: "bw4",  label: "4층",  zones: [
        { id: "w", label: "서편", rows: 5, cols: 11, totalSeats: 52 },
        { id: "e", label: "동편", rows: 6, cols: 10, totalSeats: 59 },
      ]},
      { id: "bw5",  label: "5층",  zones: [
        { id: "w", label: "서편", rows: 6, cols: 10, totalSeats: 57 },
        { id: "e", label: "동편", rows: 6, cols: 11, totalSeats: 64 },
      ]},
      { id: "bw6",  label: "6층",  zones: [
        { id: "w", label: "서편", rows: 7, cols: 10, totalSeats: 67 },
        { id: "e", label: "동편", rows: 7, cols: 10, totalSeats: 65 },
      ]},
      { id: "bw7",  label: "7층",  zones: [
        { id: "w", label: "서편", rows: 6, cols: 10, totalSeats: 57 },
        { id: "e", label: "동편", rows: 5, cols: 10, totalSeats: 47 },
      ]},
      { id: "bw8",  label: "8층",  zones: [{ id: "main", label: "스마트오피스", rows: 4, cols: 7,  totalSeats: 28 }] },
      { id: "bw9",  label: "9층",  zones: [
        { id: "w", label: "서편", rows: 6, cols: 9,  totalSeats: 53 },
        { id: "e", label: "동편", rows: 6, cols: 10, totalSeats: 59 },
      ]},
    ],
  },
  {
    id: "ns", label: "신관", color: "bg-emerald-600",
    floors: [
      { id: "ns2",  label: "2층",  zones: [
        { id: "e", label: "동편", rows: 6, cols: 8,  totalSeats: 44 },
        { id: "w", label: "서편", rows: 5, cols: 7,  totalSeats: 35 },
      ]},
      { id: "ns3",  label: "3층",  zones: [
        { id: "e", label: "동편", rows: 6, cols: 10, totalSeats: 60 },
        { id: "w", label: "서편", rows: 5, cols: 8,  totalSeats: 40 },
      ]},
      { id: "ns4",  label: "4층",  zones: [
        { id: "e", label: "동편", rows: 6, cols: 9,  totalSeats: 51 },
        { id: "w", label: "서편", rows: 5, cols: 8,  totalSeats: 40 },
      ]},
      { id: "ns5",  label: "5층",  zones: [
        { id: "e", label: "동편", rows: 6, cols: 8,  totalSeats: 48 },
        { id: "w", label: "서편", rows: 5, cols: 7,  totalSeats: 35 },
      ]},
    ],
  },
  {
    id: "sb", label: "S빌딩", color: "bg-violet-600",
    floors: [
      { id: "sb3",  label: "3층",  zones: [{ id: "main", label: "스마트오피스", rows: 3, cols: 17, totalSeats: 51 }] },
      { id: "sb4",  label: "4층",  zones: [
        { id: "focus", label: "포커스존",    rows: 3, cols: 7,  totalSeats: 21 },
        { id: "work",  label: "워크스페이스", rows: 4, cols: 10, totalSeats: 40 },
      ]},
      { id: "sb5",  label: "5층",  zones: [{ id: "main", label: "스마트오피스", rows: 3, cols: 12, totalSeats: 36 }] },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SEAT ID HELPER
// ─────────────────────────────────────────────────────────────────────────────
function seatId(buildingId: string, floorId: string, zoneId: string, n: number): string {
  return `${buildingId}/${floorId}/${zoneId}/${String(n).padStart(3, "0")}`;
}

// Get all seat IDs for a zone
function zoneSeats(b: BuildingDef, f: FloorDef, z: ZoneDef): string[] {
  return Array.from({ length: z.totalSeats }, (_, i) => seatId(b.id, f.id, z.id, i + 1));
}

// ─────────────────────────────────────────────────────────────────────────────
// COLOR / LABEL MAPS
// ─────────────────────────────────────────────────────────────────────────────
const MONITOR_LABEL: Record<NonNullable<MonitorType>, string> = {
  "24":   '24"',
  "27":   '27"',
  "34":   '34"',
  "none": "미설치",
};

const SEAT_BG: Record<string, string> = {
  "24":   "bg-sky-400   hover:bg-sky-300   text-white",
  "27":   "bg-indigo-500 hover:bg-indigo-400 text-white",
  "34":   "bg-violet-600 hover:bg-violet-500 text-white",
  "none": "bg-rose-400  hover:bg-rose-300  text-white",
  "null": "bg-gray-200  hover:bg-gray-300  text-gray-500",
};

const LEGEND: Array<{ type: MonitorType | "null"; label: string; cls: string }> = [
  { type: "27",   label: '27"',  cls: "bg-indigo-500" },
  { type: "34",   label: '34"',  cls: "bg-violet-600" },
  { type: "24",   label: '24"',  cls: "bg-sky-400" },
  { type: "none", label: "미설치", cls: "bg-rose-400" },
  { type: "null", label: "미확인", cls: "bg-gray-300" },
];

const STORAGE_KEY = "sw-asset-map-v2";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function loadStorage(): Record<string, MonitorType> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveStorage(data: Record<string, MonitorType>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* noop */ }
}

function floorCompletion(b: BuildingDef, f: FloorDef, data: Record<string, MonitorType>): number {
  let total = 0, done = 0;
  for (const z of f.zones) {
    for (const id of zoneSeats(b, f, z)) {
      total++;
      if (data[id] !== undefined && data[id] !== null) done++;
    }
  }
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

function buildingCompletion(b: BuildingDef, data: Record<string, MonitorType>): number {
  let total = 0, done = 0;
  for (const f of b.floors) {
    for (const z of f.zones) {
      for (const id of zoneSeats(b, f, z)) {
        total++;
        if (data[id] !== undefined && data[id] !== null) done++;
      }
    }
  }
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

function totalSeatsInZone(z: ZoneDef): number { return z.totalSeats; }

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/** Small popup that appears when a seat is clicked */
function MonitorPicker({
  current,
  onSelect,
  onClose,
}: {
  current: MonitorType;
  onSelect: (t: MonitorType) => void;
  onClose: () => void;
}) {
  const options: Array<{ v: MonitorType; label: string; cls: string }> = [
    { v: "27",   label: '27"',   cls: "bg-indigo-500 hover:bg-indigo-600 text-white" },
    { v: "34",   label: '34"',   cls: "bg-violet-600 hover:bg-violet-700 text-white" },
    { v: "24",   label: '24"',   cls: "bg-sky-400    hover:bg-sky-500    text-white" },
    { v: "none", label: "미설치", cls: "bg-rose-400   hover:bg-rose-500   text-white" },
    { v: null,   label: "초기화", cls: "bg-gray-200   hover:bg-gray-300   text-gray-700" },
  ];
  return (
    <div
      className="absolute z-50 bottom-full mb-1 left-1/2 -translate-x-1/2
                 bg-white rounded-xl shadow-2xl border border-gray-200 p-2 w-44"
      onClick={e => e.stopPropagation()}
    >
      <p className="text-[10px] font-semibold text-gray-500 mb-1.5 text-center tracking-wide">모니터 종류</p>
      <div className="flex flex-col gap-1">
        {options.map(o => (
          <button
            key={String(o.v)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors w-full
                        ${o.cls} ${current === o.v ? "ring-2 ring-offset-1 ring-gray-900" : ""}`}
            onClick={() => { onSelect(o.v); onClose(); }}
          >
            {o.label}
          </button>
        ))}
      </div>
      <button
        className="mt-2 w-full text-[10px] text-gray-400 hover:text-gray-600 text-center"
        onClick={onClose}
      >닫기</button>
    </div>
  );
}

/** Single seat button */
function SeatButton({
  id, monitor, idx, onUpdate,
}: {
  id: string;
  monitor: MonitorType;
  idx: number;
  onUpdate: (id: string, t: MonitorType) => void;
}) {
  const [open, setOpen] = useState(false);
  const key = monitor === null ? "null" : monitor;
  const bgCls = SEAT_BG[key] ?? SEAT_BG["null"];
  return (
    <div className="relative" onClick={e => { e.stopPropagation(); setOpen(v => !v); }}>
      <button
        title={`좌석 ${idx + 1}${monitor ? ` · ${MONITOR_LABEL[monitor as NonNullable<MonitorType>] ?? ""}` : ""}`}
        className={`w-8 h-8 rounded-md text-[10px] font-bold flex items-center justify-center
                    transition-all duration-150 select-none cursor-pointer border border-white/30
                    ${bgCls} ${open ? "ring-2 ring-offset-1 ring-gray-800 scale-110 z-10" : ""}`}
      >
        {monitor !== null ? (monitor === "none" ? "✕" : monitor) : String(idx + 1)}
      </button>
      {open && (
        <MonitorPicker
          current={monitor}
          onSelect={t => onUpdate(id, t)}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

/** Schematic grid for one zone */
function ZoneGrid({
  building, floor, zone, data, onUpdate,
}: {
  building: BuildingDef;
  floor: FloorDef;
  zone: ZoneDef;
  data: Record<string, MonitorType>;
  onUpdate: (id: string, t: MonitorType) => void;
}) {
  const seats = useMemo(
    () => zoneSeats(building, floor, zone),
    [building, floor, zone]
  );

  // Stats
  const stats = useMemo(() => {
    const counts: Record<string, number> = { "27": 0, "34": 0, "24": 0, "none": 0, null: 0 };
    for (const id of seats) {
      const m = data[id] ?? null;
      counts[String(m)] = (counts[String(m)] ?? 0) + 1;
    }
    return counts;
  }, [seats, data]);

  const done = seats.filter(id => data[id] !== undefined && data[id] !== null).length;
  const pct  = Math.round((done / seats.length) * 100);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      {/* Zone header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-gray-800 text-base">{zone.label}</h3>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {zone.totalSeats}석
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-gray-400">{done}/{seats.length} 완료</div>
          <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className={`text-xs font-bold ${pct === 100 ? "text-emerald-500" : "text-gray-400"}`}>
            {pct}%
          </span>
        </div>
      </div>

      {/* Seat mini-stats */}
      <div className="flex flex-wrap gap-2 mb-4">
        {LEGEND.map(l => {
          const cnt = stats[l.type === null ? "null" : String(l.type)] ?? 0;
          if (cnt === 0) return null;
          return (
            <span key={String(l.type)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold text-white ${l.cls}`}>
              {l.label} <span className="opacity-80">{cnt}</span>
            </span>
          );
        })}
      </div>

      {/* Seat grid */}
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${zone.cols}, minmax(0, 1fr))` }}
        onClick={e => e.stopPropagation()}
      >
        {seats.map((id, idx) => (
          <SeatButton
            key={id}
            id={id}
            idx={idx}
            monitor={data[id] ?? null}
            onUpdate={onUpdate}
          />
        ))}
      </div>

      {/* Row/col label */}
      <p className="mt-3 text-[10px] text-gray-400 text-right">
        {zone.rows}행 × {zone.cols}열 · 배치석 {zone.totalSeats}석
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BULK FILL MODAL
// ─────────────────────────────────────────────────────────────────────────────
function BulkModal({
  building, floor, zone, data, onUpdate, onClose,
}: {
  building: BuildingDef;
  floor: FloorDef;
  zone: ZoneDef;
  data: Record<string, MonitorType>;
  onUpdate: (id: string, t: MonitorType) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<MonitorType>("27");
  const seats = zoneSeats(building, floor, zone);
  const unset  = seats.filter(id => data[id] === undefined || data[id] === null);

  const applyAll = () => {
    for (const id of seats) onUpdate(id, selected);
    onClose();
  };
  const applyUnset = () => {
    for (const id of unset) onUpdate(id, selected);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-80" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-800 mb-1 text-base">일괄 입력</h3>
        <p className="text-xs text-gray-500 mb-4">
          <strong>{zone.label}</strong> — 선택한 모니터 종류를 일괄 적용합니다.
        </p>
        <div className="flex flex-col gap-2 mb-5">
          {(["27", "34", "24", "none"] as NonNullable<MonitorType>[]).map(v => (
            <button
              key={v}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition-all border-2
                ${selected === v ? "border-gray-800 scale-[1.02]" : "border-transparent"}
                ${SEAT_BG[v]}`}
              onClick={() => setSelected(v)}
            >
              {MONITOR_LABEL[v]}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            className="flex-1 rounded-xl bg-gray-800 text-white text-sm font-bold py-2 hover:bg-gray-700"
            onClick={applyAll}
          >전체 적용</button>
          <button
            className="flex-1 rounded-xl bg-emerald-500 text-white text-sm font-bold py-2 hover:bg-emerald-600"
            onClick={applyUnset}
            disabled={unset.length === 0}
          >
            미입력만 ({unset.length})
          </button>
        </div>
        <button
          className="mt-3 w-full text-xs text-gray-400 hover:text-gray-600"
          onClick={onClose}
        >취소</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PANEL
// ─────────────────────────────────────────────────────────────────────────────
export default function AssetMapPanel() {
  const [data, setData] = useState<Record<string, MonitorType>>({});
  const [selectedBuildingId, setSelectedBuildingId] = useState(BUILDINGS[0].id);
  const [selectedFloorId,    setSelectedFloorId]    = useState(BUILDINGS[0].floors[0].id);
  const [selectedZoneId,     setSelectedZoneId]     = useState(BUILDINGS[0].floors[0].zones[0].id);
  const [bulkTarget,         setBulkTarget]         = useState<{ z: ZoneDef; b: BuildingDef; f: FloorDef } | null>(null);
  const [filterType,         setFilterType]         = useState<MonitorType | "all">("all");

  // Load from localStorage on mount
  useEffect(() => {
    setData(loadStorage());
  }, []);

  // Persist on change
  const updateSeat = useCallback((id: string, t: MonitorType) => {
    setData(prev => {
      const next = { ...prev, [id]: t };
      saveStorage(next);
      return next;
    });
  }, []);

  // Derived
  const building = useMemo(
    () => BUILDINGS.find(b => b.id === selectedBuildingId) ?? BUILDINGS[0],
    [selectedBuildingId]
  );
  const floor = useMemo(
    () => building.floors.find(f => f.id === selectedFloorId) ?? building.floors[0],
    [building, selectedFloorId]
  );
  const zone = useMemo(
    () => floor.zones.find(z => z.id === selectedZoneId) ?? floor.zones[0],
    [floor, selectedZoneId]
  );

  // When building changes, reset floor & zone
  const handleSelectBuilding = (bid: string) => {
    setSelectedBuildingId(bid);
    const b = BUILDINGS.find(x => x.id === bid)!;
    setSelectedFloorId(b.floors[0].id);
    setSelectedZoneId(b.floors[0].zones[0].id);
  };

  // When floor changes, reset zone
  const handleSelectFloor = (fid: string) => {
    setSelectedFloorId(fid);
    const f = building.floors.find(x => x.id === fid)!;
    setSelectedZoneId(f.zones[0].id);
  };

  // Global stats
  const globalStats = useMemo(() => {
    const counts: Record<string, number> = { "27": 0, "34": 0, "24": 0, "none": 0, null: 0 };
    let total = 0;
    for (const b of BUILDINGS) {
      for (const f of b.floors) {
        for (const z of f.zones) {
          for (const id of zoneSeats(b, f, z)) {
            total++;
            const m = data[id] ?? null;
            counts[String(m)] = (counts[String(m)] ?? 0) + 1;
          }
        }
      }
    }
    const done = total - (counts["null"] ?? 0);
    return { counts, total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [data]);

  // Export CSV
  const handleExport = () => {
    const rows: string[] = ["건물,층,구역,좌석번호,모니터"];
    for (const b of BUILDINGS) {
      for (const f of b.floors) {
        for (const z of f.zones) {
          const seats = zoneSeats(b, f, z);
          seats.forEach((id, idx) => {
            const m = data[id] ?? null;
            rows.push(`${b.label},${f.label},${z.label},${idx + 1},${m === null ? "미확인" : (MONITOR_LABEL[m] ?? m)}`);
          });
        }
      }
    }
    const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "smart_office_monitors.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  // Reset all
  const handleResetAll = () => {
    if (!confirm("모든 모니터 현황 데이터를 초기화하시겠습니까?")) return;
    setData({});
    saveStorage({});
  };

  // Close picker when clicking background
  const handleBackdropClick = useCallback(() => {
    // Seat buttons handle their own open state; just a passthrough
  }, []);

  return (
    <div className="flex h-full min-h-0 bg-gray-50 font-sans" onClick={handleBackdropClick}>

      {/* ── LEFT SIDEBAR ──────────────────────────────────────────────── */}
      <aside className="w-56 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col overflow-hidden">

        {/* Building tabs */}
        <div className="flex border-b border-gray-100">
          {BUILDINGS.map(b => {
            const pct = buildingCompletion(b, data);
            return (
              <button
                key={b.id}
                onClick={() => handleSelectBuilding(b.id)}
                className={`flex-1 py-3 text-xs font-bold transition-colors relative
                  ${selectedBuildingId === b.id
                    ? "text-gray-900 bg-gray-50"
                    : "text-gray-400 hover:text-gray-700"}`}
              >
                {b.label}
                {pct === 100 && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                )}
                {selectedBuildingId === b.id && (
                  <div className={`absolute bottom-0 inset-x-0 h-0.5 ${b.color}`} />
                )}
              </button>
            );
          })}
        </div>

        {/* Floor list */}
        <div className="flex-1 overflow-y-auto py-2">
          {building.floors.map(f => {
            const pct    = floorCompletion(building, f, data);
            const active = f.id === selectedFloorId;
            return (
              <button
                key={f.id}
                onClick={() => handleSelectFloor(f.id)}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors
                  ${active ? "bg-gray-100 text-gray-900 font-semibold" : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"}`}
              >
                <span>{f.label}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full
                  ${pct === 100 ? "bg-emerald-100 text-emerald-600"
                    : pct > 0    ? "bg-amber-100 text-amber-600"
                    :              "bg-gray-100 text-gray-400"}`}
                >
                  {pct}%
                </span>
              </button>
            );
          })}
        </div>

        {/* Global progress footer */}
        <div className="border-t border-gray-100 p-3">
          <div className="flex justify-between text-[10px] text-gray-500 mb-1">
            <span>전체 진행률</span>
            <span className="font-bold">{globalStats.done}/{globalStats.total}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${globalStats.pct}%` }}
            />
          </div>
          <p className="text-right text-[10px] font-bold text-emerald-600 mt-0.5">
            {globalStats.pct}%
          </p>
        </div>
      </aside>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="font-bold text-gray-900 text-base">
              {building.label} {floor.label}
            </h2>
            {/* Zone tabs */}
            {floor.zones.length > 1 && (
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                {floor.zones.map(z => (
                  <button
                    key={z.id}
                    onClick={() => setSelectedZoneId(z.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all
                      ${z.id === selectedZoneId
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"}`}
                  >
                    {z.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Filter */}
            <select
              value={filterType ?? "all"}
              onChange={e => setFilterType(e.target.value === "all" ? "all" : e.target.value as MonitorType)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none"
            >
              <option value="all">전체 보기</option>
              <option value="27">27" 보기</option>
              <option value="34">34" 보기</option>
              <option value="24">24" 보기</option>
              <option value="none">미설치 보기</option>
            </select>

            <button
              onClick={() => setBulkTarget({ z: zone, b: building, f: floor })}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 text-white text-xs font-semibold rounded-lg hover:bg-gray-700 transition-colors"
            >
              일괄 입력
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
            >
              CSV 내보내기
            </button>
          </div>
        </div>

        {/* Legend bar */}
        <div className="bg-white border-b border-gray-100 px-6 py-2 flex items-center gap-4 flex-shrink-0">
          <span className="text-[11px] text-gray-400 font-medium mr-1">범례</span>
          {LEGEND.map(l => (
            <button
              key={String(l.type)}
              onClick={() => setFilterType(filterType === l.type ? "all" : (l.type as MonitorType | "all"))}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold transition-all
                ${filterType === l.type ? "ring-2 ring-gray-600 scale-105" : "opacity-80 hover:opacity-100"}`}
            >
              <span className={`w-3 h-3 rounded-sm ${l.cls}`} />
              <span className="text-gray-700">{l.label}</span>
            </button>
          ))}
        </div>

        {/* Zone grid content */}
        <div className="flex-1 overflow-y-auto p-6" onClick={handleBackdropClick}>
          {/* If filter active, show only matching zones; otherwise show selected zone */}
          {filterType !== "all" ? (
            <div className="space-y-6">
              {building.floors.map(f =>
                f.zones.map(z => {
                  const seats = zoneSeats(building, f, z);
                  const matching = seats.filter(id =>
                    filterType === null ? (data[id] === undefined || data[id] === null)
                    : data[id] === filterType
                  );
                  if (matching.length === 0) return null;
                  return (
                    <div key={`${f.id}-${z.id}`}>
                      <p className="text-xs font-semibold text-gray-500 mb-2">
                        {f.label} · {z.label} ({matching.length}석)
                      </p>
                      <FilteredSeatList
                        seatIds={matching}
                        allSeats={seats}
                        data={data}
                        onUpdate={updateSeat}
                      />
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <ZoneGrid
              key={`${building.id}-${floor.id}-${zone.id}`}
              building={building}
              floor={floor}
              zone={zone}
              data={data}
              onUpdate={updateSeat}
            />
          )}
        </div>

        {/* Bottom stats bar */}
        <div className="bg-white border-t border-gray-100 px-6 py-2 flex items-center gap-6 flex-shrink-0">
          {LEGEND.map(l => {
            const cnt = (globalStats.counts[l.type === null ? "null" : String(l.type)] ?? 0);
            return (
              <div key={String(l.type)} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-sm ${l.cls}`} />
                <span className="text-xs text-gray-600">{l.label}</span>
                <span className="text-xs font-bold text-gray-800">{cnt}</span>
              </div>
            );
          })}
          <div className="ml-auto flex gap-2">
            <span className="text-xs text-gray-500">
              총 {globalStats.total}석 중 {globalStats.done}석 입력완료
            </span>
            <button
              onClick={handleResetAll}
              className="text-xs text-rose-400 hover:text-rose-600 transition-colors"
            >
              전체 초기화
            </button>
          </div>
        </div>
      </main>

      {/* Bulk fill modal */}
      {bulkTarget && (
        <BulkModal
          building={bulkTarget.b}
          floor={bulkTarget.f}
          zone={bulkTarget.z}
          data={data}
          onUpdate={updateSeat}
          onClose={() => setBulkTarget(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FILTERED LIST (used when a legend filter is active)
// ─────────────────────────────────────────────────────────────────────────────
function FilteredSeatList({
  seatIds, allSeats, data, onUpdate,
}: {
  seatIds: string[];
  allSeats: string[];
  data: Record<string, MonitorType>;
  onUpdate: (id: string, t: MonitorType) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {seatIds.map(id => {
        const idx = allSeats.indexOf(id);
        return (
          <SeatButton
            key={id}
            id={id}
            idx={idx}
            monitor={data[id] ?? null}
            onUpdate={onUpdate}
          />
        );
      })}
    </div>
  );
}
