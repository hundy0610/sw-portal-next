// SaaS 사용 현황 — 각 PC의 수집 클라이언트(PowerShell, 작업 스케줄러로 상시 실행)가
// Chrome/Edge 방문기록에서 추출해 보낸 도메인을 SaaS 도메인 정책(app/manage의
// "SaaS 도메인 정책" 탭에서 관리)과 대조한 결과를 보여준다.
//
// 설치형 SW 감사(PcScanPanel의 SwAuditModal)와 달리 파일을 그때그때 골라 검사하는
// 방식이 아니다 — 수집 클라이언트가 보낼 때마다 서버가 이미 누적·대조해 저장해두므로
// 이 화면은 그 결과를 그대로 조회만 한다.
"use client";

import { useCallback, useEffect, useState } from "react";
import { safeJson } from "@/lib/fetch-json";

interface PcSummary {
  pcName: string;
  serial: string;
  userName?: string;
  corp?: string;
  lastReportedAt: string;
  total: number;
  whitelist: number;
  blacklist: number;
  unknown: number;
  excluded: number;
}

interface UnknownAggregate {
  host: string;
  count: number;
  pcNames: string[];
  totalVisits: number;
}

interface UsageResult {
  ok: true;
  perPcSummary: PcSummary[];
  unknownAggregate: UnknownAggregate[];
}

export default function SaasUsagePanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState<UsageResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [registering, setRegistering] = useState(false);
  const [registeredCount, setRegisteredCount] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    fetch("/api/saas-usage")
      .then(r => safeJson(r))
      .then(res => {
        if (!res.ok) { setError(res.error ?? "조회 실패"); return; }
        setResult(res);
      })
      .catch(() => setError("네트워크 오류"))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  function toggle(host: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(host) ? next.delete(host) : next.add(host);
      return next;
    });
  }

  async function handleBlacklist() {
    if (selected.size === 0) return;
    setRegistering(true);
    try {
      const res = await fetch("/api/saas-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _action: "bulkCreate", domains: Array.from(selected), status: "banned" }),
      });
      const json = await safeJson(res);
      if (json.ok) {
        setRegisteredCount(json.created);
        setSelected(new Set());
        load();
      } else {
        alert(json.error ?? "등록 실패");
      }
    } finally {
      setRegistering(false);
    }
  }

  const totalPcs = result?.perPcSummary.length ?? 0;
  const totalBlacklistHits = result?.perPcSummary.reduce((s, p) => s + p.blacklist, 0) ?? 0;

  return (
    <div className="max-w-5xl">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-base font-bold text-gray-900">SaaS 사용 현황</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            각 PC의 수집 스크립트가 보고한 브라우저 방문 도메인을 SaaS 도메인 정책과 대조한 결과입니다.
          </p>
        </div>
        <button onClick={load} className="px-4 py-1.5 rounded-lg bg-zinc-700 text-white text-xs font-semibold hover:bg-zinc-800">새로고침</button>
      </div>

      {loading && <div className="text-center py-16 text-gray-400 text-sm">불러오는 중…</div>}
      {error && <div className="px-3 py-2 bg-red-50 rounded-lg text-sm text-red-600">{error}</div>}

      {result && (
        <>
          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-gray-800">{totalPcs}</div>
              <div className="text-xs text-gray-500 mt-0.5">보고 중인 PC</div>
            </div>
            <div className="bg-red-50 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-red-600">{result.unknownAggregate.length}</div>
              <div className="text-xs text-red-500 mt-0.5">미확인 도메인 종류</div>
            </div>
            <div className="bg-red-50 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-red-600">{totalBlacklistHits}</div>
              <div className="text-xs text-red-500 mt-0.5">금지 도메인 접속 건(PC 합계)</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-gray-800">{result.perPcSummary.reduce((s, p) => s + p.whitelist, 0)}</div>
              <div className="text-xs text-gray-500 mt-0.5">승인 도메인 사용 건</div>
            </div>
          </div>

          <h3 className="text-xs font-bold text-gray-700 mb-2">미확인 도메인 (발견 PC수 순)</h3>
          {result.unknownAggregate.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm mb-6">미확인 도메인이 없습니다 — 전부 관리 목록에 있습니다.</div>
          ) : (
            <div className="border border-gray-200 rounded-xl overflow-hidden mb-3">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-8 px-3 py-2"></th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-500">도메인</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-500">누적 방문수</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-500">발견 PC수</th>
                  </tr>
                </thead>
                <tbody>
                  {result.unknownAggregate.map(u => (
                    <tr key={u.host} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={selected.has(u.host)} onChange={() => toggle(u.host)} />
                      </td>
                      <td className="px-3 py-2 text-gray-800">{u.host}</td>
                      <td className="px-3 py-2 text-right text-gray-500">{u.totalVisits}</td>
                      <td className="px-3 py-2 text-right text-gray-600" title={u.pcNames.join(", ")}>{u.count}대</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {result.unknownAggregate.length > 0 && (
            <div className="flex items-center gap-3 mb-8">
              <button onClick={handleBlacklist} disabled={selected.size === 0 || registering}
                className="py-2 px-4 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-40 transition-colors">
                {registering ? "등록 중…" : `선택 ${selected.size}건 블랙리스트 등록`}
              </button>
              {registeredCount !== null && <p className="text-xs text-green-600">{registeredCount}건이 블랙리스트에 등록되었습니다.</p>}
            </div>
          )}

          <h3 className="text-xs font-bold text-gray-700 mb-2">PC별 현황</h3>
          {result.perPcSummary.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">아직 보고된 PC가 없습니다.</div>
          ) : (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-gray-500">PC명</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-500">법인</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-500">사용자</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-500">승인</th>
                    <th className="text-right px-3 py-2 font-semibold text-red-500">금지</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-500">미확인</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-500">최근 보고</th>
                  </tr>
                </thead>
                <tbody>
                  {result.perPcSummary
                    .slice()
                    .sort((a, b) => b.blacklist - a.blacklist)
                    .map(p => (
                      <tr key={p.serial} className={`border-t border-gray-100 hover:bg-gray-50 ${p.blacklist > 0 ? "bg-red-50/40" : ""}`}>
                        <td className="px-3 py-2 text-gray-800">{p.pcName}</td>
                        <td className="px-3 py-2 text-gray-500">{p.corp || "—"}</td>
                        <td className="px-3 py-2 text-gray-500">{p.userName || "—"}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{p.whitelist}</td>
                        <td className="px-3 py-2 text-right font-bold text-red-600">{p.blacklist || "—"}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{p.unknown}</td>
                        <td className="px-3 py-2 text-gray-400">{new Date(p.lastReportedAt).toLocaleString("ko-KR")}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
