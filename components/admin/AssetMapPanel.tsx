"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import type { MonitorHistoryEntry } from "@/lib/notion";
import { FLOOR_SKETCHES, SketchCtx, SketchZone } from "./FloorSketches";
import FloorMapEditor, { type EditorData, migrate } from "./FloorMapEditor";
import FloorMapView from "./FloorMapView";

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════
type MonitorType = "std27" | "std24" | "dev34" | "none" | "unk";
type FilterMode  = "all" | MonitorType;

interface SeatData {
  id:   string;
  type: MonitorType;
  row:  number;
  col:  number;
}
interface ZoneData {
  id:    string;
  label: string;
  side:  string;       // "W" | "E" | "S"
  cols:  number;
  rows:  number;
  seats: SeatData[];
}
interface FloorData {
  id:    string;
  label: string;
  note:  string;
  zones: ZoneData[];
  rooms: string[];
}
interface BuildingData {
  id:     string;
  label:  string;
  floors: FloorData[];
}

// SVG 스케치 레이아웃 타입
interface CoreBlock  { x:number; y:number; w:number; h:number; label:string; fill?:string; stroke?:string; }
interface RoomBlock  { x:number; y:number; w:number; h:number; label:string; sub?:string; }
interface DeskBgBlock{ id:string; x:number; y:number; w:number; h:number; label:string; fill:string; stroke:string; }
interface SeatGrid   { zoneId:string; startX:number; startY:number; cols:number; rows:number; sw:number; sh:number; gx:number; gy:number; rowGroups:number[]; aisle:number; }
interface SvgLabel   { x:number; y:number; text:string; size?:number; color?:string; anchor?:string; bold?:boolean; }
interface FloorSvgCfg{
  vw:number; vh:number;
  coreBlocks?: CoreBlock[];
  extraBlocks?: CoreBlock[];
  rooms?:       RoomBlock[];
  deskBg?:      DeskBgBlock[];
  seatGrids?:   SeatGrid[];
  labels?:      SvgLabel[];
}

// ══════════════════════════════════════════════════════════════════════════════
// MONITOR META
// ══════════════════════════════════════════════════════════════════════════════
const MONITOR = {
  std27: { label:'27"',  long:'표준형 27"',  color:"#2563EB", pale:"#DBEAFE", border:"#93C5FD" },
  std24: { label:'24"',  long:'표준형 24"',  color:"#0284C7", pale:"#E0F2FE", border:"#7DD3FC" },
  dev34: { label:'34"',  long:'개발자 34"',  color:"#7C3AED", pale:"#EDE9FE", border:"#C4B5FD" },
  none:  { label:"✕",   long:"미설치",      color:"#DC2626", pale:"#FEE2E2", border:"#FCA5A5" },
  unk:   { label:"·",   long:"미확인",      color:"#94A3B8", pale:"#F1F5F9", border:"#CBD5E1" },
} as const;
const TYPES: MonitorType[] = ["std27","std24","dev34","none","unk"];

// ══════════════════════════════════════════════════════════════════════════════
// DATA HELPERS
// ══════════════════════════════════════════════════════════════════════════════
const f = (n:number, t:MonitorType): MonitorType[] => Array(n).fill(t);
const m = (...pairs:[number,MonitorType][]): MonitorType[] => pairs.flatMap(([n,t]) => f(n,t));

function buildZone(
  id:string, label:string, side:string,
  cols:number, rows:number,
  types:MonitorType[],
  bldCode:string, flCode:string
): ZoneData {
  const seats: SeatData[] = types.map((type, idx) => ({
    id:   `${bldCode}-${flCode}${side}-${String.fromCharCode(65+Math.floor(idx/cols))}${String(idx%cols+1).padStart(2,"0")}`,
    type,
    row:  Math.floor(idx/cols),
    col:  idx%cols,
  }));
  return { id, label, side, cols, rows, seats };
}

function calcStats(zones: ZoneData[]) {
  const r = { std27:0, std24:0, dev34:0, none:0, unk:0, total:0 };
  zones.forEach(z => z.seats.forEach(s => { (r as Record<string,number>)[s.type]++; r.total++; }));
  return r;
}

function getSeatPositions(sg: SeatGrid): {x:number;y:number;row:number;col:number}[] {
  const { startX, startY, cols, rows, sw, sh, gx, gy, rowGroups, aisle } = sg;
  const positions: {x:number;y:number;row:number;col:number}[] = [];
  let rowY = startY, groupIdx = 0, rowInGroup = 0;
  for (let r = 0; r < rows; r++) {
    let colX = startX;
    for (let c = 0; c < cols; c++) {
      positions.push({ x:colX, y:rowY, row:r, col:c });
      colX += sw + gx;
    }
    rowInGroup++;
    const groupSize = (rowGroups && rowGroups[groupIdx]) || 2;
    if (rowInGroup >= groupSize && r < rows - 1) {
      rowY += sh + gy + aisle; groupIdx++; rowInGroup = 0;
    } else {
      rowY += sh + gy;
    }
  }
  return positions;
}

// ══════════════════════════════════════════════════════════════════════════════
// BUILDING DATA  (본관 도면 기반 근사치 / 신관·S빌딩 추후 업데이트)
// ══════════════════════════════════════════════════════════════════════════════
const BUILDINGS: BuildingData[] = [
  {
    id:"bw", label:"본관",
    floors: [
      // ── 본관 좌석 수는 원본 코드베이스 기준 (mkZone 좌석 수 검증값)
      // ── 타입은 전체 미확인(unk)으로 초기화 → 현장 조사 후 편집 기능으로 입력
      // 2층: 클러스터3(base=26) 아랫줄 좌측 4번째(seat[36]) = 모니터 미설치(도면 빨간X)
      { id:"2F", label:"2층", note:"서편 스마트오피스 52석",
        zones:[ buildZone("SO","스마트오피스","W",13,4,
          m([36,"unk"],[1,"none"],[15,"unk"]), "BW","2F") ],
        rooms:["미팅룸 A (13.5㎡/4.1평)","미팅룸 B (21.1㎡/6.4평)","미팅룸 C (18.8㎡/5.7평)","쇼룸 (15.2㎡/4.6평)"] },
      { id:"3F", label:"3층", note:"서편 54석 · 동편 71석",
        zones:[
          buildZone("W","서편","W",6,9, f(54,"unk"), "BW","3F"),
          buildZone("E","동편","E",8,9, f(71,"unk"), "BW","3F"),
        ],
        rooms:["미팅룸 (18.5m²/5.6평)","미팅룸 (16.1m²/4.9평)"] },
      { id:"4F", label:"4층", note:"서편 74석 · 동편 49석",
        zones:[
          buildZone("W","서편","W",7,11, f(74,"unk"), "BW","4F"),
          buildZone("E","동편","E",7,7,  f(49,"unk"), "BW","4F"),
        ],
        rooms:["스마트2 (5.6평)","스마트3 (5.6평)","라운지 (10.7평)"] },
      { id:"5F", label:"5층", note:"서편 74석 · 동편 49석",
        zones:[
          buildZone("W","서편","W",7,11, f(74,"unk"), "BW","5F"),
          buildZone("E","동편","E",7,7,  f(49,"unk"), "BW","5F"),
        ],
        rooms:["미팅룸 (6.6m²/2.0평)"] },
      { id:"6F", label:"6층", note:'서편(개발 34") 67석 · 동편 65석',
        zones:[
          buildZone("W",'서편 (개발 34")',"W",7,10, f(67,"unk"), "BW","6F"),
          buildZone("E","동편","E",8,9,   f(65,"unk"), "BW","6F"),
        ],
        rooms:[] },
      { id:"7F", label:"7층", note:"서편 19석 · 동편 57석",
        zones:[
          buildZone("W","서편","W",4,5, f(19,"unk"), "BW","7F"),
          buildZone("E","동편","E",7,9, f(57,"unk"), "BW","7F"),
        ],
        rooms:[] },
      { id:"8F", label:"8층", note:"회의실 중심 · 업무공간 28석",
        zones:[ buildZone("M","업무공간","W",7,4, f(28,"unk"), "BW","8F") ],
        rooms:["회의실/미팅룸-1","회의실/미팅룸-2","미팅룸","Conference-1","회의실/멀티룸","Conference-2"] },
      { id:"9F", label:"9층", note:"스튜디오 37석 · 홀 85석",
        zones:[
          buildZone("W","스튜디오 (서편)","W",5,8,  f(37,"unk"), "BW","9F"),
          buildZone("E","홀 (동편)","E",   9,10, f(85,"unk"), "BW","9F"),
        ],
        rooms:[] },
    ],
  },
  {
    id:"ns", label:"신관",
    floors: [
      { id:"2F", label:"2층", note:"동편(탄천방면) 65평 — 48석 + 포커스룸 2실",
        zones:[ buildZone("M","OPEN-OFFICE","E",8,6, m([43,"std27"],[4,"none"],[1,"dev34"]), "NS","2F") ],
        rooms:["포커스룸 1","포커스룸 2","Meeting RM"] },
      { id:"3F", label:"3층", note:"동편(탄천방면) 65평 — 48석 (전체 실내 230평)",
        zones:[ buildZone("M","OPEN-OFFICE","E",8,6, m([42,"std27"],[5,"none"],[1,"dev34"]), "NS","3F") ],
        rooms:["포커스룸 1","포커스룸 2"] },
      { id:"4F", label:"4층", note:"동편 65평 — 미설치 다수",
        zones:[ buildZone("M","OPEN-OFFICE","E",8,6, m([32,"std27"],[15,"none"],[1,"dev34"]), "NS","4F") ],
        rooms:["포커스룸 1","포커스룸 2"] },
      { id:"5F", label:"5층", note:"동편 65평",
        zones:[ buildZone("M","OPEN-OFFICE","E",8,6, m([39,"std27"],[8,"none"],[1,"dev34"]), "NS","5F") ],
        rooms:["포커스룸 1","포커스룸 2"] },
    ],
  },
  {
    id:"sb", label:"S빌딩",
    floors: [
      { id:"3F", label:"3층", note:"OPEN-OFFICE + FOCUS OFFICE 1~4 / CASUAL WORK SPACE",
        zones:[ buildZone("M","OPEN-OFFICE","E",8,5, m([37,"std27"],[2,"none"],[1,"dev34"]), "SB","3F") ],
        rooms:["Focus Office 1","Focus Office 2","Focus Office 3","Focus Office 4","Meeting RM"] },
      { id:"4F", label:"4층", note:"OPEN-OFFICE + FOCUS OFFICE 1~4",
        zones:[ buildZone("M","OPEN-OFFICE","E",8,5, m([38,"std27"],[1,"none"],[1,"dev34"]), "SB","4F") ],
        rooms:["Focus Office 1","Focus Office 2","Focus Office 3","Focus Office 4","Meeting RM"] },
      { id:"5F", label:"5층", note:"OPEN-OFFICE + FOCUS OFFICE 1~4",
        zones:[ buildZone("M","OPEN-OFFICE","E",8,5, m([39,"std27"],[0,"none"],[1,"dev34"]), "SB","5F") ],
        rooms:["Focus Office 1","Focus Office 2","Focus Office 3","Focus Office 4","Meeting RM"] },
    ],
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// SVG 스케치 도면 설정  (본관 2~9층 도면 기반)
// ══════════════════════════════════════════════════════════════════════════════
const FLOOR_SVGS: Record<string, FloorSvgCfg> = {
  "2F": {
    // 실제 도면: 좌측=4블록 스마트오피스(각 블록 13석), 중앙=미팅룸 A/B/C/쇼룸 수직 배치,
    //           중앙-우=계단/EV 홀, 우=EPS·화장실·창고(VOID)
    vw:800, vh:380,
    coreBlocks: [
      { x:512, y:18, w:90, h:342, label:"계단\nELEV HALL\nEV" },
      { x:608, y:18, w:78, h:342, label:"EPS\n화장실" },
    ],
    extraBlocks:[{ x:692, y:18, w:100, h:342, label:"창고 2평\n(VOID)", fill:"#E2E8F0", stroke:"#94A3B8" }],
    rooms:[
      { x:348, y:20,  w:158, h:80,  label:"미팅룸 A", sub:"13.5㎡ / 4.1평" },
      { x:348, y:106, w:158, h:90,  label:"미팅룸 B", sub:"21.1㎡ / 6.4평" },
      { x:348, y:202, w:158, h:82,  label:"미팅룸 C", sub:"18.8㎡ / 5.7평" },
      { x:348, y:290, w:158, h:70,  label:"쇼룸",     sub:"15.2㎡ / 4.6평" },
    ],
    deskBg:[{ id:"SO", x:12, y:12, w:328, h:348, label:"스마트오피스 (서편) — 90평 / 52석", fill:"#EFF6FF", stroke:"#93C5FD" }],
    // 실제 도면 4개 블록에 맞춰 4줄 사이 통로: rowGroups=[1,1,1,1]
    seatGrids:[{ zoneId:"SO", startX:22, startY:60, cols:13, rows:4, sw:21, sh:26, gx:3, gy:4, rowGroups:[1,1,1,1], aisle:48 }],
    labels:[
      { x:176, y:32, text:"← 서편 (WEST) →", size:9, color:"#2563EB", anchor:"middle", bold:true },
      { x:427, y:372, text:"↑ 동편 복도 / 엘리베이터 홀 / 창고", size:7.5, color:"#94A3B8", anchor:"middle" },
    ],
  },
  "3F": {
    vw:800, vh:380,
    coreBlocks:[{ x:325, y:18, w:150, h:342, label:"계단/EPS/EV/화장실" }],
    extraBlocks:[
      { x:12, y:12, w:95, h:90, label:"협업공간", fill:"#F0FDF4", stroke:"#86EFAC" },
      { x:570, y:12, w:95, h:90, label:"협업공간", fill:"#F0FDF4", stroke:"#86EFAC" },
      { x:672, y:12, w:120, h:90, label:"G/B", fill:"#F0FDF4", stroke:"#86EFAC" },
    ],
    rooms:[
      { x:12, y:298, w:145, h:72, label:"미팅룸", sub:"18.5m² / 5.6인" },
      { x:165, y:298, w:148, h:72, label:"미팅룸", sub:"16.1m² / 4.9인" },
    ],
    deskBg:[
      { id:"W", x:12, y:108, w:305, h:182, label:"서편", fill:"#EFF6FF", stroke:"#93C5FD" },
      { id:"E", x:483, y:108, w:308, h:182, label:"동편", fill:"#EFF6FF", stroke:"#93C5FD" },
    ],
    seatGrids:[
      { zoneId:"W", startX:22, startY:118, cols:6, rows:8, sw:15, sh:12, gx:5, gy:3, rowGroups:[2,2,2,2], aisle:12 },
      { zoneId:"E", startX:493, startY:118, cols:9, rows:7, sw:15, sh:12, gx:5, gy:3, rowGroups:[2,2,2,1], aisle:12 },
    ],
    labels:[
      { x:164, y:28, text:"서편 (WEST)", size:9, color:"#2563EB", anchor:"middle", bold:true },
      { x:636, y:28, text:"동편 (EAST)", size:9, color:"#2563EB", anchor:"middle", bold:true },
      { x:398, y:192, text:"계단\nEPS\n화장실", size:8, color:"#64748B", anchor:"middle" },
    ],
  },
  "4F": {
    vw:800, vh:380,
    coreBlocks:[{ x:325, y:18, w:150, h:342, label:"계단/EPS/화장실" }],
    extraBlocks:[{ x:683, y:298, w:112, h:72, label:"8인 미팅룸", fill:"#F0FDF4", stroke:"#86EFAC" }],
    rooms:[
      { x:12, y:298, w:100, h:72, label:"스마트2", sub:"5.6평" },
      { x:120, y:298, w:100, h:72, label:"스마트3", sub:"5.6평" },
      { x:228, y:298, w:90, h:72, label:"라운지", sub:"10.7평" },
    ],
    deskBg:[
      { id:"W", x:12, y:12, w:305, h:278, label:"서편 (미설치 다수)", fill:"#FFF1F2", stroke:"#FCA5A5" },
      { id:"E", x:483, y:12, w:308, h:278, label:"동편", fill:"#EFF6FF", stroke:"#93C5FD" },
    ],
    seatGrids:[
      { zoneId:"W", startX:22, startY:22, cols:5, rows:8, sw:18, sh:13, gx:5, gy:3, rowGroups:[2,2,2,2], aisle:14 },
      { zoneId:"E", startX:493, startY:22, cols:8, rows:7, sw:18, sh:13, gx:5, gy:3, rowGroups:[2,2,2,1], aisle:14 },
    ],
    labels:[
      { x:164, y:28, text:"서편 (WEST) — 미설치 주의", size:9, color:"#DC2626", anchor:"middle", bold:true },
      { x:636, y:28, text:"동편 (EAST)", size:9, color:"#2563EB", anchor:"middle", bold:true },
      { x:398, y:192, text:"계단\nEPS\n화장실", size:8, color:"#64748B", anchor:"middle" },
    ],
  },
  "5F": {
    vw:800, vh:380,
    coreBlocks:[
      { x:325, y:18, w:150, h:250, label:"계단/EPS/화장실" },
      { x:325, y:276, w:150, h:84, label:"미팅룸", fill:"#F0FDF4", stroke:"#86EFAC" },
    ],
    extraBlocks:[{ x:570, y:12, w:222, h:105, label:"라운지 / 바 (Bar Table)", fill:"#FEF3C7", stroke:"#FCD34D" }],
    rooms:[],
    deskBg:[
      { id:"W", x:12, y:12, w:305, h:358, label:"서편", fill:"#EFF6FF", stroke:"#93C5FD" },
      { id:"E", x:483, y:118, w:308, h:252, label:"동편", fill:"#EFF6FF", stroke:"#93C5FD" },
    ],
    seatGrids:[
      { zoneId:"W", startX:22, startY:22, cols:6, rows:7, sw:17, sh:13, gx:5, gy:3, rowGroups:[2,2,2,1], aisle:14 },
      { zoneId:"E", startX:493, startY:128, cols:8, rows:6, sw:17, sh:13, gx:5, gy:3, rowGroups:[2,2,2], aisle:14 },
    ],
    labels:[
      { x:164, y:28, text:"서편 (WEST)", size:9, color:"#2563EB", anchor:"middle", bold:true },
      { x:636, y:134, text:"동편 (EAST)", size:9, color:"#2563EB", anchor:"middle", bold:true },
      { x:398, y:152, text:"계단/EPS", size:8, color:"#64748B", anchor:"middle" },
    ],
  },
  "6F": {
    vw:800, vh:380,
    coreBlocks:[{ x:325, y:18, w:150, h:342, label:"계단/EPS/화장실" }],
    extraBlocks:[],
    rooms:[],
    deskBg:[
      { id:"W", x:12, y:12, w:305, h:358, label:'서편 — 개발자 34" 구역', fill:"#F5F3FF", stroke:"#C4B5FD" },
      { id:"E", x:483, y:12, w:308, h:358, label:"동편", fill:"#EFF6FF", stroke:"#93C5FD" },
    ],
    seatGrids:[
      { zoneId:"W", startX:22, startY:42, cols:7, rows:7, sw:16, sh:13, gx:5, gy:3, rowGroups:[2,2,2,1], aisle:14 },
      { zoneId:"E", startX:493, startY:22, cols:8, rows:7, sw:17, sh:13, gx:5, gy:3, rowGroups:[2,2,2,1], aisle:14 },
    ],
    labels:[
      { x:164, y:28, text:'서편 (WEST) — 개발자 34"', size:9, color:"#7C3AED", anchor:"middle", bold:true },
      { x:636, y:28, text:"동편 (EAST)", size:9, color:"#2563EB", anchor:"middle", bold:true },
      { x:398, y:192, text:"계단\nEPS\n화장실", size:8, color:"#64748B", anchor:"middle" },
    ],
  },
  "7F": {
    vw:800, vh:380,
    coreBlocks:[{ x:325, y:18, w:150, h:342, label:"계단/EPS/화장실" }],
    extraBlocks:[{ x:12, y:298, w:305, h:72, label:"로커 구역 (LOCKER)", fill:"#F1F5F9", stroke:"#CBD5E1" }],
    rooms:[],
    deskBg:[
      { id:"W", x:12, y:12, w:305, h:278, label:"서편 (미설치 다수)", fill:"#FFF1F2", stroke:"#FCA5A5" },
      { id:"E", x:483, y:12, w:308, h:358, label:"동편", fill:"#EFF6FF", stroke:"#93C5FD" },
    ],
    seatGrids:[
      { zoneId:"W", startX:22, startY:22, cols:6, rows:6, sw:17, sh:13, gx:5, gy:3, rowGroups:[2,2,2], aisle:14 },
      { zoneId:"E", startX:493, startY:22, cols:8, rows:7, sw:17, sh:13, gx:5, gy:3, rowGroups:[2,2,2,1], aisle:14 },
    ],
    labels:[
      { x:164, y:28, text:"서편 (WEST) — 미설치 주의", size:9, color:"#DC2626", anchor:"middle", bold:true },
      { x:636, y:28, text:"동편 (EAST)", size:9, color:"#2563EB", anchor:"middle", bold:true },
      { x:398, y:192, text:"계단\nEPS\n화장실", size:8, color:"#64748B", anchor:"middle" },
    ],
  },
  "8F": {
    vw:800, vh:380,
    coreBlocks:[{ x:325, y:18, w:150, h:342, label:"CANTEEN\n계단\n화장실" }],
    extraBlocks:[],
    rooms:[
      { x:12, y:12, w:152, h:120, label:"회의실/미팅룸-1", sub:"4.1인" },
      { x:12, y:140, w:152, h:120, label:"회의실/미팅룸-2", sub:"4.1인" },
      { x:12, y:268, w:152, h:102, label:"미팅룸", sub:"7.6인" },
      { x:483, y:12, w:308, h:138, label:"Conference-1", sub:"17.9인" },
      { x:483, y:158, w:308, h:105, label:"회의실/멀티룸", sub:"13.8인" },
      { x:483, y:271, w:308, h:99, label:"Conference-2", sub:"19.5인" },
    ],
    deskBg:[{ id:"M", x:172, y:90, w:145, h:200, label:"업무공간", fill:"#EFF6FF", stroke:"#93C5FD" }],
    seatGrids:[{ zoneId:"M", startX:180, startY:100, cols:5, rows:5, sw:16, sh:13, gx:5, gy:3, rowGroups:[2,3], aisle:20 }],
    labels:[
      { x:92, y:28, text:"← 회의실 구역 →", size:9, color:"#15803D", anchor:"middle" },
      { x:636, y:28, text:"← 컨퍼런스룸 구역 →", size:9, color:"#15803D", anchor:"middle" },
      { x:244, y:52, text:"업무공간", size:8, color:"#2563EB", anchor:"middle" },
      { x:398, y:192, text:"CANTEEN\n계단\n화장실", size:8, color:"#64748B", anchor:"middle" },
    ],
  },
  "9F": {
    vw:800, vh:380,
    coreBlocks:[{ x:325, y:18, w:150, h:342, label:"계단/창고/화장실" }],
    extraBlocks:[
      { x:12, y:12, w:175, h:100, label:"스튜디오 / 도서관", fill:"#FEF3C7", stroke:"#F6CE4A" },
      { x:12, y:120, w:175, h:80, label:"스탠딩 데스크", fill:"#FEF3C7", stroke:"#F6CE4A" },
    ],
    rooms:[],
    deskBg:[
      { id:"W", x:12, y:208, w:305, h:162, label:"스튜디오 (서편)", fill:"#FFF7E6", stroke:"#F6CE4A" },
      { id:"E", x:483, y:12, w:308, h:358, label:"홀 (동편) — 54석", fill:"#EFF6FF", stroke:"#93C5FD" },
    ],
    seatGrids:[
      { zoneId:"W", startX:22, startY:220, cols:4, rows:5, sw:20, sh:14, gx:7, gy:4, rowGroups:[2,2,1], aisle:14 },
      { zoneId:"E", startX:493, startY:22, cols:9, rows:6, sw:15, sh:13, gx:4, gy:3, rowGroups:[2,2,2], aisle:14 },
    ],
    labels:[
      { x:164, y:28, text:"서편 — 스튜디오 / 라이브러리", size:9, color:"#92400E", anchor:"middle", bold:true },
      { x:636, y:28, text:"동편 (EAST) — 홀 54석", size:9, color:"#2563EB", anchor:"middle", bold:true },
      { x:398, y:192, text:"계단\n화장실\n창고", size:8, color:"#64748B", anchor:"middle" },
    ],
  },
};

// ─── 신관 (탄천방면) — 65평 / 스마트오피스 48석 + 포커스룸 2개실 ───
const NS_FLOOR: FloorSvgCfg = {
  vw:800, vh:380,
  coreBlocks:[{ x:380, y:100, w:130, h:200, label:"계단\n화장실\nEV" }],
  extraBlocks:[
    { x:520, y:18, w:265, h:80, label:"포커스룸 1 · 2", fill:"#F0FDF4", stroke:"#86EFAC" },
    { x:12,  y:300, w:260, h:70, label:"CASUAL WORK\nSPACE", fill:"#FEF3C7", stroke:"#FCD34D" },
  ],
  rooms:[
    { x:280, y:300, w:90, h:70, label:"MEETING", sub:"12.4㎡" },
  ],
  deskBg:[
    { id:"M", x:520, y:108, w:265, h:182, label:"OPEN-OFFICE (동편)", fill:"#EFF6FF", stroke:"#93C5FD" },
    { id:"M2",x:12,  y:12,  w:360, h:78,  label:"CASUAL / BENCH (서편)", fill:"#FFF7E6", stroke:"#F6CE4A" },
  ],
  seatGrids:[
    { zoneId:"M", startX:530, startY:118, cols:8, rows:6, sw:15, sh:13, gx:5, gy:3, rowGroups:[2,2,2], aisle:14 },
  ],
  labels:[
    { x:650, y:58,  text:"FOCUS OFFICES (1~4)", size:9, color:"#15803D", anchor:"middle", bold:true },
    { x:440, y:200, text:"코어", size:8, color:"#64748B", anchor:"middle" },
    { x:142, y:50,  text:"서편 작업대", size:9, color:"#92400E", anchor:"middle", bold:true },
  ],
};

// ─── S빌딩 ─── 3F/4F/5F 공통 프레임 (실제 도면: 좌 CASUAL+MEETING, 우 OPEN-OFFICE)
const SB_FLOOR: FloorSvgCfg = {
  vw:800, vh:380,
  coreBlocks:[{ x:300, y:60, w:110, h:180, label:"계단\n화장실\nLOCKER" }],
  extraBlocks:[
    { x:420, y:18, w:370, h:70, label:"FOCUS OFFICE 1 · 2 · 3 · 4", fill:"#F0FDF4", stroke:"#86EFAC" },
  ],
  rooms:[
    { x:180, y:300, w:110, h:70, label:"MEETING RM", sub:"12.4㎡" },
  ],
  deskBg:[
    { id:"M",  x:420, y:98,  w:370, h:260, label:"OPEN-OFFICE (동편)", fill:"#EFF6FF", stroke:"#93C5FD" },
    { id:"M2", x:12,  y:12,  w:280, h:278, label:"CASUAL WORK SPACE (서편)", fill:"#FFF7E6", stroke:"#F6CE4A" },
  ],
  seatGrids:[
    { zoneId:"M", startX:430, startY:108, cols:8, rows:5, sw:17, sh:13, gx:6, gy:3, rowGroups:[2,2,1], aisle:14 },
  ],
  labels:[
    { x:152, y:30,  text:"CASUAL WORK SPACE", size:9, color:"#92400E", anchor:"middle", bold:true },
    { x:605, y:58,  text:"FOCUS OFFICES", size:9, color:"#15803D", anchor:"middle", bold:true },
    { x:355, y:154, text:"계단\n화장실", size:8, color:"#64748B", anchor:"middle" },
  ],
};

// 건물별 층 매핑
Object.assign(FLOOR_SVGS, {
  "ns-2F": NS_FLOOR, "ns-3F": NS_FLOOR, "ns-4F": NS_FLOOR, "ns-5F": NS_FLOOR,
  "sb-3F": SB_FLOOR, "sb-4F": SB_FLOOR, "sb-5F": SB_FLOOR,
});

// 미확인 층 fallback SVG
const FALLBACK_SVG: FloorSvgCfg = {
  vw:800, vh:360,
  coreBlocks:[{ x:325, y:18, w:150, h:325, label:"계단/EV/화장실" }],
  extraBlocks:[],
  rooms:[],
  deskBg:[{ id:"M", x:12, y:12, w:305, h:335, label:"업무 구역 (도면 확인 중)", fill:"#F1F5F9", stroke:"#CBD5E1" }],
  seatGrids:[{ zoneId:"M", startX:22, startY:60, cols:8, rows:6, sw:20, sh:14, gx:6, gy:4, rowGroups:[2,2,2], aisle:18 }],
  labels:[{ x:400, y:190, text:"도면 업데이트 예정\n신관/S빌딩 도면 수신 후 반영됩니다", size:11, color:"#94A3B8", anchor:"middle" }],
};

// ══════════════════════════════════════════════════════════════════════════════
// SVG FLOOR PLAN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
function FloorPlanSVG({
  bldId, floorId, zones, filter, selectedId, onSelect,
}: {
  bldId: string;
  floorId: string;
  zones: ZoneData[];
  filter: FilterMode;
  selectedId: string | null;
  onSelect: (seat: SeatData, zone: ZoneData) => void;
}) {
  // 건물별 층 키 우선, 없으면 본관 기본 키, 그 다음 fallback
  // ① 전용 스케치가 있으면 그것으로 렌더 (실제 도면 기반 손 스케치)
  const sketchKey = `${bldId}-${floorId}`;
  const sketchRender = FLOOR_SKETCHES[sketchKey];
  if (sketchRender) {
    const sketchZones: SketchZone[] = zones.map(z => ({
      id: z.id, label: z.label,
      seats: z.seats.map(s => ({ id: s.id, type: s.type })),
    }));
    const ctx: SketchCtx = {
      zones: sketchZones,
      filter,
      selectedId,
      onSelect: (seatId) => {
        for (const z of zones) {
          const s = z.seats.find(x => x.id === seatId);
          if (s) { onSelect(s, z); return; }
        }
      },
      colorOf: (t) => ({ color: MONITOR[t].color, pale: MONITOR[t].pale }),
    };
    return (
      <div className="w-full overflow-x-auto">{sketchRender(ctx)}</div>
    );
  }

  const cfg: FloorSvgCfg =
    FLOOR_SVGS[`${bldId}-${floorId}`] ??
    (bldId === "bw" ? FLOOR_SVGS[floorId] : undefined) ??
    FALLBACK_SVG;
  const { vw, vh, coreBlocks=[], extraBlocks=[], rooms=[], deskBg=[], seatGrids=[], labels=[] } = cfg;

  const seatPosMap = useMemo(() => {
    const map: Record<string, {x:number;y:number;row:number;col:number}[]> = {};
    seatGrids.forEach(sg => { map[sg.zoneId] = getSeatPositions(sg); });
    return map;
  }, [bldId, floorId]);

  const zoneMap = useMemo(() => {
    const m: Record<string, ZoneData> = {};
    zones.forEach(z => { m[z.id] = z; });
    return m;
  }, [zones]);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${vw} ${vh}`}
        style={{ width:"100%", minWidth:560, maxWidth:900, height:"auto", display:"block" }}
      >
        {/* 건물 외곽 */}
        <rect x={4} y={4} width={vw-8} height={vh-8} rx={8} fill="#FAFAFA" stroke="#94A3B8" strokeWidth={1.5}/>
        {/* 창문 힌트 (외벽) */}
        {Array.from({length: Math.floor((vw-50)/30)}, (_,i) => (
          <line key={`wt${i}`} x1={30+i*30} y1={4} x2={30+i*30} y2={10} stroke="#BAE6FD" strokeWidth={2} opacity={0.6}/>
        ))}
        {Array.from({length: Math.floor((vw-50)/30)}, (_,i) => (
          <line key={`wb${i}`} x1={30+i*30} y1={vh-4} x2={30+i*30} y2={vh-10} stroke="#BAE6FD" strokeWidth={2} opacity={0.6}/>
        ))}

        {/* 업무 구역 배경 */}
        {deskBg.map(bg => (
          <g key={bg.id}>
            <rect x={bg.x} y={bg.y} width={bg.w} height={bg.h} rx={4}
              fill={bg.fill} stroke={bg.stroke} strokeWidth={1.5} strokeDasharray="6,3"/>
            <text x={bg.x+6} y={bg.y+16} fontSize={9} fontWeight="700" fill={bg.stroke}>{bg.label}</text>
          </g>
        ))}

        {/* 특수 구역 (라운지, 로커, 협업공간 등) */}
        {extraBlocks.map((eb, i) => (
          <g key={`eb${i}`}>
            <rect x={eb.x} y={eb.y} width={eb.w} height={eb.h} rx={4}
              fill={eb.fill||"#E2E8F0"} stroke={eb.stroke||"#94A3B8"} strokeWidth={1}/>
            {eb.label.split("\n").map((line,li) => (
              <text key={li} x={eb.x+eb.w/2} y={eb.y+eb.h/2-6+li*12}
                fontSize={8} fill="#475569" textAnchor="middle">{line}</text>
            ))}
          </g>
        ))}

        {/* 회의실 */}
        {rooms.map((room, i) => (
          <g key={`rm${i}`}>
            <rect x={room.x} y={room.y} width={room.w} height={room.h} rx={3}
              fill="#F0FDF4" stroke="#86EFAC" strokeWidth={1.5}/>
            <text x={room.x+room.w/2} y={room.y+room.h/2-(room.sub?6:0)}
              fontSize={8.5} fontWeight="600" fill="#15803D" textAnchor="middle">{room.label}</text>
            {room.sub && (
              <text x={room.x+room.w/2} y={room.y+room.h/2+8}
                fontSize={7.5} fill="#16A34A" textAnchor="middle" opacity={0.8}>{room.sub}</text>
            )}
          </g>
        ))}

        {/* 코어 블록 (계단/EV) */}
        {coreBlocks.map((core, i) => (
          <g key={`core${i}`}>
            <rect x={core.x} y={core.y} width={core.w} height={core.h} rx={4}
              fill={core.fill||"#E2E8F0"} stroke={core.stroke||"#94A3B8"} strokeWidth={1}/>
            <line x1={core.x+10} y1={core.y+25} x2={core.x+core.w-10} y2={core.y+25} stroke="#94A3B8" strokeWidth={0.8}/>
            <line x1={core.x+10} y1={core.y+35} x2={core.x+core.w-10} y2={core.y+35} stroke="#94A3B8" strokeWidth={0.8}/>
            {core.label.split("\n").map((line,li) => (
              <text key={li} x={core.x+core.w/2} y={core.y+core.h/2-8+li*14}
                fontSize={8.5} fill="#64748B" textAnchor="middle">{line}</text>
            ))}
          </g>
        ))}

        {/* 좌석 렌더링 */}
        {seatGrids.map(sg => {
          const zone = zoneMap[sg.zoneId];
          if (!zone) return null;
          const positions = seatPosMap[sg.zoneId] || [];
          return positions.map((pos, idx) => {
            const seat = zone.seats[idx];
            if (!seat) return null;
            const type = seat.type;
            const meta = MONITOR[type];
            const isSel = seat.id === selectedId;
            const dimmed = filter !== "all" && type !== filter;
            return (
              <g key={seat.id}>
                <rect
                  x={pos.x} y={pos.y} width={sg.sw} height={sg.sh} rx={2}
                  fill={dimmed ? "#E5E7EB" : meta.color+(type==="unk"?"55":"CC")}
                  stroke={isSel ? meta.color : (dimmed ? "#E5E7EB" : meta.color+"44")}
                  strokeWidth={isSel ? 2 : 0.5}
                  style={{ cursor:"pointer" }}
                  onClick={() => !dimmed && onSelect(seat, zone)}
                >
                  <title>{seat.id} — {meta.long}</title>
                </rect>
                {/* 미설치 X */}
                {type === "none" && !dimmed && (
                  <>
                    <line x1={pos.x+2} y1={pos.y+2} x2={pos.x+sg.sw-2} y2={pos.y+sg.sh-2}
                      stroke="white" strokeWidth={1.2} style={{pointerEvents:"none"}}/>
                    <line x1={pos.x+sg.sw-2} y1={pos.y+2} x2={pos.x+2} y2={pos.y+sg.sh-2}
                      stroke="white" strokeWidth={1.2} style={{pointerEvents:"none"}}/>
                  </>
                )}
                {/* 선택 링 */}
                {isSel && (
                  <rect x={pos.x-2} y={pos.y-2} width={sg.sw+4} height={sg.sh+4} rx={3}
                    fill="none" stroke={meta.color} strokeWidth={2} opacity={0.7}
                    style={{pointerEvents:"none"}}/>
                )}
              </g>
            );
          });
        })}

        {/* 행 레이블 (A,B,C…) */}
        {seatGrids.map(sg => {
          const positions = seatPosMap[sg.zoneId] || [];
          const seen = new Set<number>();
          return positions.filter(p => { if(seen.has(p.row)) return false; seen.add(p.row); return true; })
            .map(pos => (
              <text key={`rl-${sg.zoneId}-${pos.row}`}
                x={pos.x-9} y={pos.y+sg.sh/2+1}
                fontSize={7.5} fill="#D1D5DB" textAnchor="middle" fontWeight="700">
                {String.fromCharCode(65+pos.row)}
              </text>
            ));
        })}

        {/* 방향 표시 */}
        <text x={10} y={vh-8} fontSize={7} fill="#CBD5E1">← 서쪽</text>
        <text x={vw-10} y={vh-8} fontSize={7} fill="#CBD5E1" textAnchor="end">동쪽 →</text>

        {/* 범례 라벨 */}
        {labels.map((lb, i) => (
          lb.text.includes("\n")
            ? lb.text.split("\n").map((line,li) => (
                <text key={`lb${i}-${li}`} x={lb.x} y={lb.y+li*13}
                  fontSize={lb.size||9} fill={lb.color||"#64748B"} textAnchor={(lb.anchor||"middle") as "inherit"|"start"|"end"|"middle"}
                  fontWeight={lb.bold?"700":"400"}>{line}</text>
              ))
            : <text key={`lb${i}`} x={lb.x} y={lb.y}
                fontSize={lb.size||9} fill={lb.color||"#64748B"} textAnchor={(lb.anchor||"middle") as "inherit"|"start"|"end"|"middle"}
                fontWeight={lb.bold?"700":"400"}>{lb.text}</text>
        ))}
      </svg>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SEAT DETAIL PANEL
// ══════════════════════════════════════════════════════════════════════════════
const REPAIR_REASONS = ["화면 불량", "전원 이슈", "해상도/색상 문제", "물리적 파손", "기타"] as const;

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending:     { label: "접수",    color: "#F59E0B" },
  in_progress: { label: "처리 중", color: "#3B82F6" },
  done:        { label: "완료",    color: "#10B981" },
};
const EVENT_LABEL: Record<string, string> = {
  zone_move:       "구역 이동",
  repair_request:  "수리 요청",
  repair_done:     "수리 완료",
  note:            "메모",
};

function SeatDetailPanel({
  seat, zone, floor, building, onClose, onUpdateType,
}: {
  seat: SeatData; zone: ZoneData; floor: FloorData; building: BuildingData;
  onClose: () => void;
  onUpdateType: (seatId: string, type: MonitorType) => void;
}) {
  const meta = MONITOR[seat.type];
  const rowLabel = String.fromCharCode(65 + seat.row);

  const [repairOpen,   setRepairOpen]   = useState(false);
  const [repairReason, setRepairReason] = useState<string>(REPAIR_REASONS[0]);
  const [repairNote,   setRepairNote]   = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [submitMsg,    setSubmitMsg]    = useState("");

  const [history,      setHistory]      = useState<MonitorHistoryEntry[]>([]);
  const [histLoading,  setHistLoading]  = useState(false);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);

  // 이력 로드
  useEffect(() => {
    setHistLoading(true);
    fetch(`/api/monitor-history?itemId=${encodeURIComponent(seat.id)}`)
      .then(r => r.json())
      .then(({ entries }) => setHistory(entries ?? []))
      .catch(() => {})
      .finally(() => setHistLoading(false));
  }, [seat.id]);

  const submitRepair = async () => {
    setSubmitting(true); setSubmitMsg("");
    try {
      const res = await fetch("/api/monitor-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId:      seat.id,
          label:       `${building.label} ${floor.label} ${zone.label} ${rowLabel}행${seat.col + 1}번`,
          building:    building.label,
          floor:       floor.label,
          eventType:   "repair_request",
          description: `${repairReason}${repairNote ? ` — ${repairNote}` : ""}`,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "요청 실패");
      setSubmitMsg("✓ 수리 요청이 접수되었습니다.");
      setRepairOpen(false); setRepairNote("");
      // 이력 갱신
      const refresh = await fetch(`/api/monitor-history?itemId=${encodeURIComponent(seat.id)}`).then(r => r.json());
      setHistory(refresh.entries ?? []);
    } catch (e: any) {
      setSubmitMsg(`✗ ${e.message}`);
    } finally {
      setSubmitting(false);
      setTimeout(() => setSubmitMsg(""), 4000);
    }
  };

  const updateStatus = async (entryId: string, status: string) => {
    setStatusUpdating(entryId);
    try {
      await fetch(`/api/monitor-history/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setHistory(prev => prev.map(e => e.id === entryId ? { ...e, status: status as any } : e));
    } catch {}
    finally { setStatusUpdating(null); }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto text-sm">
      {/* 헤더 */}
      <div className="flex items-start justify-between px-4 py-3 bg-slate-800 text-white flex-shrink-0">
        <div>
          <div className="text-[10px] opacity-60 mb-0.5">좌석 상세 정보</div>
          <div className="text-lg font-extrabold tracking-widest leading-tight font-mono">{seat.id}</div>
          <div className="text-[10px] opacity-60 mt-1">{building.label} · {floor.label} · {zone.label}</div>
        </div>
        <button onClick={onClose} className="opacity-60 hover:opacity-100 text-lg mt-0.5">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* 모니터 현황 */}
        <div className="rounded-xl p-3 border" style={{ background: meta.pale, borderColor: meta.border }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-black"
              style={{ background: meta.color }}>{meta.label}</div>
            <div>
              <div className="font-bold" style={{ color: meta.color }}>{meta.long}</div>
              <div className="text-[10px] opacity-70" style={{ color: meta.color }}>
                {seat.type === "unk" ? "미확인 좌석" : seat.type === "none" ? "모니터 미설치" : seat.type === "dev34" ? "개발자용 와이드 모니터" : "표준형 모니터 설치됨"}
              </div>
            </div>
          </div>
        </div>

        {/* 위치 정보 */}
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
          <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-2">📍 위치</div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {[building.label, floor.label, zone.label].map(tag => (
              <span key={tag} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-semibold border border-blue-100">{tag}</span>
            ))}
          </div>
          <div className="text-xs text-gray-600 space-y-0.5">
            <div><span className="text-gray-400">행</span> <strong>{rowLabel}행</strong></div>
            <div><span className="text-gray-400">열</span> <strong>{seat.col + 1}번</strong></div>
          </div>
        </div>

        {/* 찾아가는 방법 */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <div className="text-[10px] font-bold text-amber-700 mb-1.5">🗺 찾아가는 방법</div>
          <div className="text-[11px] text-amber-700 leading-relaxed">
            {building.label} 건물 진입<br/>
            → <strong>{floor.label}</strong> 이동 (계단/엘리베이터)<br/>
            → <strong>{zone.label}</strong> 구역<br/>
            → <strong>{rowLabel}행 {seat.col + 1}번째 자리</strong>
          </div>
        </div>

        {/* 모니터 타입 변경 */}
        <div className="bg-white border border-gray-100 rounded-xl p-3">
          <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-2">✏️ 모니터 상태 변경</div>
          <div className="grid grid-cols-1 gap-1.5">
            {TYPES.map(t => {
              const m = MONITOR[t];
              const isActive = seat.type === t;
              return (
                <button key={t} onClick={() => onUpdateType(seat.id, t)}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-semibold transition-all border"
                  style={{
                    background: isActive ? m.color : m.pale,
                    color: isActive ? "white" : m.color,
                    borderColor: m.border,
                    outline: isActive ? `2px solid ${m.color}` : "none",
                  }}>
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={{ background: isActive ? "white" : m.color + "CC" }}/>
                  {m.long}
                  {isActive && <span className="ml-auto text-[10px] opacity-80">✓ 현재</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* 수리 요청 */}
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <button
            onClick={() => setRepairOpen(o => !o)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors">
            <span>🔧 교체/수리 요청</span>
            <span className="text-gray-400 text-[10px]">{repairOpen ? "▲" : "▼"}</span>
          </button>
          {repairOpen && (
            <div className="px-3 pb-3 space-y-2 border-t border-gray-100">
              <div className="pt-2">
                <div className="text-[10px] text-gray-400 mb-1">사유 선택</div>
                <select
                  value={repairReason}
                  onChange={e => setRepairReason(e.target.value)}
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-400">
                  {REPAIR_REASONS.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <div className="text-[10px] text-gray-400 mb-1">메모 (선택)</div>
                <textarea
                  value={repairNote}
                  onChange={e => setRepairNote(e.target.value)}
                  rows={2}
                  placeholder="상세 증상 또는 요청 내용"
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-red-400"/>
              </div>
              <button
                onClick={submitRepair}
                disabled={submitting}
                className="w-full py-2 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50 transition-colors">
                {submitting ? "접수 중…" : "요청 제출"}
              </button>
            </div>
          )}
          {submitMsg && (
            <div className={`px-3 pb-2 text-[11px] font-medium ${submitMsg.startsWith("✓") ? "text-green-600" : "text-red-500"}`}>
              {submitMsg}
            </div>
          )}
        </div>

        {/* 위치 복사 */}
        <button
          className="w-full py-2 rounded-lg border border-gray-200 bg-white text-gray-600 text-xs font-semibold hover:bg-gray-50 transition-colors"
          onClick={() => navigator.clipboard?.writeText(`${building.label} ${floor.label} ${zone.label} ${rowLabel}행 ${seat.col + 1}번 (${seat.id})`)}>
          📋 위치 텍스트 복사
        </button>

        {/* 이력 목록 */}
        <div className="bg-white border border-gray-100 rounded-xl p-3">
          <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-2">📋 이력</div>
          {histLoading ? (
            <div className="text-[11px] text-gray-400 text-center py-3">불러오는 중…</div>
          ) : history.length === 0 ? (
            <div className="text-[11px] text-gray-400 text-center py-3">이력 없음</div>
          ) : (
            <div className="space-y-2">
              {history.map(entry => {
                const st = STATUS_LABEL[entry.status] ?? STATUS_LABEL.pending;
                return (
                  <div key={entry.id} className="border border-gray-100 rounded-lg p-2 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-semibold text-slate-600">
                        {EVENT_LABEL[entry.eventType] ?? entry.eventType}
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: st.color + "22", color: st.color }}>
                        {st.label}
                      </span>
                    </div>
                    {(entry.from || entry.to) && (
                      <div className="text-[10px] text-gray-500">
                        {entry.from && <span>{entry.from}</span>}
                        {entry.from && entry.to && <span className="mx-1 text-gray-300">→</span>}
                        {entry.to && <span>{entry.to}</span>}
                      </div>
                    )}
                    {entry.description && (
                      <div className="text-[10px] text-gray-400 truncate">{entry.description}</div>
                    )}
                    <div className="text-[9px] text-gray-300">
                      {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString("ko-KR") : "—"}
                      {entry.createdBy ? ` · ${entry.createdBy}` : ""}
                    </div>
                    {/* 관리자 상태 변경 */}
                    {entry.status !== "done" && (
                      <div className="flex gap-1 pt-0.5">
                        {entry.status === "pending" && (
                          <button
                            disabled={statusUpdating === entry.id}
                            onClick={() => updateStatus(entry.id, "in_progress")}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 disabled:opacity-50">
                            처리 중으로
                          </button>
                        )}
                        <button
                          disabled={statusUpdating === entry.id}
                          onClick={() => updateStatus(entry.id, "done")}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-green-50 text-green-600 border border-green-200 hover:bg-green-100 disabled:opacity-50">
                          완료
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 범례 */}
        <div className="bg-white border border-gray-100 rounded-xl p-3">
          <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-2">범례</div>
          <div className="space-y-1.5">
            {TYPES.map(t => (
              <div key={t} className="flex items-center gap-2">
                <div className="w-3.5 h-3 rounded-sm flex-shrink-0"
                  style={{ background: MONITOR[t].color + (t === "unk" ? "55" : "CC") }}/>
                <span className="text-[10px] text-gray-500">{MONITOR[t].long}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ITEM DETAIL PANEL  (편집도면 모니터 클릭 시)
// ══════════════════════════════════════════════════════════════════════════════
type EditorItem = EditorData["items"][number];

function ItemDetailPanel({
  item,
  editorData,
  buildingLabel,
  floorLabel,
  onClose,
  onUpdateType,
}: {
  item: EditorItem;
  editorData: EditorData;
  buildingLabel: string;
  floorLabel: string;
  onClose: () => void;
  onUpdateType: (itemId: string, type: MonitorType) => void;
}) {
  const mt: MonitorType = (item.monitorType as MonitorType) in MONITOR
    ? (item.monitorType as MonitorType)
    : "unk";
  const meta = MONITOR[mt];
  const zone = editorData.zones.find(z => isItemInZone(item, z));

  const [repairOpen,   setRepairOpen]   = useState(false);
  const [repairReason, setRepairReason] = useState<string>(REPAIR_REASONS[0]);
  const [repairNote,   setRepairNote]   = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [submitMsg,    setSubmitMsg]    = useState("");

  const [history,        setHistory]        = useState<MonitorHistoryEntry[]>([]);
  const [histLoading,    setHistLoading]    = useState(false);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);

  const loadHistory = useCallback(() => {
    setHistLoading(true);
    fetch(`/api/monitor-history?itemId=${encodeURIComponent(item.id)}`)
      .then(r => r.json())
      .then(({ entries }) => setHistory(entries ?? []))
      .catch(() => {})
      .finally(() => setHistLoading(false));
  }, [item.id]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const submitRepair = async () => {
    setSubmitting(true); setSubmitMsg("");
    try {
      const locationLabel = [buildingLabel, floorLabel, zone?.name, item.label].filter(Boolean).join(" ");
      const res = await fetch("/api/monitor-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId:      item.id,
          label:       locationLabel || item.id,
          building:    buildingLabel,
          floor:       floorLabel,
          eventType:   "repair_request",
          description: `${repairReason}${repairNote ? ` — ${repairNote}` : ""}`,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "요청 실패");
      setSubmitMsg("✓ 수리 요청이 접수되었습니다.");
      setRepairOpen(false); setRepairNote("");
      loadHistory();
    } catch (e: any) {
      setSubmitMsg(`✗ ${e.message}`);
    } finally {
      setSubmitting(false);
      setTimeout(() => setSubmitMsg(""), 4000);
    }
  };

  const updateStatus = async (entryId: string, status: string) => {
    setStatusUpdating(entryId);
    try {
      await fetch(`/api/monitor-history/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setHistory(prev => prev.map(e => e.id === entryId ? { ...e, status: status as any } : e));
    } catch {}
    finally { setStatusUpdating(null); }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto text-sm">
      {/* 헤더 */}
      <div className="flex items-start justify-between px-4 py-3 bg-slate-800 text-white flex-shrink-0">
        <div>
          <div className="text-[10px] opacity-60 mb-0.5">모니터 상세</div>
          <div className="text-base font-extrabold tracking-wide leading-tight">{item.label || item.id}</div>
          <div className="text-[10px] opacity-60 mt-1">
            {buildingLabel} · {floorLabel}{zone ? ` · ${zone.name}` : ""}
          </div>
        </div>
        <button onClick={onClose} className="opacity-60 hover:opacity-100 text-lg mt-0.5">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* 현재 상태 */}
        <div className="rounded-xl p-3 border" style={{ background: meta.pale, borderColor: meta.border }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-black"
              style={{ background: meta.color }}>{meta.label}</div>
            <div>
              <div className="font-bold" style={{ color: meta.color }}>{meta.long}</div>
              <div className="text-[10px] opacity-70" style={{ color: meta.color }}>
                {mt === "unk" ? "미확인" : mt === "none" ? "미설치" : mt === "dev34" ? "개발자용 와이드" : "표준형"}
              </div>
            </div>
          </div>
        </div>

        {/* 구역 */}
        {zone && (
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
            <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-2">📍 구역</div>
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-semibold border border-blue-100">
                {zone.name}
              </span>
              {(zone.tags as string[] | undefined)?.map((tag: string) => (
                <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full border border-gray-200">{tag}</span>
              ))}
            </div>
          </div>
        )}

        {/* 상태 변경 */}
        <div className="bg-white border border-gray-100 rounded-xl p-3">
          <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-2">✏️ 상태 변경</div>
          <div className="grid grid-cols-1 gap-1.5">
            {TYPES.map(t => {
              const m = MONITOR[t];
              const isActive = mt === t;
              return (
                <button key={t} onClick={() => onUpdateType(item.id, t)}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-semibold transition-all border"
                  style={{
                    background:   isActive ? m.color : m.pale,
                    color:        isActive ? "white" : m.color,
                    borderColor:  m.border,
                    outline:      isActive ? `2px solid ${m.color}` : "none",
                  }}>
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={{ background: isActive ? "white" : m.color + "CC" }}/>
                  {m.long}
                  {isActive && <span className="ml-auto text-[10px] opacity-80">✓ 현재</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* 수리 요청 */}
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <button
            onClick={() => setRepairOpen(o => !o)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors">
            <span>🔧 교체/수리 요청</span>
            <span className="text-gray-400 text-[10px]">{repairOpen ? "▲" : "▼"}</span>
          </button>
          {repairOpen && (
            <div className="px-3 pb-3 space-y-2 border-t border-gray-100">
              <div className="pt-2">
                <div className="text-[10px] text-gray-400 mb-1">사유 선택</div>
                <select
                  value={repairReason}
                  onChange={e => setRepairReason(e.target.value)}
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-400">
                  {REPAIR_REASONS.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <div className="text-[10px] text-gray-400 mb-1">메모 (선택)</div>
                <textarea
                  value={repairNote}
                  onChange={e => setRepairNote(e.target.value)}
                  rows={2}
                  placeholder="상세 증상 또는 요청 내용"
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-red-400"/>
              </div>
              <button
                onClick={submitRepair}
                disabled={submitting}
                className="w-full py-2 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50 transition-colors">
                {submitting ? "접수 중…" : "요청 제출"}
              </button>
            </div>
          )}
          {submitMsg && (
            <div className={`px-3 pb-2 text-[11px] font-medium ${submitMsg.startsWith("✓") ? "text-green-600" : "text-red-500"}`}>
              {submitMsg}
            </div>
          )}
        </div>

        {/* 이력 목록 */}
        <div className="bg-white border border-gray-100 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">📋 이력</div>
            <button onClick={loadHistory} className="text-[10px] text-blue-400 hover:text-blue-600">↻ 새로고침</button>
          </div>
          {histLoading ? (
            <div className="text-[11px] text-gray-400 text-center py-3">불러오는 중…</div>
          ) : history.length === 0 ? (
            <div className="text-[11px] text-gray-400 text-center py-3">이력 없음</div>
          ) : (
            <div className="space-y-2">
              {history.map(entry => {
                const st = STATUS_LABEL[entry.status] ?? STATUS_LABEL.pending;
                return (
                  <div key={entry.id} className="border border-gray-100 rounded-lg p-2 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-semibold text-slate-600">
                        {EVENT_LABEL[entry.eventType] ?? entry.eventType}
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: st.color + "22", color: st.color }}>
                        {st.label}
                      </span>
                    </div>
                    {(entry.from || entry.to) && (
                      <div className="text-[10px] text-gray-500">
                        {entry.from && <span>{entry.from}</span>}
                        {entry.from && entry.to && <span className="mx-1 text-gray-300">→</span>}
                        {entry.to && <span>{entry.to}</span>}
                      </div>
                    )}
                    {entry.description && (
                      <div className="text-[10px] text-gray-400 truncate">{entry.description}</div>
                    )}
                    <div className="text-[9px] text-gray-300">
                      {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString("ko-KR") : "—"}
                      {entry.createdBy ? ` · ${entry.createdBy}` : ""}
                    </div>
                    {entry.status !== "done" && (
                      <div className="flex gap-1 pt-0.5">
                        {entry.status === "pending" && (
                          <button
                            disabled={statusUpdating === entry.id}
                            onClick={() => updateStatus(entry.id, "in_progress")}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 disabled:opacity-50">
                            처리 중으로
                          </button>
                        )}
                        <button
                          disabled={statusUpdating === entry.id}
                          onClick={() => updateStatus(entry.id, "done")}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-green-50 text-green-600 border border-green-200 hover:bg-green-100 disabled:opacity-50">
                          완료
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// OVERVIEW SIDE PANEL  (좌석 미선택 시)
// ══════════════════════════════════════════════════════════════════════════════
// 아이템 중심점이 구역 내부인지 판단
function isItemInZone(item: { x:number; y:number; w:number; h:number }, zone: { x:number; y:number; w:number; h:number; rotation:number }): boolean {
  const cx = item.x + item.w / 2, cy = item.y + item.h / 2;
  const rot = zone.rotation ?? 0;
  if (rot === 0) return cx >= zone.x && cx <= zone.x + zone.w && cy >= zone.y && cy <= zone.y + zone.h;
  const zcx = zone.x + zone.w / 2, zcy = zone.y + zone.h / 2;
  const theta = -(rot * Math.PI / 180);
  const dx = cx - zcx, dy = cy - zcy;
  const rx = dx * Math.cos(theta) - dy * Math.sin(theta);
  const ry = dx * Math.sin(theta) + dy * Math.cos(theta);
  return Math.abs(rx) <= zone.w / 2 && Math.abs(ry) <= zone.h / 2;
}

function OverviewSidePanel({ building, floor, editorData }: { building: BuildingData; floor: FloorData; editorData: EditorData }) {
  const items = editorData.items;
  const zones = editorData.zones;

  // 타입별 집계
  const st = { std27:0, std24:0, dev34:0, none:0, unk:0, total: items.length };
  items.forEach(i => { (st as any)[i.monitorType] = ((st as any)[i.monitorType] ?? 0) + 1; });
  const confirmed = st.std27 + st.std24 + st.dev34 + st.none;
  const pct = st.total > 0 ? Math.round((confirmed / st.total) * 100) : 0;

  // 구역별 집계
  const zoneStats = zones.map(z => {
    const zItems = items.filter(i => isItemInZone(i, z));
    const zSt = { std27:0, std24:0, dev34:0, none:0, unk:0, total: zItems.length };
    zItems.forEach(i => { (zSt as any)[i.monitorType]++; });
    return { zone: z, st: zSt };
  });
  const unzoned = items.filter(i => !zones.some(z => isItemInZone(i, z)));

  return (
    <div className="flex flex-col h-full text-sm overflow-y-auto">
      <div className="px-4 py-3 bg-slate-800 text-white flex-shrink-0">
        <div className="text-[10px] opacity-60 mb-0.5">층 현황</div>
        <div className="font-bold">{building.label} {floor.label}</div>
      </div>

      <div className="flex-1 p-3 space-y-3 overflow-y-auto">
        {items.length === 0 ? (
          <div className="text-center text-gray-400 text-xs py-8">
            <div className="text-2xl mb-2">📋</div>
            도면 데이터가 없습니다.<br/>편집 모드에서 저장 후 확인해주세요.
          </div>
        ) : (
          <>
            {/* 진행률 */}
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <div className="text-[10px] text-gray-400 font-semibold mb-2">확인 진행률</div>
              <div className="flex items-baseline gap-2 mb-1.5">
                <span className="text-2xl font-extrabold text-gray-800">{pct}%</span>
                <span className="text-xs text-gray-400">{confirmed}/{st.total}대 완료</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width:`${pct}%`, background: pct===100?"#10B981":"#3B82F6" }}/>
              </div>
            </div>

            {/* 타입별 카드 */}
            <div className="grid grid-cols-1 gap-1.5">
              {TYPES.map(t => {
                const cnt = (st as any)[t] as number;
                if (!cnt) return null;
                const meta = MONITOR[t];
                return (
                  <div key={t} className="rounded-lg p-2.5 border flex items-center gap-2.5"
                    style={{ background:meta.pale, borderColor:meta.border }}>
                    <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background:meta.color+"CC" }}/>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-semibold truncate" style={{ color:meta.color }}>{meta.long}</div>
                    </div>
                    <div className="text-base font-extrabold flex-shrink-0" style={{ color:meta.color }}>{cnt}</div>
                  </div>
                );
              })}
            </div>

            {/* 구역별 */}
            {(zoneStats.length > 0 || unzoned.length > 0) && (
            <div className="bg-white border border-gray-100 rounded-xl p-3">
              <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-2">구역별 현황</div>
              {zoneStats.map(({ zone: z, st: zSt }) => (
                <div key={z.id} className="mb-3 last:mb-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-xs font-semibold text-gray-700 truncate max-w-[120px]">{z.name}</span>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">{zSt.total}대</span>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {TYPES.map(t => {
                      const cnt = (zSt as any)[t] as number;
                      if (!cnt) return null;
                      const meta = MONITOR[t];
                      return (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                          style={{ background:meta.pale, color:meta.color }}>
                          {meta.label} {cnt}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
              {unzoned.length > 0 && (
                <div className="mb-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-xs font-semibold text-gray-400">미분류</span>
                    <span className="text-[10px] text-gray-400">{unzoned.length}대</span>
                  </div>
                </div>
              )}
            </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PANEL
// ══════════════════════════════════════════════════════════════════════════════
const EMPTY_EDITOR_DATA: EditorData = { imageUrl: null, items: [], zones: [], facilities: [], groups: [], renderOrder: [] };

export default function AssetMapPanel() {
  const [buildingId,    setBuildingId]    = useState<string>("bw");
  const [floorId,       setFloorId]       = useState<string>("2F");
  const [filter,        setFilter]        = useState<FilterMode>("all");
  const [selected,      setSelected]      = useState<{ seat:SeatData; zone:ZoneData } | null>(null);
  const [seatOverrides, setSeatOverrides] = useState<Record<string, MonitorType>>({});
  const [editorMode,    setEditorMode]    = useState<boolean>(false);
  const [editorData,    setEditorData]    = useState<EditorData>(EMPTY_EDITOR_DATA);
  const [isSaving,      setIsSaving]      = useState<boolean>(false);
  const [saveMsg,       setSaveMsg]       = useState<string>("");

  // ── 편집도면 모니터 선택 (view mode) ──────────────────────────────
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const selectedItem = useMemo(
    () => selectedItemId ? editorData.items.find(i => i.id === selectedItemId) ?? null : null,
    [selectedItemId, editorData.items]
  );

  // ── localStorage 초기 로드 ──────────────────────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem("sw-monitor-overrides");
      if (stored) setSeatOverrides(JSON.parse(stored));
    } catch {}
  }, []);

  // ── 편집 데이터 로드 (건물/층 변경 시) ──────────────────────────
  useEffect(() => {
    const key = `sw-floormap-editor-${buildingId}-${floorId}`;
    // 1) 로컬스토리지 즉시 적용
    try {
      const stored = localStorage.getItem(key);
      if (stored) setEditorData(migrate(JSON.parse(stored)));
      else setEditorData(EMPTY_EDITOR_DATA);
    } catch { setEditorData(EMPTY_EDITOR_DATA); }

    // 2) Notion에서 최신 데이터 로드 (비동기)
    fetch(`/api/floor-map?building=${buildingId}&floor=${floorId}`)
      .then(r => r.json())
      .then(({ data }) => {
        if (!data) return;
        const migrated = migrate(data);
        setEditorData(migrated);
        try { localStorage.setItem(key, JSON.stringify(migrated)); } catch {}
      })
      .catch(() => {});
  }, [buildingId, floorId]);

  const handleEditorChange = useCallback((data: EditorData) => {
    setEditorData(data);
    const key = `sw-floormap-editor-${buildingId}-${floorId}`;
    try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
  }, [buildingId, floorId]);

  const handleZoneMove = useCallback((itemId: string, label: string, fromZone: string, toZone: string) => {
    const bl = BUILDINGS.find(b => b.id === buildingId);
    const fl = bl?.floors.find(f => f.id === floorId);
    fetch("/api/monitor-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId,
        label,
        building: bl?.label ?? buildingId,
        floor:    fl?.label ?? floorId,
        eventType: "zone_move",
        from: fromZone,
        to:   toZone,
        description: `도면 편집기에서 구역 이동: ${fromZone} → ${toZone}`,
      }),
    }).catch(() => {});
  }, [buildingId, floorId]);

  const handleSaveToNotion = useCallback(async () => {
    setIsSaving(true); setSaveMsg("");
    try {
      const res = await fetch("/api/floor-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ building: buildingId, floor: floorId, data: editorData }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "저장 실패");
      setSaveMsg(json.imageSkipped
        ? "✓ 저장 완료 (배경 이미지는 용량 초과로 제외됨)"
        : "✓ 노션 저장 완료");
    } catch (e: any) {
      setSaveMsg(`✗ ${e.message}`);
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMsg(""), 4000);
    }
  }, [buildingId, floorId, editorData]);

  // ── 편집도면 아이템 타입 변경 + Notion 저장 ─────────────────────
  const updateItemType = useCallback(async (itemId: string, type: MonitorType) => {
    const nextData = {
      ...editorData,
      items: editorData.items.map(i => i.id === itemId ? { ...i, monitorType: type } : i),
    };
    setEditorData(nextData);
    const key = `sw-floormap-editor-${buildingId}-${floorId}`;
    try { localStorage.setItem(key, JSON.stringify(nextData)); } catch {}

    // Notion 자동 저장
    setIsSaving(true); setSaveMsg("");
    try {
      const res = await fetch("/api/floor-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ building: buildingId, floor: floorId, data: nextData }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "저장 실패");
      setSaveMsg("✓ 상태 저장 완료");
    } catch (e: any) {
      setSaveMsg(`✗ ${(e as any).message}`);
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMsg(""), 4000);
    }
  }, [buildingId, floorId, editorData]);

  // ── 좌석 타입 업데이트 (localStorage 동기 저장) ──────────────────
  const updateSeatType = useCallback((seatId: string, type: MonitorType) => {
    setSeatOverrides(prev => {
      const next = { ...prev, [seatId]: type };
      try { localStorage.setItem("sw-monitor-overrides", JSON.stringify(next)); } catch {}
      return next;
    });
    // 현재 선택된 좌석도 즉시 반영
    setSelected(prev =>
      prev?.seat.id === seatId ? { ...prev, seat: { ...prev.seat, type } } : prev
    );
  }, []);

  const building = useMemo(() => BUILDINGS.find(b => b.id === buildingId)!, [buildingId]);
  const floor    = useMemo(
    () => building.floors.find(f => f.id === floorId) ?? building.floors[0],
    [building, floorId]
  );

  // override 적용된 zones (렌더링·통계 모두 이걸 사용)
  const effectiveZones = useMemo(() =>
    floor.zones.map(z => ({
      ...z,
      seats: z.seats.map(s => ({
        ...s,
        type: (seatOverrides[s.id] ?? s.type) as MonitorType,
      })),
    })),
    [floor.zones, seatOverrides]
  );

  const flStats    = useMemo(() => calcStats(effectiveZones), [effectiveZones]);
  const selectedId = selected?.seat.id ?? null;

  // editorData 기반 통계 (헤더/필터에 사용)
  const editorStats = useMemo(() => {
    const r = { std27:0, std24:0, dev34:0, none:0, unk:0, total:0 };
    editorData.items.forEach(i => { (r as any)[i.monitorType]++; r.total++; });
    return r;
  }, [editorData.items]);

  const handleBldChange = (bid: string) => {
    setBuildingId(bid);
    setFloorId(BUILDINGS.find(b => b.id === bid)!.floors[0].id);
    setSelected(null);
    setSelectedItemId(null);
  };
  const handleFloorChange = (fid: string) => { setFloorId(fid); setSelected(null); setSelectedItemId(null); };
  const handleSelect = (seat: SeatData, zone: ZoneData) => {
    // 선택 시 override 반영된 최신 type 적용
    const effective: SeatData = { ...seat, type: (seatOverrides[seat.id] ?? seat.type) as MonitorType };
    setSelected(prev => prev?.seat.id === seat.id ? null : { seat: effective, zone });
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-50" style={{ fontFamily:"system-ui,-apple-system,sans-serif" }}>

      {/* ── 상단 바 ───────────────────────────────────────────────── */}
      <div className="flex-none bg-white border-b px-5 py-3 flex flex-wrap items-center gap-3 shadow-sm">
        <div className="shrink-0">
          <div className="text-[10px] text-gray-400">스마트오피스</div>
          <div className="text-base font-bold text-slate-800">모니터 배치도</div>
        </div>

        {/* 층 통계 칩 (editorData 기반) */}
        <div className="flex gap-1.5 flex-wrap">
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs bg-gray-100 text-gray-600 border border-gray-200">
            총 {editorStats.total}대
          </span>
          {TYPES.map(t => {
            const cnt = (editorStats as any)[t] as number;
            if (!cnt) return null;
            const meta = MONITOR[t];
            return (
              <span key={t} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border"
                style={{ background:meta.pale, color:meta.color, borderColor:meta.border }}>
                <span className="w-2 h-2 rounded-sm" style={{ background:meta.color+"CC" }}/>
                {meta.long} {cnt}
              </span>
            );
          })}
        </div>

        {/* 편집 모드 토글 */}
        <button
          onClick={() => setEditorMode(v => !v)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
            editorMode
              ? "bg-amber-500 text-white border-amber-500 shadow-sm"
              : "bg-white text-slate-600 border-gray-200 hover:border-amber-400 hover:text-amber-600"
          }`}>
          {editorMode ? "✏️ 편집 모드 ON" : "✏️ 편집 모드"}
        </button>

        {/* 건물 + 층 선택 */}
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {BUILDINGS.map(b => (
              <button key={b.id}
                onClick={() => handleBldChange(b.id)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors border-r border-gray-200 last:border-0 ${
                  b.id === buildingId ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-gray-50"
                }`}>{b.label}</button>
            ))}
          </div>
          <div className="flex gap-1 flex-wrap">
            {building.floors.map(f => (
              <button key={f.id}
                onClick={() => handleFloorChange(f.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                  f.id === floorId
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-white text-slate-500 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                }`}>{f.label.replace("층","F")}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 필터 바 ───────────────────────────────────────────────── */}
      <div className="flex-none bg-white border-b px-5 py-2 flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              filter==="all" ? "bg-white shadow text-slate-800 font-semibold" : "text-slate-500 hover:text-slate-700"
            }`}>전체 보기</button>
          {TYPES.map(t => {
            const cnt = (editorStats as any)[t] as number;
            if (!cnt) return null;
            return (
              <button key={t}
                onClick={() => setFilter(filter===t?"all":t)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  filter===t ? "bg-white shadow font-semibold" : "text-slate-500 hover:text-slate-700"
                }`}
                style={{ color: filter===t ? MONITOR[t].color : undefined }}>
                {MONITOR[t].long}만
              </button>
            );
          })}
        </div>
        <span className="text-[10px] text-gray-400 ml-2">좌석 클릭 시 위치 정보 · 교체 요청 가능</span>
      </div>

      {/* ── 편집 모드 ──────────────────────────────────────────────── */}
      {editorMode && (
        <div className="flex flex-1 min-h-0 overflow-hidden flex-col">
          <div className="flex-none bg-amber-50 border-b border-amber-200 px-5 py-1.5 flex items-center gap-2">
            <span className="text-[10px] font-semibold text-amber-700">✏️ 편집 모드</span>
            <span className="text-[10px] text-amber-600 hidden lg:block">
              도면 이미지 업로드 · 모니터 배치 · 공간 구역 지정 · 시설물 마커 · 드래그 이동 · 회전 지원
            </span>
            <div className="flex items-center gap-2 ml-auto">
              {saveMsg && (
                <span className={`text-[10px] font-medium ${saveMsg.startsWith("✓") ? "text-green-600" : "text-red-500"}`}>
                  {saveMsg}
                </span>
              )}
              <button
                onClick={handleSaveToNotion}
                disabled={isSaving}
                className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm">
                {isSaving ? "저장 중…" : "💾 노션 저장"}
              </button>
              <span className="text-[10px] text-amber-500">{building.label} {floor.label}</span>
            </div>
          </div>
          <FloorMapEditor data={editorData} onChange={handleEditorChange} onZoneMove={handleZoneMove}/>
        </div>
      )}

      {/* ── 메인 콘텐츠 ─────────────────────────────────────────── */}
      {!editorMode && (
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* 도면 영역 */}
        <div className="flex-1 overflow-auto p-4">
          {/* 탭 헤더 */}
          <div className="flex items-center gap-1 mb-3">
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
              <span className="px-3 py-1.5 font-medium bg-blue-600 text-white">
                📊 시트 배치도
              </span>
            </div>
            <h2 className="text-sm font-bold text-slate-700 ml-2">{floor.label}</h2>
            {floor.note && <span className="text-xs text-gray-400">· {floor.note}</span>}
          </div>

          {/* 편집 도면 */}
          {editorData.items.length > 0 || editorData.zones.length > 0 || editorData.facilities.length > 0 || editorData.imageUrl
            ? <FloorMapView
                data={editorData}
                className="w-full"
                onItemClick={item =>
                  setSelectedItemId(prev => prev === item.id ? null : item.id)
                }
                selectedItemId={selectedItemId}
              />
            : <div className="flex flex-col items-center justify-center py-20 text-center text-gray-400">
                <div className="text-4xl mb-3">🗺</div>
                <div className="text-sm font-medium text-gray-500">저장된 도면이 없습니다</div>
                <div className="text-xs mt-1">편집 모드에서 도면을 작성하고 <span className="font-semibold text-blue-500">💾 노션 저장</span>을 눌러주세요.</div>
              </div>
          }
        </div>

        {/* 우측 패널 */}
        <div className="w-64 flex-shrink-0 border-l border-gray-200 bg-white overflow-hidden flex flex-col">
          {/* view mode 저장 메시지 */}
          {saveMsg && !editorMode && (
            <div className={`flex-none px-3 py-1.5 text-[11px] font-medium text-center border-b ${
              saveMsg.startsWith("✓")
                ? "bg-green-50 text-green-700 border-green-100"
                : "bg-red-50 text-red-600 border-red-100"
            }`}>
              {isSaving ? "저장 중…" : saveMsg}
            </div>
          )}
          <div className="flex-1 overflow-hidden">
            {selectedItem ? (
              <ItemDetailPanel
                item={selectedItem}
                editorData={editorData}
                buildingLabel={building.label}
                floorLabel={floor.label}
                onClose={() => setSelectedItemId(null)}
                onUpdateType={updateItemType}
              />
            ) : (
              <OverviewSidePanel building={building} floor={floor} editorData={editorData}/>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
