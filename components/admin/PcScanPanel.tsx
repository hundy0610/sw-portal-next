"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import type { PcScanRecordWithMatch } from "@/lib/pc-scan";
import { safeJson } from "@/lib/fetch-json";

function hasMismatch(r: PcScanRecordWithMatch): boolean {
  return !!r.mismatch && (r.mismatch.corp || r.mismatch.dept || r.mismatch.userName);
}

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── 스탯 카드 ──────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-1">
      <div className="text-2xl font-extrabold" style={{ color }}>{value}</div>
      <div className="text-xs font-medium text-gray-500">{label}</div>
    </div>
  );
}

// ── 상세 팝업 ──────────────────────────────────────────────────
function DetailModal({ record, onClose }: { record: PcScanRecordWithMatch; onClose: () => void }) {
  const fields: [string, string][] = [
    ["자산번호",  record.assetNo],
    ["PC이름",   record.pcName],
    ["시리얼 넘버", record.serial],
    ["법인명",   record.corp],
    ["겸직/쉐어드", record.isDualOrShared ? "예" : "아니오"],
    ["원소속법인", record.originalCorp],
    ["부서",     record.dept],
    ["사용자",   record.userName],
    ["이메일",   record.email],
    ["제조사",   record.manufacturer],
    ["모델명",   record.model],
    ["CPU",      record.cpu],
    ["RAM",      record.ram],
    ["OS",       record.os],
    ["GPU",      record.gpu],
    ["저장장치", record.storage],
    ["MAC",      record.mac],
    ["수집일시", formatDate(record.collectedAt)],
    ["마스터존재", record.masterExists ? "✓ 일치" : "—"],
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
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 신규 등록 모달 ──────────────────────────────────────────────
const MODAL_INPUT_CLS = "w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white form-field-white";

// 마스터 DB에 이미 등록된 제조사 표기와 대소문자 무시하고 정확히 일치할 때만 채택
// (스캔이 보내는 "SAMSUNG ELECTRONICS CO., LTD." 같은 원본값은 마스터 표기와 다른 경우가 많아 그대로 쓰지 않음)
function bestMakerMatch(raw: string, options: string[]): string {
  if (!raw) return "";
  return options.find(o => o.toLowerCase() === raw.toLowerCase()) ?? "";
}

const CUSTOM_MAKER = "__custom__";

function RegisterMasterModal({
  record,
  makerOptions,
  onClose,
  onRegistered,
}: {
  record: PcScanRecordWithMatch;
  makerOptions: string[];
  onClose: () => void;
  onRegistered: (id: string) => void;
}) {
  const [assetNo, setAssetNo] = useState(record.assetNo);
  const [maker, setMaker]     = useState(() => bestMakerMatch(record.manufacturer, makerOptions));
  const [makerCustom, setMakerCustom] = useState(false);
  const [model, setModel]     = useState(record.model);
  const [serial, setSerial]   = useState(record.serial);
  const [company, setCompany] = useState(record.corp);
  const [user, setUser]       = useState(record.userName);
  const [dept, setDept]       = useState(record.dept);
  const [cpu, setCpu]         = useState(record.cpu);
  const [ram, setRam]         = useState(record.ram);
  const [mac, setMac]         = useState(record.mac);
  const [email, setEmail]     = useState(record.email);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState("");

  const canSubmit = assetNo.trim() !== "" && maker.trim() !== "" && !submitting;

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/hw/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "pc-scan",
          rows: [{
            assetNo: assetNo.trim(), model: model.trim(), serial: serial.trim(), maker: maker.trim(),
            cpu: cpu.trim(), ram: ram.trim(), company: company.trim(), user: user.trim(), dept: dept.trim(),
            mac: mac.trim(), email: email.trim(),
            location: "", purchaseDate: "", price: 0, useDate: "",
          }],
        }),
      });
      const json = await safeJson(res);
      if (!json?.ok || (json.success ?? 0) < 1) {
        throw new Error(json?.error || json?.results?.[0]?.error || "등록 실패");
      }
      onRegistered(record.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "등록 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-base">HW 마스터 신규 등록</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="px-6 py-4 max-h-[65vh] overflow-y-auto space-y-3">
          <p className="text-xs text-gray-400">
            스캔값으로 자동 채워졌습니다. 등록 전 내용을 확인·수정하세요. 자산번호·제조사는 필수입니다.
          </p>

          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">자산번호 *</label>
            <input className={MODAL_INPUT_CLS} value={assetNo} onChange={e => setAssetNo(e.target.value)} />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">제조사 *</label>
            {makerCustom ? (
              <div className="flex items-center gap-2">
                <input
                  className={MODAL_INPUT_CLS}
                  value={maker}
                  onChange={e => setMaker(e.target.value)}
                  placeholder="제조사명 입력"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => { setMakerCustom(false); setMaker(bestMakerMatch(record.manufacturer, makerOptions)); }}
                  className="text-[11px] text-gray-400 hover:text-gray-600 whitespace-nowrap"
                >
                  목록에서 선택
                </button>
              </div>
            ) : (
              <select
                className={MODAL_INPUT_CLS}
                value={maker}
                onChange={e => {
                  if (e.target.value === CUSTOM_MAKER) { setMakerCustom(true); setMaker(""); }
                  else setMaker(e.target.value);
                }}
              >
                <option value="">— 선택 —</option>
                {makerOptions.map(m => <option key={m} value={m}>{m}</option>)}
                <option value={CUSTOM_MAKER}>+ 직접 입력</option>
              </select>
            )}
            {record.manufacturer && maker !== record.manufacturer && (
              <p className="text-[11px] text-gray-400 mt-1">
                스캔값: {record.manufacturer} — 마스터 DB에서 쓰는 제조사명을 목록에서 선택하세요.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">모델명</label>
              <input className={MODAL_INPUT_CLS} value={model} onChange={e => setModel(e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">시리얼 넘버</label>
              <input className={MODAL_INPUT_CLS} value={serial} onChange={e => setSerial(e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">법인명</label>
              <input className={MODAL_INPUT_CLS} value={company} onChange={e => setCompany(e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">사용자</label>
              <input className={MODAL_INPUT_CLS} value={user} onChange={e => setUser(e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">부서</label>
              <input className={MODAL_INPUT_CLS} value={dept} onChange={e => setDept(e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">CPU</label>
              <input className={MODAL_INPUT_CLS} value={cpu} onChange={e => setCpu(e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">RAM</label>
              <input className={MODAL_INPUT_CLS} value={ram} onChange={e => setRam(e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">MAC</label>
              <input className={MODAL_INPUT_CLS} value={mac} onChange={e => setMac(e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">이메일</label>
              <input className={MODAL_INPUT_CLS} value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700">
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-4 py-1.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-40"
          >
            {submitting ? "등록 중…" : "신규 등록"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 동기화 확인 모달 (⚠ 불일치 / ? 시리얼만 일치 공통) ─────────────
function SyncConfirmModal({
  record,
  onClose,
  onSynced,
}: {
  record: PcScanRecordWithMatch;
  onClose: () => void;
  onSynced: (id: string) => void;
}) {
  const masterId   = record.masterId ?? record.serialOnlyMatch?.masterId ?? null;
  const masterCorp = record.master?.corp     ?? record.serialOnlyMatch?.masterCorp ?? "";
  const masterDept = record.master?.dept     ?? record.serialOnlyMatch?.masterDept ?? "";
  const masterUser = record.master?.userName ?? record.serialOnlyMatch?.masterUser ?? "";
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const rows: [string, string, string][] = [
    ["법인", masterCorp, record.corp],
    ["부서", masterDept, record.dept],
    ["사용자", masterUser, record.userName],
  ];

  async function handleSync() {
    if (!masterId) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/hw/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: masterId,
          fields: { company: record.corp, dept: record.dept, user: record.userName, status: "사용중", verified: true },
        }),
      });
      const json = await safeJson(res);
      if (!json?.ok) throw new Error(json?.error || "동기화 실패");
      onSynced(record.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "동기화 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-base">마스터 정보 동기화</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="px-6 py-4 space-y-3">
          {record.serialOnlyMatch && (
            <p className="text-xs bg-sky-50 text-sky-700 rounded-lg px-3 py-2">
              자산번호 불일치 — 마스터: <strong>{record.serialOnlyMatch.masterAssetNo || "(없음)"}</strong> / 스캔: <strong>{record.assetNo || "(없음)"}</strong>
              <br />자산번호는 여기서 고칠 수 없으며, 아래 정보만 스캔값으로 동기화됩니다.
            </p>
          )}

          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] text-gray-400 uppercase tracking-wide">
                <th className="text-left font-semibold py-1">항목</th>
                <th className="text-left font-semibold py-1">마스터(현재)</th>
                <th className="text-left font-semibold py-1">스캔값</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, masterVal, scanVal]) => (
                <tr key={label} className="border-t border-gray-100">
                  <td className="py-1.5 text-gray-500">{label}</td>
                  <td className={`py-1.5 ${masterVal !== scanVal ? "text-amber-600 font-medium" : "text-gray-700"}`}>{masterVal || "—"}</td>
                  <td className="py-1.5 text-gray-900">{scanVal || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="text-[11px] text-gray-400">동기화 시 마스터 상태는 &quot;사용중&quot; · 실사확인 ✓ 로 함께 반영됩니다.</p>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700">
            취소
          </button>
          <button
            onClick={handleSync}
            disabled={submitting || !masterId}
            className="px-4 py-1.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-40"
          >
            {submitting ? "동기화 중…" : "동기화 적용"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 필터 상태 ──────────────────────────────────────────────────
interface Filters {
  assetNo: string;
  corp: string;
  isDualOrShared: string; // "" | "true" | "false"
  originalCorp: string;
  dept: string;
  userName: string;
  email: string;
  pcName: string;
  cpu: string;
  ram: string;
  gpu: string;
  os: string;
  hasFile: string;      // "" | "yes" | "no"
  masterStatus: string; // "" | "match" | "mismatch" | "serialOnly" | "none"
}
const EMPTY: Filters = {
  assetNo: "", corp: "", isDualOrShared: "", originalCorp: "", dept: "", userName: "", email: "",
  pcName: "", cpu: "", ram: "", gpu: "", os: "", hasFile: "", masterStatus: "",
};

const INPUT_CLS = "w-full px-2 py-1 text-[11px] border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white";

// ── SW 목록 대조 (블랙리스트 후보 추출) ──────────────────────────
interface SwAuditFileTarget { recordId: string; pcName: string; fileUrl: string }
interface UnknownAggregateEntry { name: string; publisher: string; count: number; pcNames: string[] }
interface SwAuditResult {
  checked: number;
  failed: { recordId: string; pcName: string; error: string }[];
  perPcSummary: { recordId: string; pcName: string; total: number; whitelist: number; blacklist: number; unknown: number }[];
  unknownAggregate: UnknownAggregateEntry[];
}

function SwAuditModal({ files, onClose }: { files: SwAuditFileTarget[]; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [result, setResult]   = useState<SwAuditResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [registering, setRegistering] = useState(false);
  const [registeredCount, setRegisteredCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/admin/pc-scan/sw-audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files }),
    })
      .then(r => safeJson(r))
      .then(res => {
        if (!res.ok) { setError(res.error ?? "검사 실패"); return; }
        setResult(res);
      })
      .catch(() => setError("네트워크 오류"))
      .finally(() => setLoading(false));
  }, [files]);

  function toggle(name: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  async function handleBlacklist() {
    if (selected.size === 0) return;
    setRegistering(true);
    try {
      const res = await fetch("/api/sw-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _action: "bulkCreate", names: Array.from(selected), status: "banned" }),
      });
      const json = await safeJson(res);
      if (json.ok) {
        setRegisteredCount(json.created);
        setSelected(new Set());
      } else {
        alert(json.error ?? "등록 실패");
      }
    } finally {
      setRegistering(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 bg-gray-900 text-white flex items-center justify-between shrink-0">
          <div>
            <div className="font-bold text-base">설치 SW 일괄 검사</div>
            <div className="text-xs opacity-80 mt-0.5">{files.length}대 대상 · 관리 중인 SW DB와 대조해 미확인 SW를 추출합니다</div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5">
          {loading && <div className="text-center py-16 text-gray-400 text-sm">{files.length}대 설치 프로그램 목록 분석 중…</div>}
          {error && <div className="px-3 py-2 bg-red-50 rounded-lg text-sm text-red-600">{error}</div>}

          {result && (
            <>
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-gray-800">{result.checked}</div>
                  <div className="text-xs text-gray-500 mt-0.5">검사 완료 PC</div>
                </div>
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-red-600">{result.unknownAggregate.length}</div>
                  <div className="text-xs text-red-500 mt-0.5">미확인 SW 종류</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-gray-800">{result.failed.length}</div>
                  <div className="text-xs text-gray-500 mt-0.5">분석 실패</div>
                </div>
              </div>

              {result.failed.length > 0 && (
                <details className="mb-4 text-xs text-gray-500">
                  <summary className="cursor-pointer hover:text-gray-700">분석 실패 {result.failed.length}건 보기</summary>
                  <ul className="mt-2 space-y-1 pl-4">
                    {result.failed.map(f => <li key={f.recordId}>{f.pcName}: {f.error}</li>)}
                  </ul>
                </details>
              )}

              {result.unknownAggregate.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">미확인 SW가 없습니다 — 전부 관리 목록에 있습니다.</div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-600">미확인 SW 목록 (발견 PC수 순)</p>
                    <p className="text-xs text-gray-400">{selected.size}개 선택됨</p>
                  </div>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="w-8 px-3 py-2"></th>
                          <th className="text-left px-3 py-2 font-semibold text-gray-500">SW명</th>
                          <th className="text-left px-3 py-2 font-semibold text-gray-500">게시자</th>
                          <th className="text-right px-3 py-2 font-semibold text-gray-500">발견 PC수</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.unknownAggregate.map(u => (
                          <tr key={u.name} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="px-3 py-2">
                              <input type="checkbox" checked={selected.has(u.name)} onChange={() => toggle(u.name)} />
                            </td>
                            <td className="px-3 py-2 text-gray-800">{u.name}</td>
                            <td className="px-3 py-2 text-gray-500">{u.publisher || "—"}</td>
                            <td className="px-3 py-2 text-right text-gray-600" title={u.pcNames.join(", ")}>{u.count}대</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {registeredCount !== null && (
                <p className="mt-3 text-xs text-green-600">{registeredCount}건이 블랙리스트에 등록되었습니다.</p>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">닫기</button>
          {result && result.unknownAggregate.length > 0 && (
            <button onClick={handleBlacklist} disabled={selected.size === 0 || registering}
              className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-40 transition-colors">
              {registering ? "등록 중…" : `선택 ${selected.size}건 블랙리스트 등록`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 패널 본체 ──────────────────────────────────────────────────
export default function PcScanPanel() {
  const [records, setRecords]   = useState<PcScanRecordWithMatch[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [filters, setFilters]   = useState<Filters>(EMPTY);
  const [detail, setDetail]     = useState<PcScanRecordWithMatch | null>(null);
  const [register, setRegister] = useState<PcScanRecordWithMatch | null>(null);
  const [syncTarget, setSyncTarget] = useState<PcScanRecordWithMatch | null>(null);
  const [zipping, setZipping]   = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [syncing, setSyncing]   = useState(false);
  const [warming, setWarming]   = useState(false);
  const [filterOpen, setFilterOpen] = useState(true);
  const [makerOptions, setMakerOptions] = useState<string[]>([]);
  const [swAuditOpen, setSwAuditOpen] = useState(false);

  useEffect(() => {
    // 신규 등록 모달의 "제조사" 목록 — 마스터 DB에 이미 쓰이고 있는 제조사 표기를 그대로 재사용
    fetch("/api/hw/stats")
      .then(r => safeJson(r))
      .then(res => {
        const byMaker = res?.ok ? res.stats?.byMaker : null;
        if (byMaker) setMakerOptions(Object.keys(byMaker).filter(m => m !== "기타").sort());
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/admin/pc-scan")
      .then(r => safeJson(r))
      .then(res => {
        if (res?.ok) {
          setRecords(res.data ?? []);
          setWarming(!!res.masterCacheWarming);
        } else {
          setError(res?.error ?? "불러오기 실패");
        }
      })
      .catch(() => setError("네트워크 오류"))
      .finally(() => setLoading(false));
  }, []);

  const corpOptions = useMemo(
    () => [...new Set(records.map(r => r.corp).filter(Boolean))].sort(),
    [records]
  );

  const originalCorpOptions = useMemo(
    () => [...new Set(records.map(r => r.originalCorp).filter(Boolean))].sort(),
    [records]
  );

  function handleRegistered(id: string) {
    setRecords(prev => prev.map(r =>
      r.id === id
        ? { ...r, masterExists: true, mismatch: { corp: false, dept: false, userName: false }, serialOnlyMatch: null }
        : r
    ));
  }

  function handleSynced(id: string) {
    setRecords(prev => prev.map(r =>
      r.id === id && r.mismatch
        ? { ...r, mismatch: { corp: false, dept: false, userName: false } }
        : r
    ));
  }

  const filtered = useMemo(() => records.filter(r => {
    if (filters.assetNo    && !r.assetNo.toLowerCase().includes(filters.assetNo.toLowerCase()))     return false;
    if (filters.corp       && r.corp !== filters.corp)                                               return false;
    if (filters.isDualOrShared === "true"  && !r.isDualOrShared) return false;
    if (filters.isDualOrShared === "false" &&  r.isDualOrShared) return false;
    if (filters.originalCorp && r.originalCorp !== filters.originalCorp)                             return false;
    if (filters.dept       && !r.dept.toLowerCase().includes(filters.dept.toLowerCase()))           return false;
    if (filters.userName   && !r.userName.toLowerCase().includes(filters.userName.toLowerCase()))   return false;
    if (filters.email      && !r.email.toLowerCase().includes(filters.email.toLowerCase()))         return false;
    if (filters.pcName     && !r.pcName.toLowerCase().includes(filters.pcName.toLowerCase()))       return false;
    if (filters.cpu        && !r.cpu.toLowerCase().includes(filters.cpu.toLowerCase()))             return false;
    if (filters.ram        && !r.ram.toLowerCase().includes(filters.ram.toLowerCase()))             return false;
    if (filters.gpu        && !r.gpu.toLowerCase().includes(filters.gpu.toLowerCase()))             return false;
    if (filters.os         && !r.os.toLowerCase().includes(filters.os.toLowerCase()))               return false;
    if (filters.hasFile === "yes" && !r.programFileUrl)  return false;
    if (filters.hasFile === "no"  &&  r.programFileUrl)  return false;
    if (filters.masterStatus === "match"      && !(r.masterExists && !hasMismatch(r)))          return false;
    if (filters.masterStatus === "mismatch"   && !(r.masterExists && hasMismatch(r)))            return false;
    if (filters.masterStatus === "serialOnly" && !(!r.masterExists && r.serialOnlyMatch))        return false;
    if (filters.masterStatus === "none"       && !(!r.masterExists && !r.serialOnlyMatch))       return false;
    return true;
  }), [records, filters]);

  function sf(key: keyof Filters, val: string) {
    setFilters(f => ({ ...f, [key]: val }));
  }

  function downloadExcel() {
    const wb = XLSX.utils.book_new();
    const rows = filtered.map(r => ({
      자산번호:        r.assetNo,
      법인:            r.corp,
      "겸직/쉐어드":   r.isDualOrShared ? "예" : "",
      원소속법인:      r.originalCorp,
      부서:            r.dept,
      사용자:          r.userName,
      이메일:          r.email,
      모델:            r.model,
      PC이름:          r.pcName,
      CPU:             r.cpu,
      RAM:             r.ram,
      GPU:             r.gpu,
      OS:              r.os,
      시리얼넘버:      r.serial,
      제조사:          r.manufacturer,
      저장장치:        r.storage,
      MAC:             r.mac,
      수집일시:        r.collectedAt ? formatDate(r.collectedAt) : "",
      마스터존재:      r.masterExists ? "✓" : "",
      설치프로그램파일: r.programFileName,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "자산실사현황");
    XLSX.writeFile(wb, `자산실사현황_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const downloadZip = useCallback(async () => {
    const ids = filtered.filter(r => r.programFileUrl).map(r => r.id);
    if (ids.length === 0) return;
    setZipping(true);
    try {
      const res = await fetch("/api/admin/pc-scan/zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "ZIP 생성 실패");
        return;
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `설치프로그램_${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("다운로드 중 오류가 발생했습니다.");
    } finally {
      setZipping(false);
    }
  }, [filtered]);

  const syncableFiltered = useMemo(() => filtered.filter(hasMismatch), [filtered]);

  function toggleSelect(id: string) {
    setSelected(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected(s => {
      const allSelected = syncableFiltered.length > 0 && syncableFiltered.every(r => s.has(r.id));
      if (allSelected) return new Set();
      return new Set(syncableFiltered.map(r => r.id));
    });
  }

  const syncSelected = useCallback(async () => {
    const targets = records.filter(r => selected.has(r.id) && r.masterId && r.mismatch);
    if (targets.length === 0) return;
    setSyncing(true);
    try {
      const results = await Promise.allSettled(targets.map(r => {
        const fields: Record<string, string | boolean> = {};
        if (r.mismatch!.corp)     fields.company = r.corp;
        if (r.mismatch!.dept)     fields.dept    = r.dept;
        if (r.mismatch!.userName) fields.user    = r.userName;
        fields.status   = "사용중";
        fields.verified = true;
        return fetch("/api/hw/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: r.masterId, fields }),
        }).then(res => res.json());
      }));

      const succeededIds = new Set<string>();
      let failCount = 0;
      results.forEach((result, i) => {
        if (result.status === "fulfilled" && result.value?.ok) {
          succeededIds.add(targets[i].id);
        } else {
          failCount++;
        }
      });

      setRecords(prev => prev.map(r =>
        succeededIds.has(r.id)
          ? { ...r, mismatch: { corp: false, dept: false, userName: false } }
          : r
      ));
      setSelected(s => {
        const next = new Set(s);
        succeededIds.forEach(id => next.delete(id));
        return next;
      });

      if (failCount > 0) alert(`${failCount}건 동기화 실패`);
    } catch {
      alert("동기화 중 오류가 발생했습니다.");
    } finally {
      setSyncing(false);
    }
  }, [records, selected]);

  const hasFilter = Object.values(filters).some(Boolean);
  const swAuditFiles = useMemo(
    () => filtered.filter(r => r.programFileUrl).map(r => ({ recordId: r.id, pcName: r.pcName, fileUrl: r.programFileUrl })),
    [filtered]
  );

  return (
    <div className="fade-in">
      {detail && <DetailModal record={detail} onClose={() => setDetail(null)} />}
      {register && (
        <RegisterMasterModal
          record={register}
          makerOptions={makerOptions}
          onClose={() => setRegister(null)}
          onRegistered={handleRegistered}
        />
      )}
      {syncTarget && (
        <SyncConfirmModal
          record={syncTarget}
          onClose={() => setSyncTarget(null)}
          onSynced={handleSynced}
        />
      )}
      {swAuditOpen && (
        <SwAuditModal files={swAuditFiles.slice(0, 50)} onClose={() => setSwAuditOpen(false)} />
      )}

      {/* 헤더 */}
      <div className="mb-4 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">자산 실사 현황</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="전체"         value={records.length}                              color="var(--state-neutral)" />
            <StatCard label="필터 표시"    value={filtered.length}                              color="var(--state-progress)" />
            <StatCard label="마스터 일치"  value={filtered.length - syncableFiltered.length}    color="var(--state-positive)" />
            <StatCard label="마스터 불일치" value={syncableFiltered.length}                     color="var(--state-risk)" />
          </div>
          {warming && (
            <p className="text-xs text-amber-600 mt-1">마스터 데이터 캐시를 갱신하고 있습니다. 잠시 후 새로고침 해주세요.</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterOpen(v => !v)}
            className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg flex items-center gap-1"
          >
            <span style={{ display: "inline-block", transition: "transform .15s ease", transform: filterOpen ? "rotate(90deg)" : "rotate(0deg)" }}>▸</span>
            필터
          </button>
          {selected.size > 0 && (
            <button
              onClick={syncSelected}
              disabled={syncing}
              className="px-4 py-1.5 text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-40"
            >
              {syncing ? "동기화 중…" : `선택 동기화 (${selected.size})`}
            </button>
          )}
          {hasFilter && (
            <button
              onClick={() => setFilters(EMPTY)}
              className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg"
            >
              필터 초기화
            </button>
          )}
          <button
            onClick={() => setSwAuditOpen(true)}
            disabled={swAuditFiles.length === 0}
            title={swAuditFiles.length > 50 ? "50건 초과 시 앞 50건만 검사됩니다. 필터로 범위를 좁혀보세요." : undefined}
            className="px-4 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-40"
          >
            설치 SW 일괄 검사 ({swAuditFiles.length})
          </button>
          <button
            onClick={downloadExcel}
            disabled={filtered.length === 0}
            className="px-4 py-1.5 text-xs font-medium bg-gray-700 hover:bg-gray-800 text-white rounded-lg disabled:opacity-40"
          >
            엑셀 다운로드 ({filtered.length}건)
          </button>
          <button
            onClick={downloadZip}
            disabled={filtered.filter(r => r.programFileUrl).length === 0 || zipping}
            className="px-4 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-40"
          >
            {zipping
              ? "ZIP 생성 중…"
              : `설치프로그램 ZIP (${filtered.filter(r => r.programFileUrl).length}건)`}
          </button>
        </div>
      </div>

      {/* 테이블 */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">불러오는 중…</div>
      ) : error ? (
        <div className="text-center py-12 text-red-400 text-sm">{error}</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-xs border-collapse min-w-[1500px]">
            <thead>
              {/* 컬럼 헤더 */}
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-500">
                <th className="text-center px-3 py-2.5 font-semibold whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={syncableFiltered.length > 0 && syncableFiltered.every(r => selected.has(r.id))}
                    onChange={toggleSelectAll}
                  />
                </th>
                {["자산번호","법인","겸직/쉐어드","원소속법인","부서","사용자","이메일","PC이름","CPU","RAM","GPU","OS","설치프로그램","마스터"].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>

              {/* 필터 행 */}
              {filterOpen && <tr className="border-b border-gray-200 bg-gray-50/60">
                <td className="px-2 py-1.5" />
                <td className="px-2 py-1.5 min-w-[90px]">
                  <input className={INPUT_CLS} placeholder="검색" value={filters.assetNo} onChange={e => sf("assetNo", e.target.value)} />
                </td>
                <td className="px-2 py-1.5 min-w-[90px]">
                  <select className={INPUT_CLS} value={filters.corp} onChange={e => sf("corp", e.target.value)}>
                    <option value="">전체</option>
                    {corpOptions.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1.5 min-w-[80px]">
                  <select className={INPUT_CLS} value={filters.isDualOrShared} onChange={e => sf("isDualOrShared", e.target.value)}>
                    <option value="">전체</option>
                    <option value="true">예</option>
                    <option value="false">아니오</option>
                  </select>
                </td>
                <td className="px-2 py-1.5 min-w-[90px]">
                  <select className={INPUT_CLS} value={filters.originalCorp} onChange={e => sf("originalCorp", e.target.value)}>
                    <option value="">전체</option>
                    {originalCorpOptions.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1.5 min-w-[80px]">
                  <input className={INPUT_CLS} placeholder="검색" value={filters.dept} onChange={e => sf("dept", e.target.value)} />
                </td>
                <td className="px-2 py-1.5 min-w-[80px]">
                  <input className={INPUT_CLS} placeholder="검색" value={filters.userName} onChange={e => sf("userName", e.target.value)} />
                </td>
                <td className="px-2 py-1.5 min-w-[130px]">
                  <input className={INPUT_CLS} placeholder="검색" value={filters.email} onChange={e => sf("email", e.target.value)} />
                </td>
                <td className="px-2 py-1.5 min-w-[100px]">
                  <input className={INPUT_CLS} placeholder="검색" value={filters.pcName} onChange={e => sf("pcName", e.target.value)} />
                </td>
                <td className="px-2 py-1.5 min-w-[80px]">
                  <input className={INPUT_CLS} placeholder="검색" value={filters.cpu} onChange={e => sf("cpu", e.target.value)} />
                </td>
                <td className="px-2 py-1.5 min-w-[70px]">
                  <input className={INPUT_CLS} placeholder="검색" value={filters.ram} onChange={e => sf("ram", e.target.value)} />
                </td>
                <td className="px-2 py-1.5 min-w-[80px]">
                  <input className={INPUT_CLS} placeholder="검색" value={filters.gpu} onChange={e => sf("gpu", e.target.value)} />
                </td>
                <td className="px-2 py-1.5 min-w-[80px]">
                  <input className={INPUT_CLS} placeholder="검색" value={filters.os} onChange={e => sf("os", e.target.value)} />
                </td>
                <td className="px-2 py-1.5 min-w-[90px]">
                  <select className={INPUT_CLS} value={filters.hasFile} onChange={e => sf("hasFile", e.target.value)}>
                    <option value="">전체</option>
                    <option value="yes">있음</option>
                    <option value="no">없음</option>
                  </select>
                </td>
                <td className="px-2 py-1.5 min-w-[80px]">
                  <select className={INPUT_CLS} value={filters.masterStatus} onChange={e => sf("masterStatus", e.target.value)}>
                    <option value="">전체</option>
                    <option value="match">✓ 일치</option>
                    <option value="mismatch">⚠ 불일치</option>
                    <option value="serialOnly">? 시리얼만 일치</option>
                    <option value="none">— 미매칭</option>
                  </select>
                </td>
              </tr>}
            </thead>

            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={15} className="text-center py-12 text-gray-400">
                    {hasFilter ? "필터에 맞는 결과가 없습니다." : "수집된 데이터가 없습니다."}
                  </td>
                </tr>
              ) : filtered.map(r => (
                <tr key={r.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2.5 text-center">
                    {hasMismatch(r) ? (
                      <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} />
                    ) : (
                      <span className="text-gray-200">—</span>
                    )}
                  </td>
                  {/* 자산번호 — 클릭 시 상세 팝업 */}
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => setDetail(r)}
                      className="font-semibold text-blue-600 hover:underline text-left"
                    >
                      {r.assetNo || <span className="text-gray-300 font-normal">—</span>}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {r.corp
                      ? <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">{r.corp}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {r.isDualOrShared
                      ? <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">겸직/쉐어드</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {r.originalCorp
                      ? <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">{r.originalCorp}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{r.dept || <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{r.userName || <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2.5 text-gray-600 max-w-[160px] truncate" title={r.email}>{r.email || <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{r.pcName || <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2.5 text-gray-500 max-w-[160px] truncate" title={r.cpu}>{r.cpu || <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{r.ram || <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2.5 text-gray-500 max-w-[120px] truncate" title={r.gpu}>{r.gpu || <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2.5 text-gray-500 max-w-[140px] truncate" title={r.os}>{r.os || <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2.5">
                    {r.programFileUrl ? (
                      <a
                        href={r.programFileUrl}
                        download={r.programFileName || undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline whitespace-nowrap"
                        title={r.programFileName}
                      >
                        {r.programFileName ? r.programFileName.replace(/\.[^.]+$/, "") : "다운로드"}
                      </a>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {!r.masterExists ? (
                      r.serialOnlyMatch ? (
                        <button
                          onClick={() => setSyncTarget(r)}
                          className="text-sky-600 font-bold text-sm hover:text-sky-700"
                          title={`시리얼은 일치하지만 자산번호가 다름 — 마스터 자산번호: ${r.serialOnlyMatch.masterAssetNo || "(없음)"} (자산번호 오기입 의심, 클릭 시 동기화)`}
                        >
                          ?
                        </button>
                      ) : (
                        <button
                          onClick={() => setRegister(r)}
                          className="text-[10px] font-medium text-emerald-600 hover:text-emerald-700 hover:underline whitespace-nowrap"
                        >
                          신규 등록
                        </button>
                      )
                    ) : hasMismatch(r) ? (
                      <button
                        onClick={() => setSyncTarget(r)}
                        className="text-amber-600 font-bold text-sm hover:text-amber-700"
                        title={`불일치: ${[
                          r.mismatch!.corp && "법인",
                          r.mismatch!.dept && "부서",
                          r.mismatch!.userName && "사용자",
                        ].filter(Boolean).join(", ")} (클릭 시 동기화)`}
                      >
                        ⚠
                      </button>
                    ) : (
                      <span className="text-emerald-600 font-bold text-sm">✓</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
