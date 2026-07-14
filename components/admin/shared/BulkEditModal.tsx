"use client";

import { useState } from "react";

export interface BulkFieldOption {
  key: string;
  label: string;
  type: "select" | "text";
  options?: string[];
}

export interface BulkApplyResult {
  success: number;
  failed: number;
  results?: { id: string; ok: boolean; error?: string }[];
}

interface BulkEditModalProps {
  count: number;
  fieldOptions: BulkFieldOption[];
  onClose: () => void;
  onApply: (fieldKey: string, value: string) => Promise<BulkApplyResult>;
}

type Step = "form" | "confirm" | "result";

export default function BulkEditModal({ count, fieldOptions, onClose, onApply }: BulkEditModalProps) {
  const [step,        setStep]        = useState<Step>("form");
  const [fieldKey,    setFieldKey]    = useState(fieldOptions[0]?.key ?? "");
  const [value,       setValue]       = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState("");
  const [result,      setResult]      = useState<BulkApplyResult | null>(null);
  const [showDetail,  setShowDetail]  = useState(false);

  const field = fieldOptions.find(f => f.key === fieldKey);
  const estSeconds = Math.ceil(count * 0.35);

  async function handleConfirm() {
    setSubmitting(true); setError("");
    try {
      const res = await onApply(fieldKey, value);
      setResult(res);
      setStep("result");
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={step === "result" ? undefined : onClose}>
      <div className="bg-white form-field-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 bg-gray-900 text-white flex items-center justify-between shrink-0">
          <div className="font-bold text-base">일괄 수정</div>
          {step !== "result" && <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">✕</button>}
        </div>

        <div className="px-6 py-5 space-y-4">
          {step === "form" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">수정할 필드</label>
                <select value={fieldKey} onChange={e => { setFieldKey(e.target.value); setValue(""); }}
                  className="w-full rounded-lg border border-gray-200 bg-white form-field-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                  {fieldOptions.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">새 값</label>
                {field?.type === "select" ? (
                  <select value={value} onChange={e => setValue(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white form-field-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                    <option value="">선택</option>
                    {(field.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input value={value} onChange={e => setValue(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white form-field-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                )}
              </div>
              {fieldKey === "company" && (
                <div className="px-3 py-2 bg-amber-50 rounded-lg text-xs text-amber-700">
                  법인명을 일괄 변경하면 대상 자산/라이선스의 소속 법인이 전부 바뀝니다. 신중히 확인해주세요.
                </div>
              )}
            </>
          )}

          {step === "confirm" && (
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                <span className="font-bold text-gray-900">{count}건</span>에{" "}
                <span className="font-bold text-gray-900">&lsquo;{field?.label}: {value || "(빈 값)"}&rsquo;</span>이 적용됩니다.
              </p>
              {count > 30 && (
                <p className="text-xs text-gray-400">Notion API 특성상 다소 시간이 걸릴 수 있습니다 (예상 약 {estSeconds}초)</p>
              )}
              {fieldKey === "company" && (
                <div className="px-3 py-2 bg-amber-50 rounded-lg text-xs text-amber-700">
                  법인명 일괄 변경을 진행합니다. 되돌리려면 다시 일괄 수정해야 합니다.
                </div>
              )}
            </div>
          )}

          {step === "result" && result && (
            <div className="space-y-3">
              <p className="text-sm">
                <span className="font-bold text-emerald-600">{result.success}건 성공</span>
                {result.failed > 0 && <span className="font-bold text-red-600 ml-2">{result.failed}건 실패</span>}
              </p>
              {result.failed > 0 && result.results && (
                <div>
                  <button onClick={() => setShowDetail(s => !s)} className="text-xs text-blue-600 hover:underline">
                    {showDetail ? "실패 목록 접기" : "실패 목록 보기"}
                  </button>
                  {showDetail && (
                    <ul className="mt-2 max-h-40 overflow-y-auto space-y-1">
                      {result.results.filter(r => !r.ok).map(r => (
                        <li key={r.id} className="text-xs text-gray-500">{r.id}: {r.error ?? "실패"}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {error && <div className="px-3 py-2 bg-red-50 rounded-lg text-sm text-red-600">{error}</div>}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex gap-3">
          {step === "form" && (
            <>
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">취소</button>
              <button onClick={() => setStep("confirm")} disabled={!fieldKey || !value}
                className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-700 disabled:opacity-40 transition-colors">
                다음
              </button>
            </>
          )}
          {step === "confirm" && (
            <>
              <button onClick={() => setStep("form")} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">뒤로</button>
              <button onClick={handleConfirm} disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 disabled:opacity-60 transition-colors">
                {submitting ? "처리 중…" : "적용"}
              </button>
            </>
          )}
          {step === "result" && (
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-700 transition-colors">닫기</button>
          )}
        </div>
      </div>
    </div>
  );
}
