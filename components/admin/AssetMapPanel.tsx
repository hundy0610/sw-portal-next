"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";

const MapEditor = dynamic(() => import("./FloorMapEditor/MapEditor"), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full text-gray-400 text-sm">도면 편집기 로딩 중...</div>,
});

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════
type MonitorType = "std27" | "std24" | "dev34" | "none" | "unk";

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
        rooms:["미팅룸 A","미팅룸 B","미팅룸 C","쇼룸"] },
      { id:"3F", label:"3층", note:"서편 54석 · 동편 71석 · 벽면 7석",
        zones:[
          buildZone("W","서편","W",6,9, f(54,"unk"), "BW","3F"),
          buildZone("E","동편","E",8,9, f(71,"unk"), "BW","3F"),
          buildZone("EW","동편 벽면","E",1,7, f(7,"unk"), "BW","3F"),
        ],
        rooms:["미팅룸","미팅룸"] },
      { id:"4F", label:"4층", note:"서편 74석 · 동편 49석",
        zones:[
          buildZone("W","서편","W",7,11, f(74,"unk"), "BW","4F"),
          buildZone("E","동편","E",7,7,  f(49,"unk"), "BW","4F"),
        ],
        rooms:["스마트2","스마트3","라운지"] },
      { id:"5F", label:"5층", note:"서편 74석 · 동편 49석",
        zones:[
          buildZone("W","서편","W",7,11, f(74,"unk"), "BW","5F"),
          buildZone("E","동편","E",7,7,  f(49,"unk"), "BW","5F"),
        ],
        rooms:["미팅룸"] },
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
// SEAT DETAIL PANEL
// ══════════════════════════════════════════════════════════════════════════════
interface MonitorRequest {
  id: string;
  seatId: string;
  building: string;
  floor: string;
  zone: string;
  type: "repair" | "replace";
  status: "pending" | "in_progress" | "done";
  createdAt: string;
  createdByName: string;
  note?: string;
}

function SeatDetailPanel({
  seat, zone, floor, building, onClose, onUpdateType,
}: {
  seat: SeatData; zone: ZoneData; floor: FloorData; building: BuildingData;
  onClose: () => void;
  onUpdateType: (seatId: string, type: MonitorType) => void;
}) {
  const meta     = MONITOR[seat.type];
  const rowLabel = String.fromCharCode(65 + seat.row);

  // 탭: info | history | request
  const [tab, setTab] = useState<"info" | "history" | "request">("info");

  // 수리 요청 상태
  const [reqType,     setReqType]     = useState<"repair" | "replace">("repair");
  const [reqNote,     setReqNote]     = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [submitMsg,   setSubmitMsg]   = useState<{ ok: boolean; text: string } | null>(null);

  // 이력 (모니터 요청 목록)
  const [history,     setHistory]     = useState<MonitorRequest[]>([]);
  const [histLoading, setHistLoading] = useState(false);

  // seat 변경 시 탭·상태 초기화
  useEffect(() => {
    setTab("info");
    setReqNote("");
    setSubmitMsg(null);
    setHistory([]);
  }, [seat.id]);

  // history 탭 진입 시 이력 조회
  useEffect(() => {
    if (tab !== "history") return;
    setHistLoading(true);
    fetch("/api/monitor-requests")
      .then(r => r.json())
      .then(data => {
        if (data.ok && Array.isArray(data.requests)) {
          const filtered = (data.requests as MonitorRequest[])
            .filter(r => r.seatId === seat.id)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          setHistory(filtered);
        }
      })
      .catch(() => {})
      .finally(() => setHistLoading(false));
  }, [tab, seat.id]);

  const handleSubmitRequest = async () => {
    setSubmitting(true);
    setSubmitMsg(null);
    try {
      const res = await fetch("/api/monitor-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seatId:   seat.id,
          building: building.label,
          floor:    floor.label,
          zone:     zone.label,
          type:     reqType,
          note:     reqNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSubmitMsg({ ok: true, text: "✅ 요청이 접수되었습니다. 총무 담당자에게 알림이 전송됩니다." });
        setReqNote("");
      } else {
        setSubmitMsg({ ok: false, text: data.error ?? "요청 실패. 다시 시도해주세요." });
      }
    } catch {
      setSubmitMsg({ ok: false, text: "네트워크 오류. 다시 시도해주세요." });
    } finally {
      setSubmitting(false);
    }
  };

  const STATUS_LABEL: Record<string, { text: string; color: string }> = {
    pending:     { text: "접수",    color: "#F59E0B" },
    in_progress: { text: "처리 중", color: "#3B82F6" },
    done:        { text: "완료",    color: "#10B981" },
  };

  return (
    <div className="flex flex-col h-full text-sm">
      {/* 헤더 */}
      <div className="flex items-start justify-between px-4 py-3 bg-slate-800 text-white flex-shrink-0">
        <div>
          <div className="text-[10px] opacity-60 mb-0.5">좌석 상세 정보</div>
          <div className="text-lg font-extrabold tracking-widest leading-tight font-mono">{seat.id}</div>
          <div className="text-[10px] opacity-60 mt-1">{building.label} · {floor.label} · {zone.label}</div>
        </div>
        <button onClick={onClose} className="opacity-60 hover:opacity-100 text-lg mt-0.5">✕</button>
      </div>

      {/* 모니터 현황 */}
      <div className="flex-shrink-0 px-3 pt-3">
        <div className="rounded-xl p-3 border" style={{ background: meta.pale, borderColor: meta.border }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-black flex-shrink-0"
              style={{ background: meta.color }}>{meta.label}</div>
            <div className="min-w-0">
              <div className="font-bold text-sm" style={{ color: meta.color }}>{meta.long}</div>
              <div className="text-[10px] opacity-70 truncate" style={{ color: meta.color }}>
                {seat.type === "unk" ? "미확인 좌석" : seat.type === "none" ? "모니터 미설치" : seat.type === "dev34" ? "개발자용 와이드 모니터" : "표준형 모니터 설치됨"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex-shrink-0 flex border-b border-gray-200 mt-2 px-3">
        {(["info", "history", "request"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-[11px] font-semibold border-b-2 transition-colors ${
              tab === t
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            {t === "info" ? "정보" : t === "history" ? "이력" : "수리 요청"}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      <div className="flex-1 overflow-y-auto">

        {/* ── 정보 탭 ── */}
        {tab === "info" && (
          <div className="p-3 space-y-3">
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
                {building.label} 건물 진입<br />
                → <strong>{floor.label}</strong> 이동 (계단/엘리베이터)<br />
                → <strong>{zone.label}</strong> 구역<br />
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
                    <button key={t}
                      onClick={() => onUpdateType(seat.id, t)}
                      className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-semibold transition-all border"
                      style={{
                        background: isActive ? m.color : m.pale,
                        color: isActive ? "white" : m.color,
                        borderColor: m.border,
                        outline: isActive ? `2px solid ${m.color}` : "none",
                      }}
                    >
                      <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: isActive ? "white" : m.color + "CC" }} />
                      {m.long}
                      {isActive && <span className="ml-auto text-[10px] opacity-80">✓ 현재</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 바로가기 버튼 */}
            <div className="space-y-1.5">
              <button
                onClick={() => setTab("request")}
                className="w-full py-2.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors"
              >
                🔧 교체/수리 요청
              </button>
              <button
                className="w-full py-2 rounded-lg border border-gray-200 bg-white text-gray-600 text-xs font-semibold hover:bg-gray-50 transition-colors"
                onClick={() => navigator.clipboard?.writeText(
                  `${building.label} ${floor.label} ${zone.label} ${rowLabel}행 ${seat.col + 1}번 (${seat.id})`
                )}
              >
                📋 위치 텍스트 복사
              </button>
            </div>
          </div>
        )}

        {/* ── 이력 탭 ── */}
        {tab === "history" && (
          <div className="p-3">
            <div className="text-[10px] text-gray-400 font-semibold mb-2">수리/교체 요청 이력</div>
            {histLoading ? (
              <div className="text-xs text-gray-400 py-4 text-center">로딩 중...</div>
            ) : history.length === 0 ? (
              <div className="text-xs text-gray-400 py-8 text-center">
                <div className="text-2xl mb-2 opacity-40">📋</div>
                요청 이력이 없습니다
              </div>
            ) : (
              <div className="space-y-2">
                {history.map(req => {
                  const s = STATUS_LABEL[req.status] ?? { text: req.status, color: "#6B7280" };
                  return (
                    <div key={req.id} className="border border-gray-100 rounded-xl p-2.5 bg-white space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold"
                          style={{ color: req.type === "repair" ? "#DC2626" : "#7C3AED" }}>
                          {req.type === "repair" ? "🔧 수리" : "🔄 교체"}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: s.color + "20", color: s.color }}>
                          {s.text}
                        </span>
                        <span className="ml-auto text-[10px] text-gray-400">
                          {new Date(req.createdAt).toLocaleDateString("ko-KR")}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-500">요청자: {req.createdByName}</div>
                      {req.note && (
                        <div className="text-[10px] text-gray-600 bg-gray-50 rounded px-2 py-1">
                          {req.note}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── 수리 요청 탭 ── */}
        {tab === "request" && (
          <div className="p-3 space-y-3">
            <div className="text-[10px] text-gray-400 font-semibold">교체/수리 요청 접수</div>

            {/* 요청 종류 */}
            <div>
              <div className="text-[10px] text-gray-500 mb-1.5">요청 종류</div>
              <div className="flex gap-2">
                {(["repair", "replace"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setReqType(t)}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all ${
                      reqType === t
                        ? t === "repair"
                          ? "bg-red-600 text-white border-red-600"
                          : "bg-purple-600 text-white border-purple-600"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {t === "repair" ? "🔧 수리" : "🔄 교체"}
                  </button>
                ))}
              </div>
            </div>

            {/* 요청 메모 */}
            <div>
              <div className="text-[10px] text-gray-500 mb-1.5">증상 / 메모 (선택)</div>
              <textarea
                value={reqNote}
                onChange={e => setReqNote(e.target.value)}
                rows={3}
                placeholder="증상을 구체적으로 입력하면 처리가 빨라집니다&#10;예: 화면이 깜빡임, 전원이 안 켜짐..."
                className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
              />
            </div>

            {/* 대상 좌석 확인 */}
            <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-100">
              <div className="text-[10px] text-gray-400 mb-1">대상 좌석</div>
              <div className="text-xs font-mono font-bold text-slate-700">{seat.id}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">
                {building.label} {floor.label} · {zone.label} {rowLabel}행 {seat.col + 1}번
              </div>
            </div>

            {/* 결과 메시지 */}
            {submitMsg && (
              <div className={`rounded-lg px-3 py-2 text-xs font-medium ${
                submitMsg.ok
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}>
                {submitMsg.text}
              </div>
            )}

            {/* 제출 버튼 */}
            <button
              onClick={handleSubmitRequest}
              disabled={submitting}
              className="w-full py-2.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "처리 중..." : "🔧 요청 접수 · 총무 담당자 알림"}
            </button>

            <p className="text-[10px] text-gray-400 text-center leading-relaxed">
              요청 접수 시 총무 담당자의<br />관리 대시보드에 알림이 표시됩니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// OVERVIEW SIDE PANEL  (좌석 미선택 시)
// ══════════════════════════════════════════════════════════════════════════════
function OverviewSidePanel({ building, floor, zones }: { building: BuildingData; floor: FloorData; zones: ZoneData[] }) {
  const st = calcStats(zones);
  const confirmed = st.std27 + st.std24 + st.dev34 + st.none;
  const pct = st.total > 0 ? Math.round((confirmed / st.total) * 100) : 0;

  return (
    <div className="flex flex-col h-full text-sm overflow-y-auto">
      <div className="px-4 py-3 bg-slate-800 text-white flex-shrink-0">
        <div className="text-[10px] opacity-60 mb-0.5">층 현황</div>
        <div className="font-bold">{building.label} {floor.label}</div>
      </div>

      <div className="flex-1 p-3 space-y-3 overflow-y-auto">
        {/* 진행률 */}
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
          <div className="text-[10px] text-gray-400 font-semibold mb-2">확인 진행률</div>
          <div className="flex items-baseline gap-2 mb-1.5">
            <span className="text-2xl font-extrabold text-gray-800">{pct}%</span>
            <span className="text-xs text-gray-400">{confirmed}/{st.total}석 완료</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width:`${pct}%`, background: pct===100?"#10B981":"#3B82F6" }}/>
          </div>
        </div>

        {/* 타입별 카드 */}
        <div className="grid grid-cols-1 gap-1.5">
          {TYPES.map(t => {
            const cnt = st[t as keyof typeof st] as number;
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
        <div className="bg-white border border-gray-100 rounded-xl p-3">
          <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-2">구역별 현황</div>
          {zones.map(z => {
            const zst = calcStats([z]);
            const zConfirmed = zst.std27+zst.std24+zst.dev34+zst.none;
            const zPct = zst.total > 0 ? Math.round((zConfirmed/zst.total)*100) : 0;
            return (
              <div key={z.id} className="mb-3 last:mb-0">
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-xs font-semibold text-gray-700 truncate max-w-[120px]">{z.label}</span>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">{z.seats.length}석 {zPct}%</span>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {TYPES.map(t => {
                    const cnt = zst[t as keyof typeof zst] as number;
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
            );
          })}
        </div>

        {/* 찾아가기 가이드 */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <div className="text-[10px] font-bold text-amber-700 mb-1.5">📍 찾아가는 방법</div>
          <div className="text-[10px] text-amber-600 leading-relaxed space-y-0.5">
            <p>• <strong>서편</strong> : 삼성역 방면 엘리베이터 이용</p>
            <p>• <strong>동편</strong> : 탄천 방면 엘리베이터 이용</p>
            <p>• 좌석 클릭 → 정확한 위치 확인</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PANEL
// ══════════════════════════════════════════════════════════════════════════════
export default function AssetMapPanel() {
  const [buildingId,    setBuildingId]    = useState<string>("bw");
  const [floorId,       setFloorId]       = useState<string>("2F");
  const [selected,      setSelected]      = useState<{ seat:SeatData; zone:ZoneData } | null>(null);
  const [seatOverrides, setSeatOverrides] = useState<Record<string, MonitorType>>({});

  // ── localStorage 초기 로드 ──────────────────────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem("sw-monitor-overrides");
      if (stored) setSeatOverrides(JSON.parse(stored));
    } catch {}
  }, []);

  // ── 좌석 타입 업데이트 (localStorage 동기 저장) ──────────────────
  const updateSeatType = useCallback((seatId: string, type: MonitorType) => {
    setSeatOverrides(prev => {
      const next = { ...prev, [seatId]: type };
      try { localStorage.setItem("sw-monitor-overrides", JSON.stringify(next)); } catch {}
      return next;
    });
    setSelected(prev =>
      prev?.seat.id === seatId ? { ...prev, seat: { ...prev.seat, type } } : prev
    );
  }, []);

  const building = useMemo(() => BUILDINGS.find(b => b.id === buildingId)!, [buildingId]);
  const floor    = useMemo(
    () => building.floors.find(f => f.id === floorId) ?? building.floors[0],
    [building, floorId]
  );

  // seatOverrides 적용된 zones
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

  // 전체 건물·층 목록 (복사 기능용)
  const availableFloors = useMemo(() =>
    BUILDINGS.flatMap(b =>
      b.floors.map(f => ({
        buildingId:    b.id,
        buildingLabel: b.label,
        floorId:       f.id,
        floorLabel:    f.label,
      }))
    ), []
  );

  const handleBldChange = (bid: string) => {
    setBuildingId(bid);
    setFloorId(BUILDINGS.find(b => b.id === bid)!.floors[0].id);
    setSelected(null);
  };
  const handleFloorChange = (fid: string) => { setFloorId(fid); setSelected(null); };

  // MapEditor에서 모니터 아이콘 클릭 시 — seatId로 좌석 찾아 패널 표시
  const handleMapEditorMonitorSelect = useCallback((seatId: string) => {
    for (const z of effectiveZones) {
      const seat = z.seats.find(s => s.id === seatId);
      if (seat) {
        const effective: SeatData = { ...seat, type: (seatOverrides[seat.id] ?? seat.type) as MonitorType };
        setSelected(prev => prev?.seat.id === seatId ? null : { seat: effective, zone: z });
        return;
      }
    }
    // effectiveZones에 없는 경우 (편집기에서 새로 추가한 모니터)
    const t = (seatOverrides[seatId] ?? "unk") as MonitorType;
    const fakeSeat: SeatData = { id: seatId, type: t, row: 0, col: 0 };
    const fakeZone: ZoneData = { id: "custom", label: "커스텀", side: "", cols: 1, rows: 1, seats: [fakeSeat] };
    setSelected(prev => prev?.seat.id === seatId ? null : { seat: fakeSeat, zone: fakeZone });
  }, [effectiveZones, seatOverrides]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-50" style={{ fontFamily:"system-ui,-apple-system,sans-serif" }}>

      {/* ── 상단 바 ───────────────────────────────────────────────── */}
      <div className="flex-none bg-white border-b px-5 py-3 flex flex-wrap items-center gap-3 shadow-sm">
        <div className="shrink-0">
          <div className="text-[10px] text-gray-400">스마트오피스</div>
          <div className="text-base font-bold text-slate-800">모니터 배치도</div>
        </div>

        {/* 층 통계 칩 */}
        <div className="flex gap-1.5 flex-wrap">
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs bg-gray-100 text-gray-600 border border-gray-200">
            총 {flStats.total}석
          </span>
          {TYPES.map(t => {
            const cnt = flStats[t as keyof typeof flStats] as number;
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

        {/* 건물 + 층 선택 */}
        <div className="flex items-center gap-2 flex-wrap ml-auto">
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

      {/* ── 메인 콘텐츠 ─────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-hidden">
          <MapEditor
            buildingId={buildingId}
            floorId={floorId}
            seatOverrides={seatOverrides}
            onMonitorSelect={handleMapEditorMonitorSelect}
            selectedSeatId={selectedId}
            availableFloors={availableFloors}
          />
        </div>

        {/* 우측 패널 */}
        <div className="w-64 flex-shrink-0 border-l border-gray-200 bg-white overflow-hidden">
          {selected ? (
            <SeatDetailPanel
              seat={selected.seat} zone={selected.zone}
              floor={floor} building={building}
              onClose={() => setSelected(null)}
              onUpdateType={updateSeatType}
            />
          ) : (
            <OverviewSidePanel building={building} floor={floor} zones={effectiveZones}/>
          )}
        </div>
      </div>
    </div>
  );
}
