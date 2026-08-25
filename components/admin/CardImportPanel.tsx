"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { safeJson } from "@/lib/fetch-json";
import { STANDARD_FIELDS, type ImportProfile, type CardRow, type BatchMeta, type StandardFieldKey } from "@/lib/card-import";
import type { ReconcileItem, ReconcileSummary, MatchStatus } from "@/lib/card-reconcile";

const fmt = (n: number) => n.toLocaleString("ko-KR");

// 엑셀 날짜(serial 또는 문자열) → YYYY-MM-DD
function toIsoDate(val: unknown): string {
  if (val === null || val === undefined || val === "") return "";
  if (typeof val === "number") {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  }
  const s = String(val).trim();
  const m = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return "";
}

// "1,234,000원", "(1,234)", "-1234" 등 → 숫자
function toAmount(val: unknown): number {
  if (typeof val === "number") return Math.round(val);
  const s = String(val ?? "").trim();
  if (!s) return 0;
  const negative = /^\(.*\)$/.test(s) || s.startsWith("-");
  const digits = s.replace(/[^0-9.]/g, "");
  const n = parseFloat(digits);
  if (!isFinite(n)) return 0;
  return Math.round(negative ? -n : n);
}

type Step = "select" | "mapping" | "preview";

export default function CardImportPanel() {
  const fileRef = useRef<HTMLInputElement>(null);

  const [profiles, setProfiles] = useState<ImportProfile[]>([]);
  const [batches,  setBatches]  = useState<BatchMeta[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [notice,   setNotice]   = useState("");

  // 업로드 진행 상태
  const [step,     setStep]     = useState<Step>("select");
  const [company,  setCompany]  = useState("");
  const [source,   setSource]   = useState("");
  const [fileName, setFileName] = useState("");
  const [sheet,    setSheet]    = useState<unknown[][]>([]);   // 원본 시트(행×열)
  const [headerRow, setHeaderRow] = useState(1);               // 1-based
  const [mapping,  setMapping]  = useState<Partial<Record<StandardFieldKey, number>>>({});
  const [saving,   setSaving]   = useState(false);

  // 상세 보기
  const [openBatch,     setOpenBatch]     = useState<BatchMeta | null>(null);
  const [openBatchRows, setOpenBatchRows] = useState<CardRow[] | null>(null);

  // 대사(카드명세 ↔ 등록 구독)
  const [reconBatch,   setReconBatch]   = useState<BatchMeta | null>(null);
  const [reconItems,   setReconItems]   = useState<ReconcileItem[] | null>(null);
  const [reconSummary, setReconSummary] = useState<ReconcileSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [pRes, bRes] = await Promise.all([
        fetch("/api/card-import/profiles").then(r => safeJson(r)),
        fetch("/api/card-import/batches").then(r => safeJson(r)),
      ]);
      if (!pRes.ok) throw new Error(pRes.error ?? "매핑 목록 조회 실패");
      if (!bRes.ok) throw new Error(bRes.error ?? "업로드 이력 조회 실패");
      setProfiles(pRes.profiles ?? []);
      setBatches(bRes.batches ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const companyOptions = useMemo(
    () => [...new Set(profiles.map(p => p.company))].sort((a, b) => a.localeCompare(b, "ko")),
    [profiles],
  );
  const sourceOptions = useMemo(
    () => [...new Set(profiles.map(p => p.source))].sort((a, b) => a.localeCompare(b, "ko")),
    [profiles],
  );

  function resetUpload() {
    setStep("select"); setFileName(""); setSheet([]); setHeaderRow(1); setMapping({});
    if (fileRef.current) fileRef.current.value = "";
  }

  // ── 파일 선택 → 시트 파싱 → 기존 매핑 있으면 바로 미리보기 ────────────────
  async function handleFile(file: File) {
    setError(""); setNotice("");
    if (!company.trim() || !source.trim()) {
      setError("법인과 소스명을 먼저 입력해주세요.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    try {
      const buf = await file.arrayBuffer();
      const wb  = XLSX.read(buf, { type: "array" });
      const ws  = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" }) as unknown[][];
      if (raw.length < 2) throw new Error("데이터 행이 없습니다 (헤더 + 최소 1행 필요)");

      setSheet(raw);
      setFileName(file.name);

      const existing = profiles.find(p => p.company === company.trim() && p.source === source.trim());
      if (existing) {
        // 저장된 매핑이 있으면 설정 화면을 건너뛰고 바로 미리보기로
        setHeaderRow(existing.headerRow);
        setMapping(existing.mapping);
        setStep("preview");
        setNotice(`저장된 매핑을 적용했습니다 (${existing.updatedAt.slice(0, 10)} 설정).`);
      } else {
        setHeaderRow(1);
        setMapping({});
        setStep("mapping");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const headers: string[] = useMemo(() => {
    const row = sheet[headerRow - 1];
    return Array.isArray(row) ? row.map(h => String(h ?? "").trim()) : [];
  }, [sheet, headerRow]);

  // ── 표준 데이터로 변환 (미리보기/저장 공용) ───────────────────────────────
  const converted: CardRow[] = useMemo(() => {
    if (step !== "preview" || sheet.length === 0) return [];
    const body = sheet.slice(headerRow); // 헤더 다음 행부터
    const pick = (r: unknown[], key: StandardFieldKey) => {
      const idx = mapping[key];
      return idx === undefined ? "" : r[idx];
    };
    const rows = body
      .filter(r => Array.isArray(r) && r.some(c => String(c ?? "").trim() !== ""))
      .map(r => ({
        company:    String(pick(r, "company") ?? "").trim() || company.trim(),
        department: String(pick(r, "department") ?? "").trim(),
        cardLast4:  String(pick(r, "cardLast4") ?? "").trim().slice(-4),
        paidAt:     toIsoDate(pick(r, "paidAt")),
        amount:     toAmount(pick(r, "amount")),
        note:       String(pick(r, "note") ?? "").trim(),
      }));

    // 검증 경고 — 서버 annotateWarnings와 동일 규칙(저장 시 서버에서 재계산됨)
    const seen = new Map<string, number>();
    for (const r of rows) {
      const k = `${r.company}|${r.cardLast4}|${r.paidAt}|${r.amount}`;
      seen.set(k, (seen.get(k) ?? 0) + 1);
    }
    return rows.map(r => {
      const warnings: string[] = [];
      if (!r.amount) warnings.push("금액 없음/0원");
      if (!r.paidAt) warnings.push("결제일 없음");
      if (!r.company) warnings.push("법인 없음");
      if ((seen.get(`${r.company}|${r.cardLast4}|${r.paidAt}|${r.amount}`) ?? 0) > 1) warnings.push("중복 의심");
      return { ...r, warnings };
    });
  }, [step, sheet, headerRow, mapping, company]);

  const warnCount = converted.filter(r => r.warnings.length > 0).length;
  const totalAmount = converted.reduce((s, r) => s + r.amount, 0);
  const mappingValid = mapping.company !== undefined && mapping.paidAt !== undefined && mapping.amount !== undefined;

  // ── 매핑 저장 후 미리보기로 ───────────────────────────────────────────────
  async function saveMappingAndPreview() {
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/card-import/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: company.trim(), source: source.trim(), headerRow, mapping }),
      });
      const json = await safeJson(res);
      if (!json.ok) throw new Error(json.error ?? "매핑 저장 실패");
      setProfiles(prev => [json.profile, ...prev.filter(p => p.id !== json.profile.id)]);
      setStep("preview");
      setNotice("매핑을 저장했습니다. 같은 법인·소스로 다음에 업로드하면 이 단계를 건너뜁니다.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  // ── 최종 저장 ─────────────────────────────────────────────────────────────
  async function confirmSave() {
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/card-import/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: company.trim(), source: source.trim(), fileName,
          rows: converted.map(({ warnings, ...r }) => r), // eslint-disable-line @typescript-eslint/no-unused-vars
        }),
      });
      const json = await safeJson(res);
      if (!json.ok) throw new Error(json.error ?? "저장 실패");
      setBatches(prev => [json.batch, ...prev]);
      setNotice(`${converted.length}건을 저장했습니다.`);
      resetUpload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function removeProfile(p: ImportProfile) {
    if (!window.confirm(`"${p.company} · ${p.source}" 매핑을 초기화하시겠습니까?\n다음 업로드 시 매핑을 다시 설정하게 됩니다.`)) return;
    try {
      const res = await fetch(`/api/card-import/profiles?id=${encodeURIComponent(p.id)}`, { method: "DELETE" });
      const json = await safeJson(res);
      if (!json.ok) throw new Error(json.error ?? "삭제 실패");
      setProfiles(prev => prev.filter(x => x.id !== p.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function removeBatch(b: BatchMeta) {
    if (!window.confirm(`${b.company} · ${b.source} (${b.rowCount}건) 업로드 건을 삭제하시겠습니까?`)) return;
    try {
      const res = await fetch(`/api/card-import/batches?id=${encodeURIComponent(b.id)}`, { method: "DELETE" });
      const json = await safeJson(res);
      if (!json.ok) throw new Error(json.error ?? "삭제 실패");
      setBatches(prev => prev.filter(x => x.id !== b.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function openReconcile(b: BatchMeta) {
    setReconBatch(b); setReconItems(null); setReconSummary(null); setError("");
    try {
      const json = await fetch(`/api/card-import/reconcile?batchId=${encodeURIComponent(b.id)}`).then(r => safeJson(r));
      if (!json.ok) throw new Error(json.error ?? "대사 실패");
      setReconItems(json.items ?? []);
      setReconSummary(json.summary ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setReconBatch(null);
    }
  }

  async function openBatchDetail(b: BatchMeta) {
    setOpenBatch(b); setOpenBatchRows(null);
    try {
      const res = await fetch(`/api/card-import/batches?id=${encodeURIComponent(b.id)}`);
      const json = await safeJson(res);
      if (!json.ok) throw new Error(json.error ?? "조회 실패");
      setOpenBatchRows(json.rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setOpenBatch(null);
    }
  }

  const inputCls = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400";

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div>
        <h2 className="text-base font-bold text-gray-900">카드명세 업로드</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          계열사·소스별 엑셀 양식이 달라도, 컬럼 매핑을 한 번만 설정하면 다음부터는 자동으로 표준 형식으로 변환됩니다.
        </p>
      </div>

      {error  && <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}
      {notice && <div className="px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">{notice}</div>}

      {/* ── 업로드 영역 ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        {/* 1단계: 법인/소스 + 파일 */}
        <div className="flex items-center gap-2 mb-4">
          <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[11px] font-bold flex items-center justify-center">1</span>
          <span className="text-sm font-semibold text-gray-800">법인·소스 선택 후 파일 업로드</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">법인 *</label>
            <input list="ci-companies" className={inputCls} value={company} disabled={step !== "select"}
              onChange={e => setCompany(e.target.value)} placeholder="예: IdsTrust" />
            <datalist id="ci-companies">{companyOptions.map(c => <option key={c} value={c} />)}</datalist>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">소스명 *</label>
            <input list="ci-sources" className={inputCls} value={source} disabled={step !== "select"}
              onChange={e => setSource(e.target.value)} placeholder="예: 신한카드, 더존 회계" />
            <datalist id="ci-sources">{sourceOptions.map(s => <option key={s} value={s} />)}</datalist>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">엑셀 / CSV 파일</label>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" disabled={step !== "select"}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              className="w-full text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100 disabled:opacity-50" />
          </div>
        </div>

        {step !== "select" && (
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-gray-500">
              <b className="text-gray-800">{fileName}</b> · {company} · {source} · 총 {sheet.length}행
            </span>
            <button onClick={resetUpload} className="text-gray-400 hover:text-gray-600 font-semibold">다시 선택</button>
          </div>
        )}

        {/* 2단계: 컬럼 매핑 */}
        {step === "mapping" && (
          <div className="mt-5 pt-5 border-t border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[11px] font-bold flex items-center justify-center">2</span>
              <span className="text-sm font-semibold text-gray-800">컬럼 매핑 설정</span>
            </div>
            <p className="text-xs text-gray-400 mb-4 ml-7">
              이 법인·소스 조합은 처음 업로드입니다. 각 표준 항목이 파일의 어느 컬럼인지 지정해주세요. (한 번만 설정하면 됩니다)
            </p>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-500 mb-1">헤더 행 번호</label>
              <input type="number" min={1} max={Math.max(1, sheet.length)} value={headerRow}
                onChange={e => setHeaderRow(Math.max(1, Math.min(sheet.length, Number(e.target.value) || 1)))}
                className={`${inputCls} w-32`} />
              <p className="text-[11px] text-gray-400 mt-1">보통 1행입니다. 파일 위쪽에 제목/안내가 있으면 실제 컬럼명이 있는 행 번호로 바꿔주세요.</p>
            </div>

            {/* 헤더 미리보기 */}
            <div className="mb-4 overflow-x-auto">
              <div className="text-[11px] font-semibold text-gray-400 mb-1">감지된 컬럼 ({headers.length}개)</div>
              <div className="flex gap-1.5 flex-wrap">
                {headers.map((h, i) => (
                  <span key={i} className="px-2 py-1 bg-gray-100 rounded text-[11px] text-gray-600 whitespace-nowrap">
                    <span className="text-gray-400 mr-1">{i}</span>{h || <i className="text-gray-300">(빈 컬럼)</i>}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {STANDARD_FIELDS.map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  <select className={inputCls}
                    value={mapping[f.key] ?? ""}
                    onChange={e => setMapping(m => {
                      const v = e.target.value;
                      const next = { ...m };
                      if (v === "") delete next[f.key]; else next[f.key] = Number(v);
                      return next;
                    })}>
                    <option value="">— 사용 안 함 —</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>{i}: {h || "(빈 컬럼)"}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button onClick={saveMappingAndPreview} disabled={!mappingValid || saving}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors">
                {saving ? "저장 중…" : "매핑 저장하고 미리보기"}
              </button>
              {!mappingValid && <span className="text-xs text-gray-400">법인·결제일·금액은 필수 매핑입니다.</span>}
            </div>
          </div>
        )}

        {/* 3단계: 미리보기 */}
        {step === "preview" && (
          <div className="mt-5 pt-5 border-t border-gray-100">
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[11px] font-bold flex items-center justify-center">3</span>
                <span className="text-sm font-semibold text-gray-800">변환 결과 미리보기</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-gray-500">{converted.length}건 · 합계 <b className="text-gray-800">₩{fmt(totalAmount)}</b></span>
                {warnCount > 0 && <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-semibold">확인 필요 {warnCount}건</span>}
                <button onClick={() => setStep("mapping")} className="text-gray-400 hover:text-gray-600 font-semibold">매핑 수정</button>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="max-h-80 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr className="text-gray-400 border-b border-gray-200">
                      {STANDARD_FIELDS.map(f => (
                        <th key={f.key} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{f.label}</th>
                      ))}
                      <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">확인</th>
                    </tr>
                  </thead>
                  <tbody>
                    {converted.slice(0, 200).map((r, i) => (
                      <tr key={i} className={`border-b border-gray-100 last:border-0 ${r.warnings.length ? "bg-orange-50/60" : ""}`}>
                        <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">{r.company || "—"}</td>
                        <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">{r.department || "—"}</td>
                        <td className="px-3 py-1.5 text-gray-600 font-mono">{r.cardLast4 || "—"}</td>
                        <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">{r.paidAt || "—"}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-gray-800">{r.amount ? fmt(r.amount) : "—"}</td>
                        <td className="px-3 py-1.5 text-gray-500 max-w-[200px] truncate">{r.note || "—"}</td>
                        <td className="px-3 py-1.5">
                          {r.warnings.length > 0
                            ? <span className="text-[10px] text-orange-700 font-semibold">{r.warnings.join(", ")}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {converted.length > 200 && (
                <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 text-[11px] text-gray-400">
                  미리보기는 상위 200건만 표시됩니다. 저장 시에는 {converted.length}건 전체가 저장됩니다.
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button onClick={confirmSave} disabled={saving || converted.length === 0}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors">
                {saving ? "저장 중…" : `${converted.length}건 저장`}
              </button>
              <button onClick={resetUpload} className="px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
                취소
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 저장된 매핑 ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-800">저장된 컬럼 매핑</h3>
          <span className="text-xs text-gray-400">{profiles.length}개</span>
        </div>
        {loading ? (
          <p className="text-xs text-gray-400 py-4 text-center">불러오는 중…</p>
        ) : profiles.length === 0 ? (
          <p className="text-xs text-gray-400 py-4 text-center">아직 저장된 매핑이 없습니다. 첫 업로드 시 자동으로 만들어집니다.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {profiles.map(p => (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-gray-800">{p.company} · {p.source}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    헤더 {p.headerRow}행 · {Object.keys(p.mapping).length}개 컬럼 매핑 · {p.updatedAt.slice(0, 10)} {p.updatedBy}
                  </div>
                </div>
                <button onClick={() => removeProfile(p)}
                  className="px-2.5 py-1 text-[11px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors shrink-0">
                  매핑 초기화
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 업로드 이력 ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-800">업로드 이력</h3>
          <span className="text-xs text-gray-400">{batches.length}건</span>
        </div>
        {loading ? (
          <p className="text-xs text-gray-400 py-4 text-center">불러오는 중…</p>
        ) : batches.length === 0 ? (
          <p className="text-xs text-gray-400 py-4 text-center">업로드된 카드명세가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-gray-200">
                  <th className="px-3 py-2 text-left font-semibold">법인 · 소스</th>
                  <th className="px-3 py-2 text-left font-semibold">파일</th>
                  <th className="px-3 py-2 text-right font-semibold">건수</th>
                  <th className="px-3 py-2 text-right font-semibold">합계</th>
                  <th className="px-3 py-2 text-center font-semibold">확인필요</th>
                  <th className="px-3 py-2 text-left font-semibold">업로드</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {batches.map(b => (
                  <tr key={b.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-3 py-2 font-semibold text-gray-800 whitespace-nowrap">{b.company} · {b.source}</td>
                    <td className="px-3 py-2 text-gray-500 max-w-[180px] truncate">{b.fileName || "—"}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{fmt(b.rowCount)}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-800">₩{fmt(b.totalAmount)}</td>
                    <td className="px-3 py-2 text-center">
                      {b.warningCount > 0
                        ? <span className="px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-semibold text-[10px]">{b.warningCount}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{b.uploadedAt.slice(0, 10)} {b.uploadedBy}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button onClick={() => openReconcile(b)} className="text-[11px] font-semibold text-blue-600 hover:underline mr-2">대사</button>
                      <button onClick={() => openBatchDetail(b)} className="text-[11px] font-semibold text-amber-700 hover:underline mr-2">상세</button>
                      <button onClick={() => removeBatch(b)} className="text-[11px] font-semibold text-red-500 hover:underline">삭제</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 대사 결과 모달 ── */}
      {reconBatch && (
        <ReconcileModal
          batch={reconBatch} items={reconItems} summary={reconSummary}
          onClose={() => { setReconBatch(null); setReconItems(null); setReconSummary(null); }}
        />
      )}

      {/* ── 배치 상세 모달 ── */}
      {openBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => { setOpenBatch(null); setOpenBatchRows(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 bg-gray-800 text-white flex items-start justify-between shrink-0">
              <div>
                <div className="font-bold text-sm">{openBatch.company} · {openBatch.source}</div>
                <div className="text-xs text-white/70 mt-0.5">
                  {openBatch.fileName} · {fmt(openBatch.rowCount)}건 · ₩{fmt(openBatch.totalAmount)}
                </div>
              </div>
              <button onClick={() => { setOpenBatch(null); setOpenBatchRows(null); }}
                className="text-white/80 hover:text-white text-xl leading-none">✕</button>
            </div>
            <div className="overflow-auto flex-1">
              {openBatchRows === null ? (
                <p className="text-xs text-gray-400 py-10 text-center">불러오는 중…</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr className="text-gray-400 border-b border-gray-200">
                      {STANDARD_FIELDS.map(f => (
                        <th key={f.key} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{f.label}</th>
                      ))}
                      <th className="px-3 py-2 text-left font-semibold">확인</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openBatchRows.map((r, i) => (
                      <tr key={i} className={`border-b border-gray-100 last:border-0 ${r.warnings.length ? "bg-orange-50/60" : ""}`}>
                        <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">{r.company || "—"}</td>
                        <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">{r.department || "—"}</td>
                        <td className="px-3 py-1.5 text-gray-600 font-mono">{r.cardLast4 || "—"}</td>
                        <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">{r.paidAt || "—"}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-gray-800">{r.amount ? fmt(r.amount) : "—"}</td>
                        <td className="px-3 py-1.5 text-gray-500 max-w-[220px] truncate">{r.note || "—"}</td>
                        <td className="px-3 py-1.5">
                          {r.warnings.length > 0
                            ? <span className="text-[10px] text-orange-700 font-semibold">{r.warnings.join(", ")}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 대사 결과 모달 ──────────────────────────────────────────────────────────
const MATCH_STYLE: Record<MatchStatus, { label: string; chip: string; row: string }> = {
  "card-only": { label: "미등록 지출", chip: "bg-red-100 text-red-700",       row: "bg-red-50/60"    },
  "sub-only":  { label: "지출 없음",   chip: "bg-orange-100 text-orange-700", row: "bg-orange-50/50" },
  "probable":  { label: "추정 일치",   chip: "bg-yellow-100 text-yellow-700", row: "bg-yellow-50/50" },
  "matched":   { label: "일치",        chip: "bg-emerald-100 text-emerald-700", row: "" },
};

function ReconcileModal({ batch, items, summary, onClose }: {
  batch: BatchMeta;
  items: ReconcileItem[] | null;
  summary: ReconcileSummary | null;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState<MatchStatus | "all">("all");
  const shown = items?.filter(i => filter === "all" || i.status === filter) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[88vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 bg-gray-800 text-white flex items-start justify-between shrink-0">
          <div>
            <div className="font-bold text-sm">카드명세 대사 — {batch.company} · {batch.source}</div>
            <div className="text-xs text-white/70 mt-0.5">
              카드 지출과 포털에 등록된 구독을 맞춰봅니다. 금액 ±10% 이내를 같은 건으로 봅니다.
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-xl leading-none">✕</button>
        </div>

        {summary && (
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 shrink-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div>
                <div className="text-[10px] text-gray-400 font-semibold uppercase">카드 지출 합계</div>
                <div className="text-sm font-bold text-gray-800">₩{fmt(summary.cardTotal)}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400 font-semibold uppercase">등록 구독 합계(월)</div>
                <div className="text-sm font-bold text-gray-800">₩{fmt(summary.subTotal)}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400 font-semibold uppercase">미등록 지출</div>
                <div className="text-sm font-bold text-red-600">₩{fmt(summary.cardOnlyAmount)}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400 font-semibold uppercase">지출 없는 구독</div>
                <div className="text-sm font-bold text-orange-600">₩{fmt(summary.subOnlyAmount)}</div>
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {([
                ["all", `전체 ${items?.length ?? 0}`],
                ["card-only", `미등록 지출 ${summary.cardOnlyCount}`],
                ["sub-only", `지출 없음 ${summary.subOnlyCount}`],
                ["probable", `추정 일치 ${summary.probableCount}`],
                ["matched", `일치 ${summary.matchedCount}`],
              ] as const).map(([key, label]) => (
                <button key={key} onClick={() => setFilter(key as MatchStatus | "all")}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                    filter === key ? "bg-gray-800 text-white" : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-100"
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-auto flex-1">
          {items === null ? (
            <p className="text-xs text-gray-400 py-12 text-center">대사 중…</p>
          ) : shown.length === 0 ? (
            <p className="text-xs text-gray-400 py-12 text-center">해당 항목이 없습니다.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50">
                <tr className="text-gray-400 border-b border-gray-200">
                  <th className="px-3 py-2 text-left font-semibold w-24">구분</th>
                  <th className="px-3 py-2 text-left font-semibold">부서</th>
                  <th className="px-3 py-2 text-left font-semibold">카드 지출</th>
                  <th className="px-3 py-2 text-left font-semibold">등록 구독</th>
                  <th className="px-3 py-2 text-right font-semibold w-24">차이</th>
                  <th className="px-3 py-2 text-left font-semibold">비고</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((it, i) => {
                  const st = MATCH_STYLE[it.status];
                  return (
                    <tr key={i} className={`border-b border-gray-100 last:border-0 ${st.row}`}>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${st.chip}`}>{st.label}</span>
                      </td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{it.department || "—"}</td>
                      <td className="px-3 py-2 text-gray-700">
                        {it.card
                          ? <>
                              <span className="font-mono font-semibold">₩{fmt(it.card.amount)}</span>
                              <span className="text-gray-400 ml-1.5">{it.card.paidAt}</span>
                              {it.card.cardLast4 && <span className="text-gray-400 ml-1">·{it.card.cardLast4}</span>}
                              {it.card.note && <div className="text-[10px] text-gray-400 truncate max-w-[180px]">{it.card.note}</div>}
                            </>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {it.sub
                          ? <>
                              <span className="font-semibold">{it.sub.swName}</span>
                              {it.sub.user && <span className="text-gray-400 ml-1.5">{it.sub.user}</span>}
                              <div className="text-[10px] text-gray-400 font-mono">월 ₩{fmt(it.sub.monthlyKrw)}</div>
                            </>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {it.diff !== undefined
                          ? <span className={it.diff === 0 ? "text-gray-400" : it.diff > 0 ? "text-red-600" : "text-blue-600"}>
                              {it.diff > 0 ? "+" : ""}{fmt(it.diff)}
                            </span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-[10px] text-gray-500">{it.reason}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 shrink-0">
          <p className="text-[11px] text-gray-400">
            * 카드명세에는 가맹점명만 찍히는 경우가 많아 SW명 자동 매칭은 하지 않습니다. 금액·부서 기준으로만
            분류하므로 <b>최종 판단은 담당자가 확인</b>해야 합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
