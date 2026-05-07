"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import type { RentalRecord } from "@/lib/rental-hw";

const COMPANIES = [
  "대웅","대웅제약","대웅바이오","대웅개발","대웅펫",
  "IdsTrust","한올바이오파마","시지바이오","시지메디텍","엠서클",
  "유와이즈원","더편한샵","디엔코스메틱스","페이지원","HR코리아",
];

const PAGE_SIZE = 30;

function daysLeft(d?: string): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

function fmtDate(d?: string) { return d ? d.slice(0, 10) : "—"; }

function DDay({ date }: { date: string }) {
  const d = daysLeft(date);
  if (d === null) return <span className="text-gray-400">—</span>;
  if (d < 0)  return <span className="text-red-600 font-bold text-xs bg-red-50 px-1.5 py-0.5 rounded-full">D+{Math.abs(d)} 초과</span>;
  if (d === 0) return <span className="text-red-600 font-bold text-xs bg-red-50 px-1.5 py-0.5 rounded-full">D-Day</span>;
  if (d <= 7)  return <span className="text-orange-600 font-semibold text-xs bg-orange-50 px-1.5 py-0.5 rounded-full">D-{d}</span>;
  return <span className="text-gray-500 text-xs">{fmtDate(date)}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const s = status.replace(/^[^\w가-힣]*\s*/, "");
  const cls = status.includes("재고")    ? "bg-blue-50 text-blue-700"
            : status.includes("미반납")  ? "bg-red-50 text-red-600"
            : "bg-gray-100 text-gray-500";
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{s || "—"}</span>;
}

// ── 등록 모달 ────────────────────────────────────────────────────────────────
function CreateModal({ onSave, onClose }: {
  onSave: (fields: Record<string, string>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    userAndReason: "", requester: "", company: "", dept: "",
    assetNo: "", assetNoOld: "", dlpAccount: "", startDate: "", returnDue: "",
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.userAndReason.trim()) { setError("실사용자/지급사유는 필수입니다."); return; }
    setSaving(true); setError("");
    try { await onSave(form); onClose(); }
    catch (e) { setError(String(e)); }
    finally { setSaving(false); }
  }

  const labelCls = "block text-xs font-semibold text-gray-500 mb-1";
  const inputCls = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 bg-blue-600 text-white flex items-center justify-between shrink-0">
          <div className="font-bold text-base">임대 노트북 등록</div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          <div><label className={labelCls}>실사용자 / 지급사유 *</label>
            <input value={form.userAndReason} onChange={e => set("userAndReason", e.target.value)} className={inputCls} placeholder="예: PC 구매 지연으로 인한 대여" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>요청인</label>
              <input value={form.requester} onChange={e => set("requester", e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>요청법인</label>
              <select value={form.company} onChange={e => set("company", e.target.value)} className={inputCls}>
                <option value="">— 선택 —</option>
                {COMPANIES.map(c => <option key={c}>{c}</option>)}
              </select></div>
          </div>
          <div><label className={labelCls}>부서</label>
            <input value={form.dept} onChange={e => set("dept", e.target.value)} className={inputCls} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>출고자산번호</label>
              <input value={form.assetNo} onChange={e => set("assetNo", e.target.value)} className={inputCls} placeholder="TEMP-INxx" /></div>
            <div><label className={labelCls}>출고자산번호 (기존)</label>
              <input value={form.assetNoOld} onChange={e => set("assetNoOld", e.target.value)} className={inputCls} placeholder="01-xxxx" /></div>
          </div>
          <div><label className={labelCls}>인증 DLP 계정</label>
            <input value={form.dlpAccount} onChange={e => set("dlpAccount", e.target.value)} className={inputCls} placeholder="예: 10번고정" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>사용시작일</label>
              <input type="date" value={form.startDate} onChange={e => set("startDate", e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>반납예정일</label>
              <input type="date" value={form.returnDue} onChange={e => set("returnDue", e.target.value)} className={inputCls} /></div>
          </div>
          {error && <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
        </div>
        <div className="px-5 py-4 border-t flex gap-2 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">취소</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors">
            {saving ? "저장 중…" : "✓ Notion에 저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 전체 편집 모달 ───────────────────────────────────────────────────────────
function EditModal({ record, onSave, onClose }: {
  record: RentalRecord;
  onSave: (id: string, fields: object) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    userAndReason: record.userAndReason,
    requester:     record.requester,
    company:       record.company,
    dept:          record.dept,
    assetNo:       record.assetNo,
    assetNoOld:    record.assetNoOld,
    dlpAccount:    record.dlpAccount,
    startDate:     record.startDate,
    returnDue:     record.returnDue,
    inStock:       record.inStock,
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  async function handleSave() {
    setSaving(true); setError("");
    try {
      await onSave(record.id, {
        ...form,
        returnDue: form.returnDue || null,
      });
      onClose();
    } catch (e) { setError(String(e)); }
    finally { setSaving(false); }
  }

  const lbl = "block text-xs font-semibold text-gray-500 mb-1";
  const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="px-5 py-4 bg-blue-600 text-white flex items-start justify-between shrink-0">
          <div>
            <div className="font-bold text-base">자산 정보 수정</div>
            <div className="text-xs opacity-80 mt-0.5">{record.assetNo || "자산번호 없음"}</div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none ml-4">✕</button>
        </div>

        {/* 본문 */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          <div><label className={lbl}>실사용자 / 지급사유</label>
            <input value={form.userAndReason} onChange={e => set("userAndReason", e.target.value)} className={inp} /></div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>요청인</label>
              <input value={form.requester} onChange={e => set("requester", e.target.value)} className={inp} /></div>
            <div><label className={lbl}>요청법인</label>
              <select value={form.company} onChange={e => set("company", e.target.value)} className={inp}>
                <option value="">— 선택 —</option>
                {COMPANIES.map(c => <option key={c}>{c}</option>)}
              </select></div>
          </div>

          <div><label className={lbl}>부서</label>
            <input value={form.dept} onChange={e => set("dept", e.target.value)} className={inp} /></div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>출고자산번호</label>
              <input value={form.assetNo} onChange={e => set("assetNo", e.target.value)} className={inp} /></div>
            <div><label className={lbl}>출고자산번호 (기존)</label>
              <input value={form.assetNoOld} onChange={e => set("assetNoOld", e.target.value)} className={inp} /></div>
          </div>

          <div><label className={lbl}>인증 DLP 계정</label>
            <input value={form.dlpAccount} onChange={e => set("dlpAccount", e.target.value)} className={inp} /></div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>사용시작일</label>
              <input type="date" value={form.startDate} onChange={e => set("startDate", e.target.value)} className={inp} /></div>
            <div><label className={lbl}>반납예정일</label>
              <input type="date" value={form.returnDue} onChange={e => set("returnDue", e.target.value)} className={inp} /></div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none pt-1">
            <input type="checkbox" checked={form.inStock} onChange={e => set("inStock", e.target.checked)}
              className="w-4 h-4 rounded accent-emerald-600" />
            <span className="text-sm font-medium text-gray-700">재고 (반납 완료 상태로 전환)</span>
          </label>

          {error && <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
        </div>

        {/* 푸터 */}
        <div className="px-5 py-4 border-t flex gap-2 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">취소</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors">
            {saving ? "저장 중…" : "✓ Notion에 저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 페이지네이션 ─────────────────────────────────────────────────────────────
function Pagination({ total, page, size, onChange }: {
  total: number; page: number; size: number; onChange: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / size));
  if (totalPages <= 1) return null;
  const start = (page - 1) * size + 1;
  const end   = Math.min(page * size, total);
  const pages: (number | "…")[] = [];
  if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
  else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }
  const btn = "w-8 h-8 rounded-lg text-xs flex items-center justify-center transition-colors";
  return (
    <div className="flex items-center justify-between mt-4">
      <span className="text-xs text-gray-400">{start}–{end} / {total}건</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(page - 1)} disabled={page === 1}
          className={`${btn} border border-gray-200 ${page === 1 ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-100"}`}>‹</button>
        {pages.map((p, i) => p === "…"
          ? <span key={`e${i}`} className="w-8 text-center text-xs text-gray-400">…</span>
          : <button key={p} onClick={() => onChange(p as number)}
              className={`${btn} ${page === p ? "bg-blue-600 text-white" : "border border-gray-200 hover:bg-gray-100 text-gray-600"}`}>{p}</button>
        )}
        <button onClick={() => onChange(page + 1)} disabled={page === totalPages}
          className={`${btn} border border-gray-200 ${page === totalPages ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-100"}`}>›</button>
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function RentalHwPanel() {
  const [records, setRecords] = useState<RentalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [filterCompany, setFilterCompany] = useState("전체");
  const [filterStatus,  setFilterStatus]  = useState("전체");
  const [showOverdue,   setShowOverdue]   = useState(false);
  const [currentPage,   setCurrentPage]   = useState(1);
  const [createOpen,  setCreateOpen]  = useState(false);
  const [editRecord,  setEditRecord]  = useState<RentalRecord | null>(null);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/rental-hw${refresh ? "?refresh=1" : ""}`);
      const json = await res.json();
      setRecords(json.data ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setCurrentPage(1); }, [search, filterCompany, filterStatus, showOverdue]);

  const handleCreate = useCallback(async (fields: Record<string, string>) => {
    const res  = await fetch("/api/rental-hw/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields) });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error ?? "등록 실패");
    setRecords(prev => [json.data, ...prev]);
  }, []);

  const handleUpdate = useCallback(async (id: string, fields: object) => {
    const res  = await fetch("/api/rental-hw/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, fields }) });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error ?? "수정 실패");
    await load(true);
  }, [load]);

  const companyOptions = useMemo(() =>
    ["전체", ...Array.from(new Set(records.map(r => r.company).filter(Boolean))).sort()], [records]);

  const stats = useMemo(() => ({
    total:    records.length,
    inUse:    records.filter(r => !r.inStock).length,
    inStock:  records.filter(r => r.inStock).length,
    overdue:  records.filter(r => { const d = daysLeft(r.returnDue); return !r.inStock && d !== null && d < 0; }).length,
  }), [records]);

  const filtered = useMemo(() => records.filter(r => {
    if (filterCompany !== "전체" && r.company !== filterCompany) return false;
    if (filterStatus  === "임대중" && r.inStock)  return false;
    if (filterStatus  === "재고"   && !r.inStock) return false;
    if (showOverdue) { const d = daysLeft(r.returnDue); if (r.inStock || d === null || d >= 0) return false; }
    if (search) {
      const q = search.toLowerCase();
      if (![r.userAndReason, r.requester, r.assetNo, r.assetNoOld, r.dept, r.company]
        .some(v => v?.toLowerCase().includes(q))) return false;
    }
    return true;
  }), [records, filterCompany, filterStatus, showOverdue, search]);

  const paginated = useMemo(() =>
    filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [filtered, currentPage]);

  if (loading) return <div className="text-center py-20 text-gray-400">데이터 로딩 중…</div>;

  return (
    <div className="fade-in">
      {/* 헤더 */}
      <div className="flex items-end justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-0.5">임대노트북 현황 관리</h2>
          <p className="text-sm text-gray-500">임시 PC 트래커 (Notion 실시간 연동)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => load(true)}
            className="px-3 py-2 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors">
            🔄 새로고침
          </button>
          <button onClick={() => setCreateOpen(true)}
            className="px-4 py-2 text-xs bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors">
            + 신규 등록
          </button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: "전체",    value: stats.total,   color: "bg-gray-50  border-gray-200",   text: "text-gray-700"   },
          { label: "임대중",  value: stats.inUse,   color: "bg-blue-50  border-blue-200",   text: "text-blue-700"   },
          { label: "재고",    value: stats.inStock, color: "bg-green-50 border-green-200",  text: "text-green-700"  },
          { label: "반납초과", value: stats.overdue, color: "bg-red-50   border-red-200",    text: "text-red-700"    },
        ].map(s => (
          <div key={s.label} className={`border rounded-xl p-4 ${s.color}`}>
            <div className={`text-2xl font-bold ${s.text}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 필터 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 space-y-3">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="사용자, 자산번호, 부서, 법인 검색…" />
          {search && <button onClick={() => setSearch("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-base">×</button>}
        </div>
        <div className="flex flex-wrap gap-2">
          {/* 법인 */}
          <div className="relative">
            <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)}
              className={`appearance-none pl-3 pr-7 py-2 border rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer ${filterCompany !== "전체" ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-gray-300 text-gray-600"}`}>
              <option value="전체">법인: 전체</option>
              {companyOptions.filter(o => o !== "전체").map(o => <option key={o}>{o}</option>)}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▾</span>
          </div>
          {/* 상태 */}
          <div className="relative">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className={`appearance-none pl-3 pr-7 py-2 border rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer ${filterStatus !== "전체" ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-gray-300 text-gray-600"}`}>
              {["전체","임대중","재고"].map(o => <option key={o}>{o}</option>)}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▾</span>
          </div>
          {/* 반납초과 */}
          <button onClick={() => setShowOverdue(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${showOverdue ? "bg-red-50 border-red-300 text-red-600" : "bg-white border-gray-300 text-gray-600 hover:border-gray-400"}`}>
            ⚠ 반납 초과만
          </button>
        </div>
        <div className="text-right text-xs text-gray-400">{filtered.length}건 조회됨</div>
      </div>

      {/* 테이블 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-auto shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {["자산번호","기존번호","실사용자/지급사유","요청인","법인","부서","DLP 계정","사용시작일","반납예정일","상태"].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-12 text-gray-400">검색 결과가 없습니다</td></tr>
            ) : paginated.map(r => (
              <tr key={r.id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors cursor-pointer"
                onClick={() => setEditRecord(r)}>
                <td className="px-3 py-3 whitespace-nowrap">
                  <span className="text-xs font-mono font-semibold text-blue-600 hover:underline">
                    {r.assetNo || "—"}
                  </span>
                </td>
                <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{r.assetNoOld || "—"}</td>
                <td className="px-3 py-3 text-xs text-gray-800 max-w-[180px]">
                  <div className="truncate" title={r.userAndReason}>{r.userAndReason || "—"}</div>
                </td>
                <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">{r.requester || "—"}</td>
                <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">{r.company || "—"}</td>
                <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{r.dept || "—"}</td>
                <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{r.dlpAccount || "—"}</td>
                <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(r.startDate)}</td>
                <td className="px-3 py-3 whitespace-nowrap">{r.returnDue ? <DDay date={r.returnDue} /> : <span className="text-gray-400 text-xs">—</span>}</td>
                <td className="px-3 py-3 whitespace-nowrap"><StatusBadge status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination total={filtered.length} page={currentPage} size={PAGE_SIZE} onChange={setCurrentPage} />

      {createOpen && <CreateModal onSave={handleCreate} onClose={() => setCreateOpen(false)} />}
      {editRecord  && <EditModal  record={editRecord}  onSave={handleUpdate} onClose={() => setEditRecord(null)} />}
    </div>
  );
}
