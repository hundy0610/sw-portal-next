"use client";

import { useCallback, useEffect, useState } from "react";
import { safeJson } from "@/lib/fetch-json";
import type { SubscriptionAlert, BudgetConfig, DeadlineConfig, AlertSeverity } from "@/lib/subscription-alerts";

const SEVERITY_STYLE: Record<AlertSeverity, { chip: string; dot: string; label: string }> = {
  urgent: { chip: "bg-red-50 border-red-200",     dot: "bg-red-500",    label: "긴급" },
  warn:   { chip: "bg-orange-50 border-orange-200", dot: "bg-orange-400", label: "주의" },
  info:   { chip: "bg-slate-50 border-slate-200",  dot: "bg-slate-400",  label: "참고" },
};

const TYPE_LABEL = { renewal: "갱신 임박", budget: "예산 초과", submission: "자료 제출" } as const;

/**
 * 구독 관리 알림 — 갱신임박 / 예산초과 / 자료 제출기한을 화면에 표시한다.
 * 메일을 발송하지는 않는다(포털 자동 발송은 중복발송 사고 이후 비활성화, 발송 주체는
 * 맥북 폴러). 판정 결과만 보여주고, 실제 조치는 담당자가 화면을 보고 진행한다.
 */
export default function SubscriptionAlerts({ isSuper }: { isSuper: boolean }) {
  const [alerts,  setAlerts]  = useState<SubscriptionAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [open,    setOpen]    = useState(true);
  const [showConfig, setShowConfig] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const json = await fetch("/api/subscription-alerts").then(r => safeJson(r));
      if (!json.ok) throw new Error(json.error ?? "알림 조회 실패");
      setAlerts(json.alerts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const urgent = alerts.filter(a => a.severity === "urgent");
  const others = alerts.filter(a => a.severity !== "urgent");

  if (loading) return null;
  if (error) {
    return (
      <div className="mb-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600" data-print-hide>
        알림을 불러오지 못했습니다: {error}
      </div>
    );
  }

  return (
    <div className="mb-4" data-print-hide>
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 text-sm font-bold text-gray-800">
          <span className={`transition-transform text-gray-400 ${open ? "rotate-90" : ""}`}>▶</span>
          구독 알림
          {alerts.length > 0 ? (
            <span className="flex items-center gap-1.5">
              {urgent.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[11px] font-bold">긴급 {urgent.length}</span>
              )}
              {others.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[11px] font-bold">주의 {others.length}</span>
              )}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[11px] font-semibold">이상 없음</span>
          )}
        </button>
        <div className="flex items-center gap-2">
          {isSuper && (
            <button onClick={() => setShowConfig(true)}
              className="text-xs text-gray-400 hover:text-gray-600 font-semibold">
              예산 · 제출기한 설정
            </button>
          )}
          <button onClick={load} className="text-xs text-gray-400 hover:text-gray-600 font-semibold">새로고침</button>
        </div>
      </div>

      {open && alerts.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {alerts.map(a => {
            const s = SEVERITY_STYLE[a.severity];
            return (
              <div key={a.id} className={`flex items-start gap-2.5 px-3 py-2 border rounded-lg ${s.chip}`}>
                <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${s.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/70 text-gray-500">
                      {TYPE_LABEL[a.type]}
                    </span>
                    <span className="text-xs font-bold text-gray-800">{a.title}</span>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    {a.company}{a.detail ? ` · ${a.detail}` : ""}
                  </div>
                </div>
              </div>
            );
          })}
          <p className="text-[11px] text-gray-400 mt-0.5">
            * 이 알림은 화면 표시 전용입니다 — 자동 메일 발송은 하지 않습니다.
          </p>
        </div>
      )}

      {showConfig && (
        <AlertConfigModal onClose={() => { setShowConfig(false); load(); }} />
      )}
    </div>
  );
}

// ─── 예산 상한 · 제출기한 설정 모달 (슈퍼어드민 전용) ────────────────────────
function AlertConfigModal({ onClose }: { onClose: () => void }) {
  const [budgets,   setBudgets]   = useState<BudgetConfig[]>([]);
  const [deadlines, setDeadlines] = useState<DeadlineConfig[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");

  useEffect(() => {
    fetch("/api/subscription-alerts/config")
      .then(r => safeJson(r))
      .then(json => {
        if (!json.ok) throw new Error(json.error ?? "설정 조회 실패");
        setBudgets(json.budgets ?? []);
        setDeadlines(json.deadlines ?? []);
      })
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/subscription-alerts/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budgets, deadlines }),
      });
      const json = await safeJson(res);
      if (!json.ok) throw new Error(json.error ?? "저장 실패");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "px-2 py-1.5 border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-amber-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 bg-gray-800 text-white flex items-start justify-between shrink-0">
          <div>
            <div className="font-bold text-sm">예산 상한 · 자료 제출기한 설정</div>
            <div className="text-xs text-white/70 mt-0.5">알림 판정 기준값입니다. 메일 발송은 하지 않습니다.</div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-xl leading-none">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-6">
          {error && <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">{error}</div>}
          {loading ? (
            <p className="text-xs text-gray-400 text-center py-8">불러오는 중…</p>
          ) : (
            <>
              {/* 예산 상한 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-800">법인 · 부서별 월 예산 상한</h4>
                  <button onClick={() => setBudgets(b => [...b, { company: "", department: "", monthlyLimitKrw: 0 }])}
                    className="text-xs font-semibold text-amber-700 hover:underline">+ 추가</button>
                </div>
                <p className="text-[11px] text-gray-400 mb-2">
                  해당 부서의 구독 월 합계가 상한을 넘으면 알림에 표시됩니다. 종량제 구독의 실사용 금액은
                  향후 벤더 API 연동 시 자동으로 이 계산에 반영됩니다.
                </p>
                {budgets.length === 0 ? (
                  <p className="text-xs text-gray-400 py-3 text-center bg-gray-50 rounded-lg">설정된 예산이 없습니다.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {budgets.map((b, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <input className={`${inputCls} flex-1`} placeholder="법인" value={b.company}
                          onChange={e => setBudgets(list => list.map((x, j) => j === i ? { ...x, company: e.target.value } : x))} />
                        <input className={`${inputCls} flex-1`} placeholder="부서" value={b.department}
                          onChange={e => setBudgets(list => list.map((x, j) => j === i ? { ...x, department: e.target.value } : x))} />
                        <input type="number" min={0} className={`${inputCls} w-32 text-right`} placeholder="월 상한(원)"
                          value={b.monthlyLimitKrw || ""}
                          onChange={e => setBudgets(list => list.map((x, j) => j === i ? { ...x, monthlyLimitKrw: Number(e.target.value) || 0 } : x))} />
                        <button onClick={() => setBudgets(list => list.filter((_, j) => j !== i))}
                          className="text-gray-300 hover:text-red-500 px-1 text-lg leading-none shrink-0">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 제출기한 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-800">법인별 카드명세 제출기한</h4>
                  <button onClick={() => setDeadlines(d => [...d, { company: "", dayOfMonth: 10 }])}
                    className="text-xs font-semibold text-amber-700 hover:underline">+ 추가</button>
                </div>
                <p className="text-[11px] text-gray-400 mb-2">
                  매월 지정일 기준 D-3부터 알림에 표시되고, 기한이 지나도 해당 월 업로드가 없으면 긴급으로 올라갑니다.
                </p>
                {deadlines.length === 0 ? (
                  <p className="text-xs text-gray-400 py-3 text-center bg-gray-50 rounded-lg">설정된 제출기한이 없습니다.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {deadlines.map((d, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <input className={`${inputCls} flex-1`} placeholder="법인" value={d.company}
                          onChange={e => setDeadlines(list => list.map((x, j) => j === i ? { ...x, company: e.target.value } : x))} />
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-400">매월</span>
                          <input type="number" min={1} max={31} className={`${inputCls} w-16 text-right`}
                            value={d.dayOfMonth}
                            onChange={e => setDeadlines(list => list.map((x, j) => j === i ? { ...x, dayOfMonth: Number(e.target.value) || 1 } : x))} />
                          <span className="text-xs text-gray-400">일</span>
                        </div>
                        <button onClick={() => setDeadlines(list => list.filter((_, j) => j !== i))}
                          className="text-gray-300 hover:text-red-500 px-1 text-lg leading-none shrink-0">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-4 bg-gray-50 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">취소</button>
          <button onClick={save} disabled={saving || loading}
            className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-60 rounded-lg transition-colors">
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
