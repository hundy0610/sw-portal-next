"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { safeJson } from "@/lib/fetch-json";
import type { VendorRow } from "@/app/api/vendor-consolidation/route";

const fmt = (n: number) => n.toLocaleString("ko-KR");

/**
 * 같은 SW/벤더를 여러 계열사가 각자 따로 계약하고 있는지 모아 보여준다. 임원이
 * "SaaS 비용 컨트롤타워" 역할을 하려면 가장 먼저 필요한 것 — 통합 협상(볼륨
 * 디스카운트) 대상을 찾는 화면. 실제 절감액은 협상 전엔 알 수 없으므로 추정치를
 * 만들지 않고, "몇 개 법인이 따로 계약 중인지 + 합산 지출"만 사실대로 보여준다.
 */
export default function VendorConsolidationPanel() {
  const [rows,    setRows]    = useState<VendorRow[]>([]);
  const [summary, setSummary] = useState<{ candidateCount: number; candidateMonthlyKrw: number; totalMonthlyKrw: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [onlyCandidates, setOnlyCandidates] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const json = await fetch("/api/vendor-consolidation").then(r => safeJson(r));
      if (!json.ok) throw new Error(json.error ?? "조회 실패");
      setRows(json.rows ?? []);
      setSummary(json.summary ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const shown = onlyCandidates ? rows.filter(r => r.consolidationCandidate) : rows;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-gray-900">벤더 통합 협상 뷰</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          같은 SW를 2개 이상 계열사가 각자 따로 결제 중인 항목을 모았습니다 — 통합 계약 협상 후보입니다.
        </p>
      </div>

      {error && <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}

      {!loading && summary && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-[10px] text-gray-400 font-semibold uppercase">통합 협상 후보</div>
            <div className="text-lg font-bold text-amber-700">{summary.candidateCount}개 SW</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-[10px] text-gray-400 font-semibold uppercase">후보 항목 월 지출 합계</div>
            <div className="text-lg font-bold text-gray-800">₩{fmt(summary.candidateMonthlyKrw)}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-[10px] text-gray-400 font-semibold uppercase">전체 구독 월 지출</div>
            <div className="text-lg font-bold text-gray-800">₩{fmt(summary.totalMonthlyKrw)}</div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 cursor-pointer">
          <input type="checkbox" checked={onlyCandidates} onChange={e => setOnlyCandidates(e.target.checked)} />
          통합 후보만 보기(2개 이상 법인이 따로 계약)
        </label>
        <button onClick={load} className="text-xs text-gray-400 hover:text-gray-600 font-semibold">새로고침</button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <p className="text-xs text-gray-400 py-12 text-center">불러오는 중…</p>
        ) : shown.length === 0 ? (
          <p className="text-xs text-gray-400 py-12 text-center">
            {onlyCandidates ? "통합 후보가 없습니다 — 모든 SW가 단일 법인에서만 계약 중입니다." : "표시할 데이터가 없습니다."}
          </p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-2.5 text-left font-semibold w-8"></th>
                <th className="px-4 py-2.5 text-left font-semibold">SW명</th>
                <th className="px-4 py-2.5 text-left font-semibold">카테고리</th>
                <th className="px-4 py-2.5 text-right font-semibold">계약 법인 수</th>
                <th className="px-4 py-2.5 text-right font-semibold">라이선스 건수</th>
                <th className="px-4 py-2.5 text-right font-semibold">월 지출 합계</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(r => {
                const isOpen = openRow === r.swName;
                return (
                  <Fragment key={r.swName}>
                    <tr
                      className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setOpenRow(isOpen ? null : r.swName)}>
                      <td className="px-4 py-2.5 text-gray-300">{isOpen ? "▼" : "▶"}</td>
                      <td className="px-4 py-2.5 font-semibold text-gray-800">
                        {r.swName}
                        {r.consolidationCandidate && (
                          <span className="ml-2 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">통합 후보</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500">{r.category}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={r.companyCount >= 2 ? "font-bold text-amber-700" : "text-gray-600"}>{r.companyCount}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-600">{r.licenseCount}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-gray-800">₩{fmt(r.monthlyKrw)}</td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={6} className="p-0">
                          <div className="bg-slate-50 border-b border-slate-200 px-8 py-3">
                            <table className="w-full text-[11px]">
                              <thead>
                                <tr className="text-slate-400">
                                  <th className="text-left font-semibold py-1">법인</th>
                                  <th className="text-right font-semibold py-1">라이선스 건수</th>
                                  <th className="text-right font-semibold py-1">월 지출</th>
                                </tr>
                              </thead>
                              <tbody>
                                {r.byCompany.map(c => (
                                  <tr key={c.company} className="border-t border-slate-200">
                                    <td className="py-1.5 text-slate-700 font-medium">{c.company}</td>
                                    <td className="py-1.5 text-right text-slate-600">{c.licenseCount}</td>
                                    <td className="py-1.5 text-right font-mono text-slate-700">₩{fmt(c.monthlyKrw)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-[11px] text-gray-400">
        * SW명은 등록된 "SW대분류"(없으면 소분류) 기준으로 묶습니다. 표기가 다르면(예: "MS Office" vs
        "Microsoft 365") 서로 다른 항목으로 잡힐 수 있어, 계열사 등록 시 SW명 표기를 통일해두면 이
        화면의 정확도가 올라갑니다. 절감 추정액은 별도로 계산하지 않습니다 — 실제 협상 결과가 있어야
        신뢰할 수 있는 숫자라서, 여기서는 "얼마가 어떻게 나뉘어 있는지"까지만 보여줍니다.
      </p>
    </div>
  );
}
