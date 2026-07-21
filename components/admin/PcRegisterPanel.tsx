"use client";

// ─────────────────────────────────────────────────────────────────────────────
// PC 신규 등록 (자산 실사 방식)
// 온라인 자산 실사(PcScanPanel)와 동일하게 "수집 프로그램 제출 → 마스터 대조" 흐름을 쓰되,
// 완전히 별도의 저장소(NOTION_DB_PC_REGISTER)를 대상으로 하는 신규 등록 전용 탭.
// 등록 직후에는 엑셀 일괄 등록(HwPanel ExcelUploadTab)과 동일한 후속 체인
// (지급 이력 기록 + 자산흐름관리 연동)을 그대로 재사용한다.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import { safeJson } from "@/lib/fetch-json";
import type { PcScanRecordWithMatch } from "@/lib/pc-scan";
import { useAssetFlowSync, AssetFlowSyncSection, type DispatchRow } from "@/components/admin/shared/AssetFlowSync";

// 마스터 DB에 이미 쓰이는 제조사 표기와 대소문자 무시하고 정확히 일치할 때만 채택
// (스캔값 원본은 마스터 표기와 다른 경우가 많아 그대로 쓰지 않음 — PcScanPanel과 동일 로직)
function bestMakerMatch(raw: string, options: string[]): string {
  if (!raw) return "";
  return options.find(o => o.toLowerCase() === raw.toLowerCase()) ?? "";
}
const CUSTOM_MAKER = "__custom__";

interface Filters { assetNo: string; corp: string; dept: string; userName: string; onlyUnregistered: boolean; }
const EMPTY_FILTERS: Filters = { assetNo: "", corp: "", dept: "", userName: "", onlyUnregistered: true };

interface RegRow {
  id: string; assetNo: string; maker: string; makerCustom: boolean; model: string; serial: string;
  company: string; user: string; dept: string; cpu: string; ram: string; mac: string; email: string;
}

function RegisterSelectedModal({
  rows, makerOptions, registering, error, onChange, onSubmit, onClose,
}: {
  rows: RegRow[];
  makerOptions: string[];
  registering: boolean;
  error: string;
  onChange: (rows: RegRow[]) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  function update(i: number, patch: Partial<RegRow>) {
    onChange(rows.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  }
  const canSubmit = !registering && rows.every(r => r.assetNo.trim() && r.maker.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-base">선택 {rows.length}건 등록 확인</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <p className="px-6 pt-3 text-xs text-gray-400">
          스캔값으로 자동 채워졌습니다. 자산번호·제조사는 필수이며, 마스터 DB 표기와 다르면 목록에서 다시 선택하세요.
        </p>
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">
          {rows.map((r, i) => (
            <div key={r.id} className="border border-gray-200 rounded-xl p-3 grid grid-cols-2 gap-3">
              <div className="col-span-2 text-xs text-gray-500 font-medium">{r.user || "사용자 미상"} · {r.model || "모델 미상"}</div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">자산번호 *</label>
                <input value={r.assetNo} onChange={e => update(i, { assetNo: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-400" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">제조사 *</label>
                {r.makerCustom ? (
                  <div className="flex items-center gap-2">
                    <input value={r.maker} onChange={e => update(i, { maker: e.target.value })} placeholder="제조사명 입력"
                      className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-400" />
                    <button type="button" onClick={() => update(i, { makerCustom: false, maker: "" })}
                      className="text-[11px] text-gray-400 hover:text-gray-600 whitespace-nowrap">목록</button>
                  </div>
                ) : (
                  <select value={r.maker} onChange={e => {
                    if (e.target.value === CUSTOM_MAKER) update(i, { makerCustom: true, maker: "" });
                    else update(i, { maker: e.target.value });
                  }} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg">
                    <option value="">— 선택 —</option>
                    {makerOptions.map(m => <option key={m} value={m}>{m}</option>)}
                    <option value={CUSTOM_MAKER}>+ 직접 입력</option>
                  </select>
                )}
              </div>
            </div>
          ))}
        </div>
        {error && <p className="px-6 pb-2 text-xs text-red-500">{error}</p>}
        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700">취소</button>
          <button onClick={onSubmit} disabled={!canSubmit}
            className="px-4 py-1.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-40">
            {registering ? "등록 중…" : `${rows.length}건 등록`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PcRegisterPanel() {
  const [records, setRecords] = useState<PcScanRecordWithMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [makerOptions, setMakerOptions] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [regRows, setRegRows] = useState<RegRow[] | null>(null);
  const [registering, setRegistering] = useState(false);
  const [regError, setRegError] = useState("");
  const [regSummary, setRegSummary] = useState<{ success: number; failed: number } | null>(null);
  const sync = useAssetFlowSync();

  useEffect(() => {
    // 등록 모달의 "제조사" 목록 — 마스터 DB에 이미 쓰이고 있는 제조사 표기를 그대로 재사용
    fetch("/api/hw/stats")
      .then(r => safeJson(r))
      .then(res => {
        const byMaker = res?.ok ? res.stats?.byMaker : null;
        if (byMaker) setMakerOptions(Object.keys(byMaker).filter(m => m !== "기타").sort());
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/admin/pc-register")
      .then(r => safeJson(r))
      .then(res => {
        if (res?.ok) setRecords(res.data ?? []);
        else setError(res?.error ?? "불러오기 실패");
      })
      .catch(() => setError("네트워크 오류"))
      .finally(() => setLoading(false));
  }, []);

  const corpOptions = useMemo(
    () => [...new Set(records.map(r => r.corp).filter(Boolean))].sort(),
    [records]
  );

  const filtered = useMemo(() => records.filter(r => {
    if (filters.onlyUnregistered && r.masterExists) return false;
    if (filters.assetNo   && !r.assetNo.toLowerCase().includes(filters.assetNo.toLowerCase())) return false;
    if (filters.corp      && r.corp !== filters.corp) return false;
    if (filters.dept      && !r.dept.toLowerCase().includes(filters.dept.toLowerCase())) return false;
    if (filters.userName  && !r.userName.toLowerCase().includes(filters.userName.toLowerCase())) return false;
    return true;
  }), [records, filters]);

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleSelectAll() {
    setSelected(prev => prev.size === filtered.length && filtered.length > 0 ? new Set() : new Set(filtered.map(r => r.id)));
  }

  function openRegisterSelected() {
    const chosen = filtered.filter(r => selected.has(r.id));
    if (chosen.length === 0) return;
    setRegRows(chosen.map(r => ({
      id: r.id, assetNo: r.assetNo, model: r.model, serial: r.serial,
      maker: bestMakerMatch(r.manufacturer, makerOptions), makerCustom: false,
      company: r.corp, user: r.userName, dept: r.dept, cpu: r.cpu, ram: r.ram, mac: r.mac, email: r.email,
    })));
    setRegError("");
    setRegSummary(null);
    sync.resetSync();
  }

  async function submitRegister() {
    if (!regRows) return;
    if (regRows.some(r => !r.assetNo.trim() || !r.maker.trim())) {
      setRegError("자산번호와 제조사는 모든 항목에 필수입니다.");
      return;
    }
    setRegistering(true);
    setRegError("");
    try {
      const rows = regRows.map(r => ({
        assetNo: r.assetNo.trim(), model: r.model.trim(), serial: r.serial.trim(), maker: r.maker.trim(),
        cpu: r.cpu.trim(), ram: r.ram.trim(), company: r.company.trim(), user: r.user.trim(), dept: r.dept.trim(),
        mac: r.mac.trim(), email: r.email.trim(),
        location: "", purchaseDate: "", price: 0, useDate: "",
      }));
      const res = await fetch("/api/hw/upload", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "pc-register", rows }),
      });
      const json = await safeJson(res);
      if (!json?.ok) throw new Error(json?.error || "등록 실패");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const successIdxSet = new Set<number>((json.results ?? []).filter((x: any) => x.ok).map((x: any) => x.index));
      const successRows: DispatchRow[] = rows.filter((_, i) => successIdxSet.has(i));
      const registeredIds = regRows.filter((_, i) => successIdxSet.has(i)).map(r => r.id);

      setRecords(prev => prev.map(r => registeredIds.includes(r.id) ? { ...r, masterExists: true } : r));
      setSelected(prev => {
        const next = new Set(prev);
        registeredIds.forEach(id => next.delete(id));
        return next;
      });
      setRegSummary({ success: json.success ?? 0, failed: json.failed ?? 0 });
      setRegRows(null);

      // 엑셀 일괄 등록과 동일한 후속 체인 (지급 이력 기록 + 자산흐름관리 연동)
      await sync.runPostRegistration(successRows);
    } catch (e) {
      setRegError(e instanceof Error ? e.message : "등록 중 오류가 발생했습니다.");
    } finally {
      setRegistering(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("이 수집 기록을 삭제하시겠습니까?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/pc-register?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const json = await safeJson(res);
      if (!json?.ok) throw new Error(json?.error || "삭제 실패");
      setRecords(prev => prev.filter(r => r.id !== id));
      setSelected(prev => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : "삭제 중 오류가 발생했습니다.");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) return <div className="py-16 text-center text-gray-400 text-sm">불러오는 중…</div>;
  if (error) return <div className="py-16 text-center text-red-500 text-sm">{error}</div>;

  return (
    <div className="space-y-4">
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-xs text-teal-700 space-y-1">
        <p className="font-semibold text-sm text-teal-800">PC 신규 등록 (자산 실사 방식)</p>
        <p>수집 프로그램이 제출한 PC 정보를 확인하고 선택 등록하면, 엑셀 일괄 등록과 동일하게 <strong>지급 이력 기록 · 자산흐름관리 연동</strong>까지 자동 처리됩니다.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">자산번호</label>
          <input value={filters.assetNo} onChange={e => setFilters(f => ({ ...f, assetNo: e.target.value }))}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg w-36" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">법인명</label>
          <select value={filters.corp} onChange={e => setFilters(f => ({ ...f, corp: e.target.value }))}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg">
            <option value="">전체</option>
            {corpOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">부서</label>
          <input value={filters.dept} onChange={e => setFilters(f => ({ ...f, dept: e.target.value }))}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg w-32" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">사용자</label>
          <input value={filters.userName} onChange={e => setFilters(f => ({ ...f, userName: e.target.value }))}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg w-32" />
        </div>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 pb-2">
          <input type="checkbox" checked={filters.onlyUnregistered} onChange={e => setFilters(f => ({ ...f, onlyUnregistered: e.target.checked }))} />
          마스터 미등록만
        </label>
        <button onClick={() => setFilters(EMPTY_FILTERS)} className="text-xs text-gray-400 hover:text-gray-700 underline pb-2">초기화</button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">수집된 PC {filtered.length}건</p>
          {selected.size > 0 && (
            <button onClick={openRegisterSelected} className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold">
              선택 {selected.size}건 등록 준비
            </button>
          )}
        </div>
        <div className="overflow-x-auto max-h-[28rem]">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 font-semibold sticky top-0">
              <tr>
                <th className="px-3 py-2.5"><input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length} onChange={toggleSelectAll} /></th>
                {["PC이름","자산번호","시리얼","제조사","모델명","법인","부서","사용자","마스터"].map(h => <th key={h} className="px-3 py-2.5 text-left whitespace-nowrap">{h}</th>)}
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} /></td>
                  <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{r.pcName || "-"}</td>
                  <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">{r.assetNo || "-"}</td>
                  <td className="px-3 py-2 font-mono text-gray-400 text-[11px] whitespace-nowrap">{r.serial || "-"}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.manufacturer || "-"}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap max-w-[120px] truncate">{r.model || "-"}</td>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{r.corp || "-"}</td>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{r.dept || "-"}</td>
                  <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{r.userName || "-"}</td>
                  <td className="px-3 py-2">
                    {r.masterExists
                      ? <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-700">등록됨</span>
                      : <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-500">미등록</span>}
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => handleDelete(r.id)} disabled={deletingId === r.id} className="text-gray-300 hover:text-red-500 disabled:opacity-40">✕</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="py-10 text-center text-gray-300">조건에 맞는 수집 데이터가 없습니다</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {regSummary && (
        <div className={`rounded-xl p-5 border ${regSummary.failed === 0 ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200"}`}>
          <p className={`text-base font-bold mb-1 ${regSummary.failed === 0 ? "text-green-800" : "text-yellow-800"}`}>
            {regSummary.failed === 0 ? "전체 등록 완료!" : "등록 완료 (일부 실패)"}
          </p>
          <p className="text-sm text-gray-700">성공 <span className="font-bold text-green-700">{regSummary.success}</span>건 · 실패 <span className="font-bold text-red-600">{regSummary.failed}</span>건</p>
        </div>
      )}

      <AssetFlowSyncSection
        syncChecked={sync.syncChecked}
        syncWarn={sync.syncWarn}
        syncMatches={sync.syncMatches}
        expandedSyncIdx={sync.expandedSyncIdx}
        onToggle={(i) => sync.setExpandedSyncIdx(sync.expandedSyncIdx === i ? null : i)}
        onConfirm={sync.confirmSync}
      />

      {regRows && (
        <RegisterSelectedModal
          rows={regRows}
          makerOptions={makerOptions}
          registering={registering}
          error={regError}
          onChange={setRegRows}
          onSubmit={submitRegister}
          onClose={() => setRegRows(null)}
        />
      )}
    </div>
  );
}
