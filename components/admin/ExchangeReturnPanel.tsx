"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import type { ExchangeReturnRecord } from "@/types";
import EnvVarMissing from "@/components/ui/EnvVarMissing";

// ── 상수 ────────────────────────────────────────────────────
const STAGES = ["교체요청", "요청기안", "기기준비", "기기준비완료", "사용자수령", "반납요청", "반납완료"] as const;
type Stage = typeof STAGES[number];

// 퇴사반납은 반납요청부터 시작, 신규지급은 사용자수령이 최종
const STAGES_BY_TYPE: Record<string, readonly Stage[]> = {
  "교체":     STAGES,
  "퇴사반납": ["반납요청", "반납완료"],
  "신규지급": ["요청기안", "기기준비", "기기준비완료", "사용자수령"],
};
const FINAL_STAGE: Stage = "반납완료";

const RECORD_TYPES = ["교체", "퇴사반납", "신규지급"] as const;

const COMPANIES = [
  "대웅제약","대웅바이오","대웅","대웅개발","대웅이엔지","대웅펫",
  "한올바이오파마","시지바이오","시지메드텍","IdsTrust","디엔컴퍼니",
  "디엔코스메틱스","더편한샵","페이지원","엠서클","애디테라","노바메디텍",
  "에이하나","다나아데이터","클리슈어리서치","유와이즈원","DNC",
  "석천나눔재단","HR코리아","힐코","블루넷",
];

const STAGE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  "교체요청":   { bg: "#F8FAFC", text: "#64748B", dot: "#94A3B8" },
  "요청기안":   { bg: "#EFF6FF", text: "#1D4ED8", dot: "#3B82F6" },
  "기기준비":   { bg: "#F5F3FF", text: "#6D28D9", dot: "#8B5CF6" },
  "기기준비완료": { bg: "#ECFDF5", text: "#065F46", dot: "#10B981" },
  "사용자수령": { bg: "#FFF7ED", text: "#C2410C", dot: "#F97316" },
  "반납요청":   { bg: "#FEFCE8", text: "#A16207", dot: "#EAB308" },
  "반납완료":   { bg: "#F0FDF4", text: "#15803D", dot: "#22C55E" },
};

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  "교체":     { bg: "#EFF6FF", text: "#1D4ED8" },
  "퇴사반납": { bg: "#FEF2F2", text: "#B91C1C" },
  "신규지급": { bg: "#F0FDF4", text: "#15803D" },
};

// ── Helpers ──────────────────────────────────────────────────
function agingDays(requestedAt: string, completedAt: string, stage: string): number {
  if (!requestedAt) return 0;
  const start = new Date(requestedAt);
  const end = stage === FINAL_STAGE && completedAt ? new Date(completedAt) : new Date();
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000);
}

function daysLeft(iso?: string): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

function fmtDateKo(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${y}.${m}.${d}`;
}

function isOverdue(r: { stage: string; returnDue: string }): boolean {
  if (r.stage !== "반납요청" || !r.returnDue) return false;
  const d = daysLeft(r.returnDue);
  return d !== null && d < 0;
}

function DDay({ date }: { date: string }) {
  const d = daysLeft(date);
  if (d === null) return <span className="text-gray-400 text-xs">—</span>;
  if (d < 0)   return <span className="text-red-600 font-bold text-[10px] bg-red-50 px-1.5 py-0.5 rounded-full">D+{Math.abs(d)} 미반납</span>;
  if (d === 0) return <span className="text-red-600 font-bold text-[10px] bg-red-50 px-1.5 py-0.5 rounded-full">D-Day</span>;
  if (d <= 7)  return <span className="text-orange-600 font-semibold text-[10px] bg-orange-50 px-1.5 py-0.5 rounded-full">D-{d}</span>;
  return <span className="text-gray-500 text-[10px]">{fmtDate(date)}</span>;
}

// ── Sub-components ───────────────────────────────────────────
function StageBadge({ stage }: { stage: string }) {
  const c = STAGE_COLORS[stage] ?? { bg: "#F1F5F9", text: "#64748B" };
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
      style={{ background: c.bg, color: c.text }}>
      {stage || "—"}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  if (!type) return <span className="text-xs text-gray-300">—</span>;
  const c = TYPE_COLORS[type] ?? { bg: "#F1F5F9", text: "#64748B" };
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
      style={{ background: c.bg, color: c.text }}>
      {type}
    </span>
  );
}

function AgingChip({ days, stage }: { days: number; stage: string }) {
  if (stage === FINAL_STAGE) return <span className="text-xs text-gray-400">{days}일 소요</span>;
  const color = days >= 7 ? "#DC2626" : days >= 3 ? "#D97706" : "#6B7280";
  return <span className="text-xs font-semibold" style={{ color }}>D+{days}</span>;
}

function stagesFor(type: string): readonly Stage[] {
  return STAGES_BY_TYPE[type] ?? STAGES;
}

function MiniStageBar({ stage, type }: { stage: string; type: string }) {
  const visible = stagesFor(type);
  const idx = visible.indexOf(stage as Stage);
  return (
    <div className="flex items-center gap-0.5">
      {visible.map((s, i) => {
        const c = STAGE_COLORS[s];
        const active = i === idx;
        const done = i < idx;
        return (
          <div key={s} title={s} className="rounded-full transition-all"
            style={{
              width: active ? 10 : 6, height: active ? 10 : 6,
              background: done ? "#22C55E" : active ? c.dot : "#E2E8F0",
              border: active ? `2px solid ${c.dot}` : "none",
            }}
          />
        );
      })}
    </div>
  );
}

function BigStageBar({ stage, type }: { stage: string; type: string }) {
  const visible = stagesFor(type);
  const idx = visible.indexOf(stage as Stage);
  return (
    <div className="flex items-start gap-0">
      {visible.map((s, i) => {
        const c = STAGE_COLORS[s];
        const active = i === idx;
        const done = i < idx;
        const isLast = i === visible.length - 1;
        return (
          <div key={s} className="flex flex-col items-center" style={{ flex: 1 }}>
            <div className="flex items-center w-full">
              <div className="flex-1 h-0.5" style={{ background: i === 0 ? "transparent" : done || active ? "#22C55E" : "#E2E8F0" }} />
              <div className="rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                style={{
                  width: active ? 22 : 14, height: active ? 22 : 14,
                  background: done ? "#22C55E" : active ? c.dot : "#E2E8F0",
                  border: active ? `3px solid ${c.dot}` : done ? "none" : "2px solid #CBD5E1",
                }}>
                {done && (
                  <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <div className="flex-1 h-0.5" style={{ background: isLast ? "transparent" : done ? "#22C55E" : "#E2E8F0" }} />
            </div>
            <div className="mt-1.5 text-center whitespace-pre-line leading-tight"
              style={{ fontSize: 8, color: active ? c.text : done ? "#22C55E" : "#94A3B8", fontWeight: active ? 700 : done ? 600 : 400 }}>
              {s}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 재고 자산 선택 모달 ──────────────────────────────────────
interface StockAsset { id: string; assetNo: string; model: string; cpu: string; ram: string; }
interface StockAssetDetail extends StockAsset {
  serial: string; maker: string; company: string; dept: string; user: string;
  status: string; location: string; useDate: string; returnDue: string;
  purchaseDate: string; docNo: string; note: string; notionUrl: string;
}
interface RtAsset {
  id: string; assetNo: string; model: string; cpu: string; ram: string;
  serial: string; dept: string; user: string; status: string; company: string;
}

function AssetPickerModal({
  company, user, department, recordId, onClose, onPicked, onNewPurchase,
}: {
  company: string;
  user: string;
  department: string;
  recordId: string;
  onClose: () => void;
  onPicked: (assetNo: string, extras: { note: string; completedAt: string }) => void;
  onNewPurchase: () => void;
}) {
  const [assets, setAssets]               = useState<StockAsset[]>([]);
  const [loading, setLoading]             = useState(true);
  const [phase, setPhase]                 = useState<1 | 2 | 3 | 4>(1);
  const [selected, setSelected]           = useState<StockAsset | null>(null);
  const [detail, setDetail]               = useState<StockAssetDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [useDate, setUseDate]             = useState(new Date().toISOString().slice(0, 10));
  const [memo, setMemo]                   = useState("");
  const [saving, setSaving]               = useState(false);
  const [newPurchasing, setNewPurchasing] = useState(false);

  useEffect(() => {
    fetch(`/api/hw?company=${encodeURIComponent(company)}&status=재고`)
      .then(r => r.json())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(json => setAssets((json.records as any[]).map((r: any) => ({
        id: r.id, assetNo: r.assetNo, model: r.model, cpu: r.cpu, ram: r.ram,
      }))))
      .finally(() => setLoading(false));
  }, [company]);

  const selectAsset = async (a: StockAsset) => {
    setSelected(a);
    setPhase(2);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/hw?search=${encodeURIComponent(a.assetNo)}`);
      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r: any = (data.records ?? []).find((x: any) => x.assetNo === a.assetNo) ?? data.records?.[0] ?? null;
      if (r) setDetail({
        id: r.id, assetNo: r.assetNo, model: r.model, cpu: r.cpu, ram: r.ram,
        serial: r.serial, maker: r.maker, company: r.company, dept: r.dept,
        user: r.user, status: r.status, location: r.location, useDate: r.useDate,
        returnDue: r.returnDue, purchaseDate: r.purchaseDate, docNo: r.docNo,
        note: r.note, notionUrl: r.notionUrl,
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const confirm = async () => {
    if (!selected || !useDate) return;
    setSaving(true);
    try {
      await Promise.all([
        fetch("/api/exchange-return/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: recordId, fields: { newAssetId: selected.assetNo, stage: "기기준비", completedAt: useDate, ...(memo ? { note: memo } : {}) } }),
        }),
        fetch("/api/hw/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: selected.id, fields: { status: "출고준비중", user, dept: department, useDate } }),
        }),
      ]);
      onPicked(selected.assetNo, { note: memo, completedAt: useDate });
    } finally {
      setSaving(false);
    }
  };

  const handleNewPurchase = async () => {
    setNewPurchasing(true);
    try {
      await fetch("/api/exchange-return/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: recordId, fields: { newAssetId: "신규구매로안내됨" } }),
      });
      onNewPurchase();
    } finally {
      setNewPurchasing(false);
    }
  };

  const PHASE_TITLES = { 1: "재고 자산 선택", 2: "자산 상세 정보", 3: "출고 정보 입력", 4: "최종 확인" };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        style={{ maxHeight: "88vh", display: "flex", flexDirection: "column" }}
        onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-gray-900 text-base">{PHASE_TITLES[phase]}</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {phase === 1 ? `${company} · 재고 상태 자산` : `${selected?.assetNo} · ${selected?.model || "—"}`}
            </p>
          </div>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">×</button>
        </div>

        {/* Phase 1: 리스트 */}
        {phase === 1 && (
          <>
            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  <span className="text-sm">불러오는 중...</span>
                </div>
              ) : assets.length === 0 ? (
                <p className="text-center text-gray-400 py-12 text-sm">{company} 법인에 재고 자산이 없습니다.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left text-xs text-gray-400 font-medium px-4 py-2.5">자산번호</th>
                      <th className="text-left text-xs text-gray-400 font-medium px-4 py-2.5">모델명</th>
                      <th className="text-left text-xs text-gray-400 font-medium px-4 py-2.5">CPU</th>
                      <th className="text-left text-xs text-gray-400 font-medium px-4 py-2.5">RAM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map(a => (
                      <tr key={a.id} onClick={() => selectAsset(a)}
                        className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors">
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{a.assetNo || "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-800">{a.model || "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">{a.cpu || "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">{a.ram || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {!loading && (
              <div className="shrink-0 px-4 py-3 border-t border-dashed border-gray-200 bg-gray-50">
                <button onClick={handleNewPurchase} disabled={newPurchasing}
                  className="w-full text-xs text-gray-400 hover:text-amber-600 hover:bg-amber-50 border border-dashed border-gray-200 hover:border-amber-300 rounded-lg px-4 py-2.5 flex items-center justify-center gap-2 transition-colors disabled:opacity-40">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                    <path d="M1 1h4l2.68 13.39a2 2 0 001.99 1.61h9.72a2 2 0 001.99-1.61L23 6H6"/>
                  </svg>
                  {newPurchasing ? "처리 중…" : "재고 없음 · 신규 구매로 안내"}
                </button>
              </div>
            )}
          </>
        )}

        {/* Phase 2: 상세 정보 */}
        {phase === 2 && (
          <>
            <div className="overflow-y-auto flex-1 px-6 py-4">
              {detailLoading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  <span className="text-sm">정보 불러오는 중...</span>
                </div>
              ) : detail ? (
                <div className="space-y-3">
                  {[
                    ["자산번호", detail.assetNo],
                    ["모델명", detail.model],
                    ["제조사", detail.maker],
                    ["CPU", detail.cpu],
                    ["RAM", detail.ram],
                    ["시리얼", detail.serial],
                    ["법인", detail.company],
                    ["부서", detail.dept],
                    ["사용자", detail.user],
                    ["위치", detail.location],
                    ["상태", detail.status],
                    ["사용일자", detail.useDate],
                    ["구매일자", detail.purchaseDate],
                    ["결재문서번호", detail.docNo],
                    ["비고", detail.note],
                  ].map(([label, value]) => value ? (
                    <div key={label} className="flex items-start gap-3 text-xs">
                      <span className="text-gray-400 w-24 shrink-0">{label}</span>
                      <span className="text-gray-800 font-medium break-all">{value}</span>
                    </div>
                  ) : null)}
                  {detail.notionUrl && (
                    <a href={detail.notionUrl} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-amber-500 hover:underline mt-1">
                      노션에서 보기 ↗
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-center text-gray-400 py-8 text-sm">상세 정보를 불러올 수 없습니다.</p>
              )}
            </div>
            <div className="shrink-0 px-6 py-4 border-t border-gray-100 flex gap-2 justify-end">
              <button onClick={() => { setPhase(1); setSelected(null); setDetail(null); }}
                className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                뒤로
              </button>
              <button onClick={() => setPhase(3)} disabled={detailLoading}
                className="text-sm px-5 py-2 rounded-lg bg-gray-900 text-white font-medium hover:bg-gray-700 disabled:opacity-40">
                다음
              </button>
            </div>
          </>
        )}

        {/* Phase 3: 사용일자 + 메모 */}
        {phase === 3 && (
          <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto flex-1">
            <div className="bg-blue-50 rounded-xl p-4 text-xs text-blue-700 space-y-1">
              <p className="font-medium">확정 시 자동 적용</p>
              <ul className="space-y-0.5 list-disc list-inside">
                <li>HW DB 상태 → <strong>출고준비중</strong></li>
                <li>사용자 → <strong>{user || "—"}</strong></li>
                <li>부서 → <strong>{department || "—"}</strong></li>
                <li>트래커 단계 → <strong>기기준비</strong></li>
              </ul>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-gray-500 font-medium">사용일자</label>
              <div className="flex items-center gap-1">
                <input type="date" value={useDate} onChange={e => setUseDate(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 flex-1" />
                {useDate && <button type="button" onClick={() => setUseDate("")} className="text-gray-400 hover:text-gray-600 text-lg leading-none shrink-0 px-0.5">×</button>}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-gray-500 font-medium">메모</label>
              <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={4}
                placeholder="기안자 : XXX, 기타 특이사항 등..."
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 w-full resize-none" />
            </div>
            <div className="flex gap-2 justify-end mt-1">
              <button onClick={() => setPhase(2)}
                className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                뒤로
              </button>
              <button onClick={() => setPhase(4)} disabled={!useDate}
                className="text-sm px-5 py-2 rounded-lg bg-gray-900 text-white font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">
                다음
              </button>
            </div>
          </div>
        )}

        {/* Phase 4: 최종 확인 */}
        {phase === 4 && (
          <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto flex-1">
            <div className="bg-orange-50 rounded-xl p-4 text-xs text-orange-800 space-y-2">
              <p className="font-semibold">확정 시 자동 적용 사항</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>교체 자산 <strong>{selected?.assetNo}</strong> → HW DB 상태: <strong>출고준비중</strong></li>
                <li>사용자 → <strong>{user || "—"}</strong> / 부서 → <strong>{department || "—"}</strong></li>
                <li>트래커 단계 → <strong>기기준비</strong></li>
                <li>사용일자 → <strong>{useDate}</strong></li>
                {memo && <li>메모 → <strong>{memo}</strong></li>}
              </ul>
            </div>
            <div className="flex gap-2 justify-end mt-1">
              <button onClick={() => setPhase(3)}
                className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                뒤로
              </button>
              <button onClick={confirm} disabled={saving}
                className="text-sm px-5 py-2 rounded-lg bg-orange-500 text-white font-semibold hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed">
                {saving ? "저장 중…" : "확정"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 사용자 수령 확정 모달 ────────────────────────────────────
function ReceiptConfirmModal({
  recordId, oldAssetId, newAssetId, recordType, onClose, onConfirmed,
}: {
  recordId: string;
  oldAssetId: string;
  newAssetId: string;
  recordType: string;
  onClose: () => void;
  onConfirmed: (returnDue: string) => void;
}) {
  const isNewIssue = recordType === "신규지급";
  const defaultDue = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  })();
  const [returnDue, setReturnDue] = useState(defaultDue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setSaving(true);
    setError(null);
    try {
      const isRealAsset = (id: string) => !!id && id !== "신규구매로안내됨";

      const [oldRes, newRes] = await Promise.all([
        isRealAsset(oldAssetId) ? fetch(`/api/hw?search=${encodeURIComponent(oldAssetId)}`).then(r => r.json()) : Promise.resolve({ records: [] }),
        isRealAsset(newAssetId) ? fetch(`/api/hw?search=${encodeURIComponent(newAssetId)}`).then(r => r.json()) : Promise.resolve({ records: [] }),
      ]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const find = (res: any, assetNo: string) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (res.records as any[]).find((r: any) => r.assetNo === assetNo) ?? (res.records.length === 1 ? res.records[0] : null);

      const oldRecord = isRealAsset(oldAssetId) ? find(oldRes, oldAssetId) : null;
      const newRecord = isRealAsset(newAssetId) ? find(newRes, newAssetId) : null;

      const stageFields = isNewIssue
        ? { stage: "사용자수령" }
        : { stage: "사용자수령", returnDue };

      const updates: Promise<unknown>[] = [
        fetch("/api/exchange-return/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: recordId, fields: stageFields }),
        }),
      ];
      if (!isNewIssue && oldRecord) updates.push(
        fetch("/api/hw/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: oldRecord.id, fields: { status: "반납예정", returnDue } }),
        })
      );
      if (newRecord) updates.push(
        fetch("/api/hw/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: newRecord.id, fields: { status: "사용중" } }),
        })
      );

      await Promise.all(updates);
      onConfirmed(isNewIssue ? "" : returnDue);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4"
        onClick={e => e.stopPropagation()}>

        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-base">사용자 수령 처리</h3>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">×</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="bg-orange-50 rounded-xl p-4 space-y-2">
            <p className="font-semibold text-orange-800 text-sm">수령 확정 시 자동 적용 사항</p>
            <ul className="space-y-1 list-disc list-inside text-xs text-orange-700">
              {newAssetId && newAssetId !== "신규구매로안내됨" && <li>교체 자산 <strong className="font-mono">{newAssetId}</strong> → HW DB 상태: <strong>사용중</strong></li>}
              {!isNewIssue && oldAssetId && <li>기존 자산 <strong className="font-mono">{oldAssetId}</strong> → HW DB 상태: <strong>반납예정</strong></li>}
              <li>트래커 단계 → <strong>사용자수령</strong></li>
              {!isNewIssue && <li>반납예정일 자동 설정</li>}
            </ul>
          </div>

          {!isNewIssue && (
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1.5">반납예정일 (수령 후 7일 기본값)</label>
              <div className="flex items-center gap-1">
                <input type="date" value={returnDue} onChange={e => setReturnDue(e.target.value)}
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-200" />
                {returnDue && <button type="button" onClick={() => setReturnDue("")} className="text-gray-400 hover:text-gray-600 text-lg leading-none shrink-0 px-0.5">×</button>}
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-600">⚠️ {error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose}
            className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">취소</button>
          <button onClick={confirm} disabled={saving || (!isNewIssue && !returnDue)}
            className="text-sm px-5 py-2 rounded-lg bg-orange-600 text-white font-medium hover:bg-orange-700 disabled:opacity-40">
            {saving ? "처리 중…" : "수령 확정"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 반납 완료 확정 모달 ──────────────────────────────────────
function ReturnCompleteModal({
  recordId, assetId, onClose, onConfirmed,
}: {
  recordId: string;
  assetId: string;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setSaving(true);
    setError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);

      // 기존 자산 HW 페이지 ID 조회
      let hwPageId: string | null = null;
      if (assetId) {
        const res = await fetch(`/api/hw?search=${encodeURIComponent(assetId)}`).then(r => r.json());
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const found = (res.records as any[]).find((r: any) => r.assetNo === assetId) ??
          (res.records.length === 1 ? res.records[0] : null);
        hwPageId = found?.id ?? null;
      }

      const updates: Promise<unknown>[] = [
        fetch("/api/exchange-return/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: recordId, fields: { stage: "반납완료", completedAt: today } }),
        }),
      ];
      if (hwPageId) updates.push(
        fetch("/api/hw/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: hwPageId, fields: { status: "재고" } }),
        })
      );

      await Promise.all(updates);
      onConfirmed();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4"
        onClick={e => e.stopPropagation()}>

        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-base">반납 완료 처리</h3>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">×</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="bg-green-50 rounded-xl p-4 space-y-2">
            <p className="font-semibold text-green-800 text-sm">완료 처리 시 자동 적용 사항</p>
            <ul className="space-y-1 list-disc list-inside text-xs text-green-700">
              {assetId && <li>기존 자산 <strong className="font-mono">{assetId}</strong> → HW DB 상태: <strong>재고</strong></li>}
              <li>트래커 단계 → <strong>반납완료</strong></li>
              <li>완료일 → <strong>오늘 날짜</strong> 자동 입력</li>
            </ul>
          </div>
          {error && <p className="text-xs text-red-600">⚠️ {error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose}
            className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">취소</button>
          <button onClick={confirm} disabled={saving}
            className="text-sm px-5 py-2 rounded-lg bg-green-700 text-white font-medium hover:bg-green-800 disabled:opacity-40">
            {saving ? "처리 중…" : "반납 완료 확정"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── HW 자산 상세 모달 ────────────────────────────────────────
function HwAssetDetailModal({ assetNo, onClose }: { assetNo: string; onClose: () => void }) {
  const [data, setData]     = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/hw?search=${encodeURIComponent(assetNo)}`)
      .then(r => r.json())
      .then(json => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const records = (json.records ?? []) as any[];
        const found = records.find((r: any) => r.assetNo === assetNo) ??
          (records.length === 1 ? records[0] : null);
        if (found) setData(found);
        else setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [assetNo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const statusColors: Record<string, { bg: string; text: string }> = {
    "사용중":    { bg: "#EFF6FF", text: "#1D4ED8" },
    "재고":      { bg: "#F0FDF4", text: "#15803D" },
    "폐기":      { bg: "#FEF2F2", text: "#B91C1C" },
    "반납예정":  { bg: "#FEFCE8", text: "#A16207" },
    "출고준비중":{ bg: "#F5F3FF", text: "#6D28D9" },
  };

  const R = ({ label, value }: { label: string; value: React.ReactNode }) => (
    value ? (
      <div className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
        <span className="text-xs text-gray-400 w-24 shrink-0 pt-0.5">{label}</span>
        <span className="text-sm text-gray-800 flex-1">{value}</span>
      </div>
    ) : null
  );

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        style={{ maxHeight: "85vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>

        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900 text-base font-mono">{assetNo}</h3>
            <p className="text-xs text-gray-400 mt-0.5">HW 자산 상세 정보</p>
          </div>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">×</button>
        </div>

        <div className="px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              <span className="text-sm">불러오는 중...</span>
            </div>
          ) : notFound || !data ? (
            <p className="text-center text-gray-400 py-10 text-sm">HW DB에서 해당 자산을 찾을 수 없습니다.</p>
          ) : (
            <>
              {/* 상태 배지 */}
              {data.status && (() => {
                const s = String(data.status);
                const c = statusColors[s] ?? { bg: "#F1F5F9", text: "#64748B" };
                return (
                  <div className="mb-4">
                    <span className="px-3 py-1 rounded-full text-xs font-bold"
                      style={{ background: c.bg, color: c.text }}>{s}</span>
                  </div>
                );
              })()}

              <R label="모델명"    value={data.model as string} />
              <R label="제조사"    value={data.maker as string} />
              <R label="CPU"      value={data.cpu as string} />
              <R label="RAM"      value={data.ram as string} />
              <R label="시리얼"    value={data.serial as string} />
              <R label="법인"     value={data.company as string} />
              <R label="부서"     value={data.dept as string} />
              <R label="사용자"    value={data.user as string} />
              <R label="위치"     value={data.location as string} />
              <R label="사용일자"  value={data.useDate ? fmtDateKo(data.useDate as string) : null} />
              <R label="반납예정일" value={data.returnDue ? fmtDateKo(data.returnDue as string) : null} />
              <R label="구매일자"  value={data.purchaseDate ? fmtDateKo(data.purchaseDate as string) : null} />
              <R label="결재문서번호" value={data.docNo as string} />
              <R label="비고"     value={data.note as string} />
            </>
          )}
        </div>

        {!loading && !!data?.notionUrl && (
          <div className="px-6 py-3 border-t border-gray-100">
            <a href={data.notionUrl as string} target="_blank" rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              노션에서 보기
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 상세 모달 ─────────────────────────────────────────────────
function DetailModal({
  record, onClose, onUpdated, onDeleted,
}: {
  record: ExchangeReturnRecord;
  onClose: () => void;
  onUpdated: (id: string, fields: Partial<ExchangeReturnRecord>) => void;
  onDeleted: (id: string) => void;
}) {
  const [deleting, setDeleting]   = useState(false);
  const [reopening, setReopening] = useState(false);

  const handleReopen = async () => {
    setReopening(true);
    try {
      const res = await fetch("/api/exchange-return/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: record.id, fields: { isClosed: false } }),
      });
      const json = await res.json();
      if (!json.ok) { alert(`재열기 실패: ${json.error || "알 수 없는 오류"}`); return; }
      onUpdated(record.id, { isClosed: false });
    } catch (e) {
      alert(`재열기 실패: ${String(e)}`);
    } finally {
      setReopening(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`자산번호 [${record.assetId || "—"}] 이력을 삭제하시겠습니까?\n\n삭제된 항목은 Notion 휴지통으로 이동됩니다.`)) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/exchange-return/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: record.id }),
      });
      const json = await res.json();
      if (!json.ok) {
        alert(`삭제 실패: ${json.error || "알 수 없는 오류"}`);
        return;
      }
      onDeleted(record.id);
      onClose();
    } catch (e) {
      alert(`삭제 실패: ${String(e)}`);
    } finally {
      setDeleting(false);
    }
  };

  const [stage, setStage] = useState(record.stage);
  const [type, setType] = useState(record.type);
  const [company, setCompany] = useState(record.company ?? "");
  const [department, setDepartment] = useState(record.department ?? "");
  const [user, setUser] = useState(record.user ?? "");
  const [newAssetId, setNewAssetId] = useState(record.newAssetId ?? "");
  const [useDate, setUseDate] = useState(record.useDate ?? "");
  const [returnDue, setReturnDue] = useState(record.returnDue ?? "");
  const [reason, setReason] = useState(record.reason ?? "");
  const [note, setNote] = useState(record.note ?? "");
  const [composingNote, setComposingNote] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [receiptConfirmOpen, setReceiptConfirmOpen] = useState(false);
  const [returnCompleteOpen, setReturnCompleteOpen] = useState(false);

  const visibleStages = stagesFor(type);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async (field: string, value: Record<string, unknown>) => {
    setSaving(field);
    try {
      const res = await fetch("/api/exchange-return/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: record.id, fields: value }),
      });
      const json = await res.json();
      if (json.ok) {
        onUpdated(record.id, value as Partial<ExchangeReturnRecord>);
        setSaved(p => ({ ...p, [field]: true }));
        setTimeout(() => setSaved(p => ({ ...p, [field]: false })), 2000);
      }
    } finally {
      setSaving(null);
    }
  };

  const days = agingDays(record.requestedAt, record.completedAt, record.stage);

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-start gap-4 py-3 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 w-24 shrink-0 pt-0.5">{label}</span>
      <div className="flex-1 text-sm text-gray-800">{children}</div>
    </div>
  );

  const SaveRow = ({ label, field, children }: { label: string; field: string; children: React.ReactNode }) => (
    <Row label={label}>
      <div className="flex items-center gap-2 flex-wrap">
        {children}
        {saved[field] && <span className="text-xs text-green-600">✓ 변경됨</span>}
      </div>
    </Row>
  );

  const selectCls = "text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200";
  const saveBtnCls = (field: string, cur: string, orig: string) =>
    `text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-white font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed ${saving === field || cur === orig ? "opacity-40 cursor-not-allowed" : ""}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden"
        style={{ maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="px-7 py-5 border-b border-gray-100 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono text-sm font-bold text-gray-900">{record.assetId || "자산번호 없음"}</span>
              <TypeBadge type={record.type} />
              {record.stage !== FINAL_STAGE && <AgingChip days={days} stage={record.stage} />}
              {record.autoSynced && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 text-cyan-700" title="HW DB 자동 동기화로 진행됨">⚡ 자동</span>
              )}
              {isOverdue(record) && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">미반납</span>
              )}
            </div>
            <p className="text-xs text-gray-400">{record.company || ""} {record.department || ""} · {record.user || ""} · 신청 {fmtDateKo(record.requestedAt)}</p>
          </div>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 shrink-0">×
          </button>
        </div>

        {/* 단계 진행 바 */}
        <div className="px-7 py-5 border-b border-gray-100 bg-gray-50">
          <BigStageBar stage={stage} type={type} />
        </div>

        <div className="px-7 py-1">
          <SaveRow label="유형" field="type">
            <select value={type} onChange={e => setType(e.target.value)} className={selectCls}>
              {RECORD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={() => save("type", { type })} disabled={saving === "type" || type === record.type} className={saveBtnCls("type", type, record.type)}>
              {saving === "type" ? "저장 중…" : "저장"}
            </button>
          </SaveRow>

          <SaveRow label="현재 단계" field="stage">
            <select value={stage} onChange={e => setStage(e.target.value)} className={selectCls}>
              {visibleStages.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button
              onClick={() => {
                if (stage === "사용자수령") { setReceiptConfirmOpen(true); }
                else if (stage === "반납완료") { setReturnCompleteOpen(true); }
                else { save("stage", { stage }); }
              }}
              disabled={saving === "stage" || stage === record.stage}
              className={saveBtnCls("stage", stage, record.stage)}>
              {saving === "stage" ? "저장 중…" : "저장"}
            </button>
          </SaveRow>

          <SaveRow label="법인" field="company">
            <select value={company} onChange={e => setCompany(e.target.value)} className={selectCls}>
              <option value="">—</option>
              {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={() => save("company", { company })} disabled={saving === "company" || company === record.company} className={saveBtnCls("company", company, record.company)}>
              {saving === "company" ? "저장 중…" : "저장"}
            </button>
          </SaveRow>

          <SaveRow label="부서" field="department">
            <input value={department} onChange={e => setDepartment(e.target.value)} className={selectCls + " w-32"} placeholder="부서명" />
            <button onClick={() => save("department", { department })} disabled={saving === "department" || department === record.department} className={saveBtnCls("department", department, record.department)}>
              {saving === "department" ? "저장 중…" : "저장"}
            </button>
          </SaveRow>

          <SaveRow label="사용자" field="user">
            <input value={user} onChange={e => setUser(e.target.value)} className={selectCls + " w-32"} placeholder="이름" />
            <button onClick={() => save("user", { user })} disabled={saving === "user" || user === record.user} className={saveBtnCls("user", user, record.user)}>
              {saving === "user" ? "저장 중…" : "저장"}
            </button>
          </SaveRow>

          <SaveRow label="사용일자" field="useDate">
            <div className="flex items-center gap-1">
              <input type="date" value={useDate} onChange={e => setUseDate(e.target.value)} className={`${selectCls} flex-1`} />
              {useDate && <button type="button" onClick={() => setUseDate("")} className="text-gray-400 hover:text-gray-600 text-lg leading-none shrink-0 px-0.5">×</button>}
            </div>
            <button onClick={() => save("useDate", { useDate: useDate || null })} disabled={saving === "useDate" || useDate === record.useDate} className={saveBtnCls("useDate", useDate, record.useDate ?? "")}>
              {saving === "useDate" ? "저장 중…" : "저장"}
            </button>
          </SaveRow>

          {(record.type === "교체" || record.type === "신규지급") && (
            <Row label={record.type === "신규지급" ? "지급 자산번호" : "교체 자산번호"}>
              <div className="flex items-center gap-2">
                {stage === "요청기안" ? (
                  <button onClick={() => setShowAssetPicker(true)}
                    className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white hover:border-blue-300 hover:bg-blue-50 text-left min-w-[10rem] transition-colors">
                    {newAssetId
                      ? <span className="font-mono text-gray-800">{newAssetId}</span>
                      : <span className="text-gray-400">재고에서 선택...</span>
                    }
                  </button>
                ) : (
                  <span className="font-mono text-sm text-gray-800">{newAssetId || "—"}</span>
                )}
                {saved.newAssetId && <span className="text-xs text-green-600">✓ 변경됨</span>}
              </div>
            </Row>
          )}
          {showAssetPicker && (
            <AssetPickerModal
              company={company || record.company || ""}
              user={user || record.user || ""}
              department={department || record.department || ""}
              recordId={record.id}
              onClose={() => setShowAssetPicker(false)}
              onPicked={(assetNo, extras) => {
                setNewAssetId(assetNo);
                setStage("기기준비");
                setNote(extras.note || note);
                onUpdated(record.id, { newAssetId: assetNo, stage: "기기준비", note: extras.note || undefined, completedAt: extras.completedAt });
                setSaved(p => ({ ...p, newAssetId: true }));
                setTimeout(() => setSaved(p => ({ ...p, newAssetId: false })), 2000);
                setShowAssetPicker(false);
              }}
              onNewPurchase={() => {
                setNewAssetId("신규구매로안내됨");
                onUpdated(record.id, { newAssetId: "신규구매로안내됨" });
                setSaved(p => ({ ...p, newAssetId: true }));
                setTimeout(() => setSaved(p => ({ ...p, newAssetId: false })), 2000);
                setShowAssetPicker(false);
              }}
            />
          )}
          {receiptConfirmOpen && (
            <ReceiptConfirmModal
              recordId={record.id}
              oldAssetId={record.assetId || ""}
              newAssetId={newAssetId || record.newAssetId || ""}
              recordType={record.type || ""}
              onClose={() => setReceiptConfirmOpen(false)}
              onConfirmed={(due) => {
                setStage("사용자수령");
                if (due) setReturnDue(due);
                onUpdated(record.id, { stage: "사용자수령", ...(due ? { returnDue: due } : {}) });
                setSaved(p => ({ ...p, stage: true }));
                setTimeout(() => setSaved(p => ({ ...p, stage: false })), 2000);
                setReceiptConfirmOpen(false);
              }}
            />
          )}
          {returnCompleteOpen && (
            <ReturnCompleteModal
              recordId={record.id}
              assetId={record.assetId || ""}
              onClose={() => setReturnCompleteOpen(false)}
              onConfirmed={() => {
                const today = new Date().toISOString().slice(0, 10);
                setStage("반납완료");
                onUpdated(record.id, { stage: "반납완료", completedAt: today });
                setSaved(p => ({ ...p, stage: true }));
                setTimeout(() => setSaved(p => ({ ...p, stage: false })), 2000);
                setReturnCompleteOpen(false);
              }}
            />
          )}

          <SaveRow label="반납예정일" field="returnDue">
            <div className="flex items-center gap-1">
              <input type="date" value={returnDue} onChange={e => setReturnDue(e.target.value)} className={`${selectCls} flex-1`} />
              {returnDue && <button type="button" onClick={() => setReturnDue("")} className="text-gray-400 hover:text-gray-600 text-lg leading-none shrink-0 px-0.5">×</button>}
            </div>
            <button onClick={() => save("returnDue", { returnDue: returnDue || null })} disabled={saving === "returnDue" || returnDue === record.returnDue} className={saveBtnCls("returnDue", returnDue, record.returnDue)}>
              {saving === "returnDue" ? "저장 중…" : "저장"}
            </button>
            {returnDue && <DDay date={returnDue} />}
          </SaveRow>

          <SaveRow label="신청사유" field="reason">
            <input value={reason} onChange={e => setReason(e.target.value)} className={selectCls + " w-56"} placeholder="신청사유" />
            <button onClick={() => save("reason", { reason })} disabled={saving === "reason" || reason === record.reason} className={saveBtnCls("reason", reason, record.reason)}>
              {saving === "reason" ? "저장 중…" : "저장"}
            </button>
          </SaveRow>

          <Row label="비고">
            <div className="flex flex-col gap-2">
              <textarea value={note}
                onChange={e => { if (!composingNote) setNote(e.target.value); }}
                onCompositionStart={() => setComposingNote(true)}
                onCompositionEnd={e => { setComposingNote(false); setNote((e.target as HTMLTextAreaElement).value); }}
                rows={3}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
                placeholder="비고 입력" />
              <div className="flex items-center gap-2">
                <button onClick={() => save("note", { note })} disabled={saving === "note" || note === record.note}
                  className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-white font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">
                  {saving === "note" ? "저장 중…" : "저장"}
                </button>
                {saved.note && <span className="text-xs text-green-600">✓ 저장됨</span>}
              </div>
            </div>
          </Row>

          {record.completedAt && <Row label="완료일">{fmtDateKo(record.completedAt)}</Row>}
          {record.stage === FINAL_STAGE && record.completedAt && (
            <Row label="총 소요일"><span className="font-semibold text-gray-700">{days}일</span></Row>
          )}

          <Row label="최근 업데이트">
            <span className="text-xs text-gray-400">
              {record.lastEditedAt ? new Date(record.lastEditedAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "—"}
            </span>
          </Row>
        </div>

        <div className="px-7 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
          {record.notionUrl ? (
            <a href={record.notionUrl} target="_blank" rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              노션에서 보기
            </a>
          ) : <span />}

          <div className="flex items-center gap-2">
            {record.isClosed && (
              <button onClick={handleReopen} disabled={reopening}
                className="text-xs font-semibold px-3 py-1.5 rounded border border-blue-200 text-blue-600 hover:bg-blue-50 disabled:opacity-50 flex items-center gap-1 transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                </svg>
                {reopening ? "처리 중…" : "케이스 다시 열기"}
              </button>
            )}
            <button onClick={handleDelete} disabled={deleting}
              className="text-xs font-semibold px-3 py-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 flex items-center gap-1 transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2"/>
              </svg>
              {deleting ? "삭제 중…" : "이력 삭제"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 신규 등록 모달 ────────────────────────────────────────────
type CreateForm = {
  type: string; assetId: string; newAssetId: string; company: string;
  department: string; user: string; stage: string; requestedAt: string; returnDue: string; reason: string; note: string;
};

const defaultStageFor = (type: string): Stage => stagesFor(type)[0];

const EMPTY_FORM: CreateForm = {
  type: "교체", assetId: "", newAssetId: "", company: "", department: "",
  user: "", stage: defaultStageFor("교체"), requestedAt: "", returnDue: "", reason: "", note: "",
};

type CreatePhase = "type" | "form" | "stock" | "detail" | "info" | "confirm" | "rt_search" | "rt_list" | "rt_fields" | "ex_search" | "ex_list" | "ex_confirm";

const TYPE_META = [
  { type: "교체",     desc: "기존 기기를 새 기기로 교체",          color: "#1D4ED8", bg: "#EFF6FF" },
  { type: "퇴사반납", desc: "반납 등록",                           color: "#B91C1C", bg: "#FEF2F2" },
  { type: "신규지급", desc: "신규 입사 또는 재고 자산 지급",        color: "#15803D", bg: "#F0FDF4" },
];

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [phase, setPhase] = useState<CreatePhase>("type");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ── 교체/퇴사반납 form state ──
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [autoFilling, setAutoFilling] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);

  // ── 신규지급 state ──
  const [niCompany, setNiCompany] = useState("");
  const [niAssets, setNiAssets] = useState<StockAsset[]>([]);
  const [niAssetsLoading, setNiAssetsLoading] = useState(false);
  const [niNewPurchasing, setNiNewPurchasing] = useState(false);
  const [niSelected, setNiSelected] = useState<StockAsset | null>(null);
  const [niDetail, setNiDetail] = useState<StockAssetDetail | null>(null);
  const [niDetailLoading, setNiDetailLoading] = useState(false);
  const [niUseDate, setNiUseDate] = useState(new Date().toISOString().slice(0, 10));
  const [niUser, setNiUser] = useState("");
  const [niDept, setNiDept] = useState("");
  const [niReason, setNiReason] = useState("");
  const [niMemo, setNiMemo] = useState("");

  // ── 퇴사반납 state ──
  const [rtCompany, setRtCompany] = useState("");
  const [rtUserName, setRtUserName] = useState("");
  const [rtAssets, setRtAssets] = useState<RtAsset[]>([]);
  const [rtLoading, setRtLoading] = useState(false);
  const [rtSelected, setRtSelected] = useState<RtAsset | null>(null);
  const [rtManualMode, setRtManualMode] = useState(false);
  const [rtManualInput, setRtManualInput] = useState("");
  const [rtManualResults, setRtManualResults] = useState<RtAsset[]>([]);
  const [rtManualLoading, setRtManualLoading] = useState(false);
  const [rtReturnDue, setRtReturnDue] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10);
  });
  const [rtReason, setRtReason] = useState("");
  const [rtNote, setRtNote] = useState("");

  // ── 교체 state ──
  const [exCompany, setExCompany] = useState("");
  const [exUserName, setExUserName] = useState("");
  const [exAssets, setExAssets] = useState<RtAsset[]>([]);
  const [exLoading, setExLoading] = useState(false);
  const [exSelected, setExSelected] = useState<RtAsset | null>(null);
  const [exManualMode, setExManualMode] = useState(false);
  const [exManualInput, setExManualInput] = useState("");
  const [exManualResults, setExManualResults] = useState<RtAsset[]>([]);
  const [exManualLoading, setExManualLoading] = useState(false);
  const [exStockAssets, setExStockAssets] = useState<StockAsset[]>([]);
  const [exStockLoading, setExStockLoading] = useState(false);
  const [exNewAsset, setExNewAsset] = useState<StockAsset | null>(null);
  const [exUseDate, setExUseDate] = useState(new Date().toISOString().slice(0, 10));
  const [exReason, setExReason] = useState("");
  const [exNote, setExNote] = useState("");
  const [exNewPurchasing, setExNewPurchasing] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 교체/퇴사반납: 자산번호 자동채움
  useEffect(() => {
    if (phase !== "form") return;
    const id = form.assetId.trim();
    if (id.length < 4) { setAutoFilled(false); return; }
    const timer = setTimeout(async () => {
      setAutoFilling(true);
      try {
        const res = await fetch(`/api/hw?search=${encodeURIComponent(id)}`);
        const data = await res.json();
        const records: { assetNo: string; user: string; dept: string; company: string }[] = data.records ?? [];
        const found = records.find(r => r.assetNo === id) ?? (records.length === 1 ? records[0] : null);
        if (found) {
          setForm(p => ({ ...p, user: found.user || p.user, department: found.dept || p.department, company: found.company || p.company }));
          setAutoFilled(true);
        } else { setAutoFilled(false); }
      } catch { /* 무시 */ } finally { setAutoFilling(false); }
    }, 600);
    return () => clearTimeout(timer);
  }, [form.assetId, phase]);

  // 신규지급: 법인 변경 시 재고 로드
  useEffect(() => {
    if (phase !== "stock" || !niCompany) { setNiAssets([]); return; }
    setNiAssetsLoading(true);
    setNiAssets([]);
    fetch(`/api/hw?company=${encodeURIComponent(niCompany)}&status=재고`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(r => r.json()).then(json => setNiAssets((json.records as any[]).map((r: any) => ({ id: r.id, assetNo: r.assetNo, model: r.model, cpu: r.cpu, ram: r.ram }))))
      .finally(() => setNiAssetsLoading(false));
  }, [niCompany, phase]);

  const selectNiAsset = (a: StockAsset) => {
    setNiSelected(a);
    setPhase("detail");
  };

  // 신규지급: 자산 선택 시 상세 정보 로드
  useEffect(() => {
    if (!niSelected) return;
    setNiDetailLoading(true);
    setNiDetail(null);
    fetch(`/api/hw?search=${encodeURIComponent(niSelected.assetNo)}`)
      .then(r => r.json())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((data: any) => {
        const r = (data.records ?? []).find((x: any) => x.assetNo === niSelected.assetNo) ?? data.records?.[0] ?? null;
        if (r) setNiDetail({ id: r.id, assetNo: r.assetNo, model: r.model, cpu: r.cpu, ram: r.ram, serial: r.serial, maker: r.maker, company: r.company, dept: r.dept, user: r.user, status: r.status, location: r.location, useDate: r.useDate, returnDue: r.returnDue, purchaseDate: r.purchaseDate, docNo: r.docNo, note: r.note, notionUrl: r.notionUrl });
      })
      .finally(() => setNiDetailLoading(false));
  }, [niSelected]);


  const set = (k: keyof CreateForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const v = e.target.value;
    if (k === "type") { setForm(p => ({ ...p, type: v, stage: defaultStageFor(v) })); return; }
    setForm(p => ({ ...p, [k]: v }));
  };

  // 교체/퇴사반납 등록
  const handleSubmit = async () => {
    if (!form.assetId.trim()) { setErr("자산번호를 입력해주세요."); return; }
    setSaving(true); setErr(null);
    try {
      const res = await fetch("/api/exchange-return/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.ok) { setErr(json.error ?? "등록 실패"); return; }
      const hwStatus = form.type === "퇴사반납" ? "반납예정" : form.type === "교체" ? "교체요청" : null;
      if (hwStatus) {
        const assetId = form.assetId.trim();
        fetch(`/api/hw?search=${encodeURIComponent(assetId)}`).then(r => r.json()).then(data => {
          const records: { id: string; assetNo: string }[] = data.records ?? [];
          const found = records.find(r => r.assetNo === assetId) ?? (records.length === 1 ? records[0] : null);
          if (found) fetch("/api/hw/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: found.id, fields: { status: hwStatus } }) }).catch(console.error);
        }).catch(console.error);
      }
      onCreated(); onClose();
    } catch (e) { setErr(String(e)); } finally { setSaving(false); }
  };

  // 신규지급 — 신규 구매로 안내 (재고 없을 때)
  const handleNewPurchaseNi = async () => {
    setNiNewPurchasing(true); setErr(null);
    try {
      const res = await fetch("/api/exchange-return/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "신규지급", assetId: "", newAssetId: "신규구매로안내됨",
          company: niCompany, department: niDept, user: niUser,
          stage: "요청기안", requestedAt: new Date().toISOString().slice(0, 10),
          note: niMemo || undefined, reason: niReason || undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) { setErr(json.error ?? "등록 실패"); return; }
      onCreated(); onClose();
    } catch (e) { setErr(String(e)); } finally { setNiNewPurchasing(false); }
  };

  // 신규지급 등록 확정
  const handleCreateNewIssue = async () => {
    if (!niSelected || !niUseDate) return;
    setSaving(true); setErr(null);
    try {
      const res = await fetch("/api/exchange-return/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "신규지급", assetId: "", newAssetId: niSelected.assetNo,
          company: niCompany, department: niDept, user: niUser,
          stage: "기기준비", requestedAt: new Date().toISOString().slice(0, 10),
          completedAt: niUseDate, note: niMemo || undefined, reason: niReason || undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) { setErr(json.error ?? "등록 실패"); return; }
      await fetch("/api/hw/update", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: niSelected.id, fields: { status: "출고준비중", user: niUser, dept: niDept, useDate: niUseDate } }),
      });
      fetch("/api/hw/dispatch-history", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify([{
          id: crypto.randomUUID(),
          dispatchedAt: new Date().toISOString(),
          type: "재고",
          assetNo: niSelected.assetNo || "",
          model: niSelected.model || "",
          serial: niDetail?.serial || "",
          user: niUser || "",
          company: niCompany || "",
          dept: niDept || "",
          useDate: niUseDate || "",
        }]),
      }).catch(console.error);
      onCreated(); onClose();
    } catch (e) { setErr(String(e)); } finally { setSaving(false); }
  };

  // 교체: 법인+이름 검색
  const handleExSearch = async () => {
    if (!exCompany || !exUserName.trim()) return;
    setExLoading(true); setExAssets([]);
    try {
      const res = await fetch(`/api/hw?company=${encodeURIComponent(exCompany)}&search=${encodeURIComponent(exUserName.trim())}`);
      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped = (data.records ?? []).map((r: any) => ({
        id: r.id, assetNo: r.assetNo, model: r.model, cpu: r.cpu, ram: r.ram,
        serial: r.serial, dept: r.dept, user: r.user, status: r.status, company: r.company,
      }));
      setExAssets(mapped);
      if (mapped.length === 0) setExManualMode(true);
      setPhase("ex_list");
    } finally { setExLoading(false); }
  };

  // 교체: 수동 자산번호 검색
  const handleExManualSearch = async () => {
    const q = exManualInput.trim();
    if (!q) return;
    setExManualLoading(true); setExManualResults([]);
    try {
      const res = await fetch(`/api/hw?search=${encodeURIComponent(q)}`);
      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setExManualResults((data.records ?? []).map((r: any) => ({
        id: r.id, assetNo: r.assetNo, model: r.model, cpu: r.cpu, ram: r.ram,
        serial: r.serial, dept: r.dept, user: r.user, status: r.status, company: r.company,
      })));
    } finally { setExManualLoading(false); }
  };

  // 교체: 기존 자산 선택
  const selectExAsset = (a: RtAsset) => {
    setExSelected(a);
    setPhase("ex_confirm");
  };

  // 교체: 신규 구매로 안내
  const handleExNewPurchase = async () => {
    if (!exSelected) return;
    setExNewPurchasing(true); setErr(null);
    try {
      const res = await fetch("/api/exchange-return/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "교체", assetId: exSelected.assetNo, newAssetId: "신규구매로안내됨",
          company: exCompany, department: exSelected.dept, user: exUserName || exSelected.user,
          stage: "교체요청", requestedAt: new Date().toISOString().slice(0, 10),
        }),
      });
      const json = await res.json();
      if (!json.ok) { setErr(json.error ?? "등록 실패"); return; }
      fetch("/api/hw/update", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: exSelected.id, fields: { status: "교체요청" } }),
      }).catch(console.error);
      onCreated(); onClose();
    } catch (e) { setErr(String(e)); } finally { setExNewPurchasing(false); }
  };

  // 교체 등록 확정
  const handleExSubmit = async () => {
    if (!exSelected) return;
    setSaving(true); setErr(null);
    try {
      const res = await fetch("/api/exchange-return/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "교체", assetId: exSelected.assetNo,
          company: exCompany, department: exSelected.dept, user: exUserName || exSelected.user,
          stage: "교체요청", requestedAt: new Date().toISOString().slice(0, 10),
          reason: exReason || undefined, note: exNote || undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) { setErr(json.error ?? "등록 실패"); return; }
      await fetch("/api/hw/update", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: exSelected.id, fields: { status: "교체요청" } }),
      });
      onCreated(); onClose();
    } catch (e) { setErr(String(e)); } finally { setSaving(false); }
  };

  // 퇴사반납: 법인+이름 검색
  const handleRtSearch = async () => {
    if (!rtCompany) return;
    setRtLoading(true); setRtAssets([]);
    try {
      const params = new URLSearchParams({ company: rtCompany });
      if (rtUserName.trim()) params.set("search", rtUserName.trim());
      const res = await fetch(`/api/hw?${params}`);
      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped = (data.records ?? []).map((r: any) => ({
        id: r.id, assetNo: r.assetNo, model: r.model, cpu: r.cpu, ram: r.ram,
        serial: r.serial, dept: r.dept, user: r.user, status: r.status, company: r.company,
      }));
      setRtAssets(mapped);
      if (mapped.length === 0) setRtManualMode(true);
      setPhase("rt_list");
    } finally { setRtLoading(false); }
  };

  // 퇴사반납: 수동 자산번호 검색
  const handleRtManualSearch = async () => {
    const q = rtManualInput.trim();
    if (!q) return;
    setRtManualLoading(true); setRtManualResults([]);
    try {
      const res = await fetch(`/api/hw?search=${encodeURIComponent(q)}`);
      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setRtManualResults((data.records ?? []).map((r: any) => ({
        id: r.id, assetNo: r.assetNo, model: r.model, cpu: r.cpu, ram: r.ram,
        serial: r.serial, dept: r.dept, user: r.user, status: r.status, company: r.company,
      })));
    } finally { setRtManualLoading(false); }
  };

  // 퇴사반납 등록
  const handleRtSubmit = async () => {
    if (!rtSelected) return;
    setSaving(true); setErr(null);
    try {
      const res = await fetch("/api/exchange-return/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "퇴사반납",
          assetId: rtSelected.assetNo,
          company: rtCompany,
          department: rtSelected.dept,
          user: rtUserName || rtSelected.user,
          stage: "반납요청",
          requestedAt: new Date().toISOString().slice(0, 10),
          returnDue: rtReturnDue || undefined,
          reason: rtReason || undefined,
          note: rtNote || undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) { setErr(json.error ?? "등록 실패"); return; }
      await fetch("/api/hw/update", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rtSelected.id, fields: { status: "반납예정", ...(rtReturnDue ? { returnDue: rtReturnDue } : {}) } }),
      });
      onCreated(); onClose();
    } catch (e) { setErr(String(e)); } finally { setSaving(false); }
  };

  const inputCls = "w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white";
  const labelCls = "text-xs text-gray-400 mb-1 block";

  const PHASE_TITLE: Record<CreatePhase, string> = {
    type: "신규 등록 — 유형 선택",
    form: `신규 등록 — ${form.type}`,
    info: "사용자 정보 입력",
    stock: "재고 자산 선택",
    detail: "자산 상세 정보",
    confirm: "최종 확인",
    rt_search: "퇴사 반납 — 사원 조회",
    rt_list: "퇴사 반납 — 자산 선택",
    rt_fields: "퇴사 반납 — 반납 정보 입력",
    ex_search: "교체 — 사원 조회",
    ex_list: "교체 — 기존 자산 선택",
    ex_confirm: "교체 — 등록 정보 입력",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        style={{ maxHeight: "90vh", display: "flex", flexDirection: "column" }}
        onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-gray-900 text-base">{PHASE_TITLE[phase]}</h3>
            {phase === "info" && <p className="text-xs text-gray-400 mt-0.5">신규지급 · 사용자 정보 및 법인을 먼저 입력해주세요</p>}
          {phase === "stock" && <p className="text-xs text-gray-400 mt-0.5">신규지급 · {niCompany} 재고 자산 선택</p>}
            {(phase === "detail" || phase === "info" || phase === "confirm") && niSelected && (
              <p className="text-xs text-gray-400 mt-0.5">{niSelected.assetNo} · {niSelected.model || "—"}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">×</button>
        </div>

        {/* ── Phase: type ── */}
        {phase === "type" && (
          <div className="px-6 py-8 flex flex-col gap-3 overflow-y-auto flex-1">
            {TYPE_META.map(({ type, desc, color, bg }) => (
              <button key={type} onClick={() => {
                if (type === "신규지급") {
                  setPhase("info");
                } else if (type === "퇴사반납") {
                  setRtCompany(""); setRtUserName(""); setRtAssets([]);
                  setRtSelected(null); setRtManualMode(false); setRtManualInput(""); setRtManualResults([]);
                  setPhase("rt_search");
                } else if (type === "교체") {
                  setExCompany(""); setExUserName(""); setExAssets([]);
                  setExSelected(null); setExManualMode(false); setExManualInput(""); setExManualResults([]);
                  setExNewAsset(null); setExReason(""); setExNote("");
                  setExUseDate(new Date().toISOString().slice(0, 10));
                  setPhase("ex_search");
                } else {
                  setForm(p => ({ ...p, type, stage: defaultStageFor(type) }));
                  setPhase("form");
                }
              }} className="flex items-center gap-4 p-4 rounded-xl border-2 border-transparent hover:border-current text-left transition-all"
                style={{ background: bg, color }}>
                <div className="flex flex-col gap-0.5 flex-1">
                  <span className="font-bold text-sm">{type}</span>
                  <span className="text-xs opacity-70">{desc}</span>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
            ))}
          </div>
        )}

        {/* ── Phase: form (교체/퇴사반납) ── */}
        {phase === "form" && (
          <>
            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>현재단계</label>
                  <select className={inputCls} value={form.stage} onChange={set("stage")}>
                    {stagesFor(form.type).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>신청일</label>
                  <div className="flex items-center gap-1">
                    <input type="date" className={`${inputCls} flex-1`} value={form.requestedAt} onChange={set("requestedAt")} />
                    {form.requestedAt && <button type="button" onClick={() => setForm(p => ({ ...p, requestedAt: "" }))} className="text-gray-400 hover:text-gray-600 text-lg leading-none shrink-0 px-0.5">×</button>}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={labelCls} style={{ margin: 0 }}>자산번호 <span className="text-red-500">*</span></label>
                  {autoFilling && (
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                      <svg className="animate-spin w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25"/><path d="M21 12a9 9 0 00-9-9"/>
                      </svg>
                      조회 중…
                    </span>
                  )}
                  {!autoFilling && autoFilled && <span className="text-[10px] text-green-500">✓ 자동입력 완료</span>}
                </div>
                <input className={inputCls} placeholder="예) DW-NB-0123" value={form.assetId} onChange={set("assetId")} autoFocus />
              </div>

              {form.type === "교체" && (
                <div>
                  <label className={labelCls}>교체 자산번호</label>
                  <input className={inputCls} placeholder="교체될 새 자산번호" value={form.newAssetId} onChange={set("newAssetId")} />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>법인</label>
                  <select className={inputCls} value={form.company} onChange={set("company")}>
                    <option value="">선택 안 함</option>
                    {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>부서</label>
                  <input className={inputCls} placeholder="부서명" value={form.department} onChange={set("department")} />
                </div>
              </div>

              <div>
                <label className={labelCls}>사용자</label>
                <input className={inputCls} placeholder="사용자 이름" value={form.user} onChange={set("user")} />
              </div>

              {form.type === "퇴사반납" && (
                <div>
                  <label className={labelCls}>반납예정일</label>
                  <div className="flex items-center gap-1">
                    <input type="date" className={`${inputCls} flex-1`} value={form.returnDue} onChange={set("returnDue")} />
                    {form.returnDue && <button type="button" onClick={() => setForm(p => ({ ...p, returnDue: "" }))} className="text-gray-400 hover:text-gray-600 text-lg leading-none shrink-0 px-0.5">×</button>}
                  </div>
                </div>
              )}

              <div>
                <label className={labelCls}>신청사유</label>
                <input className={inputCls} placeholder="신청사유를 입력하세요" value={form.reason} onChange={set("reason")} />
              </div>

              <div>
                <label className={labelCls}>비고</label>
                <textarea className={inputCls} rows={3} placeholder="비고 메모..." value={form.note} onChange={set("note")} style={{ resize: "vertical" }} />
              </div>

              {err && <p className="text-xs text-red-600">{err}</p>}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-between gap-2 shrink-0">
              <button onClick={() => setPhase("type")} className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">뒤로</button>
              <button onClick={handleSubmit} disabled={saving}
                className="text-sm px-5 py-2 rounded-lg bg-gray-900 text-white font-semibold hover:bg-gray-700 disabled:opacity-40 transition-colors">
                {saving ? "등록 중..." : "등록"}
              </button>
            </div>
          </>
        )}

        {/* ── Phase: info (신규지급 — 사용자 정보 + 법인 선택) ── */}
        {phase === "info" && (
          <>
            <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto flex-1">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-500 font-medium">법인 <span className="text-red-500">*</span></label>
                <select value={niCompany} onChange={e => setNiCompany(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-200 w-full bg-white">
                  <option value="">선택...</option>
                  {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-gray-500 font-medium">사용자</label>
                  <input value={niUser} onChange={e => setNiUser(e.target.value)}
                    placeholder="사용자 이름" autoFocus
                    className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-200 w-full" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-gray-500 font-medium">부서</label>
                  <input value={niDept} onChange={e => setNiDept(e.target.value)}
                    placeholder="부서명"
                    className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-200 w-full" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-500 font-medium">사용일자</label>
                <div className="flex items-center gap-1">
                  <input type="date" value={niUseDate} onChange={e => setNiUseDate(e.target.value)}
                    className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-200 flex-1" />
                  {niUseDate && <button type="button" onClick={() => setNiUseDate("")} className="text-gray-400 hover:text-gray-600 text-lg leading-none shrink-0 px-0.5">×</button>}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-500 font-medium">신청사유</label>
                <input value={niReason} onChange={e => setNiReason(e.target.value)}
                  placeholder="신청사유 (선택)"
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-200 w-full" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-500 font-medium">메모</label>
                <textarea value={niMemo} onChange={e => setNiMemo(e.target.value)} rows={3}
                  placeholder="기안자 : XXX, 기타 특이사항 등..."
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-200 w-full resize-none" />
              </div>
            </div>
            <div className="shrink-0 px-6 py-4 border-t border-gray-100 flex gap-2 justify-between">
              <button onClick={() => setPhase("type")}
                className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">뒤로</button>
              <button onClick={() => setPhase("stock")} disabled={!niCompany}
                className="text-sm px-5 py-2 rounded-lg bg-gray-900 text-white font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">
                재고 자산 선택 →
              </button>
            </div>
          </>
        )}

        {/* ── Phase: stock (신규지급 재고 목록) ── */}
        {phase === "stock" && (
          <>
            <div className="px-6 py-2.5 border-b border-gray-100 shrink-0 flex items-center gap-2">
              <span className="text-xs text-gray-400">법인</span>
              <span className="text-xs font-semibold text-gray-700">{niCompany}</span>
              <span className="text-xs text-gray-300 mx-1">·</span>
              <span className="text-xs text-gray-400">사용자</span>
              <span className="text-xs font-semibold text-gray-700">{niUser || "—"}</span>
            </div>

            <div className="overflow-y-auto flex-1">
              {niAssetsLoading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  <span className="text-sm">재고 목록 불러오는 중...</span>
                </div>
              ) : niAssets.length === 0 ? (
                <p className="text-center text-gray-400 py-12 text-sm">{niCompany} 법인에 재고 자산이 없습니다.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left text-xs text-gray-400 font-medium px-4 py-2.5">자산번호</th>
                      <th className="text-left text-xs text-gray-400 font-medium px-4 py-2.5">모델명</th>
                      <th className="text-left text-xs text-gray-400 font-medium px-4 py-2.5">CPU</th>
                      <th className="text-left text-xs text-gray-400 font-medium px-4 py-2.5">RAM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {niAssets.map(a => (
                      <tr key={a.id} onClick={() => selectNiAsset(a)}
                        className="border-b border-gray-50 hover:bg-green-50 cursor-pointer transition-colors">
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{a.assetNo || "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-800">{a.model || "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">{a.cpu || "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">{a.ram || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="shrink-0 px-4 py-3 border-t border-dashed border-gray-200 bg-gray-50">
              <button onClick={handleNewPurchaseNi} disabled={niNewPurchasing}
                className="w-full text-xs text-gray-400 hover:text-amber-600 hover:bg-amber-50 border border-dashed border-gray-200 hover:border-amber-300 rounded-lg px-4 py-2.5 flex items-center justify-center gap-2 transition-colors disabled:opacity-40">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                  <path d="M1 1h4l2.68 13.39a2 2 0 001.99 1.61h9.72a2 2 0 001.99-1.61L23 6H6"/>
                </svg>
                {niNewPurchasing ? "처리 중…" : "재고 없음 · 신규 구매로 안내"}
              </button>
            </div>
            <div className="shrink-0 px-6 py-3 border-t border-gray-100 flex justify-start">
              <button onClick={() => setPhase("info")} className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">뒤로</button>
            </div>
          </>
        )}

        {/* ── Phase: detail (자산 상세) ── */}
        {phase === "detail" && (
          <>
            <div className="overflow-y-auto flex-1 px-6 py-4">
              {niDetailLoading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  <span className="text-sm">정보 불러오는 중...</span>
                </div>
              ) : niDetail ? (
                <div className="space-y-3">
                  {[
                    ["자산번호", niDetail.assetNo], ["모델명", niDetail.model], ["제조사", niDetail.maker],
                    ["CPU", niDetail.cpu], ["RAM", niDetail.ram], ["시리얼", niDetail.serial],
                    ["법인", niDetail.company], ["위치", niDetail.location], ["상태", niDetail.status],
                    ["구매일자", niDetail.purchaseDate], ["결재문서번호", niDetail.docNo],
                  ].map(([label, value]) => value ? (
                    <div key={label} className="flex items-start gap-3 text-xs">
                      <span className="text-gray-400 w-24 shrink-0">{label}</span>
                      <span className="text-gray-800 font-medium break-all">{value}</span>
                    </div>
                  ) : null)}
                  {niDetail.notionUrl && (
                    <a href={niDetail.notionUrl} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-green-600 hover:underline mt-1">
                      노션에서 보기 ↗
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-center text-gray-400 py-8 text-sm">상세 정보를 불러올 수 없습니다.</p>
              )}
            </div>
            <div className="shrink-0 px-6 py-4 border-t border-gray-100 flex gap-2 justify-end">
              <button onClick={() => { setPhase("stock"); setNiSelected(null); setNiDetail(null); }}
                className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">뒤로</button>
              <button onClick={() => setPhase("confirm")} disabled={niDetailLoading}
                className="text-sm px-5 py-2 rounded-lg bg-gray-900 text-white font-medium hover:bg-gray-700 disabled:opacity-40">다음</button>
            </div>
          </>
        )}

        {/* ── Phase: confirm ── */}
        {phase === "confirm" && (
          <>
            <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto flex-1">
              <div className="bg-orange-50 rounded-xl p-4 text-xs text-orange-800 space-y-2">
                <p className="font-semibold">등록 확정 시 자동 적용 사항</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>지급 자산 <strong>{niSelected?.assetNo}</strong> → HW DB 상태: <strong>출고준비중</strong></li>
                  <li>법인 → <strong>{niCompany || "—"}</strong></li>
                  <li>사용자 → <strong>{niUser || "—"}</strong> / 부서 → <strong>{niDept || "—"}</strong></li>
                  <li>트래커 단계 → <strong>기기준비</strong></li>
                  <li>사용일자 → <strong>{niUseDate}</strong></li>
                  {niReason && <li>신청사유 → <strong>{niReason}</strong></li>}
                  {niMemo && <li>메모 → <strong>{niMemo}</strong></li>}
                </ul>
              </div>
              {err && <p className="text-xs text-red-600">⚠️ {err}</p>}
            </div>
            <div className="shrink-0 px-6 py-4 border-t border-gray-100 flex gap-2 justify-end">
              <button onClick={() => setPhase("info")}
                className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">뒤로</button>
              <button onClick={handleCreateNewIssue} disabled={saving}
                className="text-sm px-5 py-2 rounded-lg bg-orange-500 text-white font-semibold hover:bg-orange-600 disabled:opacity-40">
                {saving ? "등록 중…" : "등록 확정"}
              </button>
            </div>
          </>
        )}

        {/* ── Phase: rt_search (퇴사반납 — 법인+이름 검색) ── */}
        {phase === "rt_search" && (
          <>
            <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto flex-1">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-500 font-medium">법인 <span className="text-red-500">*</span></label>
                <select value={rtCompany} onChange={e => setRtCompany(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-200 w-full bg-white">
                  <option value="">선택...</option>
                  {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-500 font-medium">퇴사자 이름 <span className="text-red-500">*</span></label>
                <input value={rtUserName} onChange={e => setRtUserName(e.target.value)}
                  placeholder="이름 입력"
                  autoFocus
                  onKeyDown={e => { if (e.key === "Enter" && rtCompany && rtUserName.trim()) handleRtSearch(); }}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-200 w-full" />
              </div>
            </div>
            <div className="shrink-0 px-6 py-4 border-t border-gray-100 flex gap-2 justify-between">
              <button onClick={() => setPhase("type")}
                className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">뒤로</button>
              <button onClick={handleRtSearch} disabled={!rtCompany || !rtUserName.trim() || rtLoading}
                className="text-sm px-5 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-40 flex items-center gap-2">
                {rtLoading && (
                  <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                )}
                {rtLoading ? "검색 중…" : "검색"}
              </button>
            </div>
          </>
        )}

        {/* ── Phase: rt_list (퇴사반납 — 자산 리스트) ── */}
        {phase === "rt_list" && (
          <>
            <div className="px-4 py-2 border-b border-gray-100 shrink-0 flex items-center gap-2">
              <span className="text-xs text-gray-400">법인</span>
              <span className="text-xs font-semibold text-gray-700">{rtCompany}</span>
              {rtUserName && (
                <><span className="text-xs text-gray-300 mx-1">·</span>
                <span className="text-xs text-gray-400">이름</span>
                <span className="text-xs font-semibold text-gray-700">{rtUserName}</span></>
              )}
            </div>

            <div className="overflow-y-auto flex-1">
              {rtAssets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <p className="text-gray-500 text-sm font-medium">이름으로 조회된 자산이 없습니다.</p>
                  <p className="text-gray-400 text-xs">{rtCompany} · {rtUserName}</p>
                  <p className="text-gray-400 text-xs mt-1">아래에서 자산번호로 직접 검색해 주세요.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left text-xs text-gray-400 font-medium px-4 py-2.5">자산번호</th>
                      <th className="text-left text-xs text-gray-400 font-medium px-4 py-2.5">모델명</th>
                      <th className="text-left text-xs text-gray-400 font-medium px-4 py-2.5">사용자</th>
                      <th className="text-left text-xs text-gray-400 font-medium px-4 py-2.5">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rtAssets.map(a => (
                      <tr key={a.id} onClick={() => { setRtSelected(a); setPhase("rt_fields"); }}
                        className="border-b border-gray-50 hover:bg-red-50 cursor-pointer transition-colors">
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{a.assetNo || "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-800">{a.model || "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-600">{a.user || "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">{a.status || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {rtManualMode && (
                <div className="border-t border-dashed border-gray-200 px-4 py-3 space-y-2">
                  <p className="text-xs text-gray-500 font-medium">자산번호 수동 입력</p>
                  <div className="flex gap-2">
                    <input value={rtManualInput} onChange={e => setRtManualInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleRtManualSearch(); }}
                      placeholder="예) DW-NB-0123"
                      autoFocus
                      className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-200" />
                    <button onClick={handleRtManualSearch} disabled={rtManualLoading || !rtManualInput.trim()}
                      className="text-sm px-3 py-1.5 rounded-lg bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-40">
                      {rtManualLoading ? "…" : "검색"}
                    </button>
                  </div>
                  {rtManualResults.length > 0 && (
                    <table className="w-full text-sm mt-1">
                      <tbody>
                        {rtManualResults.map(a => (
                          <tr key={a.id} onClick={() => { setRtSelected(a); setPhase("rt_fields"); }}
                            className="border-b border-gray-50 hover:bg-red-50 cursor-pointer transition-colors">
                            <td className="px-2 py-2 font-mono text-xs text-gray-700">{a.assetNo || "—"}</td>
                            <td className="px-2 py-2 text-xs text-gray-800">{a.model || "—"}</td>
                            <td className="px-2 py-2 text-xs text-gray-600">{a.user || "—"}</td>
                            <td className="px-2 py-2 text-xs text-gray-500">{a.status || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>

            <div className="shrink-0 px-4 py-3 border-t border-dashed border-gray-200 bg-gray-50">
              <button
                onClick={() => { setRtManualMode(m => !m); setRtManualInput(""); setRtManualResults([]); }}
                className="w-full text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 border border-dashed border-gray-200 hover:border-red-300 rounded-lg px-4 py-2.5 flex items-center justify-center gap-2 transition-colors">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                {rtManualMode ? "수동 입력 닫기" : "리스트에 없음 · 자산번호 수동 입력"}
              </button>
            </div>
            <div className="shrink-0 px-6 py-3 border-t border-gray-100 flex justify-start">
              <button onClick={() => setPhase("rt_search")}
                className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">뒤로</button>
            </div>
          </>
        )}

        {/* ── Phase: ex_search (교체 — 법인+이름 검색) ── */}
        {phase === "ex_search" && (
          <>
            <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto flex-1">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-500 font-medium">법인 <span className="text-red-500">*</span></label>
                <select value={exCompany} onChange={e => setExCompany(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 w-full bg-white">
                  <option value="">선택...</option>
                  {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-500 font-medium">사용자 이름 <span className="text-red-500">*</span></label>
                <input value={exUserName} onChange={e => setExUserName(e.target.value)}
                  placeholder="이름 입력"
                  autoFocus
                  onKeyDown={e => { if (e.key === "Enter" && exCompany && exUserName.trim()) handleExSearch(); }}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 w-full" />
              </div>
            </div>
            <div className="shrink-0 px-6 py-4 border-t border-gray-100 flex gap-2 justify-between">
              <button onClick={() => setPhase("type")}
                className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">뒤로</button>
              <button onClick={handleExSearch} disabled={!exCompany || !exUserName.trim() || exLoading}
                className="text-sm px-5 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-40 flex items-center gap-2">
                {exLoading && (
                  <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                )}
                {exLoading ? "검색 중…" : "검색"}
              </button>
            </div>
          </>
        )}

        {/* ── Phase: ex_list (교체 — 기존 자산 선택) ── */}
        {phase === "ex_list" && (
          <>
            <div className="px-4 py-2 border-b border-gray-100 shrink-0 flex items-center gap-2">
              <span className="text-xs text-gray-400">법인</span>
              <span className="text-xs font-semibold text-gray-700">{exCompany}</span>
              <span className="text-xs text-gray-300 mx-1">·</span>
              <span className="text-xs text-gray-400">이름</span>
              <span className="text-xs font-semibold text-gray-700">{exUserName}</span>
            </div>

            <div className="overflow-y-auto flex-1">
              {exAssets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <p className="text-gray-500 text-sm font-medium">이름으로 조회된 자산이 없습니다.</p>
                  <p className="text-gray-400 text-xs">{exCompany} · {exUserName}</p>
                  <p className="text-gray-400 text-xs mt-1">아래에서 자산번호로 직접 검색해 주세요.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left text-xs text-gray-400 font-medium px-4 py-2.5">자산번호</th>
                      <th className="text-left text-xs text-gray-400 font-medium px-4 py-2.5">모델명</th>
                      <th className="text-left text-xs text-gray-400 font-medium px-4 py-2.5">사용자</th>
                      <th className="text-left text-xs text-gray-400 font-medium px-4 py-2.5">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exAssets.map(a => (
                      <tr key={a.id} onClick={() => selectExAsset(a)}
                        className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors">
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{a.assetNo || "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-800">{a.model || "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-600">{a.user || "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">{a.status || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {exManualMode && (
                <div className="border-t border-dashed border-gray-200 px-4 py-3 space-y-2">
                  <p className="text-xs text-gray-500 font-medium">자산번호 수동 입력</p>
                  <div className="flex gap-2">
                    <input value={exManualInput} onChange={e => setExManualInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleExManualSearch(); }}
                      placeholder="예) DW-NB-0123"
                      autoFocus
                      className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                    <button onClick={handleExManualSearch} disabled={exManualLoading || !exManualInput.trim()}
                      className="text-sm px-3 py-1.5 rounded-lg bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-40">
                      {exManualLoading ? "…" : "검색"}
                    </button>
                  </div>
                  {exManualResults.length > 0 && (
                    <table className="w-full text-sm mt-1">
                      <tbody>
                        {exManualResults.map(a => (
                          <tr key={a.id} onClick={() => selectExAsset(a)}
                            className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors">
                            <td className="px-2 py-2 font-mono text-xs text-gray-700">{a.assetNo || "—"}</td>
                            <td className="px-2 py-2 text-xs text-gray-800">{a.model || "—"}</td>
                            <td className="px-2 py-2 text-xs text-gray-600">{a.user || "—"}</td>
                            <td className="px-2 py-2 text-xs text-gray-500">{a.status || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>

            <div className="shrink-0 px-4 py-3 border-t border-dashed border-gray-200 bg-gray-50">
              <button
                onClick={() => { setExManualMode(m => !m); setExManualInput(""); setExManualResults([]); }}
                className="w-full text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 border border-dashed border-gray-200 hover:border-blue-300 rounded-lg px-4 py-2.5 flex items-center justify-center gap-2 transition-colors">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                {exManualMode ? "수동 입력 닫기" : "리스트에 없음 · 자산번호 수동 입력"}
              </button>
            </div>
            <div className="shrink-0 px-6 py-3 border-t border-gray-100 flex justify-start">
              <button onClick={() => setPhase("ex_search")}
                className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">뒤로</button>
            </div>
          </>
        )}

        {/* ── Phase: ex_confirm (교체 — 등록 정보 입력) ── */}
        {phase === "ex_confirm" && exSelected && (
          <>
            <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto flex-1">
              <div className="bg-blue-50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-blue-800">교체 정보</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <span className="text-blue-400">기존 자산</span><span className="text-blue-900 font-mono font-medium">{exSelected.assetNo}</span>
                  <span className="text-blue-400">모델명</span><span className="text-blue-900 font-medium">{exSelected.model || "—"}</span>
                  <span className="text-blue-400">사용자</span><span className="text-blue-900 font-medium">{exUserName || exSelected.user || "—"}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-500 font-medium">신청사유</label>
                <input value={exReason} onChange={e => setExReason(e.target.value)}
                  placeholder="신청사유를 입력하세요"
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 w-full" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-500 font-medium">비고</label>
                <textarea value={exNote} onChange={e => setExNote(e.target.value)} rows={3}
                  placeholder="기안자 : XXX, 기타 특이사항 등..."
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 w-full resize-none" />
              </div>
              {err && <p className="text-xs text-red-600">⚠️ {err}</p>}
            </div>
            <div className="shrink-0 px-6 py-4 border-t border-gray-100 flex gap-2 justify-between">
              <button onClick={() => { setExSelected(null); setPhase("ex_list"); }}
                className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">뒤로</button>
              <button onClick={handleExSubmit} disabled={saving}
                className="text-sm px-5 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-40">
                {saving ? "등록 중…" : "등록 확정"}
              </button>
            </div>
          </>
        )}

        {/* ── Phase: rt_fields (퇴사반납 — 반납 정보) ── */}
        {phase === "rt_fields" && rtSelected && (
          <>
            <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto flex-1">
              <div className="bg-red-50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-red-800">선택된 자산</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <span className="text-red-400">자산번호</span><span className="text-red-900 font-mono font-medium">{rtSelected.assetNo}</span>
                  <span className="text-red-400">모델명</span><span className="text-red-900 font-medium">{rtSelected.model || "—"}</span>
                  <span className="text-red-400">사용자</span><span className="text-red-900 font-medium">{rtSelected.user || "—"}</span>
                  <span className="text-red-400">부서</span><span className="text-red-900 font-medium">{rtSelected.dept || "—"}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-500 font-medium">반납예정일</label>
                <div className="flex items-center gap-1">
                  <input type="date" value={rtReturnDue} onChange={e => setRtReturnDue(e.target.value)}
                    className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-200 flex-1" />
                  {rtReturnDue && <button type="button" onClick={() => setRtReturnDue("")} className="text-gray-400 hover:text-gray-600 text-lg leading-none shrink-0 px-0.5">×</button>}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-500 font-medium">신청사유</label>
                <input value={rtReason} onChange={e => setRtReason(e.target.value)}
                  placeholder="신청사유를 입력하세요"
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-200 w-full" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-500 font-medium">비고</label>
                <textarea value={rtNote} onChange={e => setRtNote(e.target.value)} rows={3}
                  placeholder="비고 메모..."
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-200 w-full resize-none" />
              </div>
              {err && <p className="text-xs text-red-600">⚠️ {err}</p>}
            </div>
            <div className="shrink-0 px-6 py-4 border-t border-gray-100 flex gap-2 justify-between">
              <button onClick={() => { setRtSelected(null); setPhase("rt_list"); }}
                className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">뒤로</button>
              <button onClick={handleRtSubmit} disabled={saving}
                className="text-sm px-5 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-40">
                {saving ? "등록 중…" : "등록"}
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

// ── 메인 패널 ─────────────────────────────────────────────────
export default function ExchangeReturnPanel() {
  const [records, setRecords] = useState<ExchangeReturnRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missingEnv, setMissingEnv] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [caseTab, setCaseTab] = useState<"open" | "closed">("open");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ExchangeReturnRecord | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const [pickerTarget, setPickerTarget] = useState<ExchangeReturnRecord | null>(null);
  const [receiptTarget, setReceiptTarget] = useState<ExchangeReturnRecord | null>(null);
  const [returnCompleteTarget, setReturnCompleteTarget] = useState<ExchangeReturnRecord | null>(null);
  const [hwDetailAsset, setHwDetailAsset] = useState<string | null>(null);

  const handleUpdated = useCallback((id: string, fields: Partial<ExchangeReturnRecord>) => {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, ...fields } : r));
    setSelected(prev => prev?.id === id ? { ...prev, ...fields } : prev);
  }, []);

  const handleDeleted = useCallback((id: string) => {
    setRecords(prev => prev.filter(r => r.id !== id));
    setSelected(prev => prev?.id === id ? null : prev);
  }, []);

  const handleCloseCase = useCallback(async (id: string) => {
    setAdvancingId(id);
    try {
      const res = await fetch("/api/exchange-return/update", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, fields: { isClosed: true } }),
      });
      const json = await res.json();
      if (json.ok) handleUpdated(id, { isClosed: true });
    } finally { setAdvancingId(null); }
  }, [handleUpdated]);

  const handleAdvanceStage = useCallback(async (r: ExchangeReturnRecord) => {
    const visible = stagesFor(r.type);
    const idx = visible.indexOf(r.stage as Stage);
    if (idx === -1) return;
    // 마지막 단계에서 "다음" = 케이스 종료
    if (idx === visible.length - 1) {
      await handleCloseCase(r.id);
      return;
    }
    const nextStage = visible[idx + 1];
    if (nextStage === "사용자수령") {
      setReceiptTarget(r);
      return;
    }
    if (nextStage === "반납완료") {
      setReturnCompleteTarget(r);
      return;
    }
    if (nextStage === "기기준비완료" && r.newAssetId && r.newAssetId !== "신규구매로안내됨") {
      setAdvancingId(r.id);
      try {
        const res = await fetch("/api/exchange-return/update", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: r.id, fields: { stage: "기기준비완료" } }),
        });
        const json = await res.json();
        if (json.ok) {
          handleUpdated(r.id, { stage: "기기준비완료" });
          const assetId = r.newAssetId;
          fetch(`/api/hw?search=${encodeURIComponent(assetId)}`)
            .then(d => d.json())
            .then(data => {
              const recs: { id: string; assetNo: string }[] = data.records ?? [];
              const found = recs.find(rec => rec.assetNo === assetId) ?? (recs.length === 1 ? recs[0] : null);
              if (found) {
                fetch("/api/hw/update", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: found.id, fields: { status: "출고준비완료" } }),
                }).catch(console.error);
              }
            }).catch(console.error);
        }
      } finally { setAdvancingId(null); }
      return;
    }
    setAdvancingId(r.id);
    try {
      const res = await fetch("/api/exchange-return/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id, fields: { stage: nextStage } }),
      });
      const json = await res.json();
      if (json.ok) handleUpdated(r.id, { stage: nextStage });
    } finally {
      setAdvancingId(null);
    }
  }, [handleUpdated]);

  const load = useCallback((force = false) => {
    if (!force) { setLoading(true); setError(null); }
    fetch(`/api/exchange-return${force ? "?refresh=1" : ""}`)
      .then(r => r.json())
      .then(res => {
        if (res.missingEnv) { setMissingEnv(res.missingEnv); return; }
        if (res.error) { setError(res.error); return; }
        setRecords(res.data ?? []);
        setLastSynced(res.lastSynced ?? null);
      })
      .catch(e => { if (!force) setError(e.message); })
      .finally(() => { if (!force) setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(() => load(true), 30_000);
    return () => clearInterval(id);
  }, [load]);

  const openRecords   = useMemo(() => records.filter(r => !r.isClosed),  [records]);
  const closedRecords = useMemo(() => records.filter(r =>  r.isClosed),  [records]);
  const tabRecords    = caseTab === "open" ? openRecords : closedRecords;

  const total      = tabRecords.length;
  const inProgress = tabRecords.filter(r => stagesFor(r.type).indexOf(r.stage as Stage) < stagesFor(r.type).length - 1).length;
  const completed  = tabRecords.filter(r => stagesFor(r.type).indexOf(r.stage as Stage) === stagesFor(r.type).length - 1).length;
  const exchanges  = tabRecords.filter(r => r.type === "교체").length;
  const returns    = tabRecords.filter(r => r.type === "퇴사반납").length;
  const overdue    = tabRecords.filter(isOverdue).length;

  const stageCounts = useMemo(() =>
    Object.fromEntries(STAGES.map(s => [s, tabRecords.filter(r => r.stage === s).length])),
    [tabRecords]
  );

  const filtered = useMemo(() => {
    const arr = tabRecords.filter(r => {
      if (stageFilter !== "all" && r.stage !== stageFilter) return false;
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return [r.assetId, r.newAssetId, r.company, r.department, r.user, r.reason, r.note]
          .some(v => (v || "").toLowerCase().includes(q));
      }
      return true;
    });
    const SHIP_DATE_STAGES = ["기기준비", "기기준비완료"];
    if (stageFilter !== "all" && SHIP_DATE_STAGES.includes(stageFilter)) {
      return [...arr].sort((a, b) => (a.completedAt ?? "").localeCompare(b.completedAt ?? ""));
    }
    return [...arr].sort((a, b) => (b.lastEditedAt ?? "").localeCompare(a.lastEditedAt ?? ""));
  }, [records, caseTab, stageFilter, typeFilter, search]);

  if (missingEnv) return <EnvVarMissing varName={missingEnv} />;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400 text-sm gap-2">
        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25"/>
          <path d="M21 12a9 9 0 00-9-9"/>
        </svg>
        자산 흐름 내역 불러오는 중...
      </div>
    );
  }

  return (
    <div className="fade-in">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-0.5">자산 흐름 관리</h2>
          <p className="text-sm text-gray-500">
            기기 교체 · 반납 처리 관리 · 전체 {total}건
            {lastSynced && (
              <span className="ml-2 text-gray-300 text-[10px]">
                {new Date(lastSynced).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 동기화
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCreateOpen(true)}
            className="text-xs font-semibold px-3 py-1.5 rounded bg-gray-900 text-white hover:bg-gray-700 flex items-center gap-1.5 transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            신규 등록
          </button>
          <button onClick={() => load(true)}
            className="text-xs font-medium px-3 py-1.5 rounded border bg-white text-gray-600 border-gray-300 hover:border-gray-400 flex items-center gap-1 transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
            새로고침
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">⚠️ {error}</div>
      )}

      {/* 열린/닫힌 케이스 탭 */}
      <div className="flex items-center gap-1 mb-5 p-1 bg-gray-100 rounded-xl w-fit">
        <button onClick={() => setCaseTab("open")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${caseTab === "open" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          Open Cases
          <span className="text-xs font-normal text-gray-400 ml-0.5">{openRecords.length}</span>
        </button>
        <button onClick={() => setCaseTab("closed")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${caseTab === "closed" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
          Closed Cases
          <span className="text-xs font-normal text-gray-400 ml-0.5">{closedRecords.length}</span>
        </button>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-6 gap-3 mb-6">
        {[
          { label: "전체",    value: total,      color: "#1E40AF" },
          { label: "진행 중", value: inProgress,  color: "#C2410C" },
          { label: "완료",    value: completed,   color: "#059669" },
          { label: "교체",    value: exchanges,   color: "#1D4ED8" },
          { label: "퇴사반납", value: returns,    color: "#B91C1C" },
          { label: "미반납",   value: overdue,    color: "#DC2626" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-1">
            <div className="text-2xl font-extrabold" style={{ color }}>{value}</div>
            <div className="text-xs font-medium text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      {/* 유형 + 단계 필터 */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <button onClick={() => setTypeFilter("all")}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${typeFilter === "all" ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
          전체
        </button>
        {RECORD_TYPES.map(t => {
          const c = TYPE_COLORS[t];
          const active = typeFilter === t;
          return (
            <button key={t} onClick={() => setTypeFilter(t)}
              className="px-3 py-1 rounded-full text-xs font-semibold transition-colors"
              style={{ background: active ? "#1E293B" : c.bg, color: active ? "white" : c.text }}>
              {t}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        <button onClick={() => setStageFilter("all")}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${stageFilter === "all" ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
          전체 단계 {total}
        </button>
        {STAGES.map(s => {
          const cnt = stageCounts[s] ?? 0;
          const c = STAGE_COLORS[s];
          const active = stageFilter === s;
          return (
            <button key={s} onClick={() => setStageFilter(s)}
              className="px-3 py-1 rounded-full text-xs font-semibold transition-colors"
              style={{ background: active ? c.dot : cnt > 0 ? c.bg : "#F8FAFC", color: active ? "white" : cnt > 0 ? c.text : "#CBD5E1" }}>
              {s} {cnt}
            </button>
          );
        })}
      </div>

      {/* 검색 */}
      <div className="mb-4 flex items-center gap-2">
        <input type="text" placeholder="자산번호 / 법인 / 부서 / 사용자 / 사유 검색..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 max-w-md text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        {search && <button onClick={() => setSearch("")} className="text-xs text-gray-400 hover:text-gray-600 underline">초기화</button>}
        <span className="text-xs text-gray-400 ml-1">{filtered.length}건</span>
      </div>

      {/* 테이블 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-auto">
        <table className="data-table">
          <thead>
            <tr>
              {["진행단계", "유형", "자산번호", "교체 자산번호", "법인", "부서", "사용자", "반납예정", "메모", "사용일자"].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={10} className="text-center text-gray-400 py-10">데이터 없음</td></tr>
            ) : filtered.map(r => {
              const days = agingDays(r.requestedAt, r.completedAt, r.stage);
              const overdueRow = isOverdue(r);
              return (
                <tr key={r.id} className={overdueRow ? "bg-red-50/40" : ""}>
                  {/* 진행단계 */}
                  <td>
                    <div className="flex flex-col gap-1">
                      <div className="cursor-pointer" onClick={() => setSelected(r)}>
                        <MiniStageBar stage={r.stage} type={r.type} />
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="cursor-pointer" onClick={() => setSelected(r)}>
                          <StageBadge stage={r.stage} />
                        </span>
                        <AgingChip days={days} stage={r.stage} />
                        {r.autoSynced && <span className="text-[10px] font-bold text-cyan-700" title="자동 동기화">⚡</span>}
                        {!r.isClosed && (() => {
                          const visStages = stagesFor(r.type);
                          const isLast = visStages.indexOf(r.stage as Stage) === visStages.length - 1;
                          return (
                            <button
                              onClick={() => handleAdvanceStage(r)}
                              disabled={advancingId === r.id}
                              title={isLast ? "케이스 종료" : "다음 단계로 이동"}
                              className={`flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded transition-colors disabled:opacity-40 ${
                                isLast
                                  ? "bg-gray-200 text-gray-500 hover:bg-gray-500 hover:text-white"
                                  : "bg-gray-100 text-gray-500 hover:bg-gray-800 hover:text-white"
                              }`}
                            >
                              {advancingId === r.id ? (
                                <svg className="animate-spin w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25"/><path d="M21 12a9 9 0 00-9-9"/>
                                </svg>
                              ) : isLast ? (
                                <>종료 <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg></>
                              ) : (
                                <>다음 <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg></>
                              )}
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  </td>
                  {/* 유형 */}
                  <td><TypeBadge type={r.type} /></td>
                  {/* 자산번호 */}
                  <td>
                    {r.assetId ? (
                      <button onClick={() => setHwDetailAsset(r.assetId)}
                        className="font-mono text-sm font-semibold text-gray-800 hover:text-blue-600 hover:underline cursor-pointer">
                        {r.assetId}
                      </button>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  {/* 교체 자산번호 */}
                  <td>
                    {(r.type === "교체" || r.type === "신규지급") && r.stage === "요청기안" ? (
                      <button onClick={() => setPickerTarget(r)}
                        className="font-mono text-xs text-gray-500 hover:text-blue-600 hover:underline cursor-pointer text-left">
                        {r.newAssetId || <span className="text-gray-300 not-italic">선택...</span>}
                      </button>
                    ) : (
                      <span className="font-mono text-xs text-gray-500">{r.newAssetId || "—"}</span>
                    )}
                  </td>
                  {/* 법인 */}
                  <td className="text-xs text-gray-600">{r.company || "—"}</td>
                  {/* 부서 */}
                  <td className="text-xs text-gray-600">{r.department || "—"}</td>
                  {/* 사용자 */}
                  <td className="text-xs text-gray-700">{r.user || "—"}</td>
                  {/* 반납예정 */}
                  <td className="text-xs">
                    {r.returnDue ? <DDay date={r.returnDue} /> : <span className="text-gray-300">—</span>}
                  </td>
                  {/* 메모 */}
                  <td className="text-xs text-gray-500 max-w-[160px] truncate" title={r.note || ""}>{r.note || "—"}</td>
                  {/* 출고예정일 */}
                  <td className="text-xs text-gray-500 whitespace-nowrap">{r.completedAt ? fmtDate(r.completedAt) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 상세 모달 */}
      {selected && (
        <DetailModal
          record={selected}
          onClose={() => setSelected(null)}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}

      {createOpen && (
        <CreateModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => { setCreateOpen(false); load(true); }}
        />
      )}

      {pickerTarget && (
        <AssetPickerModal
          company={pickerTarget.company || ""}
          user={pickerTarget.user || ""}
          department={pickerTarget.department || ""}
          recordId={pickerTarget.id}
          onClose={() => setPickerTarget(null)}
          onPicked={(assetNo, extras) => {
            handleUpdated(pickerTarget.id, { newAssetId: assetNo, stage: "기기준비", ...(extras.note ? { note: extras.note } : {}), completedAt: extras.completedAt });
            setPickerTarget(null);
          }}
          onNewPurchase={() => {
            handleUpdated(pickerTarget.id, { newAssetId: "신규구매로안내됨" });
            setPickerTarget(null);
          }}
        />
      )}

      {receiptTarget && (
        <ReceiptConfirmModal
          recordId={receiptTarget.id}
          oldAssetId={receiptTarget.assetId || ""}
          newAssetId={receiptTarget.newAssetId || ""}
          recordType={receiptTarget.type || ""}
          onClose={() => setReceiptTarget(null)}
          onConfirmed={(due) => {
            handleUpdated(receiptTarget.id, { stage: "사용자수령", ...(due ? { returnDue: due } : {}) });
            setReceiptTarget(null);
          }}
        />
      )}

      {returnCompleteTarget && (
        <ReturnCompleteModal
          recordId={returnCompleteTarget.id}
          assetId={returnCompleteTarget.assetId || ""}
          onClose={() => setReturnCompleteTarget(null)}
          onConfirmed={() => {
            const today = new Date().toISOString().slice(0, 10);
            handleUpdated(returnCompleteTarget.id, { stage: "반납완료", completedAt: today });
            setReturnCompleteTarget(null);
          }}
        />
      )}

      {hwDetailAsset && (
        <HwAssetDetailModal
          assetNo={hwDetailAsset}
          onClose={() => setHwDetailAsset(null)}
        />
      )}
    </div>
  );
}
