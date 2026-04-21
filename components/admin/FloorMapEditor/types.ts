export type FloorElementType =
  | "deskDouble"   // 양면 책상 줄
  | "deskSingle"   // 단면 책상 줄
  | "meetingRoom"  // 회의실
  | "monitor"      // 단일 모니터 좌석
  | "lounge"       // 라운지
  | "storage"      // 창고
  | "elevator"     // 엘리베이터 홀
  | "stairs"       // 계단
  | "restroom"     // 화장실
  | "label"        // 텍스트 레이블
  | "void";        // 빈 공간 (사선 해칭)

export type MonitorType = "std27" | "std24" | "dev34" | "none" | "unk";

export interface FloorMapElement {
  id: string;
  type: FloorElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;  // degrees
  name: string;
  color?: string;    // custom override fill
  // monitor 전용
  seatId?: string;
  monitorType?: MonitorType;
}

export interface PaletteItem {
  type: FloorElementType;
  label: string;
  icon: string;
  defaultW: number;
  defaultH: number;
}

export interface AvailableFloor {
  buildingId: string;
  buildingLabel: string;
  floorId: string;
  floorLabel: string;
}
