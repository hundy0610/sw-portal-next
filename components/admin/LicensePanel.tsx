"use client";

import { useEffect, useState } from "react";
import type { LicenseItem, SwItem } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SyncBanner } from "@/components/ui/SyncBanner";

export default function LicensePanel() {
  const [licenses, setLicenses] = useState<LicenseItem[]>([]);
  const [swDb, setSwDb] = useState<SwItem[]>([]);
  const [lastSynced, setLastSynced] = useState("");
  const [loading, setLoading] = useState(true);
  const [filt, setFilt] = useState<"all" | "saturated" | "banned" | "unlimited">("all");

  useEffect(() => {
    Promise.all([
      fetch("/api/licenses").then((r) => r.json()),
      fetch("/api/sw-db").then((r) => r.json()),
    ]).then(([lic, sw]) => {
      setLicenses(lic.data ?? []);
      setSwDb(sw.data ?? []);
      setLastSynced(lic.lastSynced ?? "");
    }).finally(() => setLoading(false));
  }, []);

  const categories = [...new Set(licenses.map((l) => l.category))];

  const filteredSw = swDb.filter((s) => {
    if (filt === "saturated") return s.totalLicenses < 999 && s.usedLicenses / s.totalLicenses >= 0.9;
    if (filt === "banned") return s.status === "banned";
    if (filt === "unlimited") return s.totalLicenses >= 999;
    return true;
  });

  function daysUntil(dateStr?: string): number | null {
    if (!dateStr) return null;
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  if (loading) return <div className="text-center py-20 text-gray-400">노션에서 불러오는 중...</div>;

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-0.5">라이선스 현황</h2>
          <p className="text-sm text-gray-500">전사 소프트웨어 라이선스 사용 및 만료 현황</p>
        </div>
      </div>

      <SyncBanner lastSynced={lastSynced} notionUrl={process.env.NEXT_PUBLIC_NOTION_TRACKER_URL} />

      {/* 라이선스 트래커 */}
      {licenses.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 bg-blue-600 rounded" />
            <span className="font-bold text-sm text-gray-900">라이선스 트래커</span>
            <span className="text-xs text-gray-400 bg-blue-50 px-2 py-0.5 rounded-full">Notion 연동</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {categories.map((cat) => (
              <div key={cat}>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{cat}</div>
                {licenses.filter((l) => l.category === cat).map((sw) => {
                  const d = daysUntil(sw.expiryDate);
                  const isExpiring = d !== null && d < 30;
                  return (
                    <a
                      key={sw.id}
                      href={sw.notionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-lg mb-1.5 no-underline hover:border-blue-400 hover:shadow-sm transition-all group"
                    >
                      <span className="text-lg min-w-6 text-center">{sw.icon}</span>
                      <div className="flex-1 overflow-hidden">
                        <div className="font-semibold text-xs text-gray-900 truncate">{sw.name}</div>
                        {sw.usedCount !== undefined && sw.totalCount !== undefined && (
                          <div className="text-xs text-gray-400">{sw.usedCount}/{sw.totalCount}석</div>
                        )}
                        {isExpiring && (
                          <div className="text-xs text-red-500 font-semibold">만료 D-{d}</div>
                        )}
                      </div>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-300 group-hover:text-blue-400 shrink-0">
                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                        <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
                    </a>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SW DB 현황 */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1 h-5 bg-green-500 rounded" />
        <span className="font-bold text-sm text-gray-900">SW DB 현황</span>
      </div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {([["all","전체"],["saturated","⚠ 포화"],["banned","✕ 금지"],["unlimited","무제한"]] as const).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setFilt(v)}
            className={`text-xs font-medium px-3 py-1.5 rounded border transition-colors ${
              filt === v
                ? "bg-gray-800 text-white border-gray-800"
                : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-auto">
        <table className="data-table">
          <thead>
            <tr>
              {["소프트웨어", "벤더", "카테고리", "상태", "사용/전체", "사용률", "대체재"].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredSw.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-gray-400 py-10">데이터 없음</td></tr>
            ) : filteredSw.map((s) => {
              const pct = s.totalLicenses < 999 ? Math.round((s.usedLicenses / s.totalLicenses) * 100) : 0;
              return (
                <tr key={s.id}>
                  <td className="font-semibold text-gray-900">{s.name}</td>
                  <td className="text-sm text-gray-500">{s.vendor}</td>
                  <td>
                    <span className="text-xs font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{s.category}</span>
                  </td>
                  <td><Badge value={s.status} /></td>
                  <td className="text-sm">
                    {s.totalLicenses < 999 ? `${s.usedLicenses} / ${s.totalLicenses}` : "무제한"}
                  </td>
                  <td style={{ minWidth: 120 }}>
                    {s.totalLicenses < 999 ? (
                      <>
                        <ProgressBar value={pct} />
                        <span className="text-xs text-gray-400">{pct}%</span>
                      </>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="text-xs text-gray-500">{s.alternatives.join(", ") || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
