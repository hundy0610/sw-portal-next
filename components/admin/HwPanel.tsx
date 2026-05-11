"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { HwStats } from "@/lib/hw";
import EnvVarMissing from "@/components/ui/EnvVarMissing";

// ─────────────────────────────────────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────────────────────────────────────
interface HwRecord {
  id: string; notionUrl: string;
  user: string; assetNo: string; model: string; serial: string;
  maker: string; cpu: string; ram: string;
  company: string; dept: string; location: string;
  status: string;
  returnDue: string; returnDate: string;
  purchaseDate: string; useDate: string;
  price: number; note: string; docNo: string;
  verified: boolean; duplicated: boolean;
}

// 탭 공통 props (중앙 데이터 전달)
interface TabProps {
  records: HwRecord[];
  loading: boolean;
  onRefresh: () => void;
  onUpdate: (id: string, fields: Partial<HwRecord>) => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────────────────────────────────────
const COMPANIES = [
  "대웅제약","대웅바이오","대웅","대웅개발","대웅이엔지","대웅펫",
  "한올바이오파마","시지바이오","시지메드텍","IdsTrust","디엔컴퍼니",
  "디엔코스메틱스","더편한샵","페이지원","엠서클","애디테라","노바메디텍",
  "에이하나","다나아데이터","클리슈어리서치","유와이즈원","DNC",
  "석천나눔재단","HR코리아","힐코","블루넷",
];

const STATUSES = [
  "사용중","재고","교체요청","반납예정","출고준비중","출고준비완료",
  "수리","렌탈","임시지급","폐기","폐기확정(리스트화)","폐기완료",
  "3층문서고/매각","3층문서고/폐기","지하창고/폐기","지하창고/매각",
  "신규","미확인","기타",
];

const STATUS_COLOR: Record<string, string> = {
  "사용중":               "bg-amber-100 text-amber-700",
  "재고":                 "bg-purple-100 text-purple-700",
  "교체요청":             "bg-blue-100 text-blue-700",
  "반납예정":             "bg-yellow-100 text-yellow-700",
  "출고준비중":           "bg-orange-100 text-orange-700",
  "출고준비완료":         "bg-amber-100 text-amber-700",
  "수리":                 "bg-pink-100 text-pink-700",
  "렌탈":                 "bg-cyan-100 text-cyan-700",
  "임시지급":             "bg-amber-100 text-amber-700",
  "폐기":                 "bg-red-100 text-red-700",
  "폐기확정(리스트화)":   "bg-red-50 text-red-500",
  "폐기완료":             "bg-red-200 text-red-800",
  "신규":                 "bg-green-100 text-green-700",
  "미확인":               "bg-orange-100 text-orange-600",
};

const PALETTE = [
  "#6366f1","#f59e0b","#10b981","#ef4444","#3b82f6","#8b5cf6",
  "#ec4899","#14b8a6","#f97316","#84cc16","#06b6d4","#a855f7",
  "#64748b","#e11d48","#059669","#d97706",
];

const CONTRACT_QUANTITY = 3837;

// ─────────────────────────────────────────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────────────────────────────────────────
function dDay(dateStr: string): { label: string; cls: string } {
  if (!dateStr) return { label: "", cls: "" };
  const diff = Math.ceil(
    (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  if (diff < 0)   return { label: `D+${Math.abs(diff)}`, cls: "text-red-600 font-bold" };
  if (diff === 0) return { label: "D-Day",                cls: "text-red-600 font-bold" };
  if (diff <= 7)  return { label: `D-${diff}`,            cls: "text-red-500 font-semibold" };
  if (diff <= 30) return { label: `D-${diff}`,            cls: "text-orange-500 font-semibold" };
  return              { label: `D-${diff}`,               cls: "text-gray-500" };
}
function fmtDate(s: string) { return s ? s.slice(0, 10) : "-"; }
function fmtKrw(n: number)  { return n > 0 ? `₩${n.toLocaleString("ko-KR")}` : "-"; }

// ─────────────────────────────────────────────────────────────────────────────
// SVG 도넛 차트
// ─────────────────────────────────────────────────────────────────────────────
interface ChartSlice { label: string; value: number; color: string; }

function DonutChart({ data, title, centerLabel }: {
  data: ChartSlice[];
  title: string;
  centerLabel?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  const r = 68, strokeWidth = 22;
  const circumference = 2 * Math.PI * r;

  let accumulated = 0;
  const segments = data.map((d, i) => {
    const length = (d.value / total) * circumference;
    const offset = circumference - accumulated;
    accumulated += length;
    return { ...d, length, offset, index: i };
  });

  const displayTotal = hovered !== null ? data[hovered].value : total;
  const displayLabel = hovered !== null ? data[hovered].label : (centerLabel ?? "총계");

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-sm font-bold text-gray-700 mb-4">{title}</p>
      <div className="flex items-start gap-5">
        <div className="shrink-0">
          <svg width={180} height={180}>
            <circle cx={90} cy={90} r={r} fill="none" stroke="#f3f4f6" strokeWidth={strokeWidth} />
            {segments.map(seg => (
              <circle key={seg.index} cx={90} cy={90} r={r} fill="none"
                stroke={seg.color}
                strokeWidth={hovered === seg.index ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={`${seg.length} ${circumference - seg.length}`}
                strokeDashoffset={seg.offset}
                transform="rotate(-90 90 90)"
                style={{ cursor: "pointer", transition: "stroke-width 0.15s" }}
                onMouseEnter={() => setHovered(seg.index)}
                onMouseLeave={() => setHovered(null)}
              />
            ))}
            <text x={90} y={82} textAnchor="middle" fontSize="22" fontWeight="700"
              fill={hovered !== null ? data[hovered].color : "#111827"}>{displayTotal}</text>
            <text x={90} y={102} textAnchor="middle" fontSize="10" fill="#9ca3af">{displayLabel}</text>
          </svg>
        </div>
        <div className="flex-1 space-y-1.5 overflow-hidden">
          {segments.map(seg => (
            <div key={seg.index}
              className={`flex items-center gap-2 rounded-lg px-2 py-1 cursor-pointer transition-colors ${hovered === seg.index ? "bg-gray-50" : ""}`}
              onMouseEnter={() => setHovered(seg.index)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className="shrink-0 w-2.5 h-2.5 rounded-full" style={{ background: seg.color }} />
              <span className="text-xs text-gray-600 truncate flex-1">{seg.label}</span>
              <span className="text-xs font-bold text-gray-800 shrink-0">{seg.value}</span>
              <span className="text-[10px] text-gray-400 shrink-0">
                {Math.round((seg.value / total) * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 대시보드 탭 (stats 기반 — 전체 레코드 불필요, KV에서 즉시 로드)
// ─────────────────────────────────────────────────────────────────────────────
function DashboardTab({ stats, loading, onRefresh }: { stats: HwStats | null; loading: boolean; onRefresh: () => void }) {
  const coData = useMemo<ChartSlice[]>(() => {
    if (!stats) return [];
    return Object.entries(stats.byCompany).sort((a,b)=>b[1]-a[1]).slice(0,14)
      .map(([label,value],i)=>({ label, value, color: PALETTE[i%PALETTE.length] }));
  }, [stats]);

  const stData = useMemo<ChartSlice[]>(() => {
    if (!stats) return [];
    return Object.entries(stats.byStatus)
      .filter(([label]) => label !== "미확인")
      .sort((a,b)=>b[1]-a[1]).slice(0,10)
      .map(([label,value],i)=>({ label, value, color: PALETTE[i%PALETTE.length] }));
  }, [stats]);

  const mkData = useMemo<ChartSlice[]>(() => {
    if (!stats) return [];
    return Object.entries(stats.byMaker).sort((a,b)=>b[1]-a[1]).slice(0,12)
      .map(([label,value],i)=>({ label, value, color: PALETTE[i%PALETTE.length] }));
  }, [stats]);

  const StatCard = ({ label, value, sub, icon, cls }: {
    label:string; value:string|number; sub?:string; icon:string; cls:string;
  }) => (
    <div className={`rounded-xl p-4 border flex items-start gap-3 ${cls}`}>
      <span className="text-xl">{icon}</span>
      <div>
        <p className="text-xl font-bold text-current leading-tight">{value}</p>
        <p className="text-xs font-semibold opacity-80 mt-0.5">{label}</p>
        {sub && <p className="text-[11px] opacity-60 mt-0.5">{sub}</p>}
      </div>
    </div>
  );

  const { total=0, activeCount=0, stockCount=0, shipCount=0, repairCount=0,
          rentalCount=0, tempCount=0, returnCount=0, disposalCount=0,
          verifiedCount=0, totalValue=0, companyTable=[], byStatus={} } = stats ?? {};
  const confirmedTotal = total - (byStatus["미확인"] ?? 0);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-700">전체 자산 현황 대시보드</p>
          {!loading && stats && <p className="text-xs text-gray-400 mt-0.5">계약 수량 {CONTRACT_QUANTITY.toLocaleString()}건 기준 (미확인 제외 {confirmedTotal.toLocaleString()}건)</p>}
        </div>
        <button onClick={onRefresh} disabled={loading}
          className="px-4 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors">
          {loading ? "불러오는 중…" : "새로고침"}
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-300 text-sm">불러오는 중…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon="💻" label="계약 수량" value={CONTRACT_QUANTITY.toLocaleString()} sub={totalValue>0 ? `₩${Math.round(totalValue/1000000)}M` : undefined} cls="bg-amber-50 text-amber-700 border-amber-100" />
            <StatCard icon="✅" label="사용중"    value={activeCount}   sub={total>0 ? `${Math.round(activeCount/total*100)}%` : undefined}    cls="bg-amber-50 text-amber-700 border-blue-100" />
            <StatCard icon="📦" label="재고"      value={stockCount}    cls="bg-purple-50 text-purple-700 border-purple-100" />
            <StatCard icon="📤" label="출고 대기" value={shipCount}     cls="bg-orange-50 text-orange-700 border-orange-100" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon="🔧" label="수리 중"   value={repairCount}   cls="bg-pink-50 text-pink-700 border-pink-100" />
            <StatCard icon="🚗" label="렌탈"      value={rentalCount}   cls="bg-cyan-50 text-cyan-700 border-cyan-100" />
            <StatCard icon="📋" label="임시지급"  value={tempCount}     cls="bg-amber-50 text-amber-700 border-amber-100" />
            <StatCard icon="📅" label="반납 예정" value={returnCount}   cls="bg-yellow-50 text-yellow-700 border-yellow-100" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon="🗑️" label="폐기 대상" value={disposalCount} cls="bg-red-50 text-red-700 border-red-100" />
            <StatCard icon="✓"  label="실사 확인" value={verifiedCount} sub={`확인율 ${Math.round(verifiedCount/CONTRACT_QUANTITY*100)}%`} cls="bg-green-50 text-green-700 border-green-100" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DonutChart data={coData} title="법인별 자산 분포" centerLabel="법인" />
            <DonutChart data={stData} title="상태별 자산 분포" centerLabel="상태" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DonutChart data={mkData} title="제조사별 분포" centerLabel="제조사" />
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <p className="text-sm font-bold text-gray-700">법인별 자산 수</p>
              </div>
              <div className="overflow-y-auto max-h-[280px]">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500 font-semibold sticky top-0">
                    <tr>
                      <th className="px-4 py-2.5 text-left">법인명</th>
                      <th className="px-4 py-2.5 text-right">총계</th>
                      <th className="px-4 py-2.5 text-right">사용중</th>
                      <th className="px-4 py-2.5 text-right">재고</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {companyTable.map(({ company, total: t, active, stock }) => (
                      <tr key={company} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-800">{company}</td>
                        <td className="px-4 py-2 text-right font-bold text-gray-900">{t}</td>
                        <td className="px-4 py-2 text-right text-amber-600 font-semibold">{active||"-"}</td>
                        <td className="px-4 py-2 text-right text-purple-600 font-semibold">{stock||"-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 출고 현황 탭
// ─────────────────────────────────────────────────────────────────────────────
function ShipmentTab({ onUpdate, companyLock = "" }: { onUpdate: (id: string, fields: Partial<HwRecord>) => Promise<void>; companyLock?: string }) {
  const [company,      setCompany]      = useState(companyLock);
  const [records,      setRecords]      = useState<HwRecord[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [editRecord,   setEditRecord]   = useState<HwRecord | null>(null);
  const [detailRecord, setDetailRecord] = useState<HwRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ statuses: "출고준비중,출고준비완료" });
      if (company) p.set("company", company);
      const res  = await fetch(`/api/hw?${p}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setRecords(json.records ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [company]);

  useEffect(() => { load(); }, [load]);

  // 로컬 상태 즉시 반영 후 Notion 업데이트
  const handleSave = useCallback(async (id: string, fields: Partial<HwRecord>) => {
    await onUpdate(id, fields);
    setRecords(prev => prev.map(r => r.id === id ? { ...r, ...fields } : r));
  }, [onUpdate]);

  const pendingShip   = useMemo(() => records.filter(r => r.status === "출고준비중"),   [records]);
  const readyShip     = useMemo(() => records.filter(r => r.status === "출고준비완료"), [records]);
  const sortedPending = useMemo(() => [...pendingShip].sort((a, b) => String(a.useDate ?? "").localeCompare(String(b.useDate ?? ""))), [pendingShip]);
  const sortedReady   = useMemo(() => [...readyShip].sort((a, b) => String(a.useDate ?? "").localeCompare(String(b.useDate ?? ""))),   [readyShip]);

  const SectionTable = ({ title, items, headerCls }: { title:string; items:HwRecord[]; headerCls:string }) => {
    if (items.length === 0) return null;
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className={`px-5 py-3 border-b border-gray-100 flex items-center gap-2 ${headerCls}`}>
          <span className="text-sm font-bold">{title}</span>
          <span className="text-xs opacity-70">{items.length}건</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 font-semibold">
              <tr>{["자산번호","사용자","법인명","부서","모델명","상태","사용일자","위치",""].map(h=><th key={h} className="px-3 py-2.5 text-left whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 font-mono whitespace-nowrap cursor-pointer text-amber-600 hover:underline" onClick={() => setDetailRecord(r)}>{r.assetNo||"-"}</td>
                  <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">{r.user||"-"}</td>
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{r.company||"-"}</td>
                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{r.dept||"-"}</td>
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap max-w-[130px] truncate">{r.model||"-"}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_COLOR[r.status]??"bg-gray-100 text-gray-600"}`}>{r.status||"-"}</span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{fmtDate(r.useDate)}</td>
                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{r.location||"-"}</td>
                  <td className="px-3 py-2.5 flex items-center gap-2">
                    {r.notionUrl && <a href={r.notionUrl} target="_blank" rel="noreferrer" className="text-amber-400 hover:text-amber-600 underline underline-offset-2">Notion ↗</a>}
                    <button onClick={() => setEditRecord(r)} className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors">수정</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-3">
        {!companyLock && (
          <div className="w-44">
            <label className="block text-xs font-semibold text-gray-500 mb-1">법인명 필터</label>
            <select value={company} onChange={e => setCompany(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300">
              <option value="">전체 법인</option>
              {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
        <div className={companyLock ? "" : "mt-5"}>
          <button onClick={load} disabled={loading}
            className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors">
            {loading ? "불러오는 중…" : "새로고침"}
          </button>
        </div>
        {!loading && (
          <div className="mt-5 flex gap-4 text-xs">
            <span className="text-orange-600 font-semibold">출고준비중: {pendingShip.length}건</span>
            <span className="text-amber-600 font-semibold">출고준비완료: {readyShip.length}건</span>
          </div>
        )}
      </div>
      {loading ? (
        <div className="py-16 text-center text-gray-300 text-sm">불러오는 중…</div>
      ) : pendingShip.length === 0 && readyShip.length === 0 ? (
        <div className="py-16 text-center text-gray-300 text-sm"><p className="text-4xl mb-3">📤</p><p>출고 대상 자산이 없습니다</p></div>
      ) : (
        <>
          <SectionTable title="📤 출고준비중" items={sortedPending} headerCls="bg-orange-50 text-orange-700" />
          <SectionTable title="✅ 출고준비완료" items={sortedReady} headerCls="bg-amber-50 text-amber-700" />
        </>
      )}
      {detailRecord && <AssetDetailModal record={detailRecord} onSave={onUpdate} onClose={() => setDetailRecord(null)} />}
      {editRecord && (
        <EditModal
          record={editRecord}
          fields={["status","user","company","dept","location","note"]}
          onSave={handleSave}
          onClose={() => setEditRecord(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 편집 모달
// ─────────────────────────────────────────────────────────────────────────────
type EditField = "status"|"returnDue"|"returnDate"|"useDate"|"verified"|"user"|"company"|"dept"|"location"|"note";

interface EditModalProps {
  record: HwRecord;
  fields: EditField[];
  onSave: (id: string, fields: Partial<HwRecord>) => Promise<void>;
  onClose: () => void;
}

function EditModal({ record, fields, onSave, onClose }: EditModalProps) {
  const [form, setForm] = useState<Partial<HwRecord>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // 초기값 세팅
  useEffect(() => {
    const init: Partial<HwRecord> = {};
    fields.forEach(f => {
      const val = (record as Record<string, unknown>)[f];
      (init as Record<string, unknown>)[f] = val ?? (f === "verified" ? false : "");
    });
    setForm(init);
  }, [record, fields]);

  const set = (f: string, v: string) => setForm(prev => ({ ...prev, [f]: v }));
  const setBool = (f: string, v: boolean) => setForm(prev => ({ ...prev, [f]: v }));

  const handleSave = async () => {
    setSaving(true); setError("");
    try {
      await onSave(record.id, form);
      onClose();
    } catch (e) { setError(String(e)); }
    finally { setSaving(false); }
  };

  const labelMap: Record<string, string> = {
    status: "상태",
    returnDue: "반납예정일",
    returnDate: "반납일자",
    useDate: "사용일자",
    verified: "실사확인",
    user: "사용자", company: "법인명", dept: "부서", location: "위치", note: "비고",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900 text-sm">자산 정보 수정</h3>
            <p className="text-xs text-gray-400 mt-0.5">{record.assetNo || record.model || record.id}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>

        <div className="space-y-3">
          {fields.includes("status") && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">{labelMap.status}</label>
              <select value={String(form.status ?? "")} onChange={e => set("status", e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                {STATUSES.map(s => <option key={s} value={s}>{s || "— 선택 —"}</option>)}
              </select>
            </div>
          )}
          {fields.includes("returnDue") && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">{labelMap.returnDue}</label>
              <div className="flex items-center gap-1">
                <input type="date" value={String(form.returnDue ?? "")} onChange={e => set("returnDue", e.target.value)}
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300" />
                {form.returnDue && <button type="button" onClick={() => set("returnDue", "")} className="text-gray-400 hover:text-gray-600 text-lg leading-none shrink-0 px-0.5">×</button>}
              </div>
            </div>
          )}
          {fields.includes("returnDate") && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">{labelMap.returnDate}</label>
              <div className="flex items-center gap-1">
                <input type="date" value={String(form.returnDate ?? "")} onChange={e => set("returnDate", e.target.value)}
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300" />
                {form.returnDate && <button type="button" onClick={() => set("returnDate", "")} className="text-gray-400 hover:text-gray-600 text-lg leading-none shrink-0 px-0.5">×</button>}
              </div>
            </div>
          )}
          {fields.includes("useDate") && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">{labelMap.useDate}</label>
              <div className="flex items-center gap-1">
                <input type="date" value={String(form.useDate ?? "")} onChange={e => set("useDate", e.target.value)}
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                {form.useDate && <button type="button" onClick={() => set("useDate", "")} className="text-gray-400 hover:text-gray-600 text-lg leading-none shrink-0 px-0.5">×</button>}
              </div>
            </div>
          )}
          {fields.includes("verified") && (
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-gray-500">{labelMap.verified}</label>
              <input type="checkbox" checked={!!form.verified} onChange={e => setBool("verified", e.target.checked)}
                className="w-4 h-4 rounded accent-indigo-600 cursor-pointer" />
            </div>
          )}
          {fields.includes("user") && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">{labelMap.user}</label>
              <input value={String(form.user ?? "")} onChange={e => set("user", e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          )}
          {fields.includes("company") && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">{labelMap.company}</label>
              <select value={String(form.company ?? "")} onChange={e => set("company", e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">— 선택 —</option>
                {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
          {fields.includes("dept") && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">{labelMap.dept}</label>
              <input value={String(form.dept ?? "")} onChange={e => set("dept", e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          )}
          {fields.includes("location") && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">{labelMap.location}</label>
              <input value={String(form.location ?? "")} onChange={e => set("location", e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          )}
          {fields.includes("note") && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">{labelMap.note}</label>
              <textarea value={String(form.note ?? "")} onChange={e => set("note", e.target.value)}
                rows={2} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" />
            </div>
          )}
        </div>

        {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">⚠️ {error}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors">
            {saving ? "저장 중…" : "✅ Notion에 저장"}
          </button>
          <button onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition-colors">
            취소
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 자산 상세 모달
// ─────────────────────────────────────────────────────────────────────────────
function AssetDetailModal({ record, onSave, onClose }: {
  record: HwRecord;
  onSave: (id: string, fields: Partial<HwRecord>) => Promise<void>;
  onClose: () => void;
}) {
  const [status,  setStatus]  = useState(record.status);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState("");

  async function handleStatusSave() {
    if (status === record.status) return;
    setSaving(true); setError("");
    try {
      await onSave(record.id, { status });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { setError(String(e)); }
    finally { setSaving(false); }
  }

  const Row = ({ label, value }: { label: string; value?: string | number }) => {
    if (!value && value !== 0) return null;
    return (
      <div className="flex gap-2 py-2 border-b border-gray-50 last:border-0">
        <span className="text-xs text-gray-400 w-24 shrink-0">{label}</span>
        <span className="text-xs text-gray-800 font-medium break-all">{String(value)}</span>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="px-5 py-4 bg-amber-600 text-white flex items-start justify-between shrink-0">
          <div>
            <div className="font-bold text-base font-mono">{record.assetNo || "—"}</div>
            <div className="text-xs opacity-80 mt-0.5">{record.model || "—"}</div>
          </div>
          <div className="flex items-center gap-3 ml-4">
            {record.notionUrl && (
              <a href={record.notionUrl} target="_blank" rel="noreferrer"
                className="text-xs text-amber-200 hover:text-white underline underline-offset-2">
                Notion ↗
              </a>
            )}
            <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">✕</button>
          </div>
        </div>

        {/* 상태 변경 */}
        <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2 shrink-0">
          <span className="text-xs font-semibold text-gray-500 shrink-0">상태 변경</span>
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white">
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={handleStatusSave} disabled={saving || status === record.status}
            className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 disabled:opacity-40 transition-colors shrink-0">
            {saving ? "저장 중…" : saved ? "✓ 저장됨" : "저장"}
          </button>
        </div>

        {/* 상세 정보 */}
        <div className="overflow-y-auto flex-1 px-5 py-3">
          <Row label="현재 상태"  value={record.status} />
          <Row label="사용자"     value={record.user} />
          <Row label="법인"       value={record.company} />
          <Row label="부서"       value={record.dept} />
          <Row label="위치"       value={record.location} />
          <Row label="제조사"     value={record.maker} />
          <Row label="모델"       value={record.model} />
          <Row label="시리얼"     value={record.serial} />
          <Row label="CPU"        value={record.cpu} />
          <Row label="RAM"        value={record.ram} />
          <Row label="구매일자"   value={record.purchaseDate ? fmtDate(record.purchaseDate) : undefined} />
          <Row label="사용일자"   value={record.useDate     ? fmtDate(record.useDate)     : undefined} />
          <Row label="반납예정일" value={record.returnDue   ? fmtDate(record.returnDue)   : undefined} />
          <Row label="반납일자"   value={record.returnDate  ? fmtDate(record.returnDate)  : undefined} />
          <Row label="단가"       value={record.price > 0   ? fmtKrw(record.price)        : undefined} />
          <Row label="문서번호"   value={record.docNo} />
          {record.verified && <Row label="실사확인" value="완료" />}
          <Row label="비고"       value={record.note} />
        </div>

        {error && <div className="px-5 pb-3 text-xs text-red-600">⚠️ {error}</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 반납 대상자 탭
// ─────────────────────────────────────────────────────────────────────────────
function ReturnTab({ onUpdate, companyLock = "" }: { onUpdate: (id: string, fields: Partial<HwRecord>) => Promise<void>; companyLock?: string }) {
  const [company,      setCompany]      = useState(companyLock);
  const [allRecords,   setAllRecords]   = useState<HwRecord[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [editRecord,   setEditRecord]   = useState<HwRecord | null>(null);
  const [detailRecord, setDetailRecord] = useState<HwRecord | null>(null);
  const today = Date.now();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ returnDue: "1" });
      if (company) p.set("company", company);
      const res  = await fetch(`/api/hw?${p}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setAllRecords(json.records ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [company]);

  useEffect(() => { load(); }, [load]);

  const handleSave = useCallback(async (id: string, fields: Partial<HwRecord>) => {
    await onUpdate(id, fields);
    setAllRecords(prev => prev.map(r => r.id === id ? { ...r, ...fields } : r));
  }, [onUpdate]);

  const returnRecords = useMemo(() => {
    return [...allRecords].sort((a, b) => String(a.returnDue).localeCompare(String(b.returnDue)));
  }, [allRecords]);

  const urgent = useMemo(() => returnRecords.filter(r => new Date(r.returnDue).getTime() - today <= 7*86400000), [returnRecords]);
  const soon   = useMemo(() => returnRecords.filter(r => { const t = new Date(r.returnDue).getTime()-today; return t>7*86400000&&t<=30*86400000; }), [returnRecords]);
  const later  = useMemo(() => returnRecords.filter(r => new Date(r.returnDue).getTime()-today > 30*86400000), [returnRecords]);

  const ReturnRow = ({ r }: { r: HwRecord }) => {
    const dd = dDay(r.returnDue);
    return (
      <tr className={`hover:bg-gray-50 transition-colors ${new Date(r.returnDue).getTime()<today ? "bg-red-50/40" : ""}`}>
        <td className="px-3 py-2.5 whitespace-nowrap"><span className={`text-sm font-bold ${dd.cls}`}>{dd.label}</span></td>
        <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap text-xs">{fmtDate(r.returnDue)}</td>
        <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap text-xs">{r.user||"-"}</td>
        <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap text-xs">{r.company||"-"}</td>
        <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap text-xs">{r.dept||"-"}</td>
        <td className="px-3 py-2.5 font-mono whitespace-nowrap text-xs cursor-pointer text-amber-600 hover:underline" onClick={() => setDetailRecord(r)}>{r.assetNo||"-"}</td>
        <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap max-w-[130px] truncate text-xs">{r.model||"-"}</td>
        <td className="px-3 py-2.5 text-xs flex items-center gap-2">
          {r.notionUrl && <a href={r.notionUrl} target="_blank" rel="noreferrer" className="text-amber-400 hover:text-amber-600 underline underline-offset-2">Notion ↗</a>}
          <button onClick={() => setEditRecord(r)} className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors">수정</button>
        </td>
      </tr>
    );
  };

  const TableSection = ({ title, items, cls }: { title:string; items:HwRecord[]; cls:string }) => {
    if (items.length === 0) return null;
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className={`px-5 py-3 border-b border-gray-100 flex items-center gap-2 ${cls}`}>
          <span className="text-sm font-bold">{title}</span>
          <span className="text-xs opacity-70">{items.length}건</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 text-gray-500 font-semibold text-xs">
              <tr>{["D-Day","반납예정일","사용자","법인명","부서","자산번호","모델명",""].map(h=><th key={h} className="px-3 py-2.5 text-left whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">{items.map(r => <ReturnRow key={r.id} r={r} />)}</tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-3">
        {!companyLock && (
          <div className="w-44">
            <label className="block text-xs font-semibold text-gray-500 mb-1">법인명 필터</label>
            <select value={company} onChange={e => setCompany(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300">
              <option value="">전체 법인</option>
              {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
        <div className={companyLock ? "" : "mt-5"}>
          <button onClick={load} disabled={loading}
            className="px-4 py-2 rounded-lg bg-yellow-500 text-white text-sm font-semibold hover:bg-yellow-600 disabled:opacity-50 transition-colors">
            {loading ? "불러오는 중…" : "새로고침"}
          </button>
        </div>
        {!loading && (
          <div className="mt-5 flex gap-3 text-xs">
            <span className="text-red-500 font-semibold">🔴 D-7 이내: {urgent.length}건</span>
            <span className="text-orange-500 font-semibold">🟡 D-30 이내: {soon.length}건</span>
            <span className="text-gray-500">◽ 그 외: {later.length}건</span>
          </div>
        )}
      </div>
      {loading ? (
        <div className="py-16 text-center text-gray-300 text-sm">불러오는 중…</div>
      ) : returnRecords.length === 0 ? (
        <div className="py-16 text-center text-gray-300 text-sm"><p className="text-4xl mb-3">✅</p><p>반납 예정 자산이 없습니다</p></div>
      ) : (
        <>
          <TableSection title="🔴 D-7 이내 — 즉시 확인 필요" items={urgent} cls="bg-red-50 text-red-700" />
          <TableSection title="🟡 D-30 이내 — 반납 임박"     items={soon}   cls="bg-yellow-50 text-yellow-700" />
          <TableSection title="◽ D-30 초과"                   items={later}  cls="bg-gray-50 text-gray-700" />
        </>
      )}
      {detailRecord && <AssetDetailModal record={detailRecord} onSave={onUpdate} onClose={() => setDetailRecord(null)} />}
      {editRecord && (
        <EditModal
          record={editRecord}
          fields={["returnDue","status","note"]}
          onSave={handleSave}
          onClose={() => setEditRecord(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 자산 검색 탭 (자체 on-demand fetch)
// ─────────────────────────────────────────────────────────────────────────────
function SearchTab({ companyLock = "", onUpdate }: { companyLock?: string; onUpdate?: (id: string, fields: Partial<HwRecord>) => Promise<void> }) {
  const [records,     setRecords]     = useState<HwRecord[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [search,      setSearch]      = useState("");
  const [company,     setCompany]     = useState(companyLock);
  const [editRecord,   setEditRecord]   = useState<HwRecord | null>(null);
  const [detailRecord, setDetailRecord] = useState<HwRecord | null>(null);
  const [status,   setStatus]   = useState("");
  const [location, setLocation] = useState("");
  const [searched, setSearched] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(""); setSearched(true);
    try {
      const q = new URLSearchParams();
      if (search)   q.set("search",   search);
      if (company)  q.set("company",  company);
      if (status)   q.set("status",   status);
      if (location) q.set("location", location);
      const res  = await fetch(`/api/hw?${q}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setRecords(json.records);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, [search, company, status, location]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1">사용자 / 자산번호 / 모델명</label>
            <input value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && load()}
              placeholder="검색어 입력 후 Enter"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          {!companyLock && (
            <div className="w-40">
              <label className="block text-xs font-semibold text-gray-500 mb-1">법인명</label>
              <select value={company} onChange={e => setCompany(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">전체</option>
                {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
          <div className="w-44">
            <label className="block text-xs font-semibold text-gray-500 mb-1">위치</label>
            <select value={location} onChange={e => setLocation(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              <option value="">전체</option>
              {["횡성센터","본사","향남","용인","성수","신사","오송"].map(l=><option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div className="w-48">
            <label className="block text-xs font-semibold text-gray-500 mb-1">상태</label>
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              <option value="">전체</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <button onClick={load} disabled={loading}
            className="px-5 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors">
            {loading ? "검색 중…" : "🔍 검색"}
          </button>
          <button onClick={() => { setSearch(""); setCompany(""); setLocation(""); setStatus(""); setRecords([]); setSearched(false); }}
            className="px-3 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-50 transition-colors">
            초기화
          </button>
        </div>
      </div>
      {error && <div className="px-4 py-3 bg-red-50 rounded-xl text-sm text-red-600">{error}</div>}
      {searched && !loading && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">검색 결과</span>
            <span className="text-xs text-gray-400">{records.length}건</span>
          </div>
          {records.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">조회된 자산이 없습니다</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500 font-semibold">
                  <tr>{["자산번호","사용자","법인명","부서","모델명","제조사","상태","사용일자","반납예정일","단가","실사",""].map(h=><th key={h} className="px-3 py-2.5 text-left whitespace-nowrap">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {records.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2.5 font-mono whitespace-nowrap cursor-pointer text-amber-600 hover:underline" onClick={() => setDetailRecord(r)}>{r.assetNo||"-"}</td>
                      <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">{r.user||"-"}</td>
                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{r.company||"-"}</td>
                      <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{r.dept||"-"}</td>
                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap max-w-[140px] truncate">{r.model||"-"}</td>
                      <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{r.maker||"-"}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_COLOR[r.status]??"bg-gray-100 text-gray-600"}`}>{r.status||"-"}</span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{fmtDate(r.useDate)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {r.returnDue ? <span className="flex items-center gap-1.5"><span className="text-gray-600">{fmtDate(r.returnDue)}</span><span className={`text-[11px] ${dDay(r.returnDue).cls}`}>{dDay(r.returnDue).label}</span></span> : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{fmtKrw(r.price)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-center">
                        {r.verified ? <span className="text-green-600 font-bold">✓</span> : <span className="text-gray-300">−</span>}
                      </td>
                      <td className="px-3 py-2.5 flex items-center gap-2">
                        {r.notionUrl && <a href={r.notionUrl} target="_blank" rel="noreferrer" className="text-amber-400 hover:text-amber-600 underline underline-offset-2">Notion ↗</a>}
                        {onUpdate && <button onClick={() => setEditRecord(r)} className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors">수정</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {!searched && (
        <div className="py-16 text-center text-gray-300 text-sm">
          <p className="text-4xl mb-3">💻</p><p>조건을 선택하고 검색 버튼을 눌러주세요</p>
        </div>
      )}
      {detailRecord && onUpdate && (
        <AssetDetailModal
          record={detailRecord}
          onSave={async (id, fields) => {
            await onUpdate(id, fields);
            setRecords(prev => prev.map(r => r.id === id ? { ...r, ...fields } : r));
          }}
          onClose={() => setDetailRecord(null)}
        />
      )}
      {editRecord && onUpdate && (
        <EditModal
          record={editRecord}
          fields={["status","returnDue","returnDate","useDate","verified","user","company","dept","location","note"]}
          onSave={async (id, fields) => {
            await onUpdate(id, fields);
            setRecords(prev => prev.map(r => r.id === id ? { ...r, ...fields } : r));
            setEditRecord(null);
          }}
          onClose={() => setEditRecord(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 엑셀 업로드 탭
// ─────────────────────────────────────────────────────────────────────────────
interface ExcelRow {
  assetNo:string; model:string; serial:string; maker:string; cpu:string; ram:string;
  company:string; user:string; dept:string; location:string;
  purchaseDate:string|number; price:number; useDate:string|number;
}
function excelDateToStr(val:string|number|undefined):string {
  if (!val) return "";
  if (typeof val==="number") return new Date((val-25569)*86400*1000).toISOString().slice(0,10);
  return String(val).trim().replace(/[./]/g,"-").slice(0,10);
}
const COL_MAP:{key:keyof ExcelRow;aliases:string[]}[]=[
  {key:"assetNo",aliases:["관리번호","자산번호","assetno","asset_no"]},
  {key:"model",aliases:["모델명","model"]},
  {key:"serial",aliases:["시리얼","시리얼넘버","serial","serial_number","s/n"]},
  {key:"maker",aliases:["제조사","maker","manufacturer"]},
  {key:"cpu",aliases:["cpu","프로세서"]},
  {key:"ram",aliases:["램","ram","memory"]},
  {key:"company",aliases:["법인","법인명","company"]},
  {key:"user",aliases:["사용자","user","name"]},
  {key:"dept",aliases:["부서","department","dept"]},
  {key:"location",aliases:["위치","location"]},
  {key:"purchaseDate",aliases:["구매년도","구매일자","구매날짜","purchasedate","purchase_date"]},
  {key:"price",aliases:["구매가격","단가","가격","price"]},
  {key:"useDate",aliases:["사용일자","사용날짜","usedate","use_date"]},
];
function buildColIndex(headers:string[]):Partial<Record<keyof ExcelRow,number>>{
  const idx:Partial<Record<keyof ExcelRow,number>>={};
  headers.forEach((h,i)=>{
    const norm=h.toLowerCase().replace(/\s+/g,"");
    for(const{key,aliases}of COL_MAP){if(aliases.some(a=>a.replace(/\s+/g,"")=== norm)){idx[key]=i;break;}}
  });
  return idx;
}
type UploadResult={index:number;user:string;assetNo:string;ok:boolean;error?:string};
interface DupItem{excelRow:ExcelRow;matchedBy:"serial"|"assetNo";existingUser:string;existingModel:string;existingStatus:string;existingNotionUrl:string;}

function DuplicateModal({dups,cleanCount,onSkipDups,onUploadAll,onCancel}:{
  dups:DupItem[];cleanCount:number;onSkipDups:()=>void;onUploadAll:()=>void;onCancel:()=>void;
}){
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel}/>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 bg-amber-50 border-b border-amber-200 flex items-start gap-3">
          <span className="text-2xl mt-0.5">⚠️</span>
          <div>
            <p className="font-bold text-amber-800 text-base">중복 데이터 감지됨</p>
            <p className="text-xs text-amber-700 mt-1">엑셀 {dups.length+cleanCount}건 중 <strong>{dups.length}건</strong>이 Notion에 이미 등록되어 있습니다.</p>
          </div>
          <button onClick={onCancel} className="ml-auto text-amber-400 hover:text-amber-700 text-xl font-bold">✕</button>
        </div>
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 font-semibold sticky top-0">
              <tr>{["중복기준","엑셀 사용자","엑셀 모델명","기존 사용자","기존 상태","Notion"].map(h=><th key={h} className="px-4 py-2.5 text-left whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dups.map((d,i)=>(
                <tr key={i} className="bg-amber-50/40 hover:bg-amber-50">
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700">
                      {d.matchedBy==="serial"?`시리얼: ${d.excelRow.serial}`:`자산번호: ${d.excelRow.assetNo}`}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-medium text-gray-800 whitespace-nowrap">{d.excelRow.user||"-"}</td>
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap max-w-[110px] truncate">{d.excelRow.model||"-"}</td>
                  <td className="px-4 py-2.5 text-gray-700 font-medium whitespace-nowrap">{d.existingUser||"-"}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_COLOR[d.existingStatus]??"bg-gray-100 text-gray-600"}`}>{d.existingStatus||"-"}</span>
                  </td>
                  <td className="px-4 py-2.5">{d.existingNotionUrl&&<a href={d.existingNotionUrl} target="_blank" rel="noreferrer" className="text-amber-400 hover:text-amber-600 underline underline-offset-2">열기 ↗</a>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row gap-3">
          {cleanCount>0&&<button onClick={onSkipDups} className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 transition-colors">✅ 중복 제외하고 {cleanCount}건만 등록</button>}
          <button onClick={onUploadAll} className="flex-1 py-2.5 rounded-xl bg-gray-700 text-white text-sm font-bold hover:bg-gray-800 transition-colors">전체 {dups.length+cleanCount}건 등록 (중복 포함)</button>
          <button onClick={onCancel} className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-600 text-sm hover:bg-gray-100">취소</button>
        </div>
      </div>
    </div>
  );
}

function ExcelUploadTab(){
  const fileRef=useRef<HTMLInputElement>(null);
  const [rows,setRows]=useState<ExcelRow[]>([]);
  const [fileName,setFile]=useState("");
  const [parseErr,setPErr]=useState("");
  const [uploading,setUploading]=useState(false);
  const [checking,setChecking]=useState(false);
  const [progress,setProgress]=useState(0);
  const [results,setResults]=useState<UploadResult[]|null>(null);
  const [summary,setSummary]=useState<{success:number;failed:number}|null>(null);
  const [showDupModal,setShowDupModal]=useState(false);
  const [dupItems,setDupItems]=useState<DupItem[]>([]);
  const [cleanRows,setCleanRows]=useState<ExcelRow[]>([]);

  const handleFile=async(file:File)=>{
    setPErr("");setRows([]);setResults(null);setSummary(null);
    setShowDupModal(false);setDupItems([]);setCleanRows([]);setFile(file.name);
    try{
      const XLSX=await import("xlsx");
      const buf=await file.arrayBuffer();
      const wb=XLSX.read(buf,{type:"array",cellDates:false});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const raw:(string|number|undefined)[][]=XLSX.utils.sheet_to_json(ws,{header:1,defval:"",blankrows:false}) as (string|number|undefined)[][];
      if(raw.length<2) throw new Error("데이터 행이 없습니다 (헤더 + 최소 1행 필요)");
      const headers=raw[0].map(h=>String(h??""));
      const colIdx=buildColIndex(headers);
      const parsed:ExcelRow[]=[];
      for(let i=1;i<raw.length;i++){
        const r=raw[i];
        const user=String(r[colIdx.user??-1]??"").trim();
        const assetNo=String(r[colIdx.assetNo??-1]??"").trim();
        if(!user&&!assetNo) continue;
        parsed.push({assetNo,user,
          model:String(r[colIdx.model??-1]??"").trim(),serial:String(r[colIdx.serial??-1]??"").trim(),
          maker:String(r[colIdx.maker??-1]??"").trim(),cpu:String(r[colIdx.cpu??-1]??"").trim(),
          ram:String(r[colIdx.ram??-1]??"").trim(),company:String(r[colIdx.company??-1]??"").trim(),
          dept:String(r[colIdx.dept??-1]??"").trim(),location:String(r[colIdx.location??-1]??"").trim(),
          purchaseDate:r[colIdx.purchaseDate??-1]??"",
          price:Number(String(r[colIdx.price??-1]??"").replace(/[^\d.]/g,""))||0,
          useDate:r[colIdx.useDate??-1]??"",
        });
      }
      if(parsed.length===0) throw new Error("유효한 데이터가 없습니다. 헤더 이름을 확인하세요.");
      setRows(parsed);
    }catch(e){setPErr(String(e));}
  };
  const handleDrop=(e:React.DragEvent)=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)handleFile(f);};
  const handleCheckAndUpload=async()=>{
    setChecking(true);setPErr("");
    try{
      const res=await fetch("/api/hw");const json=await res.json();
      if(!json.ok) throw new Error(json.error);
      const notionRecords:HwRecord[]=json.records;
      const serialSet=new Map<string,HwRecord>();
      const assetNoSet=new Map<string,HwRecord>();
      for(const nr of notionRecords){
        if(nr.serial) serialSet.set(nr.serial.trim().toLowerCase(),nr);
        if(nr.assetNo) assetNoSet.set(nr.assetNo.trim().toLowerCase(),nr);
      }
      const dups:DupItem[]=[];const clean:ExcelRow[]=[];
      for(const row of rows){
        const sk=row.serial?.trim().toLowerCase();const ak=row.assetNo?.trim().toLowerCase();
        let matched:HwRecord|undefined;let matchedBy:"serial"|"assetNo"="serial";
        if(sk&&serialSet.has(sk)){matched=serialSet.get(sk);matchedBy="serial";}
        else if(ak&&assetNoSet.has(ak)){matched=assetNoSet.get(ak);matchedBy="assetNo";}
        if(matched){dups.push({excelRow:row,matchedBy,existingUser:matched.user,existingModel:matched.model,existingStatus:matched.status,existingNotionUrl:matched.notionUrl});}
        else{clean.push(row);}
      }
      if(dups.length===0){await doUpload(rows);}else{setDupItems(dups);setCleanRows(clean);setShowDupModal(true);}
    }catch(e){setPErr(String(e));}finally{setChecking(false);}
  };
  const doUpload=async(targetRows:ExcelRow[])=>{
    setShowDupModal(false);setUploading(true);setProgress(0);setResults(null);setSummary(null);
    try{
      const timer=setInterval(()=>setProgress(p=>Math.min(p+Math.random()*12,88)),400);
      const convertedRows=targetRows.map(r=>({...r,purchaseDate:excelDateToStr(r.purchaseDate as string|number),useDate:excelDateToStr(r.useDate as string|number)}));
      const res=await fetch("/api/hw/upload",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({rows:convertedRows})});
      const json=await res.json();clearInterval(timer);setProgress(100);
      if(!json.ok) throw new Error(json.error);
      setResults(json.results);setSummary({success:json.success,failed:json.failed});
      // 신규 지급 이력 기록 (성공 건만)
      const successSet=new Set<number>((json.results as UploadResult[]).filter((r:UploadResult)=>r.ok).map((r:UploadResult)=>r.index));
      if(successSet.size>0){
        const now=new Date().toISOString();
        const events=convertedRows.filter((_,i)=>successSet.has(i)).map(r=>({
          id:crypto.randomUUID(),dispatchedAt:now,type:"신규" as const,
          assetNo:r.assetNo||"",model:r.model||"",serial:r.serial||"",
          user:r.user||"",company:r.company||"",dept:r.dept||"",useDate:r.useDate||"",
        }));
        fetch("/api/hw/dispatch-history",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(events)}).catch(console.error);
      }
    }catch(e){setPErr(String(e));}finally{setUploading(false);}
  };
  const reset=()=>{setRows([]);setFile("");setPErr("");setResults(null);setSummary(null);setProgress(0);setShowDupModal(false);setDupItems([]);setCleanRows([]);if(fileRef.current)fileRef.current.value="";};

  return(
    <div className="space-y-4">
      {showDupModal&&<DuplicateModal dups={dupItems} cleanCount={cleanRows.length} onSkipDups={()=>doUpload(cleanRows)} onUploadAll={()=>doUpload(rows)} onCancel={()=>setShowDupModal(false)}/>}
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-xs text-teal-700 space-y-1">
        <p className="font-semibold text-sm text-teal-800">📋 업체 제공 엑셀 → Notion 자동 등록</p>
        <p>업체가 제공한 엑셀 파일을 업로드하면 <strong>사용중</strong> 상태로 NT/DT 트래커에 자동 등록됩니다.</p>
        <p className="text-teal-600">지원 컬럼: 관리번호 · 모델명 · 시리얼 · 제조사 · CPU · 램 · 법인 · 사용자 · 부서 · 위치 · 구매년도 · 구매가격 · 사용일자</p>
      </div>
      {rows.length===0&&!parseErr&&(
        <div onDrop={handleDrop} onDragOver={e=>e.preventDefault()}
          className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-10 text-center hover:border-teal-400 hover:bg-teal-50/30 transition-colors cursor-pointer"
          onClick={()=>fileRef.current?.click()}>
          <div className="text-4xl mb-3">📂</div>
          <p className="text-sm font-semibold text-gray-700">엑셀 파일을 드래그하거나 클릭하여 선택</p>
          <p className="text-xs text-gray-400 mt-1">.xlsx · .xls 지원</p>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)handleFile(f);}}/>
        </div>
      )}
      {parseErr&&(
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-start gap-3">
          <span className="text-xl">⚠️</span>
          <div><p className="font-semibold">파일 파싱 오류</p><p className="mt-1 text-xs">{parseErr}</p><button onClick={reset} className="mt-2 text-xs underline text-red-600">다시 선택</button></div>
        </div>
      )}
      {rows.length>0&&!summary&&(
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <div><span className="text-sm font-semibold text-gray-800">📄 {fileName}</span><span className="ml-2 text-xs text-gray-400">{rows.length}개 행 파싱 완료</span></div>
              <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-700 underline">취소</button>
            </div>
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500 font-semibold sticky top-0">
                  <tr>{["#","관리번호","사용자","법인","부서","모델명","제조사","시리얼","구매가격","사용일자"].map(h=><th key={h} className="px-3 py-2.5 text-left whitespace-nowrap">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r,i)=>(
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-400">{i+1}</td>
                      <td className="px-3 py-2 font-mono text-gray-700 whitespace-nowrap">{r.assetNo||"-"}</td>
                      <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{r.user||"-"}</td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.company||"-"}</td>
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{r.dept||"-"}</td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap max-w-[120px] truncate">{r.model||"-"}</td>
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{r.maker||"-"}</td>
                      <td className="px-3 py-2 font-mono text-gray-400 text-[11px] whitespace-nowrap">{r.serial||"-"}</td>
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{r.price>0?`₩${r.price.toLocaleString("ko-KR")}`:"-"}</td>
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{excelDateToStr(r.useDate as string|number)||"-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {!uploading&&!checking&&(
            <div className="flex gap-3">
              <button onClick={handleCheckAndUpload} className="flex-1 py-3 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 transition-colors shadow-sm">
                🔍 중복 확인 후 Notion 등록 ({rows.length}건)
              </button>
              <button onClick={reset} className="px-5 py-3 rounded-xl border border-gray-300 text-gray-600 text-sm hover:bg-gray-50">취소</button>
            </div>
          )}
          {checking&&(
            <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-3">
              <svg className="animate-spin w-5 h-5 text-teal-500 shrink-0" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              <div><p className="text-sm font-semibold text-gray-700">Notion 데이터와 중복 여부 확인 중…</p><p className="text-xs text-gray-400 mt-0.5">시리얼 번호 · 자산번호 기준으로 비교합니다</p></div>
            </div>
          )}
          {uploading&&(
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm font-semibold text-gray-700 mb-3">Notion 등록 중… {Math.round(progress)}%</p>
              <div className="w-full bg-gray-100 rounded-full h-2.5"><div className="bg-teal-500 h-2.5 rounded-full transition-all duration-500" style={{width:`${progress}%`}}/></div>
              <p className="text-xs text-gray-400 mt-2">Notion API 제한으로 순차 처리됩니다.</p>
            </div>
          )}
        </>
      )}
      {summary&&results&&(
        <div className="space-y-4">
          <div className={`rounded-xl p-5 border ${summary.failed===0?"bg-green-50 border-green-200":"bg-yellow-50 border-yellow-200"}`}>
            <p className={`text-base font-bold mb-1 ${summary.failed===0?"text-green-800":"text-yellow-800"}`}>{summary.failed===0?"✅ 전체 등록 완료!":"⚠️ 등록 완료 (일부 실패)"}</p>
            <p className="text-sm text-gray-700">성공 <span className="font-bold text-green-700">{summary.success}</span>건 · 실패 <span className="font-bold text-red-600">{summary.failed}</span>건</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100"><p className="text-sm font-semibold text-gray-700">등록 상세 결과</p></div>
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500 font-semibold sticky top-0">
                  <tr>{["#","사용자","관리번호","결과","오류 내용"].map(h=><th key={h} className="px-3 py-2.5 text-left">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {results.map((r,i)=>(
                    <tr key={i} className={r.ok?"":"bg-red-50/40"}>
                      <td className="px-3 py-2 text-gray-400">{r.index+1}</td>
                      <td className="px-3 py-2 font-medium text-gray-800">{r.user||"-"}</td>
                      <td className="px-3 py-2 font-mono text-gray-600">{r.assetNo||"-"}</td>
                      <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${r.ok?"bg-green-100 text-green-700":"bg-red-100 text-red-700"}`}>{r.ok?"✓ 성공":"✗ 실패"}</span></td>
                      <td className="px-3 py-2 text-red-500 text-[11px]">{r.error||""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <button onClick={reset} className="w-full py-2.5 rounded-xl border border-gray-300 text-gray-600 text-sm hover:bg-gray-50">새 파일 업로드</button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 행낭 발송지 출력 탭
// ─────────────────────────────────────────────────────────────────────────────
interface LabelEntry {
  id: string;
  recipientOrg: string;
  recipientName: string;
  user: string;
  assetNo: string;
  shipType: string;
}

interface PrintHistoryRecord {
  id: string;
  printedAt: string;   // ISO timestamp (most important)
  senderInfo: string;
  labels: LabelEntry[];
}

function LabelPrintTab({
  records,
  recordsReady,
  onLoadRecords,
}: {
  records: HwRecord[];
  recordsReady: boolean;
  onLoadRecords: () => void;
}) {
  const [senderInfo, setSenderInfo] = useState("idsTrust 자산관리파트 백승윤");
  const [labels, setLabels] = useState<LabelEntry[]>([
    { id: "1", recipientOrg: "", recipientName: "", user: "", assetNo: "", shipType: "신규지급" },
  ]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<string>("");
  const [pickerSearch, setPickerSearch] = useState("");

  // 출력 이력
  const [history, setHistory]               = useState<PrintHistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory]       = useState(false);
  const [historySearch, setHistorySearch]   = useState("");
  const [showCleanup, setShowCleanup]       = useState(false);
  const [cleanupBusy, setCleanupBusy]       = useState(false);

  useEffect(() => {
    if (!recordsReady) onLoadRecords();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 이력 로드
  useEffect(() => {
    setHistoryLoading(true);
    fetch("/api/label-history")
      .then(r => r.json())
      .then(j => {
        if (j.ok) {
          const data: PrintHistoryRecord[] = j.history ?? [];
          setHistory(data);
          if (data.length >= 190) setShowCleanup(true);
        }
      })
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, []);

  // 출력 이력 → 라벨별 플랫 행 변환 (각 라벨이 테이블 한 행)
  const historyRows = useMemo(() => {
    const rows: {
      historyId: string; printedAt: string; senderInfo: string;
      labelIndex: number; recipientOrg: string; recipientName: string;
      user: string; assetNo: string; shipType: string;
    }[] = [];
    history.forEach(h => {
      h.labels.forEach((l, i) => {
        rows.push({
          historyId: h.id, printedAt: h.printedAt, senderInfo: h.senderInfo,
          labelIndex: i + 1,
          recipientOrg: l.recipientOrg, recipientName: l.recipientName,
          user: l.user, assetNo: l.assetNo, shipType: l.shipType,
        });
      });
    });
    return rows;
  }, [history]);

  // 키워드 필터
  const filteredRows = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return historyRows;
    return historyRows.filter(r =>
      r.printedAt.includes(q) ||
      r.senderInfo.toLowerCase().includes(q) ||
      r.recipientOrg.toLowerCase().includes(q) ||
      r.recipientName.toLowerCase().includes(q) ||
      r.user.toLowerCase().includes(q) ||
      r.assetNo.toLowerCase().includes(q) ||
      r.shipType.toLowerCase().includes(q)
    );
  }, [historyRows, historySearch]);

  const filteredRecords = useMemo(() => {
    if (!pickerSearch.trim()) return records.slice(0, 50);
    const q = pickerSearch.toLowerCase();
    return records
      .filter(r =>
        (r.user || "").toLowerCase().includes(q) ||
        (r.assetNo || "").toLowerCase().includes(q) ||
        (r.company || "").toLowerCase().includes(q) ||
        (r.dept || "").toLowerCase().includes(q)
      )
      .slice(0, 40);
  }, [records, pickerSearch]);

  function updateLabel(id: string, field: keyof LabelEntry, val: string) {
    setLabels(prev => prev.map(l => l.id === id ? { ...l, [field]: val } : l));
  }

  function addLabel() {
    setLabels(prev => [...prev, {
      id: Date.now().toString(),
      recipientOrg: "", recipientName: "", user: "", assetNo: "", shipType: "신규지급",
    }]);
  }

  function removeLabel(id: string) {
    if (labels.length <= 1) return;
    setLabels(prev => prev.filter(l => l.id !== id));
  }

  function pickRecord(r: HwRecord) {
    setLabels(prev => prev.map(l => l.id === pickerTarget ? {
      ...l,
      recipientOrg: r.company || "",
      recipientName: r.user || "",
      user: r.user || "",
      assetNo: r.assetNo || "",
    } : l));
    setShowPicker(false);
    setPickerTarget("");
    setPickerSearch("");
  }

  async function printLabels() {
    const warnBar = `<div class="warning">♦파손주의♦&nbsp;&nbsp;&nbsp;♦상하주의♦&nbsp;&nbsp;&nbsp;♦취급주의♦</div>`;
    const labelHtml = labels.map((label, idx) => `
<div class="label">
  ${warnBar}
  <div class="body">
    <div class="from-to">
      <div>발신 : ${label.recipientOrg ? senderInfo : senderInfo}</div>
      <div>수신 : ${label.recipientOrg || "&nbsp;"}</div>
    </div>
    <div class="to-name">${label.recipientName || "&nbsp;"} 님 앞</div>
    <div class="ship-box">[ ${label.shipType} - 0 실사용자 : ${label.user || "&nbsp;"} 님 ]</div>
    <div class="contents">내용 : ${label.assetNo || "&nbsp;"}</div>
  </div>
  ${warnBar}
  <div class="page-num">${idx + 1} 페이지</div>
  ${warnBar}
</div>`).join("\n");

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4 portrait; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Malgun Gothic', '맑은 고딕', AppleGothic, sans-serif; width: 210mm; }
  .label {
    width: 210mm;
    height: 148.5mm;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-bottom: 2px dashed #aaa;
    page-break-inside: avoid;
  }
  .label:last-child { border-bottom: none; }
  .warning {
    background: #cc0000;
    color: white;
    font-size: 19pt;
    font-weight: 900;
    text-align: center;
    padding: 5.5mm 0;
    letter-spacing: 5px;
    flex-shrink: 0;
  }
  .body {
    flex: 1;
    padding: 5mm 18mm;
    display: flex;
    flex-direction: column;
    justify-content: space-around;
  }
  .from-to { font-size: 13pt; line-height: 2; }
  .to-name {
    font-size: 26pt;
    font-weight: 900;
    text-align: center;
  }
  .ship-box {
    border: 2.5px solid #222;
    text-align: center;
    padding: 2.5mm 0;
    font-size: 12pt;
    font-weight: bold;
  }
  .contents { font-size: 16pt; font-weight: bold; }
  .page-num {
    text-align: center;
    font-size: 15pt;
    color: #999;
    font-weight: bold;
    padding: 1.5mm 0;
    flex-shrink: 0;
  }
</style>
</head>
<body>
${labelHtml}
<script>window.onload=function(){window.print();}<\/script>
</body>
</html>`;

    const w = window.open("", "_blank", "width=900,height=750");
    if (w) { w.document.write(html); w.document.close(); }

    // 출력 이력 저장
    const record: PrintHistoryRecord = {
      id: Date.now().toString(),
      printedAt: new Date().toISOString(),
      senderInfo,
      labels: labels.map(l => ({ ...l })),
    };
    try {
      const res = await fetch("/api/label-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      });
      if (res.ok) setHistory(prev => [record, ...prev]);
    } catch {
      // 저장 실패해도 출력은 완료됨 — 조용히 무시
    }
  }

  async function deleteHistory(id: string) {
    try {
      await fetch(`/api/label-history?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      setHistory(prev => prev.filter(h => h.id !== id));
    } catch { /* silent */ }
  }

  async function cleanupHistory(keepLast: number | "all") {
    setCleanupBusy(true);
    try {
      const url = keepLast === "all"
        ? "/api/label-history"
        : `/api/label-history?keepLast=${keepLast}`;
      await fetch(url, { method: "DELETE" });
      if (keepLast === "all") {
        setHistory([]);
      } else {
        setHistory(prev => prev.slice(0, keepLast));
      }
      setShowCleanup(false);
    } catch { /* silent */ }
    finally { setCleanupBusy(false); }
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}.${pad(d.getMonth()+1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  return (
    <div className="space-y-4">
      {/* 발신자 정보 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-bold text-gray-700 mb-3">📮 발신자 정보</h3>
        <div>
          <label className="text-xs text-gray-500 font-semibold block mb-1">발신 (회사/부서/이름)</label>
          <input
            value={senderInfo}
            onChange={e => setSenderInfo(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="예: idsTrust 자산관리파트 홍길동"
          />
        </div>
      </div>

      {/* 라벨 목록 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-700">🏷️ 발송 라벨 ({labels.length}장)</h3>
          <button
            onClick={addLabel}
            className="text-xs font-semibold text-amber-600 border border-amber-200 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors"
          >
            + 라벨 추가
          </button>
        </div>

        {labels.map((label, idx) => (
          <div key={label.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-400">{idx + 1}번 라벨</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setPickerTarget(label.id); setPickerSearch(""); setShowPicker(true); }}
                  className="text-xs text-amber-600 border border-blue-200 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg font-semibold transition-colors"
                >
                  📋 자산에서 불러오기
                </button>
                {labels.length > 1 && (
                  <button onClick={() => removeLabel(label.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 font-semibold block mb-1">수신 (회사/부서)</label>
                <input value={label.recipientOrg} onChange={e => updateLabel(label.id, "recipientOrg", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="예: 시지바이오 인체품질팀" />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-semibold block mb-1">수신자 이름</label>
                <input value={label.recipientName} onChange={e => updateLabel(label.id, "recipientName", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="예: 임진규" />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-semibold block mb-1">실사용자</label>
                <input value={label.user} onChange={e => updateLabel(label.id, "user", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="예: 임진규" />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-semibold block mb-1">내용 (자산번호)</label>
                <input value={label.assetNo} onChange={e => updateLabel(label.id, "assetNo", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="예: 04-N3439" />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-semibold block mb-1">지급 유형</label>
                <select value={label.shipType} onChange={e => updateLabel(label.id, "shipType", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                  <option>신규지급</option>
                  <option>반납</option>
                  <option>교환</option>
                  <option>수리</option>
                  <option>대여</option>
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 출력 버튼 */}
      <button
        onClick={printLabels}
        className="w-full py-3 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 transition-colors shadow-sm"
      >
        🖨️ 행낭 발송지 출력 ({labels.length}장) — A4 1매에 2장
      </button>

      {/* ── 190건 경고 팝업 ── */}
      {showCleanup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⚠️</span>
              <div>
                <div className="font-bold text-gray-800 text-base">출력 이력이 {history.length}건에 달했습니다</div>
                <div className="text-xs text-gray-500 mt-0.5">최대 200건까지 저장됩니다. 오래된 이력을 정리해 주세요.</div>
              </div>
            </div>
            <div className="space-y-2">
              <button
                disabled={cleanupBusy}
                onClick={() => cleanupHistory(100)}
                className="w-full py-2.5 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 transition-colors disabled:opacity-50"
              >
                최근 100건만 남기기 ({Math.max(0, history.length - 100)}건 삭제)
              </button>
              <button
                disabled={cleanupBusy}
                onClick={() => cleanupHistory(50)}
                className="w-full py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition-colors disabled:opacity-50"
              >
                최근 50건만 남기기 ({Math.max(0, history.length - 50)}건 삭제)
              </button>
              <button
                disabled={cleanupBusy}
                onClick={() => cleanupHistory("all")}
                className="w-full py-2.5 rounded-xl border border-red-300 text-red-500 text-sm font-bold hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                전체 삭제
              </button>
            </div>
            <button
              onClick={() => setShowCleanup(false)}
              className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              나중에 정리하기
            </button>
          </div>
        </div>
      )}

      {/* ── 출력 이력 ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">

        {/* 헤더 */}
        <button
          onClick={() => setShowHistory(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
        >
          <span className="text-sm font-bold text-gray-700 flex items-center gap-2">
            📋 출력 이력
            {historyRows.length > 0 && (
              <span className="text-xs font-semibold bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">
                {historyRows.length}행
              </span>
            )}
            {history.length >= 190 && (
              <span
                onClick={e => { e.stopPropagation(); setShowCleanup(true); }}
                className="text-xs font-bold bg-red-100 text-red-500 px-2 py-0.5 rounded-full cursor-pointer hover:bg-red-200 transition-colors"
              >
                ⚠️ 정리 필요
              </span>
            )}
          </span>
          <span className="text-gray-400 text-xs">{showHistory ? "▲ 접기" : "▼ 펼치기"}</span>
        </button>

        {showHistory && (
          <div className="border-t border-gray-100">

            {/* 검색 입력 */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <span className="text-gray-400 text-sm">🔍</span>
              <input
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                placeholder="날짜, 발신, 수신처, 수신자, 자산번호 등으로 검색..."
                className="flex-1 text-sm focus:outline-none text-gray-700 placeholder-gray-300"
              />
              {historySearch && (
                <button onClick={() => setHistorySearch("")} className="text-gray-300 hover:text-gray-500 text-xs">
                  ✕
                </button>
              )}
              <span className="text-xs text-gray-400 whitespace-nowrap">
                {filteredRows.length}건{historySearch && ` / ${historyRows.length}건`}
              </span>
            </div>

            {/* 테이블 */}
            {historyLoading ? (
              <div className="text-center py-8 text-sm text-gray-400 animate-pulse">이력 불러오는 중…</div>
            ) : historyRows.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-400">출력 이력이 없습니다</div>
            ) : filteredRows.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-400">
                <div className="text-2xl mb-2">😕</div>
                &apos;{historySearch}&apos; 에 해당하는 이력이 없습니다
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse min-w-[780px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {["출력일시", "발신", "수신(회사/부서)", "수신자 이름", "실사용자", "자산번호", "지급유형", ""].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row, idx) => {
                      // 같은 출력건(historyId)의 첫 번째 행이면 날짜·발신·삭제버튼 표시
                      const isFirstOfGroup =
                        idx === 0 || filteredRows[idx - 1].historyId !== row.historyId;
                      const groupRowCount = filteredRows.filter(r => r.historyId === row.historyId).length;

                      return (
                        <tr
                          key={`${row.historyId}-${row.labelIndex}`}
                          className={`border-b border-gray-50 hover:bg-amber-50/30 transition-colors ${
                            isFirstOfGroup && idx !== 0 ? "border-t-2 border-t-gray-200" : ""
                          }`}
                        >
                          {/* 출력일시 — 같은 그룹 첫 행에만 표시 */}
                          <td className="px-3 py-2.5 whitespace-nowrap align-top">
                            {isFirstOfGroup ? (
                              <div>
                                <span className="font-bold text-amber-600">{formatDate(row.printedAt)}</span>
                                {groupRowCount > 1 && (
                                  <span className="ml-1 text-[10px] text-gray-400">({groupRowCount}장)</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-200">│</span>
                            )}
                          </td>
                          {/* 발신 — 같은 그룹 첫 행에만 표시 */}
                          <td className="px-3 py-2.5 align-top max-w-[120px]">
                            {isFirstOfGroup ? (
                              <span className="text-gray-600 line-clamp-2">{row.senderInfo || "—"}</span>
                            ) : null}
                          </td>
                          {/* 라벨 항목들 */}
                          <td className="px-3 py-2.5 text-gray-700 font-medium">{row.recipientOrg || <span className="text-gray-300">—</span>}</td>
                          <td className="px-3 py-2.5 text-gray-700 font-medium">{row.recipientName || <span className="text-gray-300">—</span>}</td>
                          <td className="px-3 py-2.5 text-gray-700">{row.user || <span className="text-gray-300">—</span>}</td>
                          <td className="px-3 py-2.5 font-mono text-gray-700">{row.assetNo || <span className="text-gray-300">—</span>}</td>
                          <td className="px-3 py-2.5">
                            <span className="bg-amber-50 text-amber-600 px-2 py-0.5 rounded-md font-semibold whitespace-nowrap">
                              {row.shipType}
                            </span>
                          </td>
                          {/* 삭제 — 같은 그룹 첫 행에만 표시 */}
                          <td className="px-2 py-2.5 text-right align-top">
                            {isFirstOfGroup && (
                              <button
                                onClick={() => deleteHistory(row.historyId)}
                                className="text-gray-300 hover:text-red-400 transition-colors px-1"
                                title="이 출력건 삭제"
                              >
                                ✕
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        )}
      </div>

      {/* 자산 검색 피커 모달 */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setShowPicker(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[70vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b flex items-center justify-between shrink-0">
              <div>
                <div className="font-bold text-gray-800 text-sm">HW 자산에서 불러오기</div>
                <div className="text-xs text-gray-400 mt-0.5">선택하면 수신자 정보가 자동 입력됩니다</div>
              </div>
              <button onClick={() => setShowPicker(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-4 border-b shrink-0">
              <input
                value={pickerSearch}
                onChange={e => setPickerSearch(e.target.value)}
                autoFocus
                placeholder="사용자명, 자산번호, 법인명으로 검색..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              {!recordsReady && (
                <div className="text-xs text-gray-400 mt-2 text-center animate-pulse">자산 데이터 불러오는 중…</div>
              )}
            </div>
            <div className="overflow-y-auto flex-1">
              {filteredRecords.map(r => (
                <button key={r.id} onClick={() => pickRecord(r)}
                  className="w-full text-left px-5 py-3 hover:bg-amber-50 border-b border-gray-50 last:border-0 transition-colors">
                  <div className="text-sm font-semibold text-gray-800">{r.user || "사용자 없음"}</div>
                  <div className="text-xs text-gray-400 mt-0.5 flex gap-2">
                    {r.assetNo && <span className="font-mono">{r.assetNo}</span>}
                    {r.company && <span>{r.company}</span>}
                    {r.dept && <span>· {r.dept}</span>}
                    {r.model && <span className="text-gray-300">· {r.model}</span>}
                  </div>
                </button>
              ))}
              {recordsReady && filteredRecords.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  {pickerSearch ? "검색 결과 없음" : "자산 없음"}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 자산지급 현황 탭
// ─────────────────────────────────────────────────────────────────────────────
function DispatchHistoryTab() {
  const [history, setHistory] = useState<DispatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [typeFilter, setTypeFilter] = useState<"전체"|"재고"|"신규">("전체");
  const [yearFilter, setYearFilter] = useState(() => String(new Date().getFullYear()));

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/hw/dispatch-history");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setHistory(json.history);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const years = useMemo(() => {
    const ys = new Set<string>();
    for (const r of history) ys.add(r.dispatchedAt.slice(0, 4));
    ys.add(String(new Date().getFullYear()));
    return [...ys].sort().reverse();
  }, [history]);

  const filtered = useMemo(() => {
    let h = history.filter(r => r.dispatchedAt.startsWith(yearFilter));
    if (typeFilter !== "전체") h = h.filter(r => r.type === typeFilter);
    return h;
  }, [history, yearFilter, typeFilter]);

  const monthlyStats = useMemo(() => {
    const result: { month: string; label: string; stock: number; newCount: number; total: number }[] = [];
    for (let m = 1; m <= 12; m++) {
      result.push({ month: `${yearFilter}-${String(m).padStart(2,"0")}`, label: `${m}월`, stock: 0, newCount: 0, total: 0 });
    }
    for (const r of history.filter(r => r.dispatchedAt.startsWith(yearFilter))) {
      const idx = parseInt(r.dispatchedAt.slice(5, 7), 10) - 1;
      if (idx >= 0 && idx < 12) {
        if (r.type === "재고") result[idx].stock++;
        else result[idx].newCount++;
        result[idx].total++;
      }
    }
    return result;
  }, [history, yearFilter]);

  const maxMonthly = Math.max(...monthlyStats.map(m => m.total), 1);
  const stockTotal = filtered.filter(r => r.type === "재고").length;
  const newTotal   = filtered.filter(r => r.type === "신규").length;

  const chartW = 560; const chartH = 160; const barArea = chartH - 10;
  const slotW  = chartW / 12; const barW = Math.floor(slotW * 0.32);

  return (
    <div className="space-y-4">
      {/* 헤더 / 필터 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[160px]">
          <p className="text-sm font-bold text-gray-800">자산지급 현황</p>
          <p className="text-xs text-gray-400 mt-0.5">재고/신규 노트북 지급 이력 및 월별 건수</p>
        </div>
        <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
          {years.map(y => <option key={y} value={y}>{y}년</option>)}
        </select>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
          {(["전체","재고","신규"] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-2 transition-colors ${typeFilter===t ? "bg-indigo-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
              {t}
            </button>
          ))}
        </div>
        <button onClick={load} disabled={loading}
          className="px-4 py-2 rounded-lg bg-indigo-500 text-white text-sm font-semibold hover:bg-indigo-600 disabled:opacity-50 transition-colors">
          {loading ? "불러오는 중…" : "새로고침"}
        </button>
      </div>

      {error && <div className="px-4 py-3 bg-red-50 rounded-xl text-sm text-red-600">⚠️ {error}</div>}

      {/* 요약 카드 */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-indigo-500">전체 지급</p>
            <p className="text-2xl font-bold text-indigo-700 mt-1">{filtered.length}<span className="text-sm font-normal ml-1">건</span></p>
            <p className="text-xs text-indigo-400 mt-0.5">{yearFilter}년</p>
          </div>
          <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-purple-500">재고 지급</p>
            <p className="text-2xl font-bold text-purple-700 mt-1">{stockTotal}<span className="text-sm font-normal ml-1">건</span></p>
            <p className="text-xs text-purple-400 mt-0.5">재고 노트북 출고완료</p>
          </div>
          <div className="bg-teal-50 border border-teal-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-teal-500">신규 지급</p>
            <p className="text-2xl font-bold text-teal-700 mt-1">{newTotal}<span className="text-sm font-normal ml-1">건</span></p>
            <p className="text-xs text-teal-400 mt-0.5">신규 구매 엑셀 등록</p>
          </div>
        </div>
      )}

      {/* 월별 막대 차트 */}
      {!loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-bold text-gray-700 mb-4">{yearFilter}년 월별 지급 현황</p>
          <div className="overflow-x-auto">
            <svg width="100%" viewBox={`0 0 ${chartW} ${chartH + 28}`} style={{ minWidth: 360 }}>
              {/* 격자선 */}
              {[0.25,0.5,0.75,1].map(f => {
                const y = chartH - f * barArea;
                return (
                  <g key={f}>
                    <line x1={0} y1={y} x2={chartW} y2={y} stroke="#f3f4f6" strokeWidth={1}/>
                    <text x={2} y={y-2} fontSize={8} fill="#d1d5db">{Math.round(f*maxMonthly)}</text>
                  </g>
                );
              })}
              {/* 막대 */}
              {monthlyStats.map((m, i) => {
                const cx   = slotW * i + slotW / 2;
                const sH   = maxMonthly > 0 ? (m.stock    / maxMonthly) * barArea : 0;
                const nH   = maxMonthly > 0 ? (m.newCount / maxMonthly) * barArea : 0;
                const topY = chartH - Math.max(sH, nH);
                return (
                  <g key={m.month}>
                    <rect x={cx-barW-1} y={chartH-sH} width={barW} height={sH} fill="#a855f7" rx={2} opacity={0.85}/>
                    <rect x={cx+1}      y={chartH-nH} width={barW} height={nH} fill="#14b8a6" rx={2} opacity={0.85}/>
                    <text x={cx} y={chartH+13} textAnchor="middle" fontSize={9} fill="#9ca3af">{m.label}</text>
                    {m.total > 0 && (
                      <text x={cx} y={topY-3} textAnchor="middle" fontSize={9} fill="#374151" fontWeight="600">{m.total}</text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-purple-400 inline-block"/>재고 지급</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-teal-400 inline-block"/>신규 지급</span>
          </div>
        </div>
      )}

      {/* 월별 집계 테이블 */}
      {!loading && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-sm font-bold text-gray-700">월별 집계</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500 font-semibold">
                <tr>
                  <th className="px-4 py-2.5 text-left">월</th>
                  <th className="px-4 py-2.5 text-right">재고 지급</th>
                  <th className="px-4 py-2.5 text-right">신규 지급</th>
                  <th className="px-4 py-2.5 text-right">합계</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {monthlyStats.map(m => (
                  <tr key={m.month} className={`hover:bg-gray-50 ${m.total===0?"opacity-40":""}`}>
                    <td className="px-4 py-2.5 font-medium text-gray-800">{m.label}</td>
                    <td className="px-4 py-2.5 text-right text-purple-600 font-semibold">{m.stock||"-"}</td>
                    <td className="px-4 py-2.5 text-right text-teal-600 font-semibold">{m.newCount||"-"}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-gray-900">{m.total||"-"}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-bold border-t-2 border-gray-200">
                  <td className="px-4 py-2.5 text-gray-700">합계</td>
                  <td className="px-4 py-2.5 text-right text-purple-700">{monthlyStats.reduce((s,m)=>s+m.stock,0)}</td>
                  <td className="px-4 py-2.5 text-right text-teal-700">{monthlyStats.reduce((s,m)=>s+m.newCount,0)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-900">{monthlyStats.reduce((s,m)=>s+m.total,0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 지급 이력 상세 */}
      {!loading && filtered.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-bold text-gray-700">지급 이력</p>
            <span className="text-xs text-gray-400">{filtered.length}건</span>
          </div>
          <div className="overflow-x-auto overflow-y-auto max-h-96">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500 font-semibold sticky top-0">
                <tr>{["지급일자","유형","자산번호","사용자","법인","부서","모델명","시리얼"].map(h=>(
                  <th key={h} className="px-3 py-2.5 text-left whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.slice(0,300).map(r=>(
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 whitespace-nowrap text-gray-500">{r.dispatchedAt.slice(0,10)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${r.type==="재고"?"bg-purple-100 text-purple-700":"bg-teal-100 text-teal-700"}`}>
                        {r.type}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono whitespace-nowrap">{r.assetNo||"-"}</td>
                    <td className="px-3 py-2.5 font-medium whitespace-nowrap">{r.user||"-"}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{r.company||"-"}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{r.dept||"-"}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap max-w-[130px] truncate">{r.model||"-"}</td>
                    <td className="px-3 py-2.5 font-mono whitespace-nowrap">{r.serial||"-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && filtered.length === 0 && !error && (
        <div className="py-16 text-center text-gray-300">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-sm">지급 이력이 없습니다</p>
          <p className="text-xs mt-2 text-gray-300">출고준비완료 전환 또는 엑셀 등록 시 자동으로 기록됩니다</p>
        </div>
      )}

      {loading && <div className="py-16 text-center text-gray-300 text-sm">불러오는 중…</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 메인 HwPanel — 데이터 1회 fetch, 모든 탭에 props 전달
// ─────────────────────────────────────────────────────────────────────────────
type Tab = "dashboard"|"shipment"|"return"|"search"|"upload"|"dispatch"|"label";

interface DispatchRecord {
  id: string;
  dispatchedAt: string;
  type: "재고" | "신규";
  assetNo: string;
  model: string;
  serial: string;
  user: string;
  company: string;
  dept: string;
  useDate: string;
}

export default function HwPanel({ company = "", initialStats }: { company?: string; initialStats?: HwStats | null }) {
  const [tab, setTab] = useState<Tab>("dashboard");

  // ── 대시보드 전용 경량 통계 (즉시 로드) ──────────────────────────────────
  const [stats,       setStats]       = useState<HwStats | null>(initialStats ?? null);
  const [statsLoading, setStatsLoading] = useState(!initialStats);
  const [statsError,   setStatsError]  = useState("");
  const [missingEnv,   setMissingEnv]  = useState<string | null>(null);

  // ── 목록 탭용 전체 레코드 (필요 시 lazy load) ─────────────────────────────
  const [records,      setRecords]      = useState<HwRecord[]>([]);
  const recordsRef = useRef<HwRecord[]>([]);
  recordsRef.current = records;
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsReady,   setRecordsReady]   = useState(false);
  const [recordsError,   setRecordsError]   = useState("");

  // stats 로드 (대시보드 진입 시)
  const loadStats = useCallback(async () => {
    setStatsLoading(true); setStatsError("");
    try {
      const statsUrl = company ? `/api/hw/stats?company=${encodeURIComponent(company)}` : "/api/hw/stats";
      const res  = await fetch(statsUrl);
      const json = await res.json();
      if (json.missingEnv) { setMissingEnv(json.missingEnv); return; }
      if (!json.ok) throw new Error(json.error);
      if (json.stats) setStats(json.stats);
    } catch (e) { setStatsError(String(e)); }
    finally { setStatsLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company]);

  // 전체 레코드 로드 (목록 탭 진입 시)
  const loadAll = useCallback(async () => {
    if (recordsReady) return; // 이미 로드됨
    setRecordsLoading(true); setRecordsError("");
    try {
      const url  = company ? `/api/hw?company=${encodeURIComponent(company)}` : "/api/hw";
      const res  = await fetch(url);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setRecords(json.records);
      setRecordsReady(true);
    } catch (e) { setRecordsError(String(e)); }
    finally { setRecordsLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company, recordsReady]);

  // 새로고침: stats + records 모두 갱신
  const handleRefreshStats = useCallback(async () => {
    setStatsLoading(true); setStatsError("");
    try {
      const statsUrl = company ? `/api/hw/stats?company=${encodeURIComponent(company)}` : "/api/hw/stats";
      const res  = await fetch(statsUrl);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setStats(json.stats);
    } catch (e) { setStatsError(String(e)); }
    finally { setStatsLoading(false); }
  }, [company]);

  const handleRefreshAll = useCallback(async () => {
    setRecordsLoading(true); setRecordsError("");
    try {
      const url  = company ? `/api/hw?company=${encodeURIComponent(company)}` : "/api/hw";
      const res  = await fetch(url);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setRecords(json.records);
      setRecordsReady(true);
    } catch (e) { setRecordsError(String(e)); }
    finally { setRecordsLoading(false); }
  }, [company]);

  // 초기 stats 로드 (initialStats 없을 때)
  useEffect(() => {
    if (!initialStats) loadStats();
  }, [initialStats, loadStats]);

  // 라벨 탭만 전체 레코드 lazy load (shipment/return은 자체 fetch)
  useEffect(() => {
    if (tab === "label") loadAll();
  }, [tab, loadAll]);

  // Notion 실시간 업데이트 — 저장 후 로컬 상태도 즉시 반영
  const handleUpdate = useCallback(async (id: string, fields: Partial<HwRecord>) => {
    // 재고 상태로 변경 시 반납예정일 자동 초기화
    const effectiveFields = fields.status === "재고" ? { ...fields, returnDue: "" } : fields;
    const res = await fetch("/api/hw/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, fields: effectiveFields }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error ?? "Notion 업데이트 실패");
    // 교체요청 전환 시 교체/반납 트래커 자동 등록
    if (fields.status === "교체요청") {
      const original = recordsRef.current.find(r => r.id === id);
      if (original) {
        const merged = { ...original, ...fields };
        fetch("/api/exchange-return/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "교체", assetId: merged.assetNo,
            company: merged.company, department: merged.dept, user: merged.user,
            stage: "교체요청", requestedAt: new Date().toISOString().slice(0, 10),
          }),
        }).catch(console.error);
      }
    }
    // 출고준비완료 전환 시 재고 지급 이력 기록
    if (fields.status === "출고준비완료") {
      const original = recordsRef.current.find(r => r.id === id);
      if (original) {
        const merged = { ...original, ...fields };
        fetch("/api/hw/dispatch-history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify([{
            id: crypto.randomUUID(),
            dispatchedAt: new Date().toISOString(),
            type: "재고",
            assetNo: merged.assetNo || "",
            model: merged.model || "",
            serial: merged.serial || "",
            user: merged.user || "",
            company: merged.company || "",
            dept: merged.dept || "",
            useDate: merged.useDate || "",
          }]),
        }).catch(console.error);
      }
    }
    // 로컬 상태 즉시 반영
    setRecords(prev => prev.map(r => r.id === id ? { ...r, ...effectiveFields } : r));
  }, []);

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "dashboard", label: "대시보드",    icon: "📊" },
    { id: "shipment",  label: "출고 현황",   icon: "📤" },
    { id: "return",    label: "반납 대상자", icon: "📅" },
    { id: "search",    label: "자산 검색",   icon: "🔍" },
    { id: "upload",    label: "엑셀 등록",   icon: "📂" },
    { id: "dispatch",  label: "자산지급 현황",icon: "📋" },
    { id: "label",     label: "행낭 발송지", icon: "🏷️" },
  ];

  const recordsTabProps: TabProps = { records, loading: recordsLoading, onRefresh: handleRefreshAll, onUpdate: handleUpdate };
  // shipment/return은 자체 fetch → 공유 records 불필요
  const isRecordsTab = tab === "label";

  // ── Notion 동기화 (GitHub Actions 즉시 트리거) ─────────────────────────────
  const [syncing,     setSyncing]     = useState(false);
  const [syncDone,    setSyncDone]    = useState(false);
  const [syncError,   setSyncError]   = useState("");
  const handleSync = useCallback(async () => {
    setSyncing(true); setSyncDone(false); setSyncError("");
    try {
      const res  = await fetch("/api/hw/sync", { method: "POST" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setSyncDone(true);
      setTimeout(() => setSyncDone(false), 5000);
    } catch (e) { setSyncError(String(e)); setTimeout(() => setSyncError(""), 5000); }
    finally { setSyncing(false); }
  }, []);

  if (missingEnv) return <EnvVarMissing varName={missingEnv} />;

  return (
    <div className="space-y-4">

      {/* 패널 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-600 flex items-center justify-center shrink-0">
            <span className="text-white text-lg">💻</span>
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-sm">HW 자산 관리</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              NT/DT/MOT 트래커 연동
              {stats && (
                <span className="ml-1 text-amber-500 font-semibold">· 총 {stats.total}개</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Notion 동기화 버튼 */}
          <button
            onClick={handleSync}
            disabled={syncing}
            title="Notion에서 직접 수정한 내용을 즉시 반영합니다 (약 1~2분 소요)"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
              syncDone
                ? "bg-green-50 border-green-200 text-green-700"
                : syncError
                ? "bg-red-50 border-red-200 text-red-600"
                : "bg-white border-gray-200 text-gray-600 hover:border-amber-300 hover:text-amber-700"
            } disabled:opacity-50`}
          >
            {syncing ? (
              <>
                <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/>
                </svg>
                동기화 중…
              </>
            ) : syncDone ? (
              <>✓ 동기화 시작됨</>
            ) : syncError ? (
              <>⚠ 실패</>
            ) : (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M1 4v6h6M23 20v-6h-6"/>
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/>
                </svg>
                Notion 동기화
              </>
            )}
          </button>

          {(statsLoading || (isRecordsTab && recordsLoading)) && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <svg className="animate-spin w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              {statsLoading ? "통계 불러오는 중…" : "데이터 불러오는 중…"}
            </div>
          )}
        </div>
      </div>

      {statsError  && <div className="px-4 py-3 bg-red-50 rounded-xl text-sm text-red-600">⚠️ {statsError}</div>}
      {recordsError && <div className="px-4 py-3 bg-red-50 rounded-xl text-sm text-red-600">⚠️ {recordsError}</div>}

      {/* 탭 */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap min-w-0 ${
              tab === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}>
            <span>{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {tab === "dashboard" && <DashboardTab  stats={stats} loading={statsLoading} onRefresh={handleRefreshStats} />}
      {tab === "shipment"  && <ShipmentTab onUpdate={handleUpdate} companyLock={company} />}
      {tab === "return"    && <ReturnTab   onUpdate={handleUpdate} companyLock={company} />}
      {tab === "search"    && <SearchTab companyLock={company} onUpdate={handleUpdate} />}
      {tab === "upload"    && <ExcelUploadTab />}
      {tab === "dispatch"  && <DispatchHistoryTab />}
      {tab === "label"     && <LabelPrintTab records={records} recordsReady={recordsReady} onLoadRecords={loadAll} />}
    </div>
  );
}

