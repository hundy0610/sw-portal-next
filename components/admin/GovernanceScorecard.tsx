"use client";

import { useCallback, useEffect, useState } from "react";
import { safeJson } from "@/lib/fetch-json";
import type { CompanyScoreRow, Severity } from "@/app/api/governance-scorecard/route";

const SEVERITY_STYLE: Record<Severity, { dot: string; label: string; row: string }> = {
  red:    { dot: "bg-red-500",    label: "조치 필요", row: "bg-red-50/60"    },
  yellow: { dot: "bg-yellow-400", label: "확인 필요", row: "bg-yellow-50/50" },
  green:  { dot: "bg-emerald-500", label: "정상",      row: ""                },
};

const SUBMISSION_STYLE: Record<CompanyScoreRow["submissionStatus"], string> = {
  "완료":   "text-emerald-600",
  "임박":   "text-yellow-600 font-semibold",
  "미제출": "text-red-600 font-bold",
  "미설정": "text-gray-300",
};

/**
 * 17개+ 계열사를 한 화면에서 보는 거버넌스 스코어카드. 각 화면(구독현황/카드명세)에
 * 흩어져 있는 신호(갱신임박·이상치·예산초과·제출현황)를 법인 단위로 한 줄씩 모아
 * 보여준다 — 매번 법인을 하나씩 클릭해 들어가지 않고 전체를 한눈에 훑기 위함.
 * 슈퍼어드민 전용(모든 법인 데이터를 다루므로).
 */
export default function GovernanceScorecard({ onOpenCompany }: { onOpenCompany?: (company: string) => void }) {
  const [rows,    setRows]    = useState<CompanyScoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [generatedAt, setGeneratedAt] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const json = await fetch("/api/governance-scorecard").then(r => safeJson(r));
      if (!json.ok) throw new Error(json.error ?? "조회 실패");
      setRows(json.rows ?? []);
      setGeneratedAt(json.generatedAt ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = {
    red:    rows.filter(r => r.severity === "red").length,
    yellow: rows.filter(r => r.severity === "yellow").length,
    green:  rows.filter(r => r.severity === "green").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-900">계열사 거버넌스 스코어카드</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            법인별 갱신임박·이상치·예산초과·카드명세 제출현황을 한 화면에서 확인합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {generatedAt && <span className="text-[11px] text-gray-400">{generatedAt.slice(0, 16).replace("T", " ")} 기준</span>}
          <button onClick={load} className="text-xs text-gray-400 hover:text-gray-600 font-semibold">새로고침</button>
        </div>
      </div>

      {error && <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}

      {!loading && !error && (
        <div className="flex gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-full text-xs font-bold text-red-700">
            <span className="w-2 h-2 rounded-full bg-red-500" /> 조치 필요 {counts.red}곳
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 border border-yellow-200 rounded-full text-xs font-bold text-yellow-700">
            <span className="w-2 h-2 rounded-full bg-yellow-400" /> 확인 필요 {counts.yellow}곳
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-bold text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> 정상 {counts.green}곳
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <p className="text-xs text-gray-400 py-12 text-center">불러오는 중…</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-gray-400 py-12 text-center">표시할 법인 데이터가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-2.5 text-left font-semibold w-10"></th>
                  <th className="px-4 py-2.5 text-left font-semibold">법인</th>
                  <th className="px-4 py-2.5 text-right font-semibold">구독 건수</th>
                  <th className="px-4 py-2.5 text-right font-semibold">갱신 D-7</th>
                  <th className="px-4 py-2.5 text-right font-semibold">갱신 D-30</th>
                  <th className="px-4 py-2.5 text-right font-semibold">이상치 부서</th>
                  <th className="px-4 py-2.5 text-right font-semibold">예산초과 부서</th>
                  <th className="px-4 py-2.5 text-center font-semibold">카드명세 제출</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const s = SEVERITY_STYLE[r.severity];
                  return (
                    <tr key={r.company}
                      className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors ${s.row}`}
                      onClick={() => onOpenCompany?.(r.company)}>
                      <td className="px-4 py-2.5"><span className={`inline-block w-2.5 h-2.5 rounded-full ${s.dot}`} title={s.label} /></td>
                      <td className="px-4 py-2.5 font-semibold text-gray-800 whitespace-nowrap">{r.company}</td>
                      <td className="px-4 py-2.5 text-right text-gray-600">{r.swCount}</td>
                      <td className="px-4 py-2.5 text-right">
                        {r.renewalUrgent > 0
                          ? <span className="font-bold text-red-600">{r.renewalUrgent}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {r.renewalWarn > 0
                          ? <span className="font-semibold text-yellow-600">{r.renewalWarn}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {r.anomalyCount > 0
                          ? <span className="font-semibold text-orange-600">{r.anomalyCount}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {r.budgetOverCount > 0
                          ? <span className="font-bold text-red-600">{r.budgetOverCount}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className={`px-4 py-2.5 text-center ${SUBMISSION_STYLE[r.submissionStatus]}`}>
                        {r.submissionStatus}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11px] text-gray-400">
        * 행을 클릭하면 해당 법인의 구독형 라이선스 현황으로 이동합니다. 갱신 D-7/D-30, 이상치,
        예산초과는 F1·F5와 동일한 판정 로직을 재사용합니다.
      </p>
    </div>
  );
}
