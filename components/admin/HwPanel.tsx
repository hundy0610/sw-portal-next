"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { HwStats, HwChangeLogEvent } from "@/lib/hw";
import EnvVarMissing from "@/components/ui/EnvVarMissing";
import { LabelPrintTab } from "@/components/admin/LabelPrintTab";
import { safeJson } from "@/lib/fetch-json";

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
  price: number; residualValue: number; note: string; docNo: string;
  mac: string; email: string;
  verified: boolean; duplicated: boolean;
  lastModifiedBy: string; lastModifiedAt: string;
  changeLog: string;
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

// 자산번호 자동 채번용 법인 코드 (형식: YY+법인코드-MM+일련번호, 예: 2601-06101)
const COMPANY_ASSET_CODES: Record<string,string> = {
  "대웅제약":"01", "대웅":"02", "대웅개발":"03", "대웅바이오":"04", "엠서클":"05",
  "시지바이오":"06", "디엔코스메틱스":"07", "대웅펫":"08", "IdsTrust":"09", "유와이즈원":"10",
  "페이지원":"11", "시지메드텍":"12", "클리슈어리서치":"13", "디엔컴퍼니":"15", "더편한샵":"16",
  "한올바이오파마":"17", "다나아데이터":"18", "애디테라":"20", "HR코리아":"21",
};

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
function fmtDateTime(iso: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fmtKrw(n: number)  { return n > 0 ? `₩${n.toLocaleString("ko-KR")}` : "-"; }

// ─────────────────────────────────────────────────────────────────────────────
// 가로 막대 차트 — 법인·상태·제조사별처럼 항목이 많고 순위 비교가 목적인 데이터용.
// (도넛은 6개 이하 구성비에만 적합 — 세그먼트가 많으면 길이 비교가 가능한 막대가 낫다)
// ─────────────────────────────────────────────────────────────────────────────
interface ChartSlice { label: string; value: number; }

function HBarChart({ data, title }: { data: ChartSlice[]; title: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
  const max = Math.max(...data.map(d => d.value));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-baseline justify-between mb-4">
        <p className="text-sm font-bold text-gray-700">{title}</p>
        <span className="text-xs text-gray-400 tabular-nums">{total.toLocaleString()}건</span>
      </div>
      <div className="space-y-2">
        {data.map(d => (
          <div key={d.label} className="grid items-center gap-2" style={{ gridTemplateColumns: "88px 1fr 40px" }}>
            <span className="text-xs text-gray-600 truncate" title={d.label}>{d.label}</span>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--admin-table-row-border)" }}>
              <div className="h-full rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: "var(--brand)" }} />
            </div>
            <span className="text-xs font-bold text-gray-800 text-right tabular-nums">{d.value}</span>
          </div>
        ))}
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
      .map(([label,value])=>({ label, value }));
  }, [stats]);

  const stData = useMemo<ChartSlice[]>(() => {
    if (!stats) return [];
    return Object.entries(stats.byStatus)
      .filter(([label]) => label !== "미확인")
      .sort((a,b)=>b[1]-a[1]).slice(0,10)
      .map(([label,value])=>({ label, value }));
  }, [stats]);

  const mkData = useMemo<ChartSlice[]>(() => {
    if (!stats) return [];
    return Object.entries(stats.byMaker).sort((a,b)=>b[1]-a[1]).slice(0,12)
      .map(([label,value])=>({ label, value }));
  }, [stats]);

  // 상태 토큰 4묶음 — 긍정(사용중) / 중립(재고) / 진행(출고·수리·렌탈·임시지급) / 주의·위험(반납예정·폐기)
  const StatCard = ({ label, value, sub, tone }: {
    label:string; value:string|number; sub?:string; tone: "positive"|"neutral"|"progress"|"caution"|"risk";
  }) => (
    <div className="rounded-xl p-4 border flex flex-col gap-1"
      style={{ background: `var(--state-${tone}-soft)`, borderColor: "transparent" }}>
      <span className="text-xl font-extrabold leading-tight tabular-nums" style={{ color: `var(--state-${tone})` }}>{value}</span>
      <span className="text-xs font-semibold" style={{ color: `var(--state-${tone})`, opacity: 0.85 }}>{label}</span>
      {sub && <span className="text-[11px] text-gray-400">{sub}</span>}
    </div>
  );

  const { total=0, activeCount=0, stockCount=0, shipCount=0, repairCount=0,
          rentalCount=0, tempCount=0, returnCount=0, disposalCount=0,
          verifiedCount=0, totalValue=0, companyTable=[] } = stats ?? {};
  // total은 이미 미확인 자산을 제외한 수량 (lib/hw.ts computeHwStats 참고)
  const progressCount = shipCount + repairCount + rentalCount + tempCount;

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-700">전체 자산 현황 대시보드</p>
          {!loading && stats && (
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-3xl font-extrabold text-gray-900 tabular-nums">{CONTRACT_QUANTITY.toLocaleString()}</span>
              <span className="text-xs text-gray-400 font-medium">계약 수량</span>
              <span className="text-xs text-gray-400 ml-1">
                미확인 제외 {total.toLocaleString()}건{totalValue>0 && ` · ₩${Math.round(totalValue/1000000)}M`}
              </span>
            </div>
          )}
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
            <StatCard tone="positive" label="사용중"   value={activeCount} sub={total>0 ? `${Math.round(activeCount/total*100)}%` : undefined} />
            <StatCard tone="neutral"  label="재고"      value={stockCount} />
            <StatCard tone="progress" label="출고·수리·렌탈·임시지급" value={progressCount} />
            <StatCard tone="caution"  label="반납 예정" value={returnCount} />
            <StatCard tone="risk"     label="폐기 대상" value={disposalCount} />
            <StatCard tone="positive" label="실사 확인" value={verifiedCount} sub={`확인율 ${Math.round(verifiedCount/CONTRACT_QUANTITY*100)}%`} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <HBarChart data={coData} title="법인별 자산 분포" />
            <HBarChart data={stData} title="상태별 자산 분포" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <HBarChart data={mkData} title="제조사별 분포" />
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
                        <td className="px-4 py-2 text-right font-semibold" style={{ color: "var(--state-positive)" }}>{active||"-"}</td>
                        <td className="px-4 py-2 text-right font-semibold" style={{ color: "var(--state-neutral)" }}>{stock||"-"}</td>
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
function ShipmentTab({ onUpdate, companyLock = "", isSuperAdmin = false }: { onUpdate: (id: string, fields: Partial<HwRecord>) => Promise<void>; companyLock?: string; isSuperAdmin?: boolean }) {
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
      const json = await safeJson(res);
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
              <tr>{["자산번호","사용자","법인명","부서","모델명","상태","사용일자","위치","","최종수정"].map(h=><th key={h} className="px-3 py-2.5 text-left whitespace-nowrap">{h}</th>)}</tr>
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
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {r.lastModifiedBy ? (
                      <div className="text-[11px]">
                        <div className="text-gray-700 font-medium">{r.lastModifiedBy}</div>
                        <div className="text-gray-400">{fmtDateTime(r.lastModifiedAt ?? "")}</div>
                      </div>
                    ) : <span className="text-gray-300">-</span>}
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
        <div className="py-16 text-center text-gray-300 text-sm"><p>출고 대상 자산이 없습니다</p></div>
      ) : (
        <>
          <SectionTable title="출고준비중" items={sortedPending} headerCls="bg-orange-50 text-orange-700" />
          <SectionTable title="출고준비완료" items={sortedReady} headerCls="bg-amber-50 text-amber-700" />
        </>
      )}
      {detailRecord && <AssetDetailModal record={detailRecord} onSave={onUpdate} onClose={() => setDetailRecord(null)} isSuperAdmin={isSuperAdmin} />}
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
      const val = (record as unknown as Record<string, unknown>)[f];
      (init as unknown as Record<string, unknown>)[f] = val ?? (f === "verified" ? false : "");
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

        {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors">
            {saving ? "저장 중…" : "Notion에 저장"}
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

// 변경 이력에서 "되돌리기"로 값을 다시 채워넣을 수 있는 필드
const REVERTIBLE_FORM_FIELDS = new Set(["status","user","company","dept","location","useDate","returnDate","returnDue","note","email"]);
const REVERTIBLE_SENSITIVE_FIELDS = new Set(["assetNo","serial"]);

// ─────────────────────────────────────────────────────────────────────────────
// 자산 상세 모달
// ─────────────────────────────────────────────────────────────────────────────
interface RevertibleForm {
  status: string; user: string; company: string; dept: string; location: string;
  useDate: string; returnDate: string; returnDue: string; note: string; email: string;
}

function AssetDetailModal({ record, onSave, onClose, isSuperAdmin = false, initialForm, previewLabel, hideHistory = false }: {
  record: HwRecord;
  onSave: (id: string, fields: Partial<HwRecord>) => Promise<void>;
  onClose: () => void;
  isSuperAdmin?: boolean;
  initialForm?: Partial<RevertibleForm>;  // 지정 시 현재값이 아닌 과거 시점 값으로 폼을 채운다 (변경이력 되돌리기 미리보기용)
  previewLabel?: string;                   // initialForm 사용 시 상단에 표시할 안내 문구
  hideHistory?: boolean;                   // 변경 이력 섹션 숨김 (변경이력 탭에서 호출할 때 — 이미 그 화면에 있으므로 중복)
}) {
  const [form, setForm] = useState<RevertibleForm>({
    status: initialForm?.status ?? record.status,
    user: initialForm?.user ?? record.user,
    company: initialForm?.company ?? record.company,
    dept: initialForm?.dept ?? record.dept,
    location: initialForm?.location ?? record.location,
    useDate: initialForm?.useDate ?? record.useDate,
    returnDate: initialForm?.returnDate ?? record.returnDate,
    returnDue: initialForm?.returnDue ?? record.returnDue,
    note: initialForm?.note ?? record.note,
    email: initialForm?.email ?? record.email,
  });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState("");

  // 민감 정보 (자산번호·시리얼) — 슈퍼어드민 전용
  const [sensitiveForm, setSensitiveForm] = useState({ assetNo: record.assetNo, serial: record.serial });
  const [sensitiveUnlocked, setSensitiveUnlocked] = useState(false);
  const [showPwInput, setShowPwInput]   = useState(false);
  const [pwValue,     setPwValue]       = useState("");
  const [pwError,     setPwError]       = useState("");
  const [pwVerifying, setPwVerifying]   = useState(false);

  const setField = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  // 변경 이력 — 별도 API 없이 record.changeLog(JSON 텍스트)를 그대로 파싱
  const changeLog: HwChangeLogEvent[] = useMemo(() => {
    try {
      const parsed = record.changeLog ? JSON.parse(record.changeLog) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [record.changeLog]);

  // 이벤트 하나(같이 저장된 필드 묶음) 전체를 한꺼번에만 되돌릴 수 있도록 — 필드 일부만 되돌리면
  // 실제로는 존재한 적 없는 어중간한 상태가 될 수 있어 개별 필드 되돌리기는 지원하지 않음
  function handleRevertEvent(ev: HwChangeLogEvent) {
    setForm(prev => {
      const next = { ...prev };
      for (const c of ev.changes) {
        if (REVERTIBLE_FORM_FIELDS.has(c.field)) {
          const value = c.from === "(없음)" ? "" : c.from;
          (next as unknown as Record<string, string>)[c.field] = value;
        }
      }
      return next;
    });
    if (sensitiveUnlocked) {
      setSensitiveForm(prev => {
        const next = { ...prev };
        for (const c of ev.changes) {
          if (REVERTIBLE_SENSITIVE_FIELDS.has(c.field)) {
            const value = c.from === "(없음)" ? "" : c.from;
            (next as unknown as Record<string, string>)[c.field] = value;
          }
        }
        return next;
      });
    }
  }

  const recAsMap = record as unknown as Record<string, unknown>;
  const isDirty = (Object.keys(form) as (keyof typeof form)[]).some(
    k => form[k] !== recAsMap[k]
  ) || (sensitiveUnlocked && (
    sensitiveForm.assetNo !== record.assetNo || sensitiveForm.serial !== record.serial
  ));
  // 현재 값과 다른 필드는 라벨을 강조 — 저장 시 실제로 바뀔 값을 미리 알려준다
  const labelCls = (k: keyof typeof form) => `block text-xs font-semibold mb-1 ${form[k] !== recAsMap[k] ? "text-amber-600" : "text-gray-500"}`;

  async function handleVerifyPassword() {
    if (!pwValue) return;
    setPwVerifying(true); setPwError("");
    try {
      const res  = await fetch("/api/admin/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwValue }),
      });
      const json = await safeJson(res);
      if (json.ok) {
        setSensitiveUnlocked(true);
        setShowPwInput(false);
        setPwValue("");
      } else {
        setPwError(json.error ?? "비밀번호가 올바르지 않습니다");
      }
    } catch {
      setPwError("서버 오류가 발생했습니다");
    } finally {
      setPwVerifying(false);
    }
  }

  async function handleSave() {
    if (!isDirty) return;
    setSaving(true); setError("");
    try {
      const changed: Partial<HwRecord> = {};
      (Object.keys(form) as (keyof typeof form)[]).forEach(k => {
        if (form[k] !== recAsMap[k])
          (changed as unknown as Record<string, unknown>)[k] = form[k];
      });
      if (sensitiveUnlocked) {
        if (sensitiveForm.assetNo !== record.assetNo) changed.assetNo = sensitiveForm.assetNo;
        if (sensitiveForm.serial  !== record.serial)  changed.serial  = sensitiveForm.serial;
      }
      await onSave(record.id, changed);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { setError(String(e)); }
    finally { setSaving(false); }
  }

  const InfoRow = ({ label, value }: { label: string; value?: string | number }) => {
    if (!value && value !== 0) return null;
    return (
      <div className="flex gap-2 py-1.5 border-b border-gray-50 last:border-0">
        <span className="text-xs text-gray-400 w-20 shrink-0">{label}</span>
        <span className="text-xs text-gray-700 font-medium break-all">{String(value)}</span>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="px-5 py-4 bg-amber-600 text-white flex items-start justify-between shrink-0">
          <div>
            <div className="font-bold text-base font-mono">{record.assetNo || "—"}</div>
            <div className="text-xs opacity-80 mt-0.5">{record.model || "—"}</div>
          </div>
          <div className="flex items-center gap-3 ml-4">
            {record.notionUrl && (
              <a href={record.notionUrl} target="_blank" rel="noreferrer"
                className="text-xs text-amber-200 hover:text-white underline underline-offset-2">Notion ↗</a>
            )}
            <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">✕</button>
          </div>
        </div>

        {/* 스크롤 영역 */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {previewLabel && (
            <div className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {previewLabel} — 강조된 필드가 현재와 다른 값입니다. 저장하면 이 값으로 되돌립니다.
            </div>
          )}
          {/* 수정 폼 */}
          <div className="space-y-3">
            <div>
              <label className={labelCls("status")}>상태</label>
              <select value={form.status} onChange={e => setField("status", e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300">
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls("user")}>사용자</label>
                <input value={form.user} onChange={e => setField("user", e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
              </div>
              <div>
                <label className={labelCls("dept")}>부서</label>
                <input value={form.dept} onChange={e => setField("dept", e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
              </div>
              <div className="col-span-2">
                <label className={labelCls("email")}>이메일</label>
                <input type="email" value={form.email} onChange={e => setField("email", e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
              </div>
              <div>
                <label className={labelCls("company")}>법인명</label>
                <select value={form.company} onChange={e => setField("company", e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300">
                  <option value="">— 선택 —</option>
                  {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls("location")}>위치</label>
                <input value={form.location} onChange={e => setField("location", e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
              </div>
              <div>
                <label className={labelCls("useDate")}>사용일자</label>
                <input type="date" value={form.useDate} onChange={e => setField("useDate", e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
              </div>
              <div>
                <label className={labelCls("returnDate")}>반납일자</label>
                <input type="date" value={form.returnDate} onChange={e => setField("returnDate", e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
              </div>
              <div>
                <label className={labelCls("returnDue")}>반납예정일</label>
                <input type="date" value={form.returnDue} onChange={e => setField("returnDue", e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
              </div>
            </div>
            <div>
              <label className={labelCls("note")}>비고</label>
              <textarea value={form.note} onChange={e => setField("note", e.target.value)} rows={2}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none" />
            </div>
          </div>

          {/* 슈퍼어드민 전용: 자산번호·시리얼 변경 */}
          {isSuperAdmin && (
            <div className="border border-red-100 rounded-xl p-3 bg-red-50/50">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wider">
                  민감 정보 {sensitiveUnlocked ? "(잠금 해제됨)" : ""}
                </p>
                {!sensitiveUnlocked && !showPwInput && (
                  <button
                    onClick={() => setShowPwInput(true)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 font-semibold transition-colors">
                    잠금 해제
                  </button>
                )}
                {sensitiveUnlocked && (
                  <button
                    onClick={() => { setSensitiveUnlocked(false); setSensitiveForm({ assetNo: record.assetNo, serial: record.serial }); }}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 font-semibold transition-colors">
                    다시 잠금
                  </button>
                )}
              </div>

              {/* 비밀번호 확인 입력 */}
              {showPwInput && !sensitiveUnlocked && (
                <div className="mb-3 space-y-2">
                  <p className="text-xs text-red-600">자산번호·시리얼 변경은 본인 비밀번호 확인이 필요합니다.</p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={pwValue}
                      onChange={e => setPwValue(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleVerifyPassword()}
                      placeholder="비밀번호 입력"
                      className="flex-1 rounded-lg border border-red-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                    />
                    <button
                      onClick={handleVerifyPassword}
                      disabled={pwVerifying || !pwValue}
                      className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600 disabled:opacity-40 transition-colors">
                      {pwVerifying ? "확인 중…" : "확인"}
                    </button>
                    <button
                      onClick={() => { setShowPwInput(false); setPwValue(""); setPwError(""); }}
                      className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-gray-200 transition-colors">
                      취소
                    </button>
                  </div>
                  {pwError && <p className="text-xs text-red-600">{pwError}</p>}
                </div>
              )}

              {/* 편집 가능 필드 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">자산번호</label>
                  {sensitiveUnlocked ? (
                    <input
                      value={sensitiveForm.assetNo}
                      onChange={e => setSensitiveForm(p => ({ ...p, assetNo: e.target.value }))}
                      className="w-full rounded-lg border border-red-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-300"
                    />
                  ) : (
                    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-mono text-gray-400">{record.assetNo || "—"}</div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">시리얼 넘버</label>
                  {sensitiveUnlocked ? (
                    <input
                      value={sensitiveForm.serial}
                      onChange={e => setSensitiveForm(p => ({ ...p, serial: e.target.value }))}
                      className="w-full rounded-lg border border-red-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-300"
                    />
                  ) : (
                    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-mono text-gray-400">{record.serial || "—"}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 읽기 전용 자산 정보 */}
          <div className="border-t border-gray-100 pt-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">자산 정보</p>
            <InfoRow label="제조사"   value={record.maker} />
            <InfoRow label="모델"     value={record.model} />
            {!isSuperAdmin && <InfoRow label="시리얼" value={record.serial} />}
            <InfoRow label="CPU"      value={record.cpu} />
            <InfoRow label="RAM"      value={record.ram} />
            <InfoRow label="MAC"      value={record.mac} />
            <InfoRow label="구매일자" value={record.purchaseDate ? fmtDate(record.purchaseDate) : undefined} />
            <InfoRow label="단가"     value={record.price > 0 ? fmtKrw(record.price) : undefined} />
            <InfoRow label="잔존가치" value={record.residualValue > 0 ? fmtKrw(record.residualValue) : undefined} />
            <InfoRow label="문서번호" value={record.docNo} />
            {record.verified && <InfoRow label="실사확인" value="완료" />}
          </div>

          {/* 변경 이력 */}
          {!hideHistory && (
            <div className="border-t border-gray-100 pt-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">변경 이력</p>
              {changeLog.length === 0 ? (
                <p className="text-xs text-gray-400 py-1">변경 이력이 없습니다.</p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {changeLog.map((ev, i) => {
                    const revertibleCount = ev.changes.filter(c =>
                      REVERTIBLE_FORM_FIELDS.has(c.field) || (REVERTIBLE_SENSITIVE_FIELDS.has(c.field) && sensitiveUnlocked)
                    ).length;
                    return (
                      <div key={i} className="text-xs border-b border-gray-50 last:border-0 pb-2">
                        <div className="flex items-center justify-between text-gray-400 mb-1">
                          <span>{fmtDateTime(ev.at)} · {ev.by}</span>
                          {revertibleCount > 0 && (
                            <button
                              onClick={() => handleRevertEvent(ev)}
                              title="이 시점의 값들로 한꺼번에 되돌립니다 (저장 전까지는 반영되지 않음)"
                              className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 hover:bg-amber-100 hover:text-amber-700 transition-colors">
                              되돌리기
                            </button>
                          )}
                        </div>
                        <div className="space-y-0.5">
                          {ev.changes.map((c, j) => (
                            <div key={j} className="text-gray-700">
                              <span className="font-semibold">{c.label}</span>: {c.from} → {c.to}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 저장 버튼 */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between shrink-0">
          <span className="text-xs text-red-600">{error ? `${error}` : ""}</span>
          <button onClick={handleSave} disabled={saving || !isDirty}
            className="px-4 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 disabled:opacity-40 transition-colors">
            {saving ? "저장 중…" : saved ? "저장됨" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 반납 대상자 탭
// ─────────────────────────────────────────────────────────────────────────────
function ReturnTab({ onUpdate, companyLock = "", isSuperAdmin = false }: { onUpdate: (id: string, fields: Partial<HwRecord>) => Promise<void>; companyLock?: string; isSuperAdmin?: boolean }) {
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
      const json = await safeJson(res);
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
            <span className="text-red-500 font-semibold">D-7 이내: {urgent.length}건</span>
            <span className="text-orange-500 font-semibold">D-30 이내: {soon.length}건</span>
            <span className="text-gray-500">◽ 그 외: {later.length}건</span>
          </div>
        )}
      </div>
      {loading ? (
        <div className="py-16 text-center text-gray-300 text-sm">불러오는 중…</div>
      ) : returnRecords.length === 0 ? (
        <div className="py-16 text-center text-gray-300 text-sm"><p>반납 예정 자산이 없습니다</p></div>
      ) : (
        <>
          <TableSection title="D-7 이내 — 즉시 확인 필요" items={urgent} cls="bg-red-50 text-red-700" />
          <TableSection title="D-30 이내 — 반납 임박"     items={soon}   cls="bg-yellow-50 text-yellow-700" />
          <TableSection title="◽ D-30 초과"                   items={later}  cls="bg-gray-50 text-gray-700" />
        </>
      )}
      {detailRecord && <AssetDetailModal record={detailRecord} onSave={onUpdate} onClose={() => setDetailRecord(null)} isSuperAdmin={isSuperAdmin} />}
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
function SearchTab({ companyLock = "", onUpdate, isSuperAdmin = false }: { companyLock?: string; onUpdate?: (id: string, fields: Partial<HwRecord>) => Promise<void>; isSuperAdmin?: boolean }) {
  const [records,     setRecords]     = useState<HwRecord[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [search,      setSearch]      = useState("");
  const [company,     setCompany]     = useState(companyLock);
  const [editRecord,    setEditRecord]    = useState<HwRecord | null>(null);
  const [detailRecord,  setDetailRecord]  = useState<HwRecord | null>(null);
  const [statusPickerId, setStatusPickerId] = useState<string | null>(null);
  const [statusPickerVal, setStatusPickerVal] = useState("");
  const [status,   setStatus]   = useState("");
  const [location, setLocation] = useState("");
  const [searched, setSearched] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    if (records.length === 0) return;
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const rows = records.map(r => ({
        "자산번호":  r.assetNo        || "",
        "사용자":    r.user           || "",
        "법인명":    r.company        || "",
        "부서":      r.dept           || "",
        "상태":      r.status         || "",
        "모델명":    r.model          || "",
        "제조사":    r.maker          || "",
        "CPU":       r.cpu            || "",
        "RAM":       r.ram            || "",
        "시리얼":    r.serial         || "",
        "구매일자":  r.purchaseDate   || "",
        "사용일자":  r.useDate        || "",
        "단가(원)":  r.price > 0 ? r.price : "",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = Object.keys(rows[0]).map(key => ({
        wch: Math.max(key.length, ...rows.map(r => String(r[key as keyof typeof r] ?? "").length)) + 2,
      }));

      // 변경이력 시트 — 자산별 changeLog(JSON)를 자산번호 기준으로 평탄화
      // (자산별로 몰아서 쌓기 때문에 한 자산의 이력 행들은 항상 연속됨 → 첫 행 위치를 하이퍼링크 타깃으로 사용)
      const historyRows: Record<string, string>[] = [];
      const firstHistoryRow = new Map<string, number>(); // 자산번호 → 변경이력 시트에서의 첫 행 번호(1-based, 헤더 제외)
      for (const r of records) {
        if (!r.assetNo) continue;
        let events: HwChangeLogEvent[] = [];
        try {
          const parsed = r.changeLog ? JSON.parse(r.changeLog) : [];
          events = Array.isArray(parsed) ? parsed : [];
        } catch { /* 손상된 데이터는 건너뜀 */ }
        for (const ev of events) {
          for (const c of ev.changes) {
            if (!firstHistoryRow.has(r.assetNo)) firstHistoryRow.set(r.assetNo, historyRows.length + 2);
            historyRows.push({
              "자산번호": r.assetNo || "",
              "변경시각": fmtDateTime(ev.at),
              "필드":     c.label,
              "이전값":   c.from,
              "이후값":   c.to,
              "변경자":   ev.by,
            });
          }
        }
      }

      const wb = XLSX.utils.book_new();
      if (historyRows.length > 0) {
        // "자산번호" 셀을 누르면 변경이력 시트의 해당 자산 첫 행으로 이동
        records.forEach((r, i) => {
          const targetRow = r.assetNo && firstHistoryRow.get(r.assetNo);
          if (!targetRow) return;
          const cellRef = `A${i + 2}`;
          if (ws[cellRef]) {
            ws[cellRef].l = { Target: `#'변경이력'!A${targetRow}`, Tooltip: "이 자산의 변경이력으로 이동" };
          }
        });
      }
      XLSX.utils.book_append_sheet(wb, ws, "HW자산");
      if (historyRows.length > 0) {
        const wsHistory = XLSX.utils.json_to_sheet(historyRows);
        wsHistory["!cols"] = Object.keys(historyRows[0]).map(key => ({
          wch: Math.max(key.length, ...historyRows.map(r => String(r[key as keyof typeof r] ?? "").length)) + 2,
        }));
        // 자산번호 컬럼 자동필터 — 특정 자산 하나만 골라서 보기
        wsHistory["!autofilter"] = { ref: `A1:F${historyRows.length + 1}` };
        XLSX.utils.book_append_sheet(wb, wsHistory, "변경이력");
      }
      const now = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `HW자산_${companyLock || "전체"}_${now}.xlsx`);
    } finally {
      setExporting(false);
    }
  }, [records, companyLock]);

  const load = useCallback(async () => {
    setLoading(true); setError(""); setSearched(true);
    try {
      const q = new URLSearchParams();
      if (search)   q.set("search",   search);
      if (company)  q.set("company",  company);
      if (status)   q.set("status",   status);
      if (location) q.set("location", location);
      const res  = await fetch(`/api/hw?${q}`);
      const json = await safeJson(res);
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
            <label className="block text-xs font-semibold text-gray-500 mb-1">사용자 / 자산번호 / 모델명 / 시리얼 / 부서 (이전 사용자·부서 포함)</label>
            <input value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && load()}
              placeholder="검색어 입력 후 Enter (쉼표로 다중검색)"
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
            {loading ? "검색 중…" : "검색"}
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
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">{records.length}건</span>
              <button
                onClick={handleExport}
                disabled={exporting || records.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {exporting ? (
                  <><svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>생성 중…</>
                ) : <>엑셀 다운로드</>}
              </button>
            </div>
          </div>
          {records.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">조회된 자산이 없습니다</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500 font-semibold">
                  <tr>{["상태","자산번호","사용자","법인명","부서","모델명","제조사","사용일자","반납일자","반납예정일","잔존가치","단가","최종수정"].map(h=><th key={h} className="px-3 py-2.5 text-left whitespace-nowrap">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {records.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {statusPickerId === r.id ? (
                          <div className="flex items-center gap-1">
                            <select value={statusPickerVal} onChange={e => setStatusPickerVal(e.target.value)} autoFocus
                              className="rounded border border-amber-300 px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400">
                              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <button onClick={async () => {
                              if (onUpdate && statusPickerVal !== r.status) {
                                await onUpdate(r.id, { status: statusPickerVal });
                                setRecords(prev => prev.map(x => x.id === r.id ? { ...x, status: statusPickerVal } : x));
                              }
                              setStatusPickerId(null);
                            }} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-600 text-white hover:bg-amber-700">확인</button>
                            <button onClick={() => setStatusPickerId(null)} className="text-[11px] text-gray-400 hover:text-gray-600 leading-none">✕</button>
                          </div>
                        ) : (
                          <span
                            onClick={() => { setStatusPickerId(r.id); setStatusPickerVal(r.status); }}
                            className={`px-2 py-0.5 rounded-full text-[11px] font-medium cursor-pointer hover:ring-2 hover:ring-amber-300 hover:ring-offset-1 ${STATUS_COLOR[r.status]??"bg-gray-100 text-gray-600"}`}>
                            {r.status||"-"}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono whitespace-nowrap cursor-pointer text-amber-600 hover:underline" onClick={() => setDetailRecord(r)}>{r.assetNo||"-"}</td>
                      <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">{r.user||"-"}</td>
                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{r.company||"-"}</td>
                      <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{r.dept||"-"}</td>
                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap max-w-[140px] truncate">{r.model||"-"}</td>
                      <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{r.maker||"-"}</td>
                      <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{fmtDate(r.useDate)}</td>
                      <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{fmtDate(r.returnDate)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {r.returnDue ? <span className="flex items-center gap-1.5"><span className="text-gray-600">{fmtDate(r.returnDue)}</span><span className={`text-[11px] ${dDay(r.returnDue).cls}`}>{dDay(r.returnDue).label}</span></span> : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{r.residualValue > 0 ? fmtKrw(r.residualValue) : "-"}</td>
                      <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{fmtKrw(r.price)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {r.lastModifiedBy ? (
                          <div className="text-[11px]">
                            <div className="text-gray-700 font-medium">{r.lastModifiedBy}</div>
                            <div className="text-gray-400">{fmtDateTime(r.lastModifiedAt ?? "")}</div>
                          </div>
                        ) : <span className="text-gray-300">-</span>}
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
          <p>조건을 선택하고 검색 버튼을 눌러주세요</p>
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
          isSuperAdmin={isSuperAdmin}
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
interface SyncMatch{erId:string;erType:string;erCompany:string;erUser:string;erDept:string;erAssetId:string;newAssetNo:string;confirmed:boolean;confirming:boolean;error:string;}

function DuplicateModal({dups,cleanCount,onSkipDups,onUploadAll,onCancel}:{
  dups:DupItem[];cleanCount:number;onSkipDups:()=>void;onUploadAll:()=>void;onCancel:()=>void;
}){
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel}/>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 bg-amber-50 border-b border-amber-200 flex items-start gap-3">
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
          {cleanCount>0&&<button onClick={onSkipDups} className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 transition-colors">중복 제외하고 {cleanCount}건만 등록</button>}
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
  const [syncWarn,setSyncWarn]=useState("");
  const [syncMatches,setSyncMatches]=useState<SyncMatch[]>([]);
  const [syncChecked,setSyncChecked]=useState(false);
  const [expandedSyncIdx,setExpandedSyncIdx]=useState<number|null>(null);

  const handleFile=async(file:File)=>{
    setPErr("");setRows([]);setResults(null);setSummary(null);setSyncWarn("");
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
      const res=await fetch("/api/hw");const json=await safeJson(res);
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
      const json=await safeJson(res);clearInterval(timer);setProgress(100);
      if(!json.ok) throw new Error(json.error);
      setResults(json.results);setSummary({success:json.success,failed:json.failed});
      // 신규 지급 이력 기록 (성공 건만)
      const successSet=new Set<number>((json.results as UploadResult[]).filter((r:UploadResult)=>r.ok).map((r:UploadResult)=>r.index));
      const successRows=convertedRows.filter((_,i)=>successSet.has(i));
      if(successRows.length>0){
        const now=new Date().toISOString();
        const events=successRows.map(r=>({
          id:crypto.randomUUID(),dispatchedAt:now,type:"신규" as const,
          assetNo:r.assetNo||"",model:r.model||"",serial:r.serial||"",
          user:r.user||"",company:r.company||"",dept:r.dept||"",useDate:r.useDate||"",
        }));
        fetch("/api/hw/dispatch-history",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(events)}).catch(console.error);

        // 자산흐름관리 연동 대상 수집 (자동 실행 없이 리스트만)
        try {
          const erJson=await fetch("/api/exchange-return").then(r=>safeJson(r));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const candidates=(erJson.data??[]).filter((r:any)=>
            (r.type==="신규지급"||r.type==="교체") &&
            (r.newAssetId??"").trim()==="신규구매로안내됨" &&
            !r.isClosed &&
            r.stage!=="사용자수령"&&r.stage!=="반납요청"&&r.stage!=="반납완료"
          );
          const matches:SyncMatch[]=[];
          for(const row of successRows){
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const matched=candidates.filter((r:any)=>(r.company??"").trim()===(row.company??"").trim()&&(r.user??"").trim()===(row.user??"").trim());
            for(const rec of matched){
              matches.push({
                erId:rec.id, erType:rec.type, erCompany:rec.company, erUser:rec.user,
                erDept:rec.department??rec.dept??"", erAssetId:rec.assetId??"",
                newAssetNo:row.assetNo, confirmed:false, confirming:false, error:"",
              });
            }
          }
          setSyncMatches(matches);
          setSyncChecked(true);
        } catch(e){
          console.warn("[ExcelUpload] 자산흐름관리 연동 대상 조회 실패:",e);
          setSyncWarn("자산흐름관리 연동 대상 조회 중 오류가 발생했습니다. 수동으로 확인해주세요.");
          setSyncChecked(true);
        }
      }
    }catch(e){setPErr(String(e));}finally{setUploading(false);}
  };
  const confirmSync=async(idx:number)=>{
    const m=syncMatches[idx];
    if(!m||m.confirmed||m.confirming) return;
    setSyncMatches(prev=>prev.map((x,i)=>i===idx?{...x,confirming:true,error:""}:x));
    try{
      const defaultDue=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
      const updates:Promise<unknown>[]=[
        fetch("/api/exchange-return/update",{method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({id:m.erId,fields:{stage:"사용자수령",newAssetId:m.newAssetNo,...(m.erType==="교체"?{returnDue:defaultDue}:{})}}),
        }).then(async res=>{const j=await safeJson(res);if(!j.ok) throw new Error(j.error||`HTTP ${res.status}`);}),
      ];
      if(m.newAssetNo){
        updates.push(fetch(`/api/hw?search=${encodeURIComponent(m.newAssetNo)}`).then(r=>safeJson(r)).then(d=>{
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const found=(d.records??[]).find((r:any)=>r.assetNo===m.newAssetNo)??(d.records?.length===1?d.records[0]:null);
          if(found) return fetch("/api/hw/update",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:found.id,fields:{status:"사용중"}})});
        }));
      }
      if(m.erType==="교체"&&m.erAssetId){
        updates.push(fetch(`/api/hw?search=${encodeURIComponent(m.erAssetId)}`).then(r=>safeJson(r)).then(d=>{
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const found=(d.records??[]).find((r:any)=>r.assetNo===m.erAssetId)??(d.records?.length===1?d.records[0]:null);
          if(found) return fetch("/api/hw/update",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:found.id,fields:{status:"반납예정",returnDue:defaultDue}})});
        }));
      }
      await Promise.all(updates);
      setSyncMatches(prev=>prev.map((x,i)=>i===idx?{...x,confirmed:true,confirming:false}:x));
      setExpandedSyncIdx(null);
    }catch(e){
      setSyncMatches(prev=>prev.map((x,i)=>i===idx?{...x,confirming:false,error:String(e)}:x));
    }
  };

  const reset=()=>{setRows([]);setFile("");setPErr("");setResults(null);setSummary(null);setProgress(0);setSyncWarn("");setSyncMatches([]);setSyncChecked(false);setExpandedSyncIdx(null);setShowDupModal(false);setDupItems([]);setCleanRows([]);if(fileRef.current)fileRef.current.value="";};

  return(
    <div className="space-y-4">
      {showDupModal&&<DuplicateModal dups={dupItems} cleanCount={cleanRows.length} onSkipDups={()=>doUpload(cleanRows)} onUploadAll={()=>doUpload(rows)} onCancel={()=>setShowDupModal(false)}/>}
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-xs text-teal-700 space-y-1">
        <p className="font-semibold text-sm text-teal-800">업체 제공 엑셀 → Notion 자동 등록</p>
        <p>업체가 제공한 엑셀 파일을 업로드하면 <strong>사용중</strong> 상태로 NT/DT 트래커에 자동 등록됩니다.</p>
        <p className="text-teal-600">지원 컬럼: 관리번호 · 모델명 · 시리얼 · 제조사 · CPU · 램 · 법인 · 사용자 · 부서 · 위치 · 구매년도 · 구매가격 · 사용일자</p>
      </div>
      {rows.length===0&&!parseErr&&(
        <div onDrop={handleDrop} onDragOver={e=>e.preventDefault()}
          className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-10 text-center hover:border-teal-400 hover:bg-teal-50/30 transition-colors cursor-pointer"
          onClick={()=>fileRef.current?.click()}>
          <p className="text-sm font-semibold text-gray-700">엑셀 파일을 드래그하거나 클릭하여 선택</p>
          <p className="text-xs text-gray-400 mt-1">.xlsx · .xls 지원</p>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)handleFile(f);}}/>
        </div>
      )}
      {parseErr&&(
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-start gap-3">
          <div><p className="font-semibold">파일 파싱 오류</p><p className="mt-1 text-xs">{parseErr}</p><button onClick={reset} className="mt-2 text-xs underline text-red-600">다시 선택</button></div>
        </div>
      )}
      {rows.length>0&&!summary&&(
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <div><span className="text-sm font-semibold text-gray-800">{fileName}</span><span className="ml-2 text-xs text-gray-400">{rows.length}개 행 파싱 완료</span></div>
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
                중복 확인 후 Notion 등록 ({rows.length}건)
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
            <p className={`text-base font-bold mb-1 ${summary.failed===0?"text-green-800":"text-yellow-800"}`}>{summary.failed===0?"전체 등록 완료!":"등록 완료 (일부 실패)"}</p>
            <p className="text-sm text-gray-700">성공 <span className="font-bold text-green-700">{summary.success}</span>건 · 실패 <span className="font-bold text-red-600">{summary.failed}</span>건</p>
          </div>
          {syncWarn&&(
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <div>
                <p className="text-sm font-semibold text-amber-800">자산흐름관리 연동 실패</p>
                <p className="text-xs text-amber-700 mt-0.5">{syncWarn}</p>
              </div>
            </div>
          )}
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
                      <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${r.ok?"bg-green-100 text-green-700":"bg-red-100 text-red-700"}`}>{r.ok?"성공":"실패"}</span></td>
                      <td className="px-3 py-2 text-red-500 text-[11px]">{r.error||""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {syncChecked&&(
            <div className="bg-white rounded-xl border border-blue-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-blue-100 bg-blue-50 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-blue-800">자산흐름관리 연동 필요 항목</p>
                  <p className="text-xs text-blue-600 mt-0.5">신규 등록 자산과 법인·사용자가 일치하는 신규구매 대기 항목입니다.</p>
                </div>
                <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-full">{syncMatches.filter(m=>!m.confirmed).length}건 대기</span>
              </div>
              {syncMatches.length===0?(
                <div className="px-5 py-6 text-center text-sm text-gray-400">연동 필요 항목 없음</div>
              ):(
              <div className="divide-y divide-gray-100">
                {syncMatches.map((m,i)=>(
                  <div key={i} className={`transition-colors ${m.confirmed?"bg-green-50/50":""}`}>
                    <button type="button" onClick={()=>setExpandedSyncIdx(expandedSyncIdx===i?null:i)}
                      className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50 text-left">
                      <div className="flex items-center gap-3">
                        {m.confirmed
                          ? <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">완료</span>
                          : <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{m.erType}</span>
                        }
                        <span className="text-sm font-medium text-gray-800">{m.erUser}</span>
                        <span className="text-xs text-gray-400">{m.erCompany} · {m.erDept}</span>
                      </div>
                      <span className="text-gray-400 text-xs">{expandedSyncIdx===i?"▲":"▼"}</span>
                    </button>
                    {expandedSyncIdx===i&&(
                      <div className="px-5 pb-4 space-y-3">
                        <div className="bg-gray-50 rounded-xl p-4 text-xs space-y-2">
                          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                            <div><span className="text-gray-400">유형</span><span className="ml-2 font-medium text-gray-800">{m.erType}</span></div>
                            <div><span className="text-gray-400">사용자</span><span className="ml-2 font-medium text-gray-800">{m.erUser}</span></div>
                            <div><span className="text-gray-400">법인</span><span className="ml-2 font-medium text-gray-800">{m.erCompany}</span></div>
                            <div><span className="text-gray-400">부서</span><span className="ml-2 font-medium text-gray-800">{m.erDept||"-"}</span></div>
                            {m.erAssetId&&<div><span className="text-gray-400">기존 자산번호</span><span className="ml-2 font-mono font-medium text-gray-800">{m.erAssetId}</span></div>}
                            <div><span className="text-gray-400">신규 자산번호</span><span className="ml-2 font-mono font-medium text-blue-700">{m.newAssetNo||"-"}</span></div>
                          </div>
                          <div className="border-t border-gray-200 pt-2 mt-1">
                            <p className="text-gray-500 font-medium mb-1">확인 시 자동 처리:</p>
                            <ul className="space-y-0.5 text-gray-600">
                              <li>· 트래커 단계 → <strong>사용자수령</strong> · 교체 자산번호 → <strong>{m.newAssetNo}</strong></li>
                              <li>· 신규 자산 HW 상태 → <strong>사용중</strong></li>
                              {m.erType==="교체"&&m.erAssetId&&<li>· 기존 자산 <strong className="font-mono">{m.erAssetId}</strong> → <strong>반납예정</strong> (반납예정일 +7일)</li>}
                            </ul>
                          </div>
                        </div>
                        {m.error&&<p className="text-xs text-red-600">{m.error}</p>}
                        {!m.confirmed&&(
                          <button onClick={()=>confirmSync(i)} disabled={m.confirming}
                            className="w-full py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40">
                            {m.confirming?"처리 중…":"확인 · 사용자수령 처리"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              )}
            </div>
          )}
          <button onClick={reset} className="w-full py-2.5 rounded-xl border border-gray-300 text-gray-600 text-sm hover:bg-gray-50">새 파일 업로드</button>
        </div>
      )}
      <NextAssetNoPanel/>
    </div>
  );
}

// ── 자산번호 복사 버튼 ───────────────────────────────────────────
function CopyAssetNo({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="font-mono font-semibold text-teal-700 hover:text-teal-900 transition-colors"
      onClick={() => {
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      title="클릭하여 복사"
    >
      {copied ? "복사됨" : value}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 법인별 다음 자산번호 추천 (형식: YY+법인코드-MM+일련번호, 예: 2601-06101)
// ─────────────────────────────────────────────────────────────────────────────
function NextAssetNoPanel(){
  const [records,setRecords]=useState<HwRecord[]|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useEffect(()=>{
    (async()=>{
      try{
        const res=await fetch("/api/hw");
        const json=await safeJson(res);
        if(!json.ok) throw new Error(json.error);
        setRecords(json.records);
      }catch(e){setError(String(e));}
      finally{setLoading(false);}
    })();
  },[]);

  const now=new Date();
  const yy=String(now.getFullYear()).slice(-2);
  const mm=String(now.getMonth()+1).padStart(2,"0");
  const companies=COMPANIES.filter(c=>COMPANY_ASSET_CODES[c]);

  const recommendations=useMemo(()=>{
    if(!records) return null;
    const map:Record<string,string>={};
    for(const c of companies){
      const code=COMPANY_ASSET_CODES[c];
      const prefix=`${yy}${code}-${mm}`;
      const re=new RegExp(`^${prefix}(\\d{3})$`);
      let maxSeq=100;
      for(const r of records){
        const m=re.exec((r.assetNo||"").trim());
        if(m){const seq=parseInt(m[1],10); if(seq>=100&&seq>maxSeq) maxSeq=seq;}
      }
      const next=maxSeq+1;
      map[c]=`${prefix}${String(next).padStart(3,"0")}`;
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[records,yy,mm]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-700">법인별 다음 자산번호 추천 ({yy}년 {mm}월)</p>
        <p className="text-xs text-gray-400 mt-0.5">형식: 연도(YY) + 법인코드 - 월(MM) + 일련번호(101~). 같은 연/월/법인에 등록된 최대 번호 +1로 계산됩니다.</p>
      </div>
      {loading&&<div className="px-5 py-4 text-sm text-gray-400">불러오는 중…</div>}
      {error&&<div className="px-5 py-4 text-sm text-red-500">{error}</div>}
      {recommendations&&(
        <div className="overflow-x-auto max-h-72">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 font-semibold sticky top-0">
              <tr><th className="px-3 py-2 text-left">법인</th><th className="px-3 py-2 text-left">추천 자산번호</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {companies.map(c=>(
                <tr key={c} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-700">{c}</td>
                  <td className="px-3 py-2"><CopyAssetNo value={recommendations[c]}/></td>
                </tr>
              ))}
            </tbody>
          </table>
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
      const json = await safeJson(res);
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

      {error && <div className="px-4 py-3 bg-red-50 rounded-xl text-sm text-red-600">{error}</div>}

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
          <p className="text-sm">지급 이력이 없습니다</p>
          <p className="text-xs mt-2 text-gray-300">출고준비완료 전환 또는 엑셀 등록 시 자동으로 기록됩니다</p>
        </div>
      )}

      {loading && <div className="py-16 text-center text-gray-300 text-sm">불러오는 중…</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 등록 현황 탭 (엑셀 신규 등록 로그 — 월별/연단위 분석)
// ─────────────────────────────────────────────────────────────────────────────
interface RegistrationRecord {
  id: string;
  registeredAt: string;
  assetNo: string; model: string; serial: string;
  user: string; company: string; dept: string; maker: string;
  price: number; purchaseDate: string; useDate: string;
  registeredBy: string;
}

function RegistrationLogTab() {
  const [log, setLog] = useState<RegistrationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [yearFilter, setYearFilter] = useState(() => String(new Date().getFullYear()));

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/hw/registration-log");
      const json = await safeJson(res);
      if (!json.ok) throw new Error(json.error);
      setLog(json.log);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const years = useMemo(() => {
    const ys = new Set<string>();
    for (const r of log) ys.add(r.registeredAt.slice(0, 4));
    ys.add(String(new Date().getFullYear()));
    return [...ys].sort().reverse();
  }, [log]);

  const filtered = useMemo(() => log.filter(r => r.registeredAt.startsWith(yearFilter)), [log, yearFilter]);

  const monthlyStats = useMemo(() => {
    const result: { month: string; label: string; count: number; amount: number }[] = [];
    for (let m = 1; m <= 12; m++) {
      result.push({ month: `${yearFilter}-${String(m).padStart(2,"0")}`, label: `${m}월`, count: 0, amount: 0 });
    }
    for (const r of filtered) {
      const idx = parseInt(r.registeredAt.slice(5, 7), 10) - 1;
      if (idx >= 0 && idx < 12) { result[idx].count++; result[idx].amount += r.price || 0; }
    }
    return result;
  }, [filtered, yearFilter]);

  const companyStats = useMemo(() => {
    const map: Record<string, { count: number; amount: number }> = {};
    for (const r of filtered) {
      const co = r.company || "미분류";
      if (!map[co]) map[co] = { count: 0, amount: 0 };
      map[co].count++; map[co].amount += r.price || 0;
    }
    return Object.entries(map).sort((a, b) => b[1].count - a[1].count);
  }, [filtered]);

  const deptStats = useMemo(() => {
    const map: Record<string, { count: number; amount: number }> = {};
    for (const r of filtered) {
      const d = r.dept || "미분류";
      if (!map[d]) map[d] = { count: 0, amount: 0 };
      map[d].count++; map[d].amount += r.price || 0;
    }
    return Object.entries(map).sort((a, b) => b[1].count - a[1].count);
  }, [filtered]);

  const totalCount  = filtered.length;
  const totalAmount = filtered.reduce((s, r) => s + (r.price || 0), 0);
  const maxMonthly  = Math.max(...monthlyStats.map(m => m.count), 1);

  const chartW = 560; const chartH = 160; const barArea = chartH - 10;
  const slotW  = chartW / 12; const barW = Math.floor(slotW * 0.5);

  const downloadReport = () => {
    const html = generateRegistrationReportHTML({ year: yearFilter, records: filtered, monthlyStats, companyStats, deptStats });
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `HW등록현황_보고서_${yearFilter}.html`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* 헤더 / 필터 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[160px]">
          <p className="text-sm font-bold text-gray-800">신규 등록 현황</p>
          <p className="text-xs text-gray-400 mt-0.5">엑셀 신규 등록 로그 · 월별/연단위 분석</p>
        </div>
        <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
          {years.map(y => <option key={y} value={y}>{y}년</option>)}
        </select>
        <button onClick={downloadReport} disabled={loading || totalCount === 0}
          className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 disabled:opacity-50 transition-colors">
          HTML 보고서 다운로드
        </button>
        <button onClick={load} disabled={loading}
          className="px-4 py-2 rounded-lg bg-indigo-500 text-white text-sm font-semibold hover:bg-indigo-600 disabled:opacity-50 transition-colors">
          {loading ? "불러오는 중…" : "새로고침"}
        </button>
      </div>

      {error && <div className="px-4 py-3 bg-red-50 rounded-xl text-sm text-red-600">{error}</div>}

      {/* 요약 카드 */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-indigo-500">연간 등록</p>
            <p className="text-2xl font-bold text-indigo-700 mt-1">{totalCount}<span className="text-sm font-normal ml-1">건</span></p>
            <p className="text-xs text-indigo-400 mt-0.5">{yearFilter}년</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-emerald-500">총 구매금액</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{fmtKrw(totalAmount)}</p>
            <p className="text-xs text-emerald-400 mt-0.5">단가 합계</p>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-amber-500">등록 법인</p>
            <p className="text-2xl font-bold text-amber-700 mt-1">{companyStats.length}<span className="text-sm font-normal ml-1">개</span></p>
            <p className="text-xs text-amber-400 mt-0.5">법인 수</p>
          </div>
        </div>
      )}

      {/* 월별 막대 차트 */}
      {!loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-bold text-gray-700 mb-4">{yearFilter}년 월별 등록 현황</p>
          <div className="overflow-x-auto">
            <svg width="100%" viewBox={`0 0 ${chartW} ${chartH + 28}`} style={{ minWidth: 360 }}>
              {[0.25,0.5,0.75,1].map(f => {
                const y = chartH - f * barArea;
                return (
                  <g key={f}>
                    <line x1={0} y1={y} x2={chartW} y2={y} stroke="#f3f4f6" strokeWidth={1}/>
                    <text x={2} y={y-2} fontSize={8} fill="#d1d5db">{Math.round(f*maxMonthly)}</text>
                  </g>
                );
              })}
              {monthlyStats.map((m, i) => {
                const cx = slotW * i + slotW / 2;
                const h  = maxMonthly > 0 ? (m.count / maxMonthly) * barArea : 0;
                return (
                  <g key={m.month}>
                    <rect x={cx-barW/2} y={chartH-h} width={barW} height={h} fill="#6366f1" rx={2} opacity={0.85}/>
                    <text x={cx} y={chartH+13} textAnchor="middle" fontSize={9} fill="#9ca3af">{m.label}</text>
                    {m.count > 0 && (
                      <text x={cx} y={chartH-h-3} textAnchor="middle" fontSize={9} fill="#374151" fontWeight="600">{m.count}</text>
                    )}
                  </g>
                );
              })}
            </svg>
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
                  <th className="px-4 py-2.5 text-right">등록 건수</th>
                  <th className="px-4 py-2.5 text-right">구매금액</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {monthlyStats.map(m => (
                  <tr key={m.month} className={`hover:bg-gray-50 ${m.count===0?"opacity-40":""}`}>
                    <td className="px-4 py-2.5 font-medium text-gray-800">{m.label}</td>
                    <td className="px-4 py-2.5 text-right text-indigo-600 font-semibold">{m.count||"-"}</td>
                    <td className="px-4 py-2.5 text-right text-gray-700">{fmtKrw(m.amount)}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-bold border-t-2 border-gray-200">
                  <td className="px-4 py-2.5 text-gray-700">합계</td>
                  <td className="px-4 py-2.5 text-right text-indigo-700">{totalCount}</td>
                  <td className="px-4 py-2.5 text-right text-gray-900">{fmtKrw(totalAmount)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 법인별 / 부서별 브레이크다운 */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100"><p className="text-sm font-bold text-gray-700">법인별 등록 현황</p></div>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500 font-semibold sticky top-0">
                  <tr><th className="px-4 py-2.5 text-left">법인</th><th className="px-4 py-2.5 text-right">건수</th><th className="px-4 py-2.5 text-right">구매금액</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {companyStats.map(([co, s]) => (
                    <tr key={co} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-800">{co}</td>
                      <td className="px-4 py-2.5 text-right text-indigo-600 font-semibold">{s.count}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{fmtKrw(s.amount)}</td>
                    </tr>
                  ))}
                  {companyStats.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-300">데이터 없음</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100"><p className="text-sm font-bold text-gray-700">부서별 등록 현황</p></div>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500 font-semibold sticky top-0">
                  <tr><th className="px-4 py-2.5 text-left">부서</th><th className="px-4 py-2.5 text-right">건수</th><th className="px-4 py-2.5 text-right">구매금액</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {deptStats.map(([d, s]) => (
                    <tr key={d} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-800">{d}</td>
                      <td className="px-4 py-2.5 text-right text-indigo-600 font-semibold">{s.count}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{fmtKrw(s.amount)}</td>
                    </tr>
                  ))}
                  {deptStats.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-300">데이터 없음</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 등록 이력 상세 */}
      {!loading && filtered.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-bold text-gray-700">등록 이력</p>
            <span className="text-xs text-gray-400">{filtered.length}건</span>
          </div>
          <div className="overflow-x-auto overflow-y-auto max-h-96">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500 font-semibold sticky top-0">
                <tr>{["등록일자","자산번호","사용자","법인","부서","모델명","구매금액","등록자"].map(h=>(
                  <th key={h} className="px-3 py-2.5 text-left whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.slice(0,300).map(r=>(
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 whitespace-nowrap text-gray-500">{r.registeredAt.slice(0,10)}</td>
                    <td className="px-3 py-2.5 font-mono whitespace-nowrap">{r.assetNo||"-"}</td>
                    <td className="px-3 py-2.5 font-medium whitespace-nowrap">{r.user||"-"}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{r.company||"-"}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{r.dept||"-"}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap max-w-[130px] truncate">{r.model||"-"}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{fmtKrw(r.price)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-gray-500">{r.registeredBy||"-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && filtered.length === 0 && !error && (
        <div className="py-16 text-center text-gray-300">
          <p className="text-4xl mb-3">🆕</p>
          <p className="text-sm">등록 이력이 없습니다</p>
          <p className="text-xs mt-2 text-gray-300">엑셀로 신규 자산을 등록하면 자동으로 기록됩니다</p>
        </div>
      )}

      {loading && <div className="py-16 text-center text-gray-300 text-sm">불러오는 중…</div>}
    </div>
  );
}

// 등록 현황 HTML 보고서 생성
function generateRegistrationReportHTML(opts: {
  year: string;
  records: RegistrationRecord[];
  monthlyStats: { label: string; count: number; amount: number }[];
  companyStats: [string, { count: number; amount: number }][];
  deptStats: [string, { count: number; amount: number }][];
}): string {
  const { year, records, monthlyStats, companyStats, deptStats } = opts;
  const totalCount  = records.length;
  const totalAmount = records.reduce((s, r) => s + (r.price || 0), 0);
  const today = new Date().toLocaleDateString("ko-KR");
  const maxMonthly = Math.max(...monthlyStats.map(m => m.count), 1);
  const chartH = 120, chartW = 520, padX = 40, padY = 20;
  const n = monthlyStats.length;
  const xOf = (i: number) => padX + (i / Math.max(n - 1, 1)) * (chartW - padX * 2);
  const yOf = (v: number) => padY + (chartH - padY * 2) * (1 - v / maxMonthly);
  const linePoints = monthlyStats.map((m, i) => `${xOf(i)},${yOf(m.count)}`).join(" ");

  const companyRows = companyStats.map(([co, s]) => `<tr><td>${co}</td><td style="text-align:right">${s.count}건</td><td style="text-align:right">${fmtKrw(s.amount)}</td></tr>`).join("");
  const deptRows = deptStats.map(([d, s]) => `<tr><td>${d}</td><td style="text-align:right">${s.count}건</td><td style="text-align:right">${fmtKrw(s.amount)}</td></tr>`).join("");
  const monthRows = monthlyStats.map(m => `<tr><td>${m.label}</td><td style="text-align:right">${m.count}건</td><td style="text-align:right">${fmtKrw(m.amount)}</td></tr>`).join("");

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>HW 신규 등록 현황 보고서 · ${year}년</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; background: #FAFAFA; color: #1E293B; }
  .page { max-width: 900px; margin: 0 auto; padding: 40px 32px; }
  .cover { text-align: center; padding: 50px 0 30px; border-bottom: 2px solid #E4E4E7; margin-bottom: 28px; }
  .cover h1 { font-size: 26px; font-weight: 800; }
  .cover .meta { font-size: 13px; color: #71717A; margin-top: 6px; }
  .cover .period { display: inline-block; background: #4F46E5; color: white; padding: 4px 16px; border-radius: 20px; font-size: 13px; font-weight: 700; margin-top: 10px; }
  .section { margin-bottom: 28px; }
  .section h2 { font-size: 15px; font-weight: 700; margin-bottom: 12px; color: #334155; }
  .summary { display: flex; gap: 12px; }
  .summary .card { flex: 1; background: white; border: 1px solid #E4E4E7; border-radius: 12px; padding: 16px; }
  .summary .card .label { font-size: 12px; color: #71717A; }
  .summary .card .value { font-size: 22px; font-weight: 800; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; }
  th, td { padding: 8px 12px; font-size: 13px; border-bottom: 1px solid #F4F4F5; text-align: left; }
  th { background: #FAFAFA; color: #71717A; font-weight: 600; }
  .footer { text-align: center; font-size: 12px; color: #A1A1AA; margin-top: 40px; }
  @media print { body { background: white; } }
</style>
</head>
<body>
<div class="page">
  <div class="cover">
    <h1>HW 신규 등록 현황 보고서</h1>
    <p class="meta">생성일 ${today}</p>
    <span class="period">${year}년</span>
  </div>

  <div class="section">
    <div class="summary">
      <div class="card"><p class="label">연간 등록</p><p class="value">${totalCount}건</p></div>
      <div class="card"><p class="label">총 구매금액</p><p class="value">${fmtKrw(totalAmount)}</p></div>
      <div class="card"><p class="label">등록 법인</p><p class="value">${companyStats.length}개</p></div>
    </div>
  </div>

  <div class="section">
    <h2>월별 등록 추이</h2>
    <svg width="100%" viewBox="0 0 ${chartW} ${chartH}" style="background:white;border-radius:8px;border:1px solid #E4E4E7">
      <polyline points="${linePoints}" fill="none" stroke="#4F46E5" stroke-width="2"/>
      ${monthlyStats.map((m, i) => `<circle cx="${xOf(i)}" cy="${yOf(m.count)}" r="3" fill="#4F46E5"/><text x="${xOf(i)}" y="${chartH-4}" font-size="9" fill="#A1A1AA" text-anchor="middle">${m.label}</text>`).join("")}
    </svg>
  </div>

  <div class="section">
    <h2>월별 집계</h2>
    <table><thead><tr><th>월</th><th style="text-align:right">건수</th><th style="text-align:right">구매금액</th></tr></thead><tbody>${monthRows}</tbody></table>
  </div>

  <div class="section">
    <h2>법인별 집계</h2>
    <table><thead><tr><th>법인</th><th style="text-align:right">건수</th><th style="text-align:right">구매금액</th></tr></thead><tbody>${companyRows}</tbody></table>
  </div>

  <div class="section">
    <h2>부서별 집계</h2>
    <table><thead><tr><th>부서</th><th style="text-align:right">건수</th><th style="text-align:right">구매금액</th></tr></thead><tbody>${deptRows}</tbody></table>
  </div>

  <p class="footer">SW Portal · HW 자산관리</p>
</div>
</body>
</html>`;
}

// 법인별 재고 탭 (INT-#### 자산번호 제외)
function StockByCompanyTab({ records, loading }: { records: HwRecord[]; loading: boolean }) {
  const rows = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of records) {
      if (r.status !== "재고") continue;
      if (/^INT-\d+$/i.test(r.assetNo ?? "")) continue;
      const co = r.company || "미분류";
      map[co] = (map[co] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [records]);

  const total = rows.reduce((s: number, [, n]: [string, number]) => s + n, 0);

  if (loading) return <div className="py-20 text-center text-gray-400 text-sm">불러오는 중…</div>;
  if (!records.length) return <div className="py-20 text-center text-gray-300 text-sm"><p>데이터를 불러오는 중입니다</p></div>;

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-5">
        <p className="text-sm font-semibold text-gray-700">법인별 재고 현황</p>
        <span className="text-xs text-gray-400">(INT-#### 제외)</span>
        <span className="ml-auto text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-100 rounded-full px-3 py-0.5">합계 {total}개</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {rows.map(([company, count]: [string, number]) => (
          <div key={company} className="rounded-xl border border-purple-100 bg-purple-50 p-4 flex flex-col gap-1">
            <p className="text-2xl font-bold text-purple-700 leading-tight">{count}</p>
            <p className="text-xs font-semibold text-purple-900 leading-snug">{company}</p>
            <p className="text-[11px] text-purple-400">{total ? Math.round(count / total * 100) : 0}%</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 변경 이력 탭 — 자산 하나를 검색해 전체 변경 흐름을 하나의 세로 타임라인으로 표시
// (핵심 필드 변경만 노출, 한 번에 같이 바뀐 필드는 한 카드에 묶어서 표시)
// ─────────────────────────────────────────────────────────────────────────────
const TIMELINE_FIELDS = new Set(["status", "company", "dept", "user"]);

function ChangeHistoryTab({ companyLock = "", onUpdate, isSuperAdmin = false }: {
  companyLock?: string;
  onUpdate: (id: string, fields: Partial<HwRecord>) => Promise<void>;
  isSuperAdmin?: boolean;
}) {
  const [query,       setQuery]       = useState("");
  const [candidates,  setCandidates]  = useState<HwRecord[]>([]);
  const [searching,   setSearching]   = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searched,    setSearched]    = useState(false);

  const [detail,        setDetail]        = useState<HwRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError,   setDetailError]   = useState("");

  const selectAsset = useCallback(async (id: string) => {
    setDetail(null); setDetailError(""); setDetailLoading(true);
    try {
      const res  = await fetch(`/api/hw/history?id=${encodeURIComponent(id)}`);
      const json = await safeJson(res);
      if (!json.ok) throw new Error(json.error);
      if (!json.record) throw new Error("자산을 찾을 수 없습니다.");
      setDetail(json.record);
    } catch (e) { setDetailError(String(e)); }
    finally { setDetailLoading(false); }
  }, []);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true); setSearchError(""); setSearched(true); setCandidates([]); setDetail(null);
    try {
      const q = new URLSearchParams({ search: query.trim() });
      if (companyLock) q.set("company", companyLock);
      const res  = await fetch(`/api/hw?${q}`);
      const json = await safeJson(res);
      if (!json.ok) throw new Error(json.error);
      const records: HwRecord[] = json.records ?? [];
      setCandidates(records);
      if (records.length === 1) selectAsset(records[0].id);
    } catch (e) { setSearchError(String(e)); }
    finally { setSearching(false); }
  }, [query, companyLock, selectAsset]);

  const changeLog: HwChangeLogEvent[] = useMemo(() => {
    if (!detail?.changeLog) return [];
    try {
      const parsed = JSON.parse(detail.changeLog);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }, [detail?.changeLog]);

  // 상태/법인/부서/이름 변경만 남기고, 한 번에 같이 바뀐 필드는 이벤트 하나(한 카드)로 유지
  const timeline = useMemo(() => {
    return changeLog
      .map(ev => ({ ...ev, changes: ev.changes.filter(c => TIMELINE_FIELDS.has(c.field)) }))
      .filter(ev => ev.changes.length > 0)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [changeLog]);

  // 각 이벤트 "직후" 시점의 자산 상태(폼 필드 원본값) 재구성 — 현재값에서 최신 이벤트부터
  // 순서대로 되돌려서 계산. changeLog는 상태/법인/부서/이름 외 필드(사용일자 등)도 포함하므로,
  // 원본 changeLog 전체를 사용해야 정확하다. AssetDetailModal의 되돌리기와 동일한 규칙(REVERTIBLE_FORM_FIELDS,
  // "(없음)" → "")으로 값을 되돌려, 그 결과를 실제 폼(initialForm)에 그대로 먹일 수 있게 한다.
  const rawSnapshotsByAt = useMemo(() => {
    const map = new Map<string, RevertibleForm>();
    if (!detail) return map;
    const snap: RevertibleForm = {
      status: detail.status, user: detail.user, company: detail.company, dept: detail.dept,
      location: detail.location, useDate: detail.useDate, returnDate: detail.returnDate,
      returnDue: detail.returnDue, note: detail.note, email: detail.email,
    };
    const sorted = [...changeLog].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    for (const ev of sorted) {
      map.set(ev.at, { ...snap });
      for (const c of ev.changes) {
        if (REVERTIBLE_FORM_FIELDS.has(c.field)) (snap as unknown as Record<string, string>)[c.field] = c.from === "(없음)" ? "" : c.from;
      }
    }
    return map;
  }, [changeLog, detail]);

  // 클릭하면 그 시점의 상세보기(배경이 흐려지는 정식 모달)를 연다
  const [previewAt, setPreviewAt] = useState<string | null>(null);
  const previewEvent = previewAt ? timeline.find(ev => ev.at === previewAt) ?? null : null;

  const [exporting, setExporting] = useState(false);
  const handleExport = useCallback(async () => {
    if (!detail || timeline.length === 0) return;
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const rows = timeline.flatMap(ev =>
        ev.changes.map(c => ({
          "변경시각": fmtDateTime(ev.at),
          "필드":     c.label,
          "이전값":   c.from || "(없음)",
          "이후값":   c.to || "(없음)",
          "변경자":   ev.by,
        }))
      );
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = Object.keys(rows[0]).map(key => ({
        wch: Math.max(key.length, ...rows.map(r => String(r[key as keyof typeof r] ?? "").length)) + 2,
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "변경이력");
      const now = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `HW변경이력_${detail.assetNo || "자산"}_${now}.xlsx`);
    } finally {
      setExporting(false);
    }
  }, [detail, timeline]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1">자산번호 / 사용자 / 시리얼 / 모델명 (이전 사용자·부서 포함)</label>
            <input value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && search()}
              placeholder="검색어 입력 후 Enter"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
          </div>
          <button onClick={search} disabled={searching}
            className="px-5 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors">
            {searching ? "검색 중…" : "검색"}
          </button>
        </div>
      </div>

      {searchError && <div className="px-4 py-3 bg-red-50 rounded-xl text-sm text-red-600">{searchError}</div>}

      {searched && !searching && candidates.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 text-xs font-semibold text-gray-500">검색 결과 {candidates.length}건 — 자산을 선택하세요</div>
          <div className="divide-y divide-gray-100">
            {candidates.map(r => (
              <button key={r.id} onClick={() => selectAsset(r.id)}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50 transition-colors flex items-center gap-3 ${detail?.id === r.id ? "bg-amber-50" : ""}`}>
                <span className="font-mono text-amber-700 font-semibold">{r.assetNo || "-"}</span>
                <span className="text-gray-600">{r.model || "-"}</span>
                <span className="text-gray-400">·</span>
                <span className="text-gray-700">{r.user || "-"}</span>
                <span className="text-gray-400 text-xs">{r.company}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {searched && !searching && !searchError && candidates.length === 0 && !detailLoading && !detail && (
        <div className="py-12 text-center text-gray-400 text-sm">조회된 자산이 없습니다</div>
      )}

      {detailLoading && <div className="py-12 text-center text-gray-400 text-sm">불러오는 중…</div>}
      {detailError && <div className="px-4 py-3 bg-red-50 rounded-xl text-sm text-red-600">{detailError}</div>}

      {detail && !detailLoading && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-gray-800">{detail.assetNo || "-"} <span className="text-gray-400 font-normal">· {detail.model || "-"}</span></p>
              <p className="text-xs text-gray-400 mt-0.5">현재 사용자 {detail.user || "-"} · {detail.company || "-"}{detail.dept ? ` · ${detail.dept}` : ""}</p>
            </div>
            <button
              onClick={handleExport}
              disabled={exporting || timeline.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors shrink-0"
            >
              {exporting ? (
                <><svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>생성 중…</>
              ) : <>엑셀 다운로드</>}
            </button>
          </div>

          {timeline.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">변경 이력이 없습니다.</p>
          ) : (
            <div className="ml-1 border-l-2 border-gray-100 pl-4 space-y-2.5">
              {timeline.map((ev, i) => (
                <div key={i} className="relative">
                  <span className={`absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full ring-2 ring-white ${i === 0 ? "bg-amber-500" : "bg-gray-300"}`} />
                  <button
                    onClick={() => setPreviewAt(ev.at)}
                    title="클릭하면 이 시점의 자산 상태를 보고 필요시 되돌릴 수 있습니다"
                    className={`w-full text-left rounded-lg border p-2.5 transition-colors hover:ring-2 hover:ring-amber-300 ${i === 0 ? "border-amber-200 bg-amber-50" : "border-gray-100 bg-gray-50"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-400">{fmtDateTime(ev.at)} · {ev.by}</span>
                      {i === 0 && <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded shrink-0">최근 변경</span>}
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {ev.changes.map((c, j) => (
                        <p key={j} className="text-sm">
                          <span className="font-semibold text-gray-500">{c.label}</span>{" "}
                          <span className="text-gray-500">{c.from || "(없음)"}</span>
                          {" → "}
                          <span className={`font-semibold ${i === 0 ? "text-amber-700" : "text-gray-800"}`}>{c.to || "(없음)"}</span>
                        </p>
                      ))}
                    </div>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {previewEvent && detail && (
        <AssetDetailModal
          hideHistory
          record={detail}
          isSuperAdmin={isSuperAdmin}
          initialForm={rawSnapshotsByAt.get(previewEvent.at)}
          previewLabel={`${fmtDateTime(previewEvent.at)} 시점 상태`}
          onClose={() => setPreviewAt(null)}
          onSave={async (id, fields) => {
            await onUpdate(id, fields);
            await selectAsset(id);
            setPreviewAt(null);
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 메인 HwPanel — 데이터 1회 fetch, 모든 탭에 props 전달
// ─────────────────────────────────────────────────────────────────────────────
type Tab = "dashboard"|"shipment"|"return"|"search"|"upload"|"dispatch"|"registration"|"label"|"stock"|"history";

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

export default function HwPanel({ company = "", initialStats, isSuperAdmin = false }: { company?: string; initialStats?: HwStats | null; isSuperAdmin?: boolean }) {
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
      const json = await safeJson(res);
      if (json.missingEnv) { setMissingEnv(json.missingEnv); return; }
      if (!json.ok) throw new Error(json.error);
      if (json.stats) {
        setStats(json.stats);
      } else if (json.warming) {
        // warm 진행 중 → 45초 후 재시도
        setTimeout(async () => {
          try {
            const r2 = await fetch(statsUrl);
            const j2 = await safeJson(r2);
            if (j2.ok && j2.stats) setStats(j2.stats);
          } catch { /* 재시도 실패 무시 */ }
        }, 45_000);
      }
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
      const json = await safeJson(res);
      if (!json.ok) throw new Error(json.error);
      if (json.warming) {
        // 캐시 워밍 중 — recordsReady를 true로 설정하지 않아 재시도 가능
        setRecordsError("HW 데이터 캐시를 갱신하는 중입니다. 잠시 후 새로고침 버튼을 눌러주세요.");
        return;
      }
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
      const json = await safeJson(res);
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
      const json = await safeJson(res);
      if (!json.ok) throw new Error(json.error);
      if (json.warming) {
        setRecordsError("HW 데이터 캐시를 갱신하는 중입니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      setRecords(json.records);
      setRecordsReady(true);
    } catch (e) { setRecordsError(String(e)); }
    finally { setRecordsLoading(false); }
  }, [company]);

  // 초기 stats 로드 (initialStats 없을 때)
  useEffect(() => {
    if (!initialStats) loadStats();
  }, [initialStats, loadStats]);

  // 라벨/재고 탭 전체 레코드 lazy load (shipment/return은 자체 fetch)
  useEffect(() => {
    if (tab === "label" || tab === "stock") loadAll();
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
    const json = await safeJson(res);
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
    { id: "history",   label: "변경 이력",   icon: "🕒" },
    { id: "upload",    label: "엑셀 등록",   icon: "📂" },
    { id: "dispatch",  label: "자산지급 현황",icon: "📋" },
    { id: "registration", label: "등록 현황", icon: "🆕" },
    { id: "label",     label: "행낭 발송지", icon: "🏷️" },
    { id: "stock",     label: "법인별 재고", icon: "📦" },
  ];

  const recordsTabProps: TabProps = { records, loading: recordsLoading, onRefresh: handleRefreshAll, onUpdate: handleUpdate };
  // shipment/return은 자체 fetch → 공유 records 불필요
  const isRecordsTab = tab === "label" || tab === "stock";

  // ── Notion 증분 동기화 (최근 수정분만 즉시 반영) ────────────────────────────
  const [syncing,     setSyncing]     = useState(false);
  const [syncDone,    setSyncDone]    = useState(false);
  const [syncMsg,     setSyncMsg]     = useState("");
  const [syncError,   setSyncError]   = useState("");
  const handleSync = useCallback(async () => {
    setSyncing(true); setSyncDone(false); setSyncError(""); setSyncMsg("");
    try {
      const res  = await fetch("/api/hw/sync", { method: "POST" });
      const json = await safeJson(res);
      if (!json.ok) throw new Error(json.error);
      setSyncDone(true);
      setSyncMsg(json.updatedCount > 0 ? `${json.updatedCount}건 반영됨` : "변경 사항 없음");
      setTimeout(() => setSyncDone(false), 5000);
      loadStats();
      if (recordsReady) loadAll();
    } catch (e) { setSyncError(String(e)); setTimeout(() => setSyncError(""), 5000); }
    finally { setSyncing(false); }
  }, [loadStats, loadAll, recordsReady]);

  if (missingEnv) return <EnvVarMissing varName={missingEnv} />;

  return (
    <div className="space-y-4">

      {/* 패널 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
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
            title="Notion에서 직접 수정한 내용을 최근 변경분만 즉시 반영합니다"
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
              <>{syncMsg || "동기화 완료"}</>
            ) : syncError ? (
              <>실패</>
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

      {statsError  && <div className="px-4 py-3 bg-red-50 rounded-xl text-sm text-red-600">{statsError}</div>}
      {recordsError && <div className="px-4 py-3 bg-red-50 rounded-xl text-sm text-red-600">{recordsError}</div>}

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
      {tab === "shipment"  && <ShipmentTab onUpdate={handleUpdate} companyLock={company} isSuperAdmin={isSuperAdmin} />}
      {tab === "return"    && <ReturnTab   onUpdate={handleUpdate} companyLock={company} isSuperAdmin={isSuperAdmin} />}
      {tab === "search"    && <SearchTab companyLock={company} onUpdate={handleUpdate} isSuperAdmin={isSuperAdmin} />}
      {tab === "history"   && <ChangeHistoryTab companyLock={company} onUpdate={handleUpdate} isSuperAdmin={isSuperAdmin} />}
      {tab === "upload"    && <ExcelUploadTab />}
      {tab === "dispatch"  && <DispatchHistoryTab />}
      {tab === "registration" && <RegistrationLogTab />}
      {tab === "label"     && <LabelPrintTab records={records} recordsReady={recordsReady} onLoadRecords={loadAll} />}
      {tab === "stock"     && <StockByCompanyTab records={records} loading={recordsLoading} />}
    </div>
  );
}

