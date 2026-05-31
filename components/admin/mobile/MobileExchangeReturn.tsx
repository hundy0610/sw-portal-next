"use client";

import { useEffect, useState, useMemo } from "react";
import type { MobileSession } from "@/app/admin/mobile/page";
import type { ExchangeReturnRecord } from "@/types";

interface Props {
  session: MobileSession;
}

const STAGES = ["교체요청", "요청기안", "기기준비", "기기준비완료", "사용자수령", "반납요청", "반납완료"] as const;
type Stage = typeof STAGES[number];

const STAGES_BY_TYPE: Record<string, readonly Stage[]> = {
  "교체":     STAGES,
  "퇴사반납": ["반납요청", "반납완료"],
  "신규지급": ["요청기안", "기기준비", "기기준비완료", "사용자수령"],
};

const STAGE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  "교체요청":     { bg: "#F8FAFC", text: "#64748B", dot: "#94A3B8" },
  "요청기안":     { bg: "#EFF6FF", text: "#1D4ED8", dot: "#3B82F6" },
  "기기준비":     { bg: "#F5F3FF", text: "#6D28D9", dot: "#8B5CF6" },
  "기기준비완료": { bg: "#ECFDF5", text: "#065F46", dot: "#10B981" },
  "사용자수령":   { bg: "#FFF7ED", text: "#C2410C", dot: "#F97316" },
  "반납요청":     { bg: "#FEFCE8", text: "#A16207", dot: "#EAB308" },
  "반납완료":     { bg: "#F0FDF4", text: "#15803D", dot: "#22C55E" },
};

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  "교체":     { bg: "#EFF6FF", text: "#1D4ED8" },
  "퇴사반납": { bg: "#FEF2F2", text: "#B91C1C" },
  "신규지급": { bg: "#F0FDF4", text: "#15803D" },
};

function fmtDate(iso: string) {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

function agingDays(requestedAt: string, completedAt: string, stage: string) {
  if (!requestedAt) return 0;
  const start = new Date(requestedAt);
  const end = stage === "반납완료" && completedAt ? new Date(completedAt) : new Date();
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000);
}

function daysLeft(iso?: string): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function StageBadge({ stage }: { stage: string }) {
  const c = STAGE_COLORS[stage] ?? { bg: "#F1F5F9", text: "#64748B" };
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap"
      style={{ background: c.bg, color: c.text }}>
      {stage || "—"}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const c = TYPE_COLORS[type] ?? { bg: "#F1F5F9", text: "#64748B" };
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
      style={{ background: c.bg, color: c.text }}>
      {type}
    </span>
  );
}

// ── 단계 진행 바 (모바일용 간소화) ──────────────────────────
function MobileStageBar({ stage, type }: { stage: string; type: string }) {
  const visible = STAGES_BY_TYPE[type] ?? STAGES;
  const idx = visible.indexOf(stage as Stage);
  return (
    <div className="flex items-center gap-0.5 my-3">
      {visible.map((s, i) => {
        const c = STAGE_COLORS[s];
        const active = i === idx;
        const done = i < idx;
        const isLast = i === visible.length - 1;
        return (
          <div key={s} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className="rounded-full flex items-center justify-center transition-all"
                style={{
                  width: active ? 20 : 12, height: active ? 20 : 12,
                  background: done ? "#22C55E" : active ? c.dot : "#E2E8F0",
                  border: active ? `2.5px solid ${c.dot}` : done ? "none" : "1.5px solid #CBD5E1",
                  flexShrink: 0,
                }}
              >
                {done && (
                  <svg width="7" height="7" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <div className="mt-1 text-center"
                style={{ fontSize: 7.5, color: active ? c.text : done ? "#22C55E" : "#CBD5E1", fontWeight: active ? 700 : done ? 600 : 400, whiteSpace: "nowrap" }}>
                {s}
              </div>
            </div>
            {!isLast && (
              <div className="h-0.5 flex-shrink-0" style={{ width: 8, marginBottom: 14, background: done ? "#22C55E" : "#E2E8F0" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── 상세 바텀시트 ────────────────────────────────────────────
function DetailSheet({ record, onClose, onStageChange }: {
  record: ExchangeReturnRecord;
  onClose: () => void;
  onStageChange: (id: string, stage: string) => Promise<void>;
}) {
  const [updating, setUpdating] = useState(false);
  const [note, setNote] = useState(record.note ?? "");
  const [savingNote, setSavingNote] = useState(false);
  const stages = STAGES_BY_TYPE[record.type] ?? STAGES;
  const idx = stages.indexOf(record.stage as Stage);
  const canNext = idx < stages.length - 1;
  const canPrev = idx > 0;
  const aging = agingDays(record.requestedAt, record.completedAt, record.stage);
  const dl = daysLeft(record.returnDue);

  async function moveStage(direction: 1 | -1) {
    const next = stages[idx + direction];
    if (!next) return;
    setUpdating(true);
    await onStageChange(record.id, next);
    setUpdating(false);
  }

  async function saveNote() {
    setSavingNote(true);
    await fetch("/api/exchange-return/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: record.id, fields: { note } }),
    });
    setSavingNote(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div className="bg-white rounded-t-3xl p-5 max-h-[85dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* 핸들 */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

        {/* 헤더 */}
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <TypeBadge type={record.type} />
              <StageBadge stage={record.stage} />
            </div>
            <div className="text-lg font-extrabold text-gray-900 mt-1">{record.user || "—"}</div>
            <div className="text-sm text-gray-500">{record.company} · {record.department}</div>
          </div>
          <button onClick={onClose} className="text-gray-400 p-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* 단계 바 */}
        <MobileStageBar stage={record.stage} type={record.type} />

        {/* 단계 변경 버튼 */}
        <div className="flex gap-2 mb-5">
          <button
            disabled={!canPrev || updating}
            onClick={() => moveStage(-1)}
            className="flex-1 py-3 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 active:bg-gray-50 disabled:opacity-30 transition-opacity"
          >
            ← 이전 단계
          </button>
          <button
            disabled={!canNext || updating}
            onClick={() => moveStage(1)}
            className="flex-1 py-3 rounded-xl text-sm font-semibold bg-blue-600 text-white active:bg-blue-700 disabled:opacity-30 transition-opacity"
          >
            다음 단계 →
          </button>
        </div>
        {updating && <div className="text-center text-xs text-blue-500 -mt-3 mb-3">업데이트 중...</div>}

        {/* 정보 */}
        <div className="space-y-2.5 text-sm">
          <InfoRow label="자산번호 (현)" value={record.assetId || "—"} />
          <InfoRow label="자산번호 (신)" value={record.newAssetId || "—"} />
          <InfoRow label="배송지" value={record.address || "—"} />
          <InfoRow label="담당자" value={record.assignee || "—"} />
          <InfoRow label="요청일" value={fmtDate(record.requestedAt)} />
          <InfoRow label="반납예정일" value={record.returnDue
            ? `${fmtDate(record.returnDue)}${dl !== null ? ` (${dl < 0 ? `D+${Math.abs(dl)} 지남` : dl === 0 ? "D-Day" : `D-${dl}`})` : ""}` : "—"}
            highlight={dl !== null && dl < 0}
          />
          <InfoRow label="경과" value={record.stage === "반납완료" ? `${aging}일 소요` : `D+${aging}`}
            highlight={aging >= 7}
          />
          <InfoRow label="사유" value={record.reason || "—"} />
        </div>

        {/* 메모 */}
        <div className="mt-4">
          <div className="text-xs font-semibold text-gray-500 mb-1.5">메모</div>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-blue-400"
            placeholder="메모 입력..."
          />
          <button
            onClick={saveNote}
            disabled={savingNote || note === record.note}
            className="mt-1.5 w-full py-2.5 rounded-xl text-sm font-semibold bg-gray-800 text-white disabled:opacity-30 active:opacity-80 transition-opacity"
          >
            {savingNote ? "저장 중..." : "메모 저장"}
          </button>
        </div>

        {/* Notion 링크 */}
        {record.notionUrl && (
          <a href={record.notionUrl} target="_blank" rel="noopener noreferrer"
            className="mt-3 flex items-center justify-center gap-1.5 text-xs text-gray-400 py-2">
            Notion에서 보기 ↗
          </a>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-gray-400 w-24 flex-shrink-0 text-xs pt-0.5">{label}</span>
      <span className={`flex-1 font-medium ${highlight ? "text-red-600" : "text-gray-900"}`}>{value}</span>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export default function MobileExchangeReturn({ session }: Props) {
  const [records, setRecords] = useState<ExchangeReturnRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("전체");
  const [filterStage, setFilterStage] = useState("진행 중");
  const [filterSpecificStage, setFilterSpecificStage] = useState("");
  const [selected, setSelected] = useState<ExchangeReturnRecord | null>(null);
  const [error, setError] = useState("");

  async function fetchRecords() {
    setLoading(true);
    try {
      const res = await fetch("/api/exchange-return");
      const data = await res.json();
      if (Array.isArray(data.data)) setRecords(data.data);
      else if (data.error) setError(data.error);
      else setError("데이터를 불러오지 못했습니다.");
    } catch { setError("네트워크 오류"); }
    setLoading(false);
  }

  useEffect(() => { fetchRecords(); }, []);

  async function handleStageChange(id: string, stage: string) {
    await fetch("/api/exchange-return/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, fields: { stage } }),
    });
    setRecords(prev => prev.map(r => r.id === id ? { ...r, stage } : r));
    setSelected(prev => prev?.id === id ? { ...prev, stage } : prev);
  }

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (filterType !== "전체" && r.type !== filterType) return false;
      if (filterSpecificStage) {
        if (r.stage !== filterSpecificStage) return false;
      } else {
        if (filterStage === "진행 중" && (r.isClosed || r.stage === "반납완료")) return false;
        if (filterStage === "완료" && !r.isClosed && r.stage !== "반납완료") return false;
      }
      if (search) {
        const q = search.toLowerCase();
        return [r.user, r.assetId, r.newAssetId, r.company, r.department, r.assignee].some(v => v?.toLowerCase().includes(q));
      }
      return true;
    });
  }, [records, filterType, filterStage, filterSpecificStage, search]);

  // 단계별 카운트 (진행 중 레코드)
  const stageCounts = useMemo(() => {
    const active = records.filter(r => !r.isClosed && r.stage !== "반납완료");
    const counts: Record<string, number> = {};
    active.forEach(r => { counts[r.stage] = (counts[r.stage] ?? 0) + 1; });
    return counts;
  }, [records]);

  return (
    <div className="flex flex-col h-full">
      {/* 단계별 칩 요약 */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {filterSpecificStage && (
            <button
              onClick={() => setFilterSpecificStage("")}
              className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-gray-800 text-white">
              {filterSpecificStage} ✕
            </button>
          )}
          {Object.entries(STAGE_COLORS).map(([stage, colors]) => {
            const cnt = stageCounts[stage] ?? 0;
            if (stage === "반납완료" || cnt === 0) return null;
            const active = filterSpecificStage === stage;
            return (
              <button key={stage}
                onClick={() => setFilterSpecificStage(active ? "" : stage)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border"
                style={{
                  background: active ? colors.dot : colors.bg,
                  color: active ? "#fff" : colors.text,
                  borderColor: colors.dot + "44",
                }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: active ? "#fff" : colors.dot }} />
                {stage} {cnt}
              </button>
            );
          })}
        </div>
      </div>

      {/* 필터 */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 space-y-2">
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="이름 · 자산번호 · 법인 검색..."
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400"
        />
        <div className="flex gap-2">
          {["전체", "교체", "퇴사반납", "신규지급"].map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors
                ${filterType === t ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {["진행 중", "완료", "전체"].map(s => (
            <button key={s} onClick={() => { setFilterStage(s); setFilterSpecificStage(""); }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors
                ${filterStage === s && !filterSpecificStage ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* 목록 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading && <div className="text-center text-gray-400 text-sm py-8">로딩 중...</div>}
        {error && <div className="text-center text-red-500 text-sm py-8">{error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-8">조건에 맞는 레코드가 없습니다</div>
        )}
        {filtered.map(r => {
          const aging = agingDays(r.requestedAt, r.completedAt, r.stage);
          const dl = daysLeft(r.returnDue);
          const overdue = r.stage === "반납요청" && dl !== null && dl < 0;
          return (
            <button key={r.id} onClick={() => setSelected(r)}
              className={`w-full bg-white rounded-2xl shadow-sm p-4 text-left active:opacity-70 transition-opacity ${overdue ? "ring-1 ring-red-400" : ""}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <TypeBadge type={r.type} />
                    <StageBadge stage={r.stage} />
                    {r.autoSynced && <span className="text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">자동싱크</span>}
                  </div>
                  <div className="font-bold text-gray-900 mt-1.5 text-sm">{r.user || "—"}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{r.company} · {r.department}</div>
                  {r.assetId && <div className="text-xs text-gray-400 mt-0.5">{r.assetId}{r.newAssetId ? ` → ${r.newAssetId}` : ""}</div>}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-xs font-bold" style={{ color: aging >= 7 ? "#DC2626" : aging >= 3 ? "#D97706" : "#6B7280" }}>
                    {r.stage === "반납완료" ? `${aging}일` : `D+${aging}`}
                  </span>
                  {r.returnDue && r.stage === "반납요청" && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${overdue ? "bg-red-50 text-red-600" : "bg-yellow-50 text-yellow-700"}`}>
                      {overdue ? `D+${Math.abs(dl!)} 미반납` : dl === 0 ? "D-Day" : `D-${dl}`}
                    </span>
                  )}
                  {r.assignee && <div className="text-xs text-gray-400">{r.assignee}</div>}
                </div>
              </div>
              {r.note && (
                <div className="mt-2 text-xs text-gray-400 bg-gray-50 rounded-lg px-2.5 py-1.5 truncate">
                  {r.note}
                </div>
              )}
            </button>
          );
        })}
        <div className="text-center text-xs text-gray-300 py-2">{filtered.length}건 / 전체 {records.length}건</div>
      </div>

      {/* 상세 시트 */}
      {selected && (
        <DetailSheet
          record={selected}
          onClose={() => setSelected(null)}
          onStageChange={handleStageChange}
        />
      )}
    </div>
  );
}
