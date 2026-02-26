"use client";

import { useEffect, useState } from "react";
import type { SwItem } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SyncBanner } from "@/components/ui/SyncBanner";

export default function SwDbPanel() {
  const [items, setItems] = useState<SwItem[]>([]);
  const [lastSynced, setLastSynced] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/sw-db")
      .then((r) => r.json())
      .then((res) => {
        setItems(res.data ?? []);
        setLastSynced(res.lastSynced ?? "");
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = items.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return [s.name, s.vendor, s.category].some((v) => v.toLowerCase().includes(q));
  });

  if (loading) return <div className="text-center py-20 text-gray-400">노션에서 불러오는 중...</div>;

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-0.5">SW DB 관리</h2>
          <p className="text-sm text-gray-500">화이트·블랙리스트 및 라이선스 정보 (노션에서 직접 편집)</p>
        </div>
        <a
          href={process.env.NEXT_PUBLIC_NOTION_TRACKER_URL || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm font-medium bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          노션에서 편집
        </a>
      </div>

      <SyncBanner lastSynced={lastSynced} />

      {/* 검색 */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          className="form-input pl-9"
          style={{ height: 38 }}
          placeholder="소프트웨어명, 벤더, 카테고리 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-auto">
        <table className="data-table">
          <thead>
            <tr>
              {["소프트웨어", "벤더", "카테고리", "승인 상태", "라이선스 사용", "사용률", "대체재", "필수"].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center text-gray-400 py-10">검색 결과 없음</td></tr>
            ) : filtered.map((s) => {
              const pct = s.totalLicenses < 999 ? Math.round((s.usedLicenses / s.totalLicenses) * 100) : 0;
              return (
                <tr key={s.id}>
                  <td>
                    <div className="font-semibold text-gray-900">{s.name}</div>
                    {s.description && (
                      <div className="text-xs text-gray-400 truncate max-w-xs">{s.description}</div>
                    )}
                  </td>
                  <td className="text-sm text-gray-500">{s.vendor}</td>
                  <td>
                    <span className="text-xs font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{s.category}</span>
                  </td>
                  <td><Badge value={s.status} /></td>
                  <td className="text-sm">
                    {s.totalLicenses < 999 ? `${s.usedLicenses} / ${s.totalLicenses}` : "무제한"}
                  </td>
                  <td style={{ minWidth: 110 }}>
                    {s.totalLicenses < 999 ? (
                      <>
                        <ProgressBar value={pct} />
                        <span className="text-xs text-gray-400">{pct}%</span>
                      </>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="text-xs text-gray-500 max-w-xs">
                    <div className="truncate">{s.alternatives.join(", ") || "—"}</div>
                  </td>
                  <td>
                    {s.mandatory ? (
                      <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-semibold">필수</span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
