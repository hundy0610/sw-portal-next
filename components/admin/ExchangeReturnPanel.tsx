"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import type { ExchangeReturnRecord } from "@/types";
import EnvVarMissing from "@/components/ui/EnvVarMissing";

// ── 상수 ────────────────────────────────────────────────────
const STAGES = ["교체요청", "요청기안", "기기준비", "사용자수령", "반납요청", "반납완료"] as const;
type Stage = typeof STAGES[number];

// 퇴사반납은 반납요청부터 시작 (앞 4단계 skip)
const STAGES_BY_TYPE: Record<string, readonly Stage[]> = {
  "교체":     STAGES,
  "퇴사반납": ["반납요청", "반납완료"],
};
const FINAL_STAGE: Stage = "반납완료";

const RECORD_TYPES = ["교체", "퇴사반납"] as const;

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
  "사용자수령": { bg: "#FFF7ED", text: "#C2410C", dot: "#F97316" },
  "반납요청":   { bg: "#FEFCE8", text: "#A16207", dot: "#EAB308" },
  "반납완료":   { bg: "#F0FDF4", text: "#15803D", dot: "#22C55E" },
};

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  "교체":     { bg: "#EFF6FF", text: "#1D4ED8" },
  "퇴사반납": { bg: "#FEF2F2", text: "#B91C1C" },
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

function AssetPickerModal({
  company, user, department, recordId, onClose, onPicked,
}: {
  company: string;
  user: string;
  department: string;
  recordId: string;
  onClose: () => void;
  onPicked: (assetNo: string) => void;
}) {
  const [assets, setAssets]     = useState<StockAsset[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<StockAsset | null>(null);
  const [useDate, setUseDate]   = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    fetch(`/api/hw?company=${encodeURIComponent(company)}&status=재고`)
      .then(r => r.json())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(json => setAssets((json.records as any[]).map((r: any) => ({
        id: r.id, assetNo: r.assetNo, model: r.model, cpu: r.cpu, ram: r.ram,
      }))))
      .finally(() => setLoading(false));
  }, [company]);

  const confirm = async () => {
    if (!selected || !useDate) return;
    setSaving(true);
    try {
      await Promise.all([
        fetch("/api/exchange-return/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: recordId, fields: { newAssetId: selected.assetNo } }),
        }),
        fetch("/api/hw/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: selected.id,
            fields: { status: "출고준비중", user, dept: department, useDate },
          }),
        }),
      ]);
      onPicked(selected.assetNo);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        style={{ maxHeight: "85vh", display: "flex", flexDirection: "column" }}
        onClick={e => e.stopPropagation()}>

        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-gray-900 text-base">
              {selected ? "사용일자 지정" : "재고 자산 선택"}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">{company} · 재고 상태 자산</p>
          </div>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">×</button>
        </div>

        {!selected ? (
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
                    <tr key={a.id} onClick={() => setSelected(a)}
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
        ) : (
          <div className="px-6 py-6 flex flex-col gap-5">
            <div className="bg-gray-50 rounded-xl p-4 space-y-1">
              <p className="text-xs text-gray-400">선택된 자산</p>
              <p className="font-mono font-bold text-gray-900 text-sm">{selected.assetNo}</p>
              <p className="text-xs text-gray-500">{selected.model} · {selected.cpu} · {selected.ram}</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 text-xs text-blue-700 space-y-1">
              <p className="font-medium">확정 시 자동 적용</p>
              <ul className="space-y-0.5 list-disc list-inside">
                <li>HW DB 상태 → <strong>출고준비중</strong></li>
                <li>사용자 → <strong>{user || "—"}</strong></li>
                <li>부서 → <strong>{department || "—"}</strong></li>
              </ul>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-gray-500 font-medium">사용일자</label>
              <input type="date" value={useDate} onChange={e => setUseDate(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 w-full" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setSelected(null)}
                className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                뒤로
              </button>
              <button onClick={confirm} disabled={saving || !useDate}
                className="text-sm px-5 py-2 rounded-lg bg-gray-900 text-white font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">
                {saving ? "저장 중…" : "확정"}
              </button>
            </div>
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
  const [deleting, setDeleting] = useState(false);

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
  const [returnDue, setReturnDue] = useState(record.returnDue ?? "");
  const [reason, setReason] = useState(record.reason ?? "");
  const [note, setNote] = useState(record.note ?? "");
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [showAssetPicker, setShowAssetPicker] = useState(false);

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
            <button onClick={() => save("stage", { stage })} disabled={saving === "stage" || stage === record.stage} className={saveBtnCls("stage", stage, record.stage)}>
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

          <Row label="신청일">{fmtDateKo(record.requestedAt)}</Row>

          {record.type === "교체" && (
            <Row label="교체 자산번호">
              <div className="flex items-center gap-2">
                <button onClick={() => setShowAssetPicker(true)}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white hover:border-blue-300 hover:bg-blue-50 text-left min-w-[10rem] transition-colors">
                  {newAssetId
                    ? <span className="font-mono text-gray-800">{newAssetId}</span>
                    : <span className="text-gray-400">재고에서 선택...</span>
                  }
                </button>
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
              onPicked={(assetNo) => {
                setNewAssetId(assetNo);
                onUpdated(record.id, { newAssetId: assetNo });
                setSaved(p => ({ ...p, newAssetId: true }));
                setTimeout(() => setSaved(p => ({ ...p, newAssetId: false })), 2000);
                setShowAssetPicker(false);
              }}
            />
          )}

          <SaveRow label="반납예정일" field="returnDue">
            <input type="date" value={returnDue} onChange={e => setReturnDue(e.target.value)} className={selectCls} />
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
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
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

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [autoFilling, setAutoFilling] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);

  // 자산번호 입력 시 HW DB에서 법인/부서/사용자 자동 채움
  useEffect(() => {
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
          setForm(p => ({
            ...p,
            user:       found.user    || p.user,
            department: found.dept    || p.department,
            company:    found.company || p.company,
          }));
          setAutoFilled(true);
        } else {
          setAutoFilled(false);
        }
      } catch { /* 무시 */ } finally {
        setAutoFilling(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [form.assetId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (k: keyof CreateForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const v = e.target.value;
    if (k === "type") {
      // 유형 변경 시 시작 단계 자동 보정
      setForm(p => ({ ...p, type: v, stage: defaultStageFor(v) }));
      return;
    }
    setForm(p => ({ ...p, [k]: v }));
  };

  const visibleStages = stagesFor(form.type);

  const handleSubmit = async () => {
    if (!form.assetId.trim()) { setErr("자산번호를 입력해주세요."); return; }
    setSaving(true); setErr(null);
    try {
      const res = await fetch("/api/exchange-return/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.ok) { setErr(json.error ?? "등록 실패"); return; }
      onCreated();
      onClose();
    } catch (e) {
      setErr(String(e));
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white";
  const labelCls = "text-xs text-gray-400 mb-1 block";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        style={{ maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>

        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-base">자산 흐름 관리 — 신규 등록</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">×</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>유형 <span className="text-red-500">*</span></label>
              <select className={inputCls} value={form.type} onChange={set("type")}>
                {RECORD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>현재단계</label>
              <select className={inputCls} value={form.stage} onChange={set("stage")}>
                {visibleStages.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
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
              <label className={labelCls}>신청일</label>
              <input type="date" className={inputCls} value={form.requestedAt} onChange={set("requestedAt")} />
            </div>
          </div>

          {(form.type === "퇴사반납" || form.stage === "반납요청") && (
            <div>
              <label className={labelCls}>반납예정일</label>
              <input type="date" className={inputCls} value={form.returnDue} onChange={set("returnDue")} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>부서</label>
              <input className={inputCls} placeholder="부서명" value={form.department} onChange={set("department")} />
            </div>
            <div>
              <label className={labelCls}>사용자</label>
              <input className={inputCls} placeholder="사용자 이름" value={form.user} onChange={set("user")} />
            </div>
          </div>

          <div>
            <label className={labelCls}>신청사유</label>
            <input className={inputCls} placeholder="신청사유를 입력하세요" value={form.reason} onChange={set("reason")} />
          </div>

          <div>
            <label className={labelCls}>비고</label>
            <textarea className={inputCls} rows={3} placeholder="비고 메모..." value={form.note}
              onChange={set("note")} style={{ resize: "vertical" }} />
          </div>

          {err && <p className="text-xs text-red-600">{err}</p>}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">취소</button>
          <button onClick={handleSubmit} disabled={saving}
            className="text-sm px-5 py-2 rounded-lg bg-gray-900 text-white font-semibold hover:bg-gray-700 disabled:opacity-40 transition-colors">
            {saving ? "등록 중..." : "등록"}
          </button>
        </div>
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
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ExchangeReturnRecord | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const [pickerTarget, setPickerTarget] = useState<ExchangeReturnRecord | null>(null);

  const handleUpdated = useCallback((id: string, fields: Partial<ExchangeReturnRecord>) => {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, ...fields } : r));
    setSelected(prev => prev?.id === id ? { ...prev, ...fields } : prev);
  }, []);

  const handleDeleted = useCallback((id: string) => {
    setRecords(prev => prev.filter(r => r.id !== id));
    setSelected(prev => prev?.id === id ? null : prev);
  }, []);

  const handleAdvanceStage = useCallback(async (r: ExchangeReturnRecord) => {
    const visible = stagesFor(r.type);
    const idx = visible.indexOf(r.stage as Stage);
    if (idx === -1 || idx === visible.length - 1) return;
    const nextStage = visible[idx + 1];
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

  const total = records.length;
  const inProgress = records.filter(r => r.stage !== FINAL_STAGE).length;
  const completed = records.filter(r => r.stage === FINAL_STAGE).length;
  const exchanges = records.filter(r => r.type === "교체").length;
  const returns = records.filter(r => r.type === "퇴사반납").length;
  const overdue = records.filter(isOverdue).length;

  const stageCounts = useMemo(() =>
    Object.fromEntries(STAGES.map(s => [s, records.filter(r => r.stage === s).length])),
    [records]
  );

  const filtered = useMemo(() => records.filter(r => {
    if (stageFilter !== "all" && r.stage !== stageFilter) return false;
    if (typeFilter !== "all" && r.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return [r.assetId, r.newAssetId, r.company, r.department, r.user, r.reason, r.note]
        .some(v => (v || "").toLowerCase().includes(q));
    }
    return true;
  }), [records, stageFilter, typeFilter, search]);

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
              {["진행단계", "유형", "자산번호", "교체 자산번호", "법인", "부서", "사용자", "신청일", "반납예정", "신청사유", "담당자", "비고"].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={12} className="text-center text-gray-400 py-10">데이터 없음</td></tr>
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
                        {r.stage !== FINAL_STAGE && (
                          <button
                            onClick={() => handleAdvanceStage(r)}
                            disabled={advancingId === r.id}
                            title="다음 단계로 이동"
                            className="flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 hover:bg-gray-800 hover:text-white transition-colors disabled:opacity-40"
                          >
                            {advancingId === r.id ? (
                              <svg className="animate-spin w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25"/><path d="M21 12a9 9 0 00-9-9"/>
                              </svg>
                            ) : (
                              <>다음 <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg></>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                  {/* 유형 */}
                  <td><TypeBadge type={r.type} /></td>
                  {/* 자산번호 */}
                  <td><span className="font-mono text-sm font-semibold text-gray-800">{r.assetId || "—"}</span></td>
                  {/* 교체 자산번호 */}
                  <td>
                    {r.type === "교체" ? (
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
                  {/* 신청일 */}
                  <td className="text-xs text-gray-500">{fmtDate(r.requestedAt)}</td>
                  {/* 반납예정 */}
                  <td className="text-xs">
                    {r.returnDue ? <DDay date={r.returnDue} /> : <span className="text-gray-300">—</span>}
                  </td>
                  {/* 신청사유 */}
                  <td className="max-w-[120px]">
                    <p className="text-xs text-gray-700 truncate" title={r.reason}>{r.reason || "—"}</p>
                  </td>
                  {/* 담당자 */}
                  <td className="text-xs text-gray-600">{r.assignee || <span className="text-gray-300">미배정</span>}</td>
                  {/* 비고 */}
                  <td className="max-w-[120px]">
                    <p className="text-xs text-gray-500 truncate" title={r.note}>{r.note || "—"}</p>
                  </td>
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
          onPicked={(assetNo) => {
            handleUpdated(pickerTarget.id, { newAssetId: assetNo });
            setPickerTarget(null);
          }}
        />
      )}
    </div>
  );
}
