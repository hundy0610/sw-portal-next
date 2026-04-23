"use client";
import { useState, useRef, useEffect } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────
type MonitorType = "std27" | "std24" | "dev34" | "none" | "unk" | "repair" | "repairing";
type EditTool    = "select" | "monitor" | "zone" | "facility";
type FacilityKind = "elevator" | "stairs" | "entrance" | "exit" | "restroom";
type ResizeHandle = "move" | "nw"|"n"|"ne"|"w"|"e"|"sw"|"s"|"se" | "r" | "rot";

interface PlacedItem {
  id: string;
  kind: "monitor";
  monitorType: MonitorType;
  x: number; y: number;
  w: number; h: number;
  rotation: number;
  label: string;
  tags: string[];
}

interface DrawnZone {
  id: string;
  x: number; y: number; w: number; h: number;
  name: string;
  color: string;
  tags: string[];
  rotation: number;
}

interface Facility {
  id: string;
  kind: FacilityKind;
  x: number; y: number; // center point
  r: number;
  label: string;
  tags: string[];
}

interface Group {
  id: string;
  name: string;
  memberIds: string[];
}

export interface EditorData {
  imageUrl: string | null;
  canvasW?: number;
  canvasH?: number;
  items: PlacedItem[];
  zones: DrawnZone[];
  facilities: Facility[];
  groups: Group[];
  renderOrder: string[];
}

interface GroupOrigin { id: string; kind: "item"|"facility"|"zone"; ox: number; oy: number; }

interface DragInfo {
  primaryId: string;
  entityKind: "item" | "facility" | "zone";
  handle: ResizeHandle;
  sx: number; sy: number;
  ox: number; oy: number; ow: number; oh: number;
  groupOrigins?: GroupOrigin[];
  rotPrevAngle?: number;
  rotStartDeg?: number;
  rotCx?: number;
  rotCy?: number;
}

// ── Constants ──────────────────────────────────────────────────────────────────
const MONITOR_META: Record<MonitorType, { label: string; color: string; long: string }> = {
  std27:     { label: '27"', color: "#2563EB", long: '표준 27"' },
  std24:     { label: '24"', color: "#0284C7", long: '표준 24"' },
  dev34:     { label: '34"', color: "#7C3AED", long: '개발자 34"' },
  none:      { label: "✕",  color: "#DC2626", long: "미설치" },
  unk:       { label: "·",  color: "#94A3B8", long: "미확인" },
  repair:    { label: "요청", color: "#F97316", long: "수리 요청" },
  repairing: { label: "수리", color: "#EF4444", long: "수리 중" },
};

const FACILITY_META: Record<FacilityKind, { label: string; icon: string; color: string }> = {
  elevator: { label: "엘리베이터", icon: "EV",   color: "#1D4ED8" },
  stairs:   { label: "계단",       icon: "계단",  color: "#374151" },
  entrance: { label: "출입구",     icon: "입구",  color: "#15803D" },
  exit:     { label: "비상구",     icon: "EXIT", color: "#DC2626" },
  restroom: { label: "화장실",     icon: "WC",   color: "#6B7280" },
};

const ZONE_COLORS  = ["#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899","#06B6D4","#84CC16"];
const MONITOR_TYPES: MonitorType[]   = ["std27","std24","dev34","none","unk","repair","repairing"];
const FACILITY_KINDS: FacilityKind[] = ["elevator","stairs","entrance","exit","restroom"];
const ITEM_DEF = { monitor: { w: 50, h: 36 } };
const FAC_DEF_R = 22;
const MIN_SZ = 20;

const uid = () => Math.random().toString(36).slice(2, 9);

// ── Helpers ────────────────────────────────────────────────────────────────────
function getSVGCoords(e: React.MouseEvent, svgRef: React.RefObject<SVGSVGElement | null>, vw: number, vh: number) {
  const svg = svgRef.current;
  if (!svg) return { x: 0, y: 0 };
  const rect = svg.getBoundingClientRect();
  return {
    x: Math.round(((e.clientX - rect.left) / rect.width)  * vw),
    y: Math.round(((e.clientY - rect.top)  / rect.height) * vh),
  };
}

function applyResize(handle: ResizeHandle, dx: number, dy: number, ox: number, oy: number, ow: number, oh: number) {
  let nx = ox, ny = oy, nw = ow, nh = oh;
  if (handle.includes("e")) nw = Math.max(MIN_SZ, ow + dx);
  if (handle.includes("w")) { const d = Math.min(dx, ow - MIN_SZ); nx = ox+d; nw = ow-d; }
  if (handle.includes("s")) nh = Math.max(MIN_SZ, oh + dy);
  if (handle.includes("n")) { const d = Math.min(dy, oh - MIN_SZ); ny = oy+d; nh = oh-d; }
  return { nx, ny, nw, nh };
}

function isInZone(px: number, py: number, zone: DrawnZone): boolean {
  const cx = zone.x + zone.w/2, cy = zone.y + zone.h/2;
  const rot = zone.rotation ?? 0;
  if (rot === 0) {
    return px >= zone.x && px <= zone.x + zone.w && py >= zone.y && py <= zone.y + zone.h;
  }
  const theta = -(rot * Math.PI / 180);
  const dx = px - cx, dy = py - cy;
  const rx = dx * Math.cos(theta) - dy * Math.sin(theta);
  const ry = dx * Math.sin(theta) + dy * Math.cos(theta);
  return Math.abs(rx) <= zone.w/2 && Math.abs(ry) <= zone.h/2;
}

export function migrate(raw: Partial<EditorData & { items: any[]; zones: any[]; facilities: any[] }>): EditorData {
  const items: PlacedItem[] = (raw.items ?? []).map((i: any) => ({
    ...i,
    id: i.id ?? uid(),
    kind: "monitor" as const,
    monitorType: i.monitorType ?? "unk",
    w: i.w ?? ITEM_DEF.monitor.w,
    h: i.h ?? ITEM_DEF.monitor.h,
    tags: i.tags ?? [],
  }));
  const zones: DrawnZone[] = (raw.zones ?? []).map((z: any) => ({
    ...z,
    tags: z.tags ?? [],
    rotation: z.rotation ?? 0,
  }));
  const facilities: Facility[] = (raw.facilities ?? []).map((f: any) => ({
    ...f,
    x: f.r !== undefined ? f.x : (f.x ?? 0) + 20,
    y: f.r !== undefined ? f.y : (f.y ?? 0) + 20,
    r: f.r ?? FAC_DEF_R,
    tags: f.tags ?? [],
  }));
  const allIds = [...zones.map(z => z.id), ...facilities.map(f => f.id), ...items.map(i => i.id)];
  const existingOrder = ((raw.renderOrder ?? []) as string[]).filter(id => allIds.includes(id));
  const newIds = allIds.filter(id => !existingOrder.includes(id));
  return {
    imageUrl: raw.imageUrl ?? null,
    canvasW: raw.canvasW ?? undefined,
    canvasH: raw.canvasH ?? undefined,
    items,
    zones,
    facilities,
    groups: (raw.groups ?? []) as Group[],
    renderOrder: [...existingOrder, ...newIds],
  };
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function TagEditor({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState("");
  const add = () => {
    const t = input.trim();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setInput("");
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-1.5 min-h-[20px]">
        {tags.length === 0 && <span className="text-[10px] text-gray-300">태그 없음</span>}
        {tags.map(tag => (
          <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-semibold border border-blue-100">
            {tag}
            <button onClick={() => onChange(tags.filter(t => t !== tag))}
              className="text-blue-300 hover:text-blue-500 text-xs leading-none">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="태그 입력 후 Enter"
          className="flex-1 px-2 py-1 rounded-lg border border-gray-200 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-400"/>
        <button onClick={add} className="px-2 py-1 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50">+</button>
      </div>
    </div>
  );
}

const RESIZE_CURSORS: Record<string, string> = {
  nw:"nw-resize", n:"n-resize", ne:"ne-resize",
  w:"w-resize",   e:"e-resize",
  sw:"sw-resize", s:"s-resize", se:"se-resize",
};

function ResizeHandles({ x, y, w, h, onStart }: {
  x:number; y:number; w:number; h:number;
  onStart: (e: React.MouseEvent, handle: ResizeHandle) => void;
}) {
  const S = 9, HS = S/2;
  const pts: { t: ResizeHandle; cx:number; cy:number }[] = [
    { t:"nw", cx:x,     cy:y      }, { t:"n", cx:x+w/2, cy:y      }, { t:"ne", cx:x+w,   cy:y      },
    { t:"w",  cx:x,     cy:y+h/2  },                                   { t:"e",  cx:x+w,   cy:y+h/2  },
    { t:"sw", cx:x,     cy:y+h    }, { t:"s", cx:x+w/2, cy:y+h    }, { t:"se", cx:x+w,   cy:y+h    },
  ];
  return (
    <>
      <rect x={x} y={y} width={w} height={h} fill="none"
        stroke="#2563EB" strokeWidth={1} strokeDasharray="5,3" opacity={0.5}
        style={{ pointerEvents:"none" }}/>
      {pts.map(p => (
        <rect key={p.t} x={p.cx-HS} y={p.cy-HS} width={S} height={S} rx={2}
          fill="white" stroke="#2563EB" strokeWidth={1.5}
          style={{ cursor: RESIZE_CURSORS[p.t] }}
          onMouseDown={e => { e.stopPropagation(); e.preventDefault(); onStart(e, p.t); }}/>
      ))}
    </>
  );
}

function ZoneDashboard({ data, selectedIds, onSelect }: {
  data: EditorData;
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
}) {
  const zoneContents = data.zones.map(z => ({
    zone: z,
    items: data.items.filter(item => isInZone(item.x + item.w/2, item.y + item.h/2, z)),
    facilities: data.facilities.filter(fac => isInZone(fac.x, fac.y, z)),
  }));
  const assignedItemIds = new Set(zoneContents.flatMap(zc => zc.items.map(i => i.id)));
  const assignedFacIds  = new Set(zoneContents.flatMap(zc => zc.facilities.map(f => f.id)));
  const unassignedItems = data.items.filter(i => !assignedItemIds.has(i.id));
  const unassignedFacs  = data.facilities.filter(f => !assignedFacIds.has(f.id));
  const hasUnassigned   = unassignedItems.length > 0 || unassignedFacs.length > 0;

  return (
    <div className="w-44 flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto text-xs">
      <div className="px-2 py-2 border-b border-gray-100 bg-gray-50 sticky top-0 z-10">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">구역 배치</div>
      </div>

      {data.zones.length === 0 && (
        <div className="p-3 text-[10px] text-gray-400 text-center mt-4">
          구역 도구로 영역을<br/>그려주세요
        </div>
      )}

      {zoneContents.map(({ zone, items, facilities }) => {
        const total = items.length + facilities.length;
        const isSel = selectedIds.has(zone.id);
        return (
          <div key={zone.id} className="border-b border-gray-100">
            <div
              className={`px-2 py-1.5 flex items-center gap-1.5 cursor-pointer transition-colors ${isSel ? "bg-blue-50" : "hover:bg-gray-50"}`}
              onClick={() => onSelect(zone.id)}>
              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0 border-2"
                style={{ borderColor: zone.color, background: zone.color+"33" }}/>
              <span className="text-[11px] font-semibold text-slate-700 truncate flex-1">{zone.name}</span>
              <span className="text-[10px] text-gray-400 flex-shrink-0">{total}</span>
            </div>
            {total > 0 && (
              <div className="pb-1">
                {items.map(item => (
                  <div key={item.id}
                    className={`px-3 py-0.5 text-[10px] cursor-pointer truncate transition-colors ${
                      selectedIds.has(item.id) ? "bg-blue-50 text-blue-600 font-medium" : "text-gray-500 hover:bg-gray-50"
                    }`}
                    onClick={() => onSelect(item.id)}>
                    🖥 {item.label}
                  </div>
                ))}
                {facilities.map(fac => (
                  <div key={fac.id}
                    className={`px-3 py-0.5 text-[10px] cursor-pointer truncate transition-colors ${
                      selectedIds.has(fac.id) ? "bg-blue-50 text-blue-600 font-medium" : "text-gray-500 hover:bg-gray-50"
                    }`}
                    onClick={() => onSelect(fac.id)}>
                    📍 {fac.label}
                  </div>
                ))}
              </div>
            )}
            {total === 0 && (
              <div className="px-3 pb-1.5 text-[10px] text-gray-300">비어 있음</div>
            )}
          </div>
        );
      })}

      {hasUnassigned && (
        <div>
          <div className="px-2 py-1 text-[10px] font-semibold text-gray-400 bg-gray-50 border-b border-gray-100 sticky top-0">
            미배치
          </div>
          <div className="pb-1">
            {unassignedItems.map(item => (
              <div key={item.id}
                className={`px-3 py-0.5 text-[10px] cursor-pointer truncate transition-colors ${
                  selectedIds.has(item.id) ? "bg-blue-50 text-blue-600 font-medium" : "text-gray-500 hover:bg-gray-50"
                }`}
                onClick={() => onSelect(item.id)}>
                🖥 {item.label}
              </div>
            ))}
            {unassignedFacs.map(fac => (
              <div key={fac.id}
                className={`px-3 py-0.5 text-[10px] cursor-pointer truncate transition-colors ${
                  selectedIds.has(fac.id) ? "bg-blue-50 text-blue-600 font-medium" : "text-gray-500 hover:bg-gray-50"
                }`}
                onClick={() => onSelect(fac.id)}>
                📍 {fac.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function FloorMapEditor({ data, onChange, onZoneMove }: {
  data: EditorData;
  onChange: (data: EditorData) => void;
  onZoneMove?: (itemId: string, label: string, fromZone: string, toZone: string) => void;
}) {
  const svgRef  = useRef<SVGSVGElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [tool,         setTool]         = useState<EditTool>("select");
  const [monitorType,  setMonitorType]  = useState<MonitorType>("std27");
  const [facilityKind, setFacilityKind] = useState<FacilityKind>("elevator");
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set());
  const [drawingZone,  setDrawingZone]  = useState<{ x:number;y:number;w:number;h:number } | null>(null);
  const [pendingZone,  setPendingZone]  = useState<{ x:number;y:number;w:number;h:number } | null>(null);
  const [zoneName,     setZoneName]     = useState("");
  const [canvasW,      setCanvasW]      = useState(1000);
  const [canvasH,      setCanvasH]      = useState(700);
  const [cwInput,      setCwInput]      = useState("1000");
  const [chInput,      setChInput]      = useState("700");

  const dragRef      = useRef<DragInfo | null>(null);
  const clipboardRef = useRef<PlacedItem[]>([]);
  const zoneStartRef = useRef<{ x:number;y:number } | null>(null);
  const zoneColorIdx = useRef(0);

  // 외부(Notion 등)에서 data가 로드될 때 canvasW/H 동기화
  useEffect(() => {
    if (data.canvasW && data.canvasW !== canvasW) {
      setCanvasW(data.canvasW);
      setCwInput(String(data.canvasW));
    }
    if (data.canvasH && data.canvasH !== canvasH) {
      setCanvasH(data.canvasH);
      setChInput(String(data.canvasH));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.canvasW, data.canvasH]);

  // Derived: last selected entity (properties panel)
  const lastSelId = [...selectedIds].at(-1) ?? null;
  const selItem  = data.items.find(i => i.id === lastSelId) ?? null;
  const selFac   = data.facilities.find(f => f.id === lastSelId) ?? null;
  const selZone  = data.zones.find(z => z.id === lastSelId) ?? null;

  // 선택된 항목 중 구역(zone)이 아닌 것만 (그룹화 대상)
  const selNonZoneIds = [...selectedIds].filter(id =>
    data.items.some(i => i.id === id) || data.facilities.some(f => f.id === id)
  );
  // 선택된 비-구역 항목들이 모두 같은 그룹에 속해 있으면 해당 그룹을 표시
  const selGroup = selNonZoneIds.length >= 2
    ? (data.groups ?? []).find(g => selNonZoneIds.every(id => g.memberIds.includes(id))) ?? null
    : (data.groups ?? []).find(g => g.memberIds.includes(lastSelId ?? "")) ?? null;

  // ── Patch helpers ────────────────────────────────────────────────────────────
  const patchItem = (patch: Partial<PlacedItem>) =>
    onChange({ ...data, items: data.items.map(i => i.id===lastSelId ? {...i, ...patch} : i) });
  const patchFac  = (patch: Partial<Facility>) =>
    onChange({ ...data, facilities: data.facilities.map(f => f.id===lastSelId ? {...f, ...patch} : f) });
  const patchZone = (patch: Partial<DrawnZone>) =>
    onChange({ ...data, zones: data.zones.map(z => z.id===lastSelId ? {...z, ...patch} : z) });

  // ── Image Upload ─────────────────────────────────────────────────────────────
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const MAX_W = 1200;
        const scale = img.naturalWidth > MAX_W ? MAX_W / img.naturalWidth : 1;
        const dw = Math.round(img.naturalWidth  * scale);
        const dh = Math.round(img.naturalHeight * scale);

        const canvas = document.createElement("canvas");
        canvas.width  = dw;
        canvas.height = dh;
        canvas.getContext("2d")!.drawImage(img, 0, 0, dw, dh);
        const compressed = canvas.toDataURL("image/jpeg", 0.75);

        // 캔버스 비율을 이미지에 맞춤
        const targetW = canvasW;
        const targetH = Math.round(targetW * dh / dw);
        setCanvasH(targetH);
        setCwInput(String(targetW));
        setChInput(String(targetH));
        onChange({ ...data, imageUrl: compressed, canvasW: targetW, canvasH: targetH });
      };
      img.onerror = () => onChange({ ...data, imageUrl: dataUrl, canvasW, canvasH });
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ── Drag Starter ─────────────────────────────────────────────────────────────
  const startDrag = (
    e: React.MouseEvent,
    id: string, entityKind: DragInfo["entityKind"], handle: ResizeHandle,
    ox: number, oy: number, ow: number, oh: number,
  ) => {
    e.stopPropagation();
    e.preventDefault();

    if (e.shiftKey) {
      // 구역(zone)은 다중선택/그룹화 대상에서 제외
      if (entityKind === "zone") return;
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
      return;
    }

    const newSel = selectedIds.has(id) ? selectedIds : new Set([id]);
    setSelectedIds(newSel);

    const pt = getSVGCoords(e, svgRef, canvasW, canvasH);

    let groupOrigins: GroupOrigin[] | undefined;
    if (handle === "move") {
      const group = data.groups?.find(g => g.memberIds.includes(id));
      const moveIds = new Set<string>(group ? group.memberIds : [...newSel]);
      moveIds.delete(id);

      groupOrigins = [...moveIds].map(mid => {
        const item = data.items.find(i => i.id === mid);
        if (item) return { id: mid, kind: "item"     as const, ox: item.x, oy: item.y };
        const fac  = data.facilities.find(f => f.id === mid);
        if (fac)  return { id: mid, kind: "facility" as const, ox: fac.x,  oy: fac.y  };
        const zone = data.zones.find(z => z.id === mid);
        if (zone) return { id: mid, kind: "zone"     as const, ox: zone.x, oy: zone.y };
        return null;
      }).filter(Boolean) as GroupOrigin[];
    }

    dragRef.current = { primaryId: id, entityKind, handle, sx: pt.x, sy: pt.y, ox, oy, ow, oh, groupOrigins };
  };

  // ── SVG Mouse Handlers ───────────────────────────────────────────────────────
  const handleSVGMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    const target = e.target as Element;
    const isBg = target === svgRef.current || target.getAttribute("data-bg") === "1";
    if (!isBg) return;

    const pt = getSVGCoords(e, svgRef, canvasW, canvasH);

    if (tool === "zone") {
      zoneStartRef.current = pt;
      setDrawingZone({ x: pt.x, y: pt.y, w: 0, h: 0 });
      return;
    }
    if (tool === "monitor") {
      const d = ITEM_DEF.monitor;
      const item: PlacedItem = {
        id: uid(), kind: "monitor", monitorType,
        x: pt.x-d.w/2, y: pt.y-d.h/2, w: d.w, h: d.h,
        rotation: 0, label: "Monitor", tags: [],
      };
      onChange({ ...data, items: [...data.items, item], renderOrder: [...(data.renderOrder ?? []), item.id] });
      setSelectedIds(new Set([item.id])); if (!e.shiftKey) setTool("select"); return;
    }
    if (tool === "facility") {
      const fac: Facility = { id: uid(), kind: facilityKind, x: pt.x, y: pt.y, r: FAC_DEF_R, label: FACILITY_META[facilityKind].label, tags: [] };
      onChange({ ...data, facilities: [...data.facilities, fac], renderOrder: [...(data.renderOrder ?? []), fac.id] });
      setSelectedIds(new Set([fac.id])); if (!e.shiftKey) setTool("select"); return;
    }
    setSelectedIds(new Set());
  };

  const handleSVGMouseMove = (e: React.MouseEvent) => {
    const pt = getSVGCoords(e, svgRef, canvasW, canvasH);
    const drag = dragRef.current;

    if (!drag) {
      if (zoneStartRef.current && tool === "zone") {
        const s = zoneStartRef.current;
        setDrawingZone({ x: Math.min(s.x,pt.x), y: Math.min(s.y,pt.y), w: Math.abs(pt.x-s.x), h: Math.abs(pt.y-s.y) });
      }
      return;
    }

    const { primaryId, entityKind, handle, sx, sy, ox, oy, ow, oh, groupOrigins } = drag;
    const dx = pt.x - sx, dy = pt.y - sy;

    if (handle === "move") {
      const nx = ox+dx, ny = oy+dy;
      let nd = { ...data };

      if (entityKind === "item")     nd = { ...nd, items:      nd.items.map(i      => i.id===primaryId ? {...i,x:nx,y:ny} : i) };
      else if (entityKind === "facility") nd = { ...nd, facilities: nd.facilities.map(f => f.id===primaryId ? {...f,x:nx,y:ny} : f) };
      else                           nd = { ...nd, zones:      nd.zones.map(z      => z.id===primaryId ? {...z,x:nx,y:ny} : z) };

      for (const go of groupOrigins ?? []) {
        const gx = go.ox+dx, gy = go.oy+dy;
        if (go.kind === "item")     nd = { ...nd, items:      nd.items.map(i      => i.id===go.id ? {...i,x:gx,y:gy} : i) };
        else if (go.kind === "facility") nd = { ...nd, facilities: nd.facilities.map(f => f.id===go.id ? {...f,x:gx,y:gy} : f) };
        else                        nd = { ...nd, zones:      nd.zones.map(z      => z.id===go.id ? {...z,x:gx,y:gy} : z) };
      }
      onChange(nd);

    } else if (handle === "r") {
      const newR = Math.max(15, ow/2 + dx);
      onChange({ ...data, facilities: data.facilities.map(f => f.id===primaryId ? {...f, r:newR} : f) });

    } else if (handle === "rot") {
      const rcx = drag.rotCx!, rcy = drag.rotCy!;
      const currentAngle = Math.atan2(pt.y - rcy, pt.x - rcx);
      let delta = (currentAngle - drag.rotPrevAngle!) * (180 / Math.PI);
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      const newRotation = ((drag.rotStartDeg! + delta) % 360 + 360) % 360;
      drag.rotPrevAngle = currentAngle;
      drag.rotStartDeg  = newRotation;
      onChange({ ...data, items: data.items.map(i => i.id === primaryId ? { ...i, rotation: Math.round(newRotation) } : i) });

    } else {
      const { nx, ny, nw, nh } = applyResize(handle, dx, dy, ox, oy, ow, oh);
      if (entityKind === "item")
        onChange({ ...data, items: data.items.map(i => i.id===primaryId ? {...i,x:nx,y:ny,w:nw,h:nh} : i) });
      else
        onChange({ ...data, zones: data.zones.map(z => z.id===primaryId ? {...z,x:nx,y:ny,w:nw,h:nh} : z) });
    }
  };

  const handleSVGMouseUp = () => {
    const drag = dragRef.current;

    if (drag && drag.handle === "move" && drag.entityKind === "item" && onZoneMove) {
      const item = data.items.find(i => i.id === drag.primaryId);
      if (item) {
        const cx  = item.x + item.w / 2, cy  = item.y + item.h / 2;
        const ocx = drag.ox + item.w / 2, ocy = drag.oy + item.h / 2;
        const fromZone = data.zones.find(z => isInZone(ocx, ocy, z));
        const toZone   = data.zones.find(z => isInZone(cx,  cy,  z));
        if (fromZone?.id !== toZone?.id) {
          onZoneMove(
            item.id,
            item.label || item.id,
            fromZone?.name ?? "미배정",
            toZone?.name   ?? "미배정",
          );
        }
      }
    }

    dragRef.current = null;
    if (zoneStartRef.current && drawingZone && drawingZone.w > 15 && drawingZone.h > 15) {
      setPendingZone(drawingZone); setZoneName("");
    }
    zoneStartRef.current = null;
    setDrawingZone(null);
  };

  // ── Zone confirm ─────────────────────────────────────────────────────────────
  const confirmZone = () => {
    if (!pendingZone) return;
    const color = ZONE_COLORS[zoneColorIdx.current % ZONE_COLORS.length];
    zoneColorIdx.current++;
    const zone: DrawnZone = { id: uid(), ...pendingZone, name: zoneName.trim() || "구역", color, tags: [], rotation: 0 };
    const newOrder = [zone.id, ...(data.renderOrder ?? [])]; // zones → back
    onChange({ ...data, zones: [...data.zones, zone], renderOrder: newOrder });
    setSelectedIds(new Set([zone.id])); setPendingZone(null);
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const deleteSelected = () => {
    if (selectedIds.size === 0) return;
    const ids = [...selectedIds];
    onChange({
      ...data,
      items:      data.items.filter(i => !ids.includes(i.id)),
      zones:      data.zones.filter(z => !ids.includes(z.id)),
      facilities: data.facilities.filter(f => !ids.includes(f.id)),
      groups:     (data.groups ?? [])
        .map(g => ({ ...g, memberIds: g.memberIds.filter(mid => !ids.includes(mid)) }))
        .filter(g => g.memberIds.length >= 2),
      renderOrder: (data.renderOrder ?? []).filter(id => !ids.includes(id)),
    });
    setSelectedIds(new Set());
  };

  // ── Group ────────────────────────────────────────────────────────────────────
  const groupSelected = () => {
    // 구역(zone)을 제외한 선택 항목만 그룹화
    const memberIds = [...selectedIds].filter(id =>
      data.items.some(i => i.id === id) || data.facilities.some(f => f.id === id)
    );
    if (memberIds.length < 2) return;

    // 기존 그룹에서 해당 멤버를 제거 후 2명 미만이면 그룹 해산
    const cleanedGroups = (data.groups ?? [])
      .map(g => ({ ...g, memberIds: g.memberIds.filter(mid => !memberIds.includes(mid)) }))
      .filter(g => g.memberIds.length >= 2);

    const group: Group = { id: uid(), name: "그룹", memberIds };
    onChange({ ...data, groups: [...cleanedGroups, group] });
    setSelectedIds(new Set(memberIds));
  };

  const patchGroup = (patch: Partial<Group>) =>
    onChange({ ...data, groups: (data.groups ?? []).map(g => g.id === selGroup?.id ? {...g, ...patch} : g) });

  const ungroupSelected = () => {
    if (!selGroup) return;
    onChange({ ...data, groups: (data.groups ?? []).filter(g => g.id !== selGroup.id) });
  };

  // ── Z-order ──────────────────────────────────────────────────────────────────
  const zOp = (id: string, op: "front"|"back"|"forward"|"backward") => {
    const order = [...(data.renderOrder ?? [])];
    const idx = order.indexOf(id);
    if (idx === -1) return;
    if (op === "front")   { order.splice(idx,1); order.push(id); }
    else if (op === "back")     { order.splice(idx,1); order.unshift(id); }
    else if (op === "forward"  && idx < order.length-1) { [order[idx],order[idx+1]] = [order[idx+1],order[idx]]; }
    else if (op === "backward" && idx > 0)              { [order[idx-1],order[idx]] = [order[idx],order[idx-1]]; }
    onChange({ ...data, renderOrder: order });
  };

  // ── Canvas size ───────────────────────────────────────────────────────────────
  const applyCanvasSize = () => {
    const w = Math.max(400, Math.min(3000, +cwInput || 1000));
    const h = Math.max(300, Math.min(2000, +chInput || 700));
    setCanvasW(w); setCanvasH(h); setCwInput(String(w)); setChInput(String(h));
    onChange({ ...data, canvasW: w, canvasH: h });
  };

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────
  const deleteRef = useRef(deleteSelected);
  deleteRef.current = deleteSelected;

  const copyRef = useRef(() => {});
  copyRef.current = () => {
    const copied = data.items.filter(i => selectedIds.has(i.id));
    if (copied.length > 0) clipboardRef.current = copied;
  };

  const pasteRef = useRef(() => {});
  pasteRef.current = () => {
    const templates = clipboardRef.current;
    if (templates.length === 0) return;
    const OFFSET = 20;
    const newItems = templates.map(t => ({ ...t, id: uid(), x: t.x + OFFSET, y: t.y + OFFSET }));
    onChange({
      ...data,
      items: [...data.items, ...newItems],
      renderOrder: [...(data.renderOrder ?? []), ...newItems.map(i => i.id)],
    });
    setSelectedIds(new Set(newItems.map(i => i.id)));
    clipboardRef.current = newItems;
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as Element).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((e.ctrlKey || e.metaKey) && e.key === "c") { e.preventDefault(); copyRef.current(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === "v") { e.preventDefault(); pasteRef.current(); return; }
      if (e.key === "Delete" || e.key === "Backspace") deleteRef.current();
      if (e.key === "Escape") {
        setSelectedIds(new Set()); setPendingZone(null);
        setDrawingZone(null); zoneStartRef.current = null; setTool("select");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Build render list in z-order ──────────────────────────────────────────────
  type RE = { type:"item"; d:PlacedItem } | { type:"facility"; d:Facility } | { type:"zone"; d:DrawnZone };
  const renderOrder = data.renderOrder ?? [];
  const orderedEntities: RE[] = renderOrder.map(id => {
    const item = data.items.find(i => i.id === id);
    if (item) return { type: "item"     as const, d: item };
    const fac  = data.facilities.find(f => f.id === id);
    if (fac)  return { type: "facility" as const, d: fac  };
    const zone = data.zones.find(z => z.id === id);
    if (zone) return { type: "zone"     as const, d: zone };
    return null;
  }).filter(Boolean) as RE[];

  // Safety net: entities not yet in renderOrder
  const inOrder = new Set(renderOrder);
  const unordered: RE[] = [
    ...data.zones.filter(z => !inOrder.has(z.id)).map(d => ({ type:"zone"     as const, d })),
    ...data.facilities.filter(f => !inOrder.has(f.id)).map(d => ({ type:"facility" as const, d })),
    ...data.items.filter(i => !inOrder.has(i.id)).map(d => ({ type:"item"     as const, d })),
  ];
  const allEntities: RE[] = [...orderedEntities, ...unordered];

  const cursor = (tool==="zone"||tool==="monitor"||tool==="facility") ? "crosshair" : "default";
  const itemCount = data.items.length + data.facilities.length + data.zones.length;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-slate-50">

      {/* ── Toolbar ── */}
      <div className="flex-none bg-white border-b px-4 py-2 flex items-center gap-2 flex-wrap shadow-sm">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
          {([
            { id:"select",   icon:"↖",  label:"선택"   },
            { id:"monitor",  icon:"🖥",  label:"모니터" },
            { id:"zone",     icon:"⬜",  label:"구역"   },
            { id:"facility", icon:"📍",  label:"시설물" },
          ] as { id:EditTool; icon:string; label:string }[]).map(t => (
            <button key={t.id} onClick={() => setTool(t.id)}
              className={`px-3 py-1.5 font-medium border-r border-gray-200 last:border-0 transition-colors ${
                tool===t.id ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-gray-50"
              }`}>{t.icon} {t.label}</button>
          ))}
        </div>

        {tool==="monitor" && (
          <div className="flex gap-1">
            {MONITOR_TYPES.map(t => (
              <button key={t} onClick={() => setMonitorType(t)}
                className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                  monitorType===t ? "text-white border-transparent" : "text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
                style={monitorType===t ? { background:MONITOR_META[t].color } : undefined}>
                {MONITOR_META[t].label}
              </button>
            ))}
          </div>
        )}

        {tool==="facility" && (
          <div className="flex gap-1 flex-wrap">
            {FACILITY_KINDS.map(k => (
              <button key={k} onClick={() => setFacilityKind(k)}
                className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                  facilityKind===k ? "bg-slate-700 text-white border-transparent" : "text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}>{FACILITY_META[k].label}</button>
            ))}
          </div>
        )}

        {tool==="select" && selNonZoneIds.length >= 2 && !selGroup && (
          <button onClick={groupSelected}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-purple-50 text-purple-600 hover:bg-purple-100 border border-purple-200 transition-colors">
            🔗 그룹화 ({selNonZoneIds.length})
          </button>
        )}
        {tool==="select" && selGroup && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-purple-500 bg-purple-50 px-2 py-1 rounded-lg border border-purple-200">
              🔗 {selGroup.name}
            </span>
            <button onClick={ungroupSelected}
              className="px-2 py-1 rounded-lg text-[11px] font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200 transition-colors">
              해제
            </button>
          </div>
        )}

        <span className="text-[10px] text-gray-400 hidden lg:block">
          {tool==="select"   && "클릭 선택 | Shift+클릭 다중선택 | Ctrl+C/V 복사·붙여넣기 | ↻ 핸들 드래그 회전 | Del 삭제"}
          {tool==="monitor"  && "캔버스 클릭 → 모니터 배치"}
          {tool==="zone"     && "드래그로 공간 영역 지정"}
          {tool==="facility" && "클릭으로 시설물 마커 배치"}
        </span>

        <div className="flex items-center gap-1 ml-auto">
          <span className="text-[10px] text-gray-400">캔버스</span>
          <input value={cwInput} onChange={e => setCwInput(e.target.value)} type="number"
            onKeyDown={e => e.key==="Enter" && applyCanvasSize()}
            className="w-14 px-1.5 py-1 rounded border border-gray-200 text-center text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-400"/>
          <span className="text-[10px] text-gray-300">×</span>
          <input value={chInput} onChange={e => setChInput(e.target.value)} type="number"
            onKeyDown={e => e.key==="Enter" && applyCanvasSize()}
            className="w-14 px-1.5 py-1 rounded border border-gray-200 text-center text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-400"/>
          <button onClick={applyCanvasSize}
            className="px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200 text-[11px] font-medium transition-colors">
            적용
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {itemCount>0 && <span className="text-[10px] text-gray-400">{itemCount}개</span>}
          <button onClick={() => fileRef.current?.click()}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200 transition-colors">
            🖼 도면 이미지
          </button>
          {data.imageUrl && (
            <button onClick={() => onChange({...data, imageUrl:null})}
              className="px-2 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-500 hover:bg-red-100 border border-red-200 transition-colors">
              제거
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload}/>
        </div>
      </div>

      {/* ── Main ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Zone Dashboard */}
        <ZoneDashboard
          data={data}
          selectedIds={selectedIds}
          onSelect={id => setSelectedIds(new Set([id]))}
        />

        {/* Canvas */}
        <div className="flex-1 overflow-auto p-4 flex items-start justify-center">
          <div className="relative" style={{ width:"100%", maxWidth: Math.max(canvasW, 900) }}>

            {!data.imageUrl && itemCount===0 && (
              <div onClick={() => fileRef.current?.click()}
                className="absolute inset-0 z-10 flex flex-col items-center justify-center cursor-pointer rounded-xl border-2 border-dashed border-blue-300 bg-white/70 hover:border-blue-400 transition-colors"
                style={{ minHeight:200 }}>
                <div className="text-5xl mb-3">🖼</div>
                <div className="text-sm font-semibold text-blue-500">도면 이미지를 업로드하세요</div>
                <div className="text-xs text-gray-400 mt-1">또는 툴바의 아이템을 직접 배치하세요</div>
              </div>
            )}

            <svg ref={svgRef}
              viewBox={`0 0 ${canvasW} ${canvasH}`}
              style={{ width:"100%", display:"block", userSelect:"none", cursor, aspectRatio:`${canvasW}/${canvasH}` }}
              className="bg-white rounded-xl border border-gray-200 shadow-sm"
              onMouseDown={handleSVGMouseDown}
              onMouseMove={handleSVGMouseMove}
              onMouseUp={handleSVGMouseUp}
              onMouseLeave={handleSVGMouseUp}>

              {data.imageUrl ? (
                <image href={data.imageUrl} x={0} y={0} width={canvasW} height={canvasH}
                  preserveAspectRatio="xMidYMid meet" data-bg="1" style={{ pointerEvents:"none" }}/>
              ) : (
                <g opacity={0.1} style={{ pointerEvents:"none" }}>
                  {Array.from({length:Math.ceil(canvasW/50)+1},(_,i)=>(
                    <line key={`gv${i}`} x1={i*50} y1={0} x2={i*50} y2={canvasH} stroke="#94A3B8" strokeWidth={0.5}/>
                  ))}
                  {Array.from({length:Math.ceil(canvasH/50)+1},(_,i)=>(
                    <line key={`gh${i}`} x1={0} y1={i*50} x2={canvasW} y2={i*50} stroke="#94A3B8" strokeWidth={0.5}/>
                  ))}
                </g>
              )}

              <rect x={0} y={0} width={canvasW} height={canvasH} fill="transparent" data-bg="1"/>

              {/* Entities in z-order */}
              {allEntities.map(entity => {
                if (entity.type === "zone") {
                  const z = entity.d;
                  const isSel = selectedIds.has(z.id);
                  const zrot  = z.rotation ?? 0;
                  const zcx   = z.x + z.w/2, zcy = z.y + z.h/2;
                  return (
                    <g key={z.id} transform={zrot ? `rotate(${zrot}, ${zcx}, ${zcy})` : undefined}>
                      <rect x={z.x} y={z.y} width={z.w} height={z.h}
                        fill={z.color+"22"} stroke={z.color}
                        strokeWidth={isSel?2.5:1.5} strokeDasharray="10,5" rx={5}
                        data-bg={tool !== "select" ? "1" : undefined}
                        style={{ cursor: tool==="select"?"move":"default" }}
                        onMouseDown={e => { if(tool!=="select") return; startDrag(e, z.id, "zone", "move", z.x, z.y, z.w, z.h); }}/>
                      <text x={z.x+8} y={z.y+18} fontSize={12} fontWeight="700" fill={z.color}
                        style={{ pointerEvents:"none" }}>{z.name}</text>
                      {zrot !== 0 && (
                        <text x={z.x+8} y={z.y+32} fontSize={9} fill={z.color} opacity={0.6}
                          style={{ pointerEvents:"none" }}>↻ {zrot}°</text>
                      )}
                      {isSel && zrot === 0 && tool==="select" && (
                        <ResizeHandles x={z.x} y={z.y} w={z.w} h={z.h}
                          onStart={(e, handle) => startDrag(e, z.id, "zone", handle, z.x, z.y, z.w, z.h)}/>
                      )}
                    </g>
                  );
                }

                if (entity.type === "facility") {
                  const fac  = entity.d;
                  const meta = FACILITY_META[fac.kind];
                  const isSel = selectedIds.has(fac.id);
                  return (
                    <g key={fac.id}
                      onMouseDown={e => { if(tool!=="select") return; startDrag(e, fac.id, "facility", "move", fac.x, fac.y, fac.r*2, fac.r*2); }}
                      style={{ cursor: tool==="select"?"move":"default" }}>
                      <circle cx={fac.x+1} cy={fac.y+2} r={fac.r} fill="#00000020"/>
                      <circle cx={fac.x} cy={fac.y} r={fac.r} fill={meta.color} opacity={0.92}
                        stroke={isSel?"white":"transparent"} strokeWidth={2.5}/>
                      <text x={fac.x} y={fac.y+4} textAnchor="middle" fontSize={Math.max(7, fac.r*0.5)}
                        fontWeight="700" fill="white" style={{ pointerEvents:"none" }}>
                        {meta.icon}
                      </text>
                      {fac.label && (
                        <text x={fac.x} y={fac.y+fac.r+14} textAnchor="middle" fontSize={10}
                          fill={meta.color} fontWeight="600" style={{ pointerEvents:"none" }}>
                          {fac.label}
                        </text>
                      )}
                      {isSel && (
                        <circle cx={fac.x} cy={fac.y} r={fac.r+3}
                          fill="none" stroke={meta.color} strokeWidth={2} opacity={0.5}
                          style={{ pointerEvents:"none" }}/>
                      )}
                      {isSel && tool==="select" && (
                        <circle cx={fac.x+fac.r+5} cy={fac.y} r={5}
                          fill="white" stroke="#2563EB" strokeWidth={1.5}
                          style={{ cursor:"e-resize" }}
                          onMouseDown={e => { e.stopPropagation(); e.preventDefault();
                            startDrag(e, fac.id, "facility", "r", fac.x, fac.y, fac.r*2, fac.r*2); }}/>
                      )}
                    </g>
                  );
                }

                if (entity.type === "item") {
                  const item = entity.d;
                  const { x, y, w, h } = item;
                  const cx = x+w/2, cy = y+h/2;
                  const color   = MONITOR_META[item.monitorType].color;
                  const isSel   = selectedIds.has(item.id);
                  const inGroup = (data.groups ?? []).some(g => g.memberIds.includes(item.id));
                  return (
                    <g key={item.id}>
                      <g transform={`rotate(${item.rotation}, ${cx}, ${cy})`}
                        onMouseDown={e => { if(tool!=="select") return; startDrag(e, item.id, "item", "move", x, y, w, h); }}
                        style={{ cursor: tool==="select"?"move":"default" }}>
                        <rect x={x+2} y={y+2} width={w} height={h} rx={5} fill="#00000020"/>
                        <rect x={x} y={y} width={w} height={h} rx={5}
                          fill={color+"CC"} stroke={isSel?"white":color+"88"} strokeWidth={isSel?2.5:1}/>
                        {inGroup && !isSel && (
                          <rect x={x} y={y} width={w} height={h} rx={5}
                            fill="none" stroke="#A855F7" strokeWidth={1} strokeDasharray="4,3" opacity={0.6}
                            style={{ pointerEvents:"none" }}/>
                        )}
                        <text x={cx} y={cy+1} textAnchor="middle" dominantBaseline="middle"
                          fontSize={10} fontWeight="700" fill="white" style={{ pointerEvents:"none" }}>
                          {MONITOR_META[item.monitorType].label}
                        </text>
                        {isSel && (
                          <circle cx={cx} cy={y-8} r={4} fill={color} opacity={0.8}
                            style={{ pointerEvents:"none" }}/>
                        )}
                      </g>
                      {isSel && tool==="select" && (
                        <ResizeHandles x={x} y={y} w={w} h={h}
                          onStart={(e, handle) => startDrag(e, item.id, "item", handle, x, y, w, h)}/>
                      )}
                      {isSel && tool==="select" && (
                        <>
                          <line x1={cx} y1={y - 1} x2={cx} y2={y - 22}
                            stroke="#2563EB" strokeWidth={1} strokeDasharray="3,2"
                            style={{ pointerEvents: "none" }}/>
                          <circle cx={cx} cy={y - 30} r={11}
                            fill="white" stroke="#2563EB" strokeWidth={1.5}
                            style={{ cursor: "grab" }}
                            onMouseDown={e => {
                              e.stopPropagation(); e.preventDefault();
                              const pt = getSVGCoords(e, svgRef, canvasW, canvasH);
                              const startAngle = Math.atan2(pt.y - cy, pt.x - cx);
                              dragRef.current = {
                                primaryId: item.id, entityKind: "item", handle: "rot",
                                sx: pt.x, sy: pt.y, ox: x, oy: y, ow: w, oh: h,
                                groupOrigins: [],
                                rotPrevAngle: startAngle, rotStartDeg: item.rotation,
                                rotCx: cx, rotCy: cy,
                              };
                              setSelectedIds(new Set([item.id]));
                            }}/>
                          <text x={cx} y={y - 30} textAnchor="middle" dominantBaseline="middle"
                            fontSize={13} fill="#2563EB" fontWeight="bold"
                            style={{ pointerEvents: "none", userSelect: "none" }}>↻</text>
                        </>
                      )}
                    </g>
                  );
                }
                return null;
              })}

              {drawingZone && drawingZone.w>0 && drawingZone.h>0 && (
                <rect x={drawingZone.x} y={drawingZone.y} width={drawingZone.w} height={drawingZone.h}
                  fill="#3B82F622" stroke="#3B82F6" strokeWidth={1.5} strokeDasharray="8,4" rx={5}
                  style={{ pointerEvents:"none" }}/>
              )}
            </svg>

            {pendingZone && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/25 rounded-xl">
                <div className="bg-white rounded-2xl shadow-2xl p-5 w-72">
                  <div className="text-sm font-bold text-slate-800 mb-1">구역 이름 입력</div>
                  <div className="text-xs text-gray-400 mb-3">크기 {Math.round(pendingZone.w)} × {Math.round(pendingZone.h)}</div>
                  <input type="text" value={zoneName} autoFocus
                    onChange={e => setZoneName(e.target.value)}
                    onKeyDown={e => { if(e.key==="Enter") confirmZone(); if(e.key==="Escape") setPendingZone(null); }}
                    placeholder="예: 서편, 동편, 개발팀..."
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 mb-3"/>
                  <div className="flex gap-2">
                    <button onClick={confirmZone}
                      className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors">확인</button>
                    <button onClick={() => setPendingZone(null)}
                      className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors">취소</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Properties Panel ── */}
        <div className="w-56 flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
          {selectedIds.size === 0 ? (
            <div className="p-4 flex flex-col items-center text-center mt-6 text-gray-400">
              <div className="text-3xl mb-2">↖</div>
              <div className="text-xs leading-relaxed">
                아이템을 클릭하여<br/>속성을 편집하세요
                <br/><span className="text-[10px] text-gray-300">Shift+클릭으로 다중선택</span>
              </div>
              <div className="mt-6 text-[10px] text-gray-300 space-y-1 text-left w-full border-t border-gray-100 pt-4">
                <div>• Del — 선택 삭제</div>
                <div>• Esc — 선택 해제</div>
                <div>• Shift+클릭 — 다중선택</div>
                <div>• Ctrl+C / V — 복사·붙여넣기</div>
                <div>• ↻ 핸들 드래그 — 회전</div>
                <div>• 핸들 드래그 — 리사이즈</div>
              </div>
            </div>
          ) : (
            <div className="p-3 space-y-3">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                속성 편집
                {selNonZoneIds.length > 1 && (
                  <span className="text-[10px] text-blue-500 normal-case font-normal">{selNonZoneIds.length}개 선택됨</span>
                )}
              </div>

              {selNonZoneIds.length >= 2 && (
                <div className="rounded-lg border border-purple-100 bg-purple-50 p-2.5 space-y-2">
                  <div className="text-[10px] font-semibold text-purple-600">{selNonZoneIds.length}개 선택됨 · 드래그로 함께 이동</div>
                  {!selGroup ? (
                    <button onClick={groupSelected}
                      className="w-full py-1.5 rounded-lg bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 transition-colors">
                      🔗 그룹으로 묶기
                    </button>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="text-[10px] text-purple-500 mb-1">그룹명</div>
                      <input type="text" value={selGroup.name}
                        onChange={e => patchGroup({ name: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-purple-200 text-xs focus:outline-none focus:ring-1 focus:ring-purple-400 bg-white text-purple-800"/>
                      <button onClick={ungroupSelected}
                        className="w-full py-1.5 rounded-lg border border-purple-200 text-purple-600 text-xs font-medium hover:bg-purple-100 transition-colors">
                        그룹 해제
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── Monitor ── */}
              {selItem && (<>
                <div className="text-xs font-semibold text-slate-700">🖥 모니터</div>
                <div>
                  <div className="text-[10px] text-gray-400 mb-1.5">모니터 타입</div>
                  <div className="space-y-1">
                    {MONITOR_TYPES.map(t => (
                      <button key={t} onClick={() => patchItem({ monitorType:t })}
                        className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-left border transition-colors flex items-center gap-2 ${
                          selItem.monitorType===t ? "text-white border-transparent" : "text-gray-600 border-gray-200 hover:bg-gray-50"
                        }`}
                        style={selItem.monitorType===t ? { background:MONITOR_META[t].color } : undefined}>
                        <span className="w-2 h-2 rounded-sm flex-shrink-0"
                          style={{ background:selItem.monitorType===t?"white":MONITOR_META[t].color+"CC" }}/>
                        {MONITOR_META[t].long}
                        {selItem.monitorType===t && <span className="ml-auto text-[10px] opacity-75">✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-400 mb-1">라벨</div>
                  <input type="text" value={selItem.label} onChange={e => patchItem({label:e.target.value})}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"/>
                </div>
                <div>
                  <div className="text-[10px] text-gray-400 mb-1">크기 (W × H)</div>
                  <div className="flex items-center gap-1">
                    <input type="number" value={Math.round(selItem.w)} min={MIN_SZ}
                      onChange={e => patchItem({w:Math.max(MIN_SZ,+e.target.value)})}
                      className="w-16 px-2 py-1.5 rounded-lg border border-gray-200 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400"/>
                    <span className="text-gray-300 text-xs">×</span>
                    <input type="number" value={Math.round(selItem.h)} min={MIN_SZ}
                      onChange={e => patchItem({h:Math.max(MIN_SZ,+e.target.value)})}
                      className="w-16 px-2 py-1.5 rounded-lg border border-gray-200 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400"/>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-400 mb-1.5">
                    회전 <span className="font-semibold text-slate-600">{selItem.rotation}°</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 mb-1.5">
                    {([[-90,"↺90"],[-45,"↺45"],[45,"↻45"],[90,"↻90"]] as [number,string][]).map(([d,lb]) => (
                      <button key={d} onClick={() => patchItem({rotation:(selItem.rotation+d+360)%360})}
                        className="py-1.5 rounded-lg border border-gray-200 text-[10px] font-bold text-slate-600 hover:bg-gray-50 transition-colors">{lb}</button>
                    ))}
                  </div>
                  <input type="range" min={0} max={359} value={selItem.rotation}
                    onChange={e => patchItem({rotation:+e.target.value})}
                    className="w-full accent-blue-600"/>
                </div>
              </>)}

              {/* ── Facility ── */}
              {selFac && (<>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                    style={{ background:FACILITY_META[selFac.kind].color }}>
                    {FACILITY_META[selFac.kind].icon}
                  </div>
                  <div className="text-xs font-semibold text-slate-700">{FACILITY_META[selFac.kind].label}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-400 mb-1">라벨</div>
                  <input type="text" value={selFac.label} onChange={e => patchFac({label:e.target.value})}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"/>
                </div>
                <div>
                  <div className="text-[10px] text-gray-400 mb-1">크기 (반지름)</div>
                  <div className="flex items-center gap-2">
                    <input type="number" value={Math.round(selFac.r)} min={15} max={120}
                      onChange={e => patchFac({r:Math.max(15,+e.target.value)})}
                      className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400"/>
                    <span className="text-[10px] text-gray-400">px (드래그도 가능)</span>
                  </div>
                </div>
              </>)}

              {/* ── Zone ── */}
              {selZone && (<>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded flex-shrink-0"
                    style={{ background:selZone.color+"33", border:`2px dashed ${selZone.color}` }}/>
                  <div className="text-xs font-semibold text-slate-700">공간 구역</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-400 mb-1">구역 이름</div>
                  <input type="text" value={selZone.name} onChange={e => patchZone({name:e.target.value})}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"/>
                </div>
                <div>
                  <div className="text-[10px] text-gray-400 mb-1">크기 (W × H)</div>
                  <div className="flex items-center gap-1">
                    <input type="number" value={Math.round(selZone.w)} min={MIN_SZ}
                      onChange={e => patchZone({w:Math.max(MIN_SZ,+e.target.value)})}
                      className="w-16 px-2 py-1.5 rounded-lg border border-gray-200 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400"/>
                    <span className="text-gray-300 text-xs">×</span>
                    <input type="number" value={Math.round(selZone.h)} min={MIN_SZ}
                      onChange={e => patchZone({h:Math.max(MIN_SZ,+e.target.value)})}
                      className="w-16 px-2 py-1.5 rounded-lg border border-gray-200 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400"/>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-400 mb-1.5">
                    구역 회전 <span className="font-semibold text-slate-600">{selZone.rotation ?? 0}°</span>
                    {(selZone.rotation ?? 0) !== 0 && (
                      <span className="ml-1 text-orange-400 text-[9px]">회전 중 리사이즈 불가</span>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-1 mb-1.5">
                    {([[-90,"↺90"],[-45,"↺45"],[45,"↻45"],[90,"↻90"]] as [number,string][]).map(([d,lb]) => (
                      <button key={d} onClick={() => patchZone({rotation:((selZone.rotation??0)+d+360)%360})}
                        className="py-1.5 rounded-lg border border-gray-200 text-[10px] font-bold text-slate-600 hover:bg-gray-50 transition-colors">{lb}</button>
                    ))}
                  </div>
                  <input type="range" min={0} max={359} value={selZone.rotation ?? 0}
                    onChange={e => patchZone({rotation:+e.target.value})}
                    className="w-full accent-blue-600"/>
                  {(selZone.rotation ?? 0) !== 0 && (
                    <button onClick={() => patchZone({rotation:0})}
                      className="mt-1 w-full py-1 rounded text-[10px] text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors border border-gray-100">
                      회전 초기화
                    </button>
                  )}
                </div>
              </>)}

              {/* ── Z-order ── */}
              {lastSelId && (
                <div className="border-t border-gray-100 pt-3">
                  <div className="text-[10px] text-gray-400 mb-1.5">🔢 순서 (Z-order)</div>
                  <div className="grid grid-cols-4 gap-1">
                    {([["back","맨뒤","⇊"],["backward","뒤로","↓"],["forward","앞으로","↑"],["front","맨앞","⇈"]] as [string,string,string][]).map(([op, label, icon]) => (
                      <button key={op}
                        onClick={() => zOp(lastSelId, op as "front"|"back"|"forward"|"backward")}
                        className="py-1.5 rounded border border-gray-200 text-[10px] text-slate-600 hover:bg-gray-50 transition-colors flex flex-col items-center gap-0.5">
                        <span className="text-sm leading-none">{icon}</span>
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Tags ── */}
              {(selItem || selFac || selZone) && (
                <div className="border-t border-gray-100 pt-3">
                  <div className="text-[10px] text-gray-400 mb-1.5">🏷 태그</div>
                  <TagEditor
                    key={lastSelId}
                    tags={selItem?.tags ?? selFac?.tags ?? selZone?.tags ?? []}
                    onChange={tags => {
                      if (selItem) patchItem({ tags });
                      else if (selFac) patchFac({ tags });
                      else if (selZone) patchZone({ tags });
                    }}
                  />
                </div>
              )}

              {/* ── Delete ── */}
              <div className="pt-2 border-t border-gray-100">
                <button onClick={deleteSelected}
                  className="w-full py-2 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 border border-red-200 transition-colors">
                  🗑 삭제{selectedIds.size > 1 ? ` (${selectedIds.size}개)` : ""}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
