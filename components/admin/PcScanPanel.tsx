"use client";

import { useEffect, useState } from "react";
import type { PcScanRecord } from "@/lib/pc-scan";
import { safeJson } from "@/lib/fetch-json";

function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function PcScanPanel() {
  const [records, setRecords] = useState<PcScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [search, setSearch]   = useState("");

  useEffect(() => {
    fetch("/api/admin/pc-scan")
      .then(r => safeJson(r))
      .then(res => {
        if (res?.ok) setRecords(res.data ?? []);
        else setError(res?.error ?? "불러오기 실패");
      })
      .catch(() => setError("네트워크 오류"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = records.filter(r => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.pcName.toLowerCase().includes(q) ||
      r.serial.toLowerCase().includes(q) ||
      r.userName.toLowerCase().includes(q) ||
      r.corp.toLowerCase().includes(q) ||
      r.dept.toLowerCase().includes(q) ||
      r.model.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fade-in">
      <div className="mb-5 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-0.5">자산 실사 현황</h2>
          <p className="text-sm text-gray-500">
            WPF 에이전트가 수집한 PC 정보 ({records.length}대)
          </p>
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="PC명·시리얼·사용자·법인 검색…"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">불러오는 중…</div>
      ) : error ? (
        <div className="text-center py-12 text-red-500 text-sm">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-xl text-gray-400 text-sm">
          {search ? "검색 결과가 없습니다." : "수집된 데이터가 없습니다."}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-xs border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {["PC명", "자산번호", "시리얼", "법인", "사용자", "부서", "제조사·모델", "OS", "수집일시", "마스터"].map(h => (
                  <th key={h} className="text-left px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">
                    <a
                      href={r.notionUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-blue-600 hover:underline"
                    >
                      {r.pcName || "—"}
                    </a>
                  </td>
                  <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{r.assetNo || "—"}</td>
                  <td className="px-3 py-2.5 text-gray-500 font-mono whitespace-nowrap">{r.serial || "—"}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {r.corp ? (
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">{r.corp}</span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{r.userName || "—"}</td>
                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{r.dept || "—"}</td>
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                    {[r.manufacturer, r.model].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-gray-500 max-w-[160px] truncate" title={r.os}>{r.os || "—"}</td>
                  <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">{formatDate(r.collectedAt)}</td>
                  <td className="px-3 py-2.5 text-center">
                    {r.masterExists ? (
                      <span className="text-emerald-600 font-bold">✓</span>
                    ) : (
                      <span className="text-gray-300">—</span>
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
