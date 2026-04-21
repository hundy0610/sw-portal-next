"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Konva from "konva";
import { Stage, Layer, Rect, Text, Group, Transformer, Line } from "react-konva";
import type { FloorMapElement, FloorElementType, MonitorType, PaletteItem, AvailableFloor } from "./types";

// ── 캔버스 논리 좌표 ─────────────────────────────────────────────
const LOGIC_W = 900;
const LOGIC_H = 520;
const PAD     = 22;
const FLOOR_W = LOGIC_W - PAD * 2;
const FLOOR_H = LOGIC_H - PAD * 2;

// ── 요소 스타일 ──────────────────────────────────────────────────
const STYLES: Record<FloorElementType, { fill: string; stroke: string; text: string }> = {
  deskDouble:  { fill: "#FAF3E0", stroke: "#C8A97A", text: "#6B4F2A" },
  deskSingle:  { fill: "#FAF3E0", stroke: "#C8A97A", text: "#6B4F2A" },
  meetingRoom: { fill: "#E8F8EF", stroke: "#5CB87A", text: "#1A6B3A" },
  monitor:     { fill: "#DBEAFE", stroke: "#93C5FD", text: "#1E40AF" },
  lounge:      { fill: "#FFF3E0", stroke: "#FFB74D", text: "#B45309" },
  storage:     { fill: "#F3F4F6", stroke: "#9CA3AF", text: "#374151" },
  elevator:    { fill: "#F0F0F0", stroke: "#BDBDBD", text: "#374151" },
  stairs:      { fill: "#F0F0F0", stroke: "#BDBDBD", text: "#374151" },
  restroom:    { fill: "#EEF2FF", stroke: "#818CF8", text: "#3730A3" },
  label:       { fill: "transparent", stroke: "transparent", text: "#1F2937" },
  void:        { fill: "#F8F9FA", stroke: "#DEE2E6", text: "#9CA3AF" },
};

// ── 모니터 색상 ──────────────────────────────────────────────────
const MCOLOR: Record<MonitorType, string> = {
  std27: "#2563EB",
  std24: "#0284C7",
  dev34: "#7C3AED",
  none:  "#DC2626",
  unk:   "#94A3B8",
};
const MLONG: Record<MonitorType, string> = {
  std27: '표준형 27"',
  std24: '표준형 24"',
  dev34: '개발자 34"',
  none:  "미설치",
  unk:   "미확인",
};

// ── 팔레트 아이템 ────────────────────────────────────────────────
const PALETTE: PaletteItem[] = [
  { type: "deskDouble",  label: "양면 테이블",  icon: "⊞", defaultW: 210, defaultH: 55 },
  { type: "deskSingle",  label: "단면 테이블",  icon: "⊟", defaultW: 210, defaultH: 35 },
  { type: "meetingRoom", label: "회의실",        icon: "⬜", defaultW: 110, defaultH: 90 },
  { type: "monitor",     label: "모니터 좌석",  icon: "🖥", defaultW: 26,  defaultH: 15 },
  { type: "lounge",      label: "라운지",        icon: "⬛", defaultW: 90,  defaultH: 70 },
  { type: "storage",     label: "창고",          icon: "◧", defaultW: 65,  defaultH: 60 },
  { type: "elevator",    label: "엘리베이터",    icon: "⇑", defaultW: 52,  defaultH: 52 },
  { type: "stairs",      label: "계단",          icon: "▤", defaultW: 58,  defaultH: 45 },
  { type: "restroom",    label: "화장실",        icon: "⊕", defaultW: 65,  defaultH: 65 },
  { type: "label",       label: "텍스트",        icon: "T", defaultW: 110, defaultH: 26 },
  { type: "void",        label: "빈 공간",       icon: "╳", defaultW: 90,  defaultH: 90 },
];

// ── localStorage 헬퍼 ────────────────────────────────────────────
function lsKey(bldId: string, floorId: string) {
  return `sw-floor-layout-${bldId}-${floorId}`;
}
function loadLayout(bldId: string, floorId: string): FloorMapElement[] {
  try {
    const s = localStorage.getItem(lsKey(bldId, floorId));
    return s ? JSON.parse(s) : [];
  } catch { return []; }
}
function saveLayout(bldId: string, floorId: string, els: FloorMapElement[]) {
  try { localStorage.setItem(lsKey(bldId, floorId), JSON.stringify(els)); } catch {}
}
export function hasLayout(bldId: string, floorId: string): boolean {
  try { return !!localStorage.getItem(lsKey(bldId, floorId)); } catch { return false; }
}

// ── Props ────────────────────────────────────────────────────────
export interface MapEditorProps {
  buildingId: string;
  floorId: string;
  seatOverrides?: Record<string, MonitorType>;
  onMonitorSelect?: (seatId: string) => void;
  selectedSeatId?: string | null;
  availableFloors?: AvailableFloor[];
}

// ════════════════════════════════════════════════════════════════
// MapEditor
// ════════════════════════════════════════════════════════════════
export default function MapEditor({
  buildingId, floorId,
  seatOverrides = {},
  onMonitorSelect,
  selectedSeatId,
  availableFloors = [],
}: MapEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef     = useRef<Konva.Stage>(null);
  const trRef        = useRef<Konva.Transformer>(null);

  const [elements,    setElements]    = useState<FloorMapElement[]>([]);
  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  const [placingType, setPlacingType] = useState<FloorElementType | null>(null);
  const [editMode,    setEditMode]    = useState(false);
  const [scale,       setScale]       = useState(1);
  const [editingName, setEditingName] = useState("");

  // 복사 모달
  const [showCopyModal,  setShowCopyModal]  = useState(false);
  const [copySourceBld,  setCopySourceBld]  = useState<string>("");
  const [copySourceFloor,setCopySourceFloor]= useState<string>("");
  const [copyMode,       setCopyMode]       = useState<"overwrite" | "append">("overwrite");

  // ── 로드 ───────────────────────────────────────────────────────
  useEffect(() => {
    setElements(loadLayout(buildingId, floorId));
    setSelectedId(null); setPlacingType(null);
  }, [buildingId, floorId]);

  // ── 저장 ───────────────────────────────────────────────────────
  useEffect(() => {
    saveLayout(buildingId, floorId, elements);
  }, [buildingId, floorId, elements]);

  // ── 반응형 스케일 ───────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      setScale(Math.min(1, Math.max(0.45, w / LOGIC_W)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Transformer 연결 ────────────────────────────────────────────
  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    if (selectedId && editMode) {
      const node = stage.findOne(`#${selectedId}`);
      tr.nodes(node ? [node as Konva.Group] : []);
    } else {
      tr.nodes([]);
    }
    tr.getLayer()?.batchDraw();
  }, [selectedId, editMode]);

  // ── 선택 시 이름 동기화 ─────────────────────────────────────────
  useEffect(() => {
    setEditingName(elements.find(e => e.id === selectedId)?.name ?? "");
  }, [selectedId, elements]);

  // ── 키보드 단축키 ───────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setPlacingType(null); setSelectedId(null); return; }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId && editMode) {
        if (document.activeElement?.tagName === "INPUT") return;
        removeSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, editMode]);

  const selectedEl = elements.find(e => e.id === selectedId);

  const updateEl = useCallback((id: string, patch: Partial<FloorMapElement>) => {
    setElements(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
  }, []);

  const removeSelected = useCallback(() => {
    if (!selectedId) return;
    setElements(prev => prev.filter(e => e.id !== selectedId));
    setSelectedId(null);
  }, [selectedId]);

  // 복사 실행
  const executeCopy = useCallback(() => {
    if (!copySourceBld || !copySourceFloor) return;
    const src = loadLayout(copySourceBld, copySourceFloor);
    if (src.length === 0) {
      alert("선택한 층에 저장된 도면이 없습니다.");
      return;
    }
    if (copyMode === "overwrite") {
      // 새 ID 부여 (덮어쓰기)
      const rekeyed = src.map(el => ({
        ...el,
        id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        seatId: el.type === "monitor" ? `NEW-${Date.now()}-${Math.random().toString(36).slice(2,5)}` : el.seatId,
      }));
      setElements(rekeyed);
      saveLayout(buildingId, floorId, rekeyed);
    } else {
      // 추가 (append) — 오른쪽/아래로 20px 오프셋
      const offset = 20;
      const appended = src.map(el => ({
        ...el,
        id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        x: Math.min(el.x + offset, LOGIC_W - el.width - PAD),
        y: Math.min(el.y + offset, LOGIC_H - el.height - PAD),
        seatId: el.type === "monitor" ? `NEW-${Date.now()}-${Math.random().toString(36).slice(2,5)}` : el.seatId,
      }));
      setElements(prev => {
        const next = [...prev, ...appended];
        saveLayout(buildingId, floorId, next);
        return next;
      });
    }
    setShowCopyModal(false);
    setSelectedId(null);
  }, [copySourceBld, copySourceFloor, copyMode, buildingId, floorId]);

  const effectiveMonitorColor = (el: FloorMapElement) => {
    const t = (el.seatId && seatOverrides[el.seatId]) || el.monitorType || "unk";
    return MCOLOR[t as MonitorType];
  };

  // ── 스테이지 클릭 ──────────────────────────────────────────────
  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;

    if (placingType && editMode) {
      const ptr = stage.getPointerPosition()!;
      const lx = ptr.x / scale;
      const ly = ptr.y / scale;
      const item = PALETTE.find(p => p.type === placingType)!;
      const newEl: FloorMapElement = {
        id: `el-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,
        type:     placingType,
        x:        Math.max(PAD, Math.min(PAD + FLOOR_W - item.defaultW, lx - item.defaultW / 2)),
        y:        Math.max(PAD, Math.min(PAD + FLOOR_H - item.defaultH, ly - item.defaultH / 2)),
        width:    item.defaultW,
        height:   item.defaultH,
        rotation: 0,
        name:     item.label,
        monitorType: placingType === "monitor" ? "unk" : undefined,
        seatId:      placingType === "monitor" ? `NEW-${Date.now()}` : undefined,
      };
      setElements(prev => [...prev, newEl]);
      setSelectedId(newEl.id);
      if (!e.evt.shiftKey) setPlacingType(null);
      return;
    }

    if (e.target === stage || e.target.getParent()?.getClassName() === "Layer") {
      setSelectedId(null);
    }
  };

  const handleElClick = (el: FloorMapElement) => {
    if (!editMode && el.type === "monitor" && el.seatId) {
      onMonitorSelect?.(el.seatId);
    } else if (editMode) {
      setSelectedId(el.id);
    }
  };

  const handleDragEnd = (id: string, e: Konva.KonvaEventObject<DragEvent>) =>
    updateEl(id, { x: Math.round(e.target.x()), y: Math.round(e.target.y()) });

  const handleTransformEnd = (e: Konva.KonvaEventObject<Event>) => {
    const node = e.target;
    const sx = node.scaleX(), sy = node.scaleY();
    updateEl(node.id(), {
      x:        Math.round(node.x()),
      y:        Math.round(node.y()),
      width:    Math.max(20, Math.round(node.width()  * sx)),
      height:   Math.max(14, Math.round(node.height() * sy)),
      rotation: Math.round(node.rotation()),
    });
    node.scaleX(1); node.scaleY(1);
  };

  // ── 복사 모달에 표시할 건물 목록 (현재 층 제외) ─────────────────
  const copyableFloors = availableFloors.filter(
    f => !(f.buildingId === buildingId && f.floorId === floorId)
  );
  // 선택한 건물의 층 목록
  const copyBldFloors = copyableFloors.filter(f => f.buildingId === copySourceBld);
  // 복사 소스 층에 저장 데이터가 있는지 미리 확인
  const copySourceHasData = copySourceBld && copySourceFloor
    ? loadLayout(copySourceBld, copySourceFloor).length > 0
    : false;
  // 복사 가능한 유일한 건물 목록
  const copyBldList = Array.from(
    new Map(copyableFloors.map(f => [f.buildingId, f])).values()
  );

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full" style={{ fontFamily: "system-ui,sans-serif" }}>

      {/* 상단 툴바 */}
      <div className="flex-none flex items-center gap-2 px-3 py-2 bg-white border-b border-gray-200 text-xs">
        <span className="text-gray-400">도면 레이아웃 편집기</span>
        {editMode && placingType && (
          <span className="text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
            📍 클릭으로 배치 · Shift=연속 · Esc=취소
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {/* 다른 층 복사 */}
          {availableFloors.length > 0 && (
            <button
              onClick={() => {
                // 기본 선택: 복사 가능한 첫 번째 항목
                if (!copySourceBld && copyBldList.length > 0) {
                  const first = copyBldList[0];
                  setCopySourceBld(first.buildingId);
                  const firstFloor = copyableFloors.find(f => f.buildingId === first.buildingId);
                  if (firstFloor) setCopySourceFloor(firstFloor.floorId);
                }
                setShowCopyModal(v => !v);
              }}
              className={`px-3 py-1.5 font-semibold rounded-lg border transition-all text-xs ${
                showCopyModal
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-blue-600 border-blue-200 hover:bg-blue-50"
              }`}
            >
              ⧉ 다른 층 복사
            </button>
          )}
          <button
            onClick={() => { setEditMode(v => !v); setSelectedId(null); setPlacingType(null); setShowCopyModal(false); }}
            className={`px-3 py-1.5 font-semibold rounded-lg border transition-all text-xs ${
              editMode
                ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                : "bg-white text-slate-600 border-gray-200 hover:bg-amber-50 hover:border-amber-300"
            }`}
          >
            {editMode ? "✓ 편집 중" : "✏️ 편집"}
          </button>
          {editMode && (
            <button
              onClick={() => {
                if (confirm("이 층의 도면을 초기화할까요? 모든 배치 아이콘이 삭제됩니다.")) {
                  setElements([]); saveLayout(buildingId, floorId, []);
                  setSelectedId(null); setPlacingType(null);
                }
              }}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-all"
            >↩ 초기화</button>
          )}
        </div>
      </div>

      {/* ── 복사 모달 패널 ──────────────────────────────────────────── */}
      {showCopyModal && (
        <div className="flex-none bg-blue-50 border-b border-blue-200 px-4 py-3">
          <div className="flex items-start gap-4 flex-wrap">
            <div>
              <div className="text-[10px] text-blue-600 font-bold mb-1.5">⧉ 다른 층 도면 복사</div>

              {/* 건물 선택 */}
              <div className="flex gap-1 mb-2">
                {copyBldList.map(b => (
                  <button
                    key={b.buildingId}
                    onClick={() => {
                      setCopySourceBld(b.buildingId);
                      const first = copyableFloors.find(f => f.buildingId === b.buildingId);
                      if (first) setCopySourceFloor(first.floorId);
                    }}
                    className={`px-2.5 py-1 text-xs font-semibold rounded border transition-all ${
                      copySourceBld === b.buildingId
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-blue-50"
                    }`}
                  >
                    {b.buildingLabel}
                  </button>
                ))}
              </div>

              {/* 층 선택 */}
              {copySourceBld && (
                <div className="flex gap-1 flex-wrap mb-2">
                  {copyBldFloors.map(f => {
                    const hasData = loadLayout(f.buildingId, f.floorId).length > 0;
                    return (
                      <button
                        key={f.floorId}
                        onClick={() => setCopySourceFloor(f.floorId)}
                        className={`px-2 py-1 text-xs rounded border transition-all ${
                          copySourceFloor === f.floorId
                            ? "bg-blue-600 text-white border-blue-600 font-semibold"
                            : hasData
                              ? "bg-white text-gray-700 border-gray-300 hover:bg-blue-50"
                              : "bg-gray-50 text-gray-400 border-gray-200 cursor-default"
                        }`}
                        title={hasData ? `${f.floorLabel} — 저장된 도면 있음` : `${f.floorLabel} — 저장된 도면 없음`}
                      >
                        {f.floorLabel}
                        {hasData && <span className="ml-1 text-[9px] opacity-70">●</span>}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 복사 방식 */}
              <div className="flex gap-2 mb-2">
                {(["overwrite", "append"] as const).map(m => (
                  <label key={m} className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                    <input
                      type="radio"
                      name="copyMode"
                      value={m}
                      checked={copyMode === m}
                      onChange={() => setCopyMode(m)}
                      className="accent-blue-600"
                    />
                    {m === "overwrite" ? "현재 도면 덮어쓰기" : "현재 도면에 추가"}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5 justify-end self-end ml-auto">
              {/* 미리보기 정보 */}
              {copySourceBld && copySourceFloor && (
                <div className={`text-[10px] px-2 py-1 rounded text-center ${
                  copySourceHasData
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-gray-50 text-gray-400 border border-gray-200"
                }`}>
                  {copySourceHasData
                    ? `${loadLayout(copySourceBld, copySourceFloor).length}개 요소`
                    : "저장된 도면 없음"}
                </div>
              )}
              <button
                onClick={executeCopy}
                disabled={!copySourceHasData}
                className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {copyMode === "overwrite" ? "⧉ 복사 (덮어쓰기)" : "⧉ 복사 (추가)"}
              </button>
              <button
                onClick={() => setShowCopyModal(false)}
                className="px-4 py-1.5 bg-white text-gray-500 text-xs rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── 팔레트 ─────────────────────────────────────────────── */}
        {editMode && (
          <div className="w-[100px] flex-shrink-0 border-r border-gray-200 bg-gray-50 overflow-y-auto p-1.5 flex flex-col gap-1">
            <div className="text-[9px] text-gray-400 font-bold px-1 py-0.5">아이콘 팔레트</div>
            {PALETTE.map(item => (
              <button
                key={item.type}
                onClick={() => setPlacingType(placingType === item.type ? null : item.type)}
                className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg text-xs transition-all border ${
                  placingType === item.type
                    ? "bg-amber-100 border-amber-400 text-amber-700 shadow-sm"
                    : "bg-white border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-300"
                }`}
              >
                <span className="text-xl leading-none">{item.icon}</span>
                <span className="text-[9px] leading-tight text-center">{item.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* ── 캔버스 ────────────────────────────────────────────── */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto bg-slate-100 flex items-start justify-start p-3"
          style={{ cursor: placingType ? "crosshair" : "default" }}
        >
          <div className="inline-block shadow-md rounded-lg overflow-hidden border border-gray-300">
            <Stage
              ref={stageRef}
              width={LOGIC_W * scale}
              height={LOGIC_H * scale}
              scaleX={scale}
              scaleY={scale}
              onClick={handleStageClick}
              style={{ display: "block" }}
            >
              <Layer>
                {/* 바닥 배경 */}
                <Rect
                  x={0} y={0} width={LOGIC_W} height={LOGIC_H}
                  fill="#FFFFFF"
                />
                {/* 층 경계 (점선) */}
                <Rect
                  x={PAD} y={PAD} width={FLOOR_W} height={FLOOR_H}
                  fill="#F8FAFC"
                  stroke="#94A3B8"
                  strokeWidth={1.5}
                  dash={[6, 3]}
                />
                {/* 방향 레이블 */}
                <Text x={PAD+6} y={PAD+6} text="← 서편" fontSize={9} fill="#94A3B8" />
                <Text x={PAD+FLOOR_W-46} y={PAD+6} text="동편 →" fontSize={9} fill="#94A3B8" />

                {/* ── 요소 렌더링 ── */}
                {elements.map(el => {
                  const sty = STYLES[el.type];
                  const isSel = el.id === selectedId;
                  const isMon = el.type === "monitor";
                  const isMonSel = isMon && el.seatId === selectedSeatId;
                  const mFill = isMon ? effectiveMonitorColor(el) + "CC" : undefined;
                  const mStroke = isMon ? effectiveMonitorColor(el) : undefined;
                  const fillColor = el.color ?? mFill ?? sty.fill;
                  const strokeColor = isSel ? "#F59E0B" : isMonSel ? "#3B82F6" : (mStroke ?? sty.stroke);
                  const strokeW = isSel || isMonSel ? 2 : 1;

                  return (
                    <Group
                      key={el.id}
                      id={el.id}
                      x={el.x}
                      y={el.y}
                      width={el.width}
                      height={el.height}
                      rotation={el.rotation}
                      draggable={editMode}
                      onClick={() => handleElClick(el)}
                      onTap={() => handleElClick(el)}
                      onDragEnd={(e) => handleDragEnd(el.id, e)}
                      onTransformEnd={handleTransformEnd}
                      offsetX={0} offsetY={0}
                    >
                      {/* 배경 */}
                      {el.type !== "label" && (
                        <Rect
                          width={el.width} height={el.height}
                          fill={fillColor}
                          stroke={strokeColor}
                          strokeWidth={strokeW}
                          cornerRadius={el.type === "meetingRoom" || el.type === "lounge" ? 4 : 2}
                          shadowEnabled={isSel}
                          shadowBlur={8} shadowOpacity={0.25}
                        />
                      )}

                      {/* void 사선 해칭 */}
                      {el.type === "void" && (() => {
                        const lines = [];
                        const step = 10;
                        for (let i = -el.height; i < el.width + el.height; i += step) {
                          lines.push(
                            <Line key={i}
                              points={[
                                Math.max(0, i), i < 0 ? -i : 0,
                                Math.min(el.width, i + el.height),
                                i < 0 ? 0 : Math.min(el.height, el.height - i + el.width),
                              ]}
                              stroke="#D1D5DB" strokeWidth={0.6} opacity={0.6}
                              listening={false}
                            />
                          );
                        }
                        return lines;
                      })()}

                      {/* 계단 X 패턴 */}
                      {el.type === "stairs" && (
                        <>
                          <Line points={[4, 4, el.width-4, el.height-4]} stroke="#9CA3AF" strokeWidth={1} listening={false} />
                          <Line points={[el.width-4, 4, 4, el.height-4]} stroke="#9CA3AF" strokeWidth={1} listening={false} />
                        </>
                      )}

                      {/* 엘리베이터 X 패턴 */}
                      {el.type === "elevator" && (
                        <>
                          <Line points={[4, 4, el.width-4, el.height-4]} stroke="#9CA3AF" strokeWidth={1} listening={false} />
                          <Line points={[el.width-4, 4, 4, el.height-4]} stroke="#9CA3AF" strokeWidth={1} listening={false} />
                        </>
                      )}

                      {/* 모니터 "✕" (미설치) */}
                      {isMon && (seatOverrides[el.seatId ?? ""] ?? el.monitorType) === "none" && (
                        <>
                          <Line points={[2, 2, el.width-2, el.height-2]} stroke="white" strokeWidth={1.3} listening={false} />
                          <Line points={[el.width-2, 2, 2, el.height-2]} stroke="white" strokeWidth={1.3} listening={false} />
                        </>
                      )}

                      {/* 선택 강조 링 */}
                      {isMonSel && (
                        <Rect
                          x={-2} y={-2} width={el.width+4} height={el.height+4}
                          fill="transparent"
                          stroke="#3B82F6" strokeWidth={2}
                          cornerRadius={2} listening={false}
                        />
                      )}

                      {/* 텍스트 (모니터 제외: 너무 작음) */}
                      {el.name && !isMon && (
                        <Text
                          text={el.name}
                          width={el.width}
                          height={el.height}
                          align="center"
                          verticalAlign="middle"
                          fontSize={Math.min(13, Math.max(7, el.height / 3.2))}
                          fill={sty.text}
                          padding={4}
                          listening={false}
                          wrap="word"
                        />
                      )}

                      {/* 편집 모드: 그립 힌트 */}
                      {editMode && !isMon && (
                        <Text
                          x={2} y={2} text="⠿" fontSize={7}
                          fill="#CBD5E1" listening={false}
                        />
                      )}
                    </Group>
                  );
                })}

                {/* Transformer */}
                {editMode && (
                  <Transformer
                    ref={trRef}
                    rotateEnabled={true}
                    enabledAnchors={[
                      "top-left","top-center","top-right",
                      "middle-left","middle-right",
                      "bottom-left","bottom-center","bottom-right",
                    ]}
                    boundBoxFunc={(oldBox, newBox) => {
                      if (newBox.width < 20 || newBox.height < 14) return oldBox;
                      return newBox;
                    }}
                    anchorSize={7}
                    anchorCornerRadius={3}
                    borderStroke="#F59E0B"
                    anchorStroke="#F59E0B"
                    anchorFill="white"
                  />
                )}
              </Layer>
            </Stage>
          </div>
        </div>

        {/* ── 속성 패널 (편집 모드 + 요소 선택 시) ──────────────── */}
        {editMode && (
          <div className="w-52 flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto flex flex-col">
            {selectedEl ? (
              <div className="p-3 space-y-3">
                <div className="text-xs font-bold text-gray-700">속성 편집</div>

                {/* 이름 */}
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">이름</label>
                  <input
                    type="text"
                    value={editingName}
                    onChange={e => { setEditingName(e.target.value); updateEl(selectedEl.id, { name: e.target.value }); }}
                    className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
                    placeholder="이름 입력..."
                  />
                </div>

                {/* 모니터 전용 */}
                {selectedEl.type === "monitor" && (
                  <div className="space-y-2">
                    <div>
                      <label className="text-[10px] text-gray-400 block mb-1">좌석 ID</label>
                      <input
                        type="text"
                        value={selectedEl.seatId ?? ""}
                        onChange={e => updateEl(selectedEl.id, { seatId: e.target.value })}
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-400"
                        placeholder="예: BW-2FW-C12"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 block mb-1">기본 타입</label>
                      <div className="flex flex-col gap-1">
                        {(["std27","std24","dev34","none","unk"] as MonitorType[]).map(t => (
                          <button
                            key={t}
                            onClick={() => updateEl(selectedEl.id, { monitorType: t })}
                            className="text-left px-2 py-1 rounded text-xs border transition-all"
                            style={{
                              background: selectedEl.monitorType === t ? MCOLOR[t] : "#F9FAFB",
                              color: selectedEl.monitorType === t ? "white" : "#374151",
                              borderColor: MCOLOR[t] + "88",
                            }}
                          >
                            {MLONG[t]}
                            {selectedEl.monitorType === t && " ✓"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 크기 */}
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">크기 (W × H)</label>
                  <div className="flex gap-1.5 items-center">
                    <input type="number"
                      value={Math.round(selectedEl.width)}
                      onChange={e => updateEl(selectedEl.id, { width: Math.max(20, +e.target.value) })}
                      className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none"
                    />
                    <span className="text-gray-300 text-xs">×</span>
                    <input type="number"
                      value={Math.round(selectedEl.height)}
                      onChange={e => updateEl(selectedEl.id, { height: Math.max(14, +e.target.value) })}
                      className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none"
                    />
                  </div>
                </div>

                {/* 위치 */}
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">위치 (X, Y)</label>
                  <div className="flex gap-1.5 items-center">
                    <input type="number"
                      value={Math.round(selectedEl.x)}
                      onChange={e => updateEl(selectedEl.id, { x: +e.target.value })}
                      className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none"
                    />
                    <span className="text-gray-300 text-xs">,</span>
                    <input type="number"
                      value={Math.round(selectedEl.y)}
                      onChange={e => updateEl(selectedEl.id, { y: +e.target.value })}
                      className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none"
                    />
                  </div>
                </div>

                {/* 회전 */}
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">회전</label>
                  <div className="flex gap-1.5 items-center">
                    <input type="number"
                      value={Math.round(selectedEl.rotation)}
                      onChange={e => updateEl(selectedEl.id, { rotation: +e.target.value })}
                      className="flex-1 border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none"
                    />
                    <span className="text-gray-400 text-[10px]">°</span>
                    <button
                      onClick={() => updateEl(selectedEl.id, { rotation: (selectedEl.rotation + 90) % 360 })}
                      className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 whitespace-nowrap"
                    >↻ 90°</button>
                  </div>
                </div>

                {/* 커스텀 색상 */}
                {selectedEl.type !== "monitor" && (
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">색상 (선택)</label>
                    <div className="flex gap-1.5 items-center">
                      <input type="color"
                        value={selectedEl.color ?? STYLES[selectedEl.type].fill}
                        onChange={e => updateEl(selectedEl.id, { color: e.target.value })}
                        className="w-8 h-7 border border-gray-200 rounded cursor-pointer"
                      />
                      {selectedEl.color && (
                        <button
                          onClick={() => updateEl(selectedEl.id, { color: undefined })}
                          className="text-[10px] text-gray-400 hover:text-red-500 underline"
                        >기본값</button>
                      )}
                    </div>
                  </div>
                )}

                {/* 레이어 순서 */}
                <div className="flex gap-1.5">
                  <button
                    onClick={() => {
                      const idx = elements.findIndex(e => e.id === selectedId);
                      if (idx > 0) {
                        const next = [...elements];
                        [next[idx-1], next[idx]] = [next[idx], next[idx-1]];
                        setElements(next);
                      }
                    }}
                    className="flex-1 text-xs py-1 border border-gray-200 rounded hover:bg-gray-50"
                    title="앞으로"
                  >↑ 앞</button>
                  <button
                    onClick={() => {
                      const idx = elements.findIndex(e => e.id === selectedId);
                      if (idx < elements.length - 1) {
                        const next = [...elements];
                        [next[idx], next[idx+1]] = [next[idx+1], next[idx]];
                        setElements(next);
                      }
                    }}
                    className="flex-1 text-xs py-1 border border-gray-200 rounded hover:bg-gray-50"
                    title="뒤로"
                  >↓ 뒤</button>
                </div>

                {/* 복제 */}
                <button
                  onClick={() => {
                    if (!selectedEl) return;
                    const clone: FloorMapElement = {
                      ...selectedEl,
                      id: `el-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,
                      x: selectedEl.x + 12,
                      y: selectedEl.y + 12,
                      seatId: selectedEl.type === "monitor" ? `NEW-${Date.now()}` : selectedEl.seatId,
                    };
                    setElements(prev => [...prev, clone]);
                    setSelectedId(clone.id);
                  }}
                  className="w-full py-1.5 text-xs border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  ⧉ 복제
                </button>

                {/* 삭제 */}
                <button
                  onClick={removeSelected}
                  className="w-full py-2 text-xs font-semibold bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                >
                  🗑 삭제 (Del)
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-4 text-xs text-gray-400">
                <div className="text-3xl mb-2 opacity-40">☝️</div>
                <div>팔레트에서 아이콘을<br />선택하고 도면을<br />클릭하여 배치하세요</div>
                <div className="mt-4 text-[10px] leading-relaxed opacity-60">
                  Shift = 연속 배치<br />
                  Del = 삭제<br />
                  Esc = 취소
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
