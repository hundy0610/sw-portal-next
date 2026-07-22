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
import type { HwRecord } from "@/lib/hw";
import { useAssetFlowSync, AssetFlowSyncSection, type DispatchRow } from "@/components/admin/shared/AssetFlowSync";
import { fetchAssetFlowCandidates, matchAssetFlowCandidates, type AssetFlowCandidate } from "@/lib/hw-register-flow";

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

// 마스터(HW DB)와 방금 수집된 스캔값을 필드별로 비교 — "업데이트" 모달·행 판정 공용
interface FieldDiff { key: string; label: string; masterVal: string; scanVal: string; }

function computeFieldDiffs(r: PcScanRecordWithMatch, master: HwRecord): FieldDiff[] {
  return [
    { key: "company", label: "법인",   masterVal: master.company ?? "", scanVal: r.corp ?? "" },
    { key: "dept",    label: "부서",   masterVal: master.dept    ?? "", scanVal: r.dept ?? "" },
    { key: "user",    label: "사용자", masterVal: master.user    ?? "", scanVal: r.userName ?? "" },
    { key: "maker",   label: "제조사", masterVal: master.maker   ?? "", scanVal: r.manufacturer ?? "" },
    { key: "model",   label: "모델명", masterVal: master.model   ?? "", scanVal: r.model ?? "" },
    { key: "cpu",     label: "CPU",    masterVal: master.cpu     ?? "", scanVal: r.cpu ?? "" },
    { key: "ram",     label: "RAM",    masterVal: master.ram     ?? "", scanVal: r.ram ?? "" },
    { key: "mac",     label: "MAC",    masterVal: master.mac     ?? "", scanVal: r.mac ?? "" },
    { key: "email",   label: "이메일", masterVal: master.email   ?? "", scanVal: r.email ?? "" },
  ];
}
// 수집값이 있고, 마스터값과 다른 경우에만 "다름"으로 취급 (빈 수집값으로 기존 값을 지우지 않음)
function isDiffField(f: FieldDiff): boolean {
  return f.scanVal.trim() !== "" && f.scanVal.trim() !== f.masterVal.trim();
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

// 마스터와 값이 다른 항목만 선택해서 반영하는 업데이트 모달
function UpdateMasterModal({
  record, master, onClose, onUpdated,
}: {
  record: PcScanRecordWithMatch;
  master: HwRecord;
  onClose: () => void;
  onUpdated: (masterId: string, fields: Record<string, string>) => void;
}) {
  const diffs = useMemo(() => computeFieldDiffs(record, master), [record, master]);
  const [selected, setSelected] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const f of diffs) init[f.key] = isDiffField(f);
    return init;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const anySelected = diffs.some(f => isDiffField(f) && selected[f.key]);
  const assetNoMismatch = record.assetNo.trim() !== master.assetNo.trim();

  async function handleSubmit() {
    const fields: Record<string, string> = {};
    for (const f of diffs) {
      if (isDiffField(f) && selected[f.key]) fields[f.key] = f.scanVal.trim();
    }
    if (Object.keys(fields).length === 0) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/hw/update", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: master.id, fields }),
      });
      const json = await safeJson(res);
      if (!json?.ok) throw new Error(json?.error || "업데이트 실패");
      onUpdated(master.id, fields);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "업데이트 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-base">마스터 정보 업데이트</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="px-6 py-4 max-h-[65vh] overflow-y-auto space-y-3">
          {assetNoMismatch && (
            <p className="text-xs bg-sky-50 text-sky-700 rounded-lg px-3 py-2">
              자산번호 불일치 — 마스터: <strong>{master.assetNo || "(없음)"}</strong> / 수집: <strong>{record.assetNo || "(없음)"}</strong>
              <br />자산번호는 여기서 변경할 수 없으며, 아래 선택한 항목만 반영됩니다.
            </p>
          )}

          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] text-gray-400 uppercase tracking-wide">
                <th className="text-left font-semibold py-1 w-8"></th>
                <th className="text-left font-semibold py-1">항목</th>
                <th className="text-left font-semibold py-1">마스터(현재)</th>
                <th className="text-left font-semibold py-1">수집된 값</th>
              </tr>
            </thead>
            <tbody>
              {diffs.map(f => {
                const diff = isDiffField(f);
                return (
                  <tr key={f.key} className="border-t border-gray-100">
                    <td className="py-1.5">
                      <input type="checkbox" checked={!!selected[f.key]} disabled={!diff}
                        onChange={e => setSelected(s => ({ ...s, [f.key]: e.target.checked }))} />
                    </td>
                    <td className="py-1.5 text-gray-500">{f.label}</td>
                    <td className={`py-1.5 ${diff ? "text-amber-600 font-medium" : "text-gray-700"}`}>{f.masterVal || "—"}</td>
                    <td className="py-1.5 text-gray-900">{f.scanVal || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p className="text-[11px] text-gray-400">체크한 항목만 마스터에 반영됩니다. 값이 같거나 수집값이 비어있는 항목은 선택할 수 없습니다.</p>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700">
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !anySelected}
            className="px-4 py-1.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-40"
          >
            {submitting ? "업데이트 중…" : "선택 항목 업데이트"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatCollectedAt(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

// 자산번호 클릭 시 상세 정보 팝업 (PcScanPanel의 DetailModal과 동일한 구성)
function DetailModal({ record, masterStatus, onClose }: {
  record: PcScanRecordWithMatch; masterStatus: "registered" | "update" | "unregistered"; onClose: () => void;
}) {
  const fields: [string, string][] = [
    ["자산번호",   record.assetNo],
    ["PC이름",    record.pcName],
    ["시리얼 넘버", record.serial],
    ["법인명",    record.corp],
    ["겸직/쉐어드", record.isDualOrShared ? "예" : "아니오"],
    ["원소속법인", record.originalCorp],
    ["부서",      record.dept],
    ["사용자",    record.userName],
    ["이메일",    record.email],
    ["제조사",    record.manufacturer],
    ["모델명",    record.model],
    ["CPU",       record.cpu],
    ["RAM",       record.ram],
    ["OS",        record.os],
    ["GPU",       record.gpu],
    ["저장장치",  record.storage],
    ["MAC",       record.mac],
    ["수집일시",  formatCollectedAt(record.collectedAt)],
    ["마스터존재", masterStatus === "registered" ? "✓ 일치" : masterStatus === "update" ? "△ 값 불일치 (업데이트 필요)" : "—"],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-base">PC 상세 정보</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="px-6 py-4 max-h-[65vh] overflow-y-auto">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            {fields.map(([label, value]) => (
              <div key={label}>
                <dt className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{label}</dt>
                <dd className="text-gray-800 break-all">{value || "—"}</dd>
              </div>
            ))}
          </dl>

          {record.programFileUrl && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">설치프로그램</p>
              <a
                href={record.programFileUrl}
                download={record.programFileName || undefined}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline font-medium"
              >
                {record.programFileName || "파일 다운로드"}
              </a>
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
          <a
            href={record.notionUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-gray-400 hover:text-blue-500 hover:underline"
          >
            Notion에서 보기 →
          </a>
          <button onClick={onClose} className="px-4 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700">
            닫기
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
  const [detail, setDetail] = useState<PcScanRecordWithMatch | null>(null);
  const [updateTarget, setUpdateTarget] = useState<{ record: PcScanRecordWithMatch; master: HwRecord } | null>(null);

  // 등록 전 실시간 중복 체크 — 엑셀 등록(HwPanel handleCheckAndUpload)과 동일하게
  // 마스터(HW DB)를 직접 조회해 시리얼·자산번호 중복이면 체크박스 자체를 막는다.
  const [hwRecords, setHwRecords] = useState<HwRecord[]>([]);
  // 자산흐름관리(신규구매 대기) 매칭 후보 — 등록 전 미리보기용 (가장 오른쪽 열에 표시)
  const [flowCandidates, setFlowCandidates] = useState<AssetFlowCandidate[]>([]);

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

  // HW 마스터 + 자산흐름관리 실시간 조회 (등록 직전 중복/매칭 확인용, 등록 후에도 재호출해 최신화)
  async function loadLiveChecks() {
    const [hwJson, candidates] = await Promise.all([
      fetch("/api/hw").then(r => safeJson(r)).catch(() => null),
      fetchAssetFlowCandidates().catch(() => []),
    ]);
    if (hwJson?.ok) setHwRecords(hwJson.records ?? []);
    setFlowCandidates(candidates);
  }
  useEffect(() => { loadLiveChecks(); }, []);

  // 마스터 관계(자산번호/시리얼로 연결된 기존 HW 레코드) 탐색 — 서버가 준 masterId/serialOnlyMatch를
  // 우선 쓰되, 방금 조회한 실시간 마스터 목록에서 자산번호·시리얼 정확 일치로 한 번 더 확인한다.
  function findMasterMatch(r: PcScanRecordWithMatch): HwRecord | undefined {
    const relId = r.masterId ?? r.serialOnlyMatch?.masterId;
    if (relId) {
      const found = hwRecords.find(h => h.id === relId);
      if (found) return found;
    }
    const sk = r.serial?.trim().toLowerCase();
    const ak = r.assetNo?.trim().toLowerCase();
    return hwRecords.find(h =>
      (!!ak && h.assetNo?.trim().toLowerCase() === ak) ||
      (!!sk && h.serial?.trim().toLowerCase() === sk)
    );
  }
  // 마스터와 관계가 없으면 "미등록"(신규 등록 가능), 관계는 있지만 값이 달라진 곳이 있으면
  // "업데이트"(선택 반영 필요), 전부 동일하면 "등록됨".
  function rowMasterStatus(r: PcScanRecordWithMatch): { status: "registered" | "update" | "unregistered"; master?: HwRecord } {
    const master = findMasterMatch(r);
    if (!master) return { status: "unregistered" };
    const hasDiff = computeFieldDiffs(r, master).some(isDiffField);
    return { status: hasDiff ? "update" : "registered", master };
  }
  function flowMatchesFor(r: PcScanRecordWithMatch): AssetFlowCandidate[] {
    return matchAssetFlowCandidates({ company: r.corp, user: r.userName }, flowCandidates);
  }
  function handleMasterUpdated(masterId: string, fields: Record<string, string>) {
    setHwRecords(prev => prev.map(h => h.id === masterId ? { ...h, ...fields } : h));
  }

  const corpOptions = useMemo(
    () => [...new Set(records.map(r => r.corp).filter(Boolean))].sort(),
    [records]
  );

  const filtered = useMemo(() => records.filter(r => {
    if (filters.onlyUnregistered && rowMasterStatus(r).status === "registered") return false;
    if (filters.assetNo   && !r.assetNo.toLowerCase().includes(filters.assetNo.toLowerCase())) return false;
    if (filters.corp      && r.corp !== filters.corp) return false;
    if (filters.dept      && !r.dept.toLowerCase().includes(filters.dept.toLowerCase())) return false;
    if (filters.userName  && !r.userName.toLowerCase().includes(filters.userName.toLowerCase())) return false;
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [records, filters, hwRecords]);

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  const selectableFiltered = useMemo(
    () => filtered.filter(r => rowMasterStatus(r).status === "unregistered"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, hwRecords]
  );

  function toggleSelectAll() {
    setSelected(prev => prev.size === selectableFiltered.length && selectableFiltered.length > 0
      ? new Set()
      : new Set(selectableFiltered.map(r => r.id)));
  }

  function openRegisterSelected() {
    // 체크박스로 막아두지만, 그 사이 마스터에 등록된 경우까지 대비해 한 번 더 방어적으로 걸러낸다.
    const chosen = filtered.filter(r => selected.has(r.id) && rowMasterStatus(r).status === "unregistered");
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
      // 방금 등록한 건이 마스터/자산흐름관리 실시간 체크에 즉시 반영되도록 재조회
      await loadLiveChecks();
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
                <th className="px-3 py-2.5">
                  <input type="checkbox"
                    checked={selectableFiltered.length > 0 && selected.size === selectableFiltered.length}
                    onChange={toggleSelectAll} />
                </th>
                {["자산번호","법인","부서","이름","제조사","모델명","마스터","자산흐름관리"].map(h => <th key={h} className="px-3 py-2.5 text-left whitespace-nowrap">{h}</th>)}
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(r => {
                const { status: mStatus, master } = rowMasterStatus(r);
                const checkboxDisabled = mStatus !== "unregistered";
                const flowMatches = flowMatchesFor(r);
                return (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selected.has(r.id)} disabled={checkboxDisabled}
                      title={checkboxDisabled
                        ? (mStatus === "update"
                          ? "마스터와 값이 달라 업데이트가 필요합니다. '업데이트' 버튼을 이용하세요."
                          : "이미 마스터(HW DB)에 동일하게 등록되어 있습니다")
                        : undefined}
                      onChange={() => toggleSelect(r.id)} />
                  </td>
                  <td className="px-3 py-2 font-mono whitespace-nowrap">
                    <button onClick={() => setDetail(r)} className="font-semibold text-blue-600 hover:underline text-left">
                      {r.assetNo || <span className="text-gray-300 font-normal">-</span>}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{r.corp || "-"}</td>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{r.dept || "-"}</td>
                  <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{r.userName || "-"}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.manufacturer || "-"}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap max-w-[120px] truncate">{r.model || "-"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {mStatus === "update" && master ? (
                      <button onClick={() => setUpdateTarget({ record: r, master })}
                        className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200">
                        업데이트
                      </button>
                    ) : mStatus === "registered" ? (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-700">등록됨</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-500">미등록</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {flowMatches.length > 0
                      ? <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700">
                          {flowMatches[0].type} 대기{flowMatches.length > 1 ? ` 외 ${flowMatches.length - 1}건` : ""}
                        </span>
                      : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => handleDelete(r.id)} disabled={deletingId === r.id} className="text-gray-300 hover:text-red-500 disabled:opacity-40">✕</button>
                  </td>
                </tr>
                );
              })}
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

      {detail && (
        <DetailModal record={detail} masterStatus={rowMasterStatus(detail).status} onClose={() => setDetail(null)} />
      )}

      {updateTarget && (
        <UpdateMasterModal
          record={updateTarget.record}
          master={updateTarget.master}
          onClose={() => setUpdateTarget(null)}
          onUpdated={handleMasterUpdated}
        />
      )}

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
