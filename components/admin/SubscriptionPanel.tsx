"use client";

import { useEffect, useState, useMemo } from "react";
import type { SwDbRecord } from "@/types";
import { SyncBanner } from "@/components/ui/SyncBanner";

// 구독 유형
type SubType = "전체" | "구독(업체)" | "구독(웹)";

// 상태 뱃지 색상
const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  "사용중":     { bg: "bg-blue-50",   text: "text-blue-700"   },
  "갱신필요":   { bg: "bg-red-50",    text: "text-red-600"    },
  "만료":       { bg: "bg-gray-100",  text: "text-gray-500"   },
  "재고":       { bg: "bg-green-50",  text: "text-green-700"  },
  "신규등록":   { bg: "bg-purple-50", text: "text-purple-700" },
  "반납예정":   { bg: "bg-orange-50", text: "text-orange-600" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { bg: "bg-gray-100", text: "text-gray-500" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      {status || "—"}
    </span>
  );
}

function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function fmtDate(d: string) {
  if (!d) return "—";
  return d.slice(0, 10);
}

export default function SubscriptionPanel() {
  const [records, setRecords] = useState<SwDbRecord[]>([]);
  const [lastSynced, setLastSynced] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 필터 상태
  const [typeFilter, setTypeFilter] = useState<SubType>("전체");
  const [statusFilter, setStatusFilter] = useState("전체");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/sw-records")
      .then((r) => r.json())
      .then((res) => {
        setRecords(res.data ?? []);
        setLastSynced(res.lastSynced ?? "");
        if (res.error) setError(res.error);
      })
      .catch(() => setError("데이터를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  // 구독 레코드만 필터 (영구 제외)
  const subRecords = useMemo(
    () => records.filter((r) => r.licenseType === "구독(업체)" || r.licenseType === "구독(웹)"),
    [records]
  );

  // 갱신 임박 (30일 이내)
  const renewingSoon = useMemo(
    () =>
      subRecords.filter((r) => {
        const d = daysUntil(r.renewalDate);
        return d !== null && d >= 0 && d <= 30;
      }),
    [subRecords]
  );

  // 활성 구독 (사용중 / 신규등록 / 재고)
  const activeCount = useMemo(
    () => subRecords.filter((r) => r.status === "사용중" || r.status === "신규등록").length,
    [subRecords]
  );

  // 필터된 목록
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return subRecords.filter((r) => {
      if (typeFilter !== "전체" && r.licenseType !== typeFilter) return false;
      if (statusFilter !== "전체" && r.status !== statusFilter) return false;
      if (q) {
        return (
          r.swCategory.toLowerCase().includes(q) ||
          r.swDetail.toLowerCase().includes(q) ||
          r.user.toLowerCase().includes(q) ||
          r.department.toLowerCase().includes(q) ||
          r.company.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [subRecords, typeFilter, statusFilter, search]);

  const statusOptions = useMemo(
    () => ["전체", ...new Set(subRecords.map((r) => r.status).filter(Boolean))],
    [subRecords]
  );

  if (loading) return <div className="text-center py-20 text-gray-400">노션에서 불러오는 중...</div>;
  if (error) return <div className="text-center py-20 text-red-500">오류: {error}</div>;

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-0.5">구독 관리</h2>
          <p className="text-sm text-gray-500">전사 구독형 SW 현황 — SW 데이터베이스(수정중) 기준</p>
        </div>
      </div>

      <SyncBanner lastSynced={lastSynced} notionUrl={process.env.NEXT_PUBLIC_NOTION_SW_UNIFIED_URL} />

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          {
            label: "전체 구독",
            val: `${subRecords.length}개`,
            color: "#0052CC",
            bg: "#DEEBFF",
          },
          {
            label: "구독 중 (활성)",
            val: `${activeCount}개`,
            color: "#00875A",
            bg: "#E3FCEF",
          },
          {
            label: "갱신 임박 (30일)",
            val: `${renewingSoon.length}개`,
            color: renewingSoon.length > 0 ? "#DE350B" : "#6B778C",
            bg: renewingSoon.length > 0 ? "#FFEBE6" : "#F4F5F7",
          },
          {
            label: "업체 구독",
            val: `${subRecords.filter((r) => r.licenseType === "구독(업체)").length}개`,
            color: "#6554C0",
            bg: "#EAE6FF",
          },
        ].map((k) => (
          <div
            key={k.label}
            className="bg-white border border-gray-200 rounded-lg p-4"
            style={{ borderLeft: `3px solid ${k.color}` }}
          >
            <div className="text-xs text-gray-500 mb-1">{k.label}</div>
            <div className="text-lg font-extrabold" style={{ color: k.color }}>
              {k.val}
            </div>
          </div>
        ))}
      </div>

      {/* 갱신 임박 알림 */}
      {renewingSoon.length > 0 && (
        <div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="font-semibold text-sm text-red-700 mb-3">⚠️ 갱신 임박 (30일 이내)</div>
          <div className="flex flex-col gap-2">
            {renewingSoon.map((r) => {
              const d = daysUntil(r.renewalDate);
              return (
                <div key={r.id} className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-900 flex-1 truncate">
                    {r.swCategory}{r.swDetail ? ` · ${r.swDetail}` : ""}
                  </span>
                  <span className="text-xs text-gray-500 shrink-0">
                    {r.user || "—"} · {r.department || "—"}
                  </span>
                  <span className="text-xs font-bold text-red-600 shrink-0">
                    D-{d} ({fmtDate(r.renewalDate)})
                  </span>
                  {r.notionUrl && (
                    <a
                      href={r.notionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline shrink-0"
                    >
                      보기
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 검색 & 필터 */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          placeholder="SW명, 사용자, 부서, 법인명 검색…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {(["전체", "구독(업체)", "구독(웹)"] as SubType[]).map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`text-xs font-medium px-3 py-1.5 rounded border transition-colors ${
              typeFilter === t
                ? "bg-gray-800 text-white border-gray-800"
                : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
            }`}
          >
            {t}
          </button>
        ))}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {statusOptions.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <span className="flex items-center text-xs text-gray-400 font-medium">{filtered.length}건</span>
      </div>

      {/* 테이블 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-auto shadow-sm">
        <table className="w-full text-sm" style={{ minWidth: 900 }}>
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {[
                "SW명",
                "구독 유형",
                "상태",
                "사용자 / 부서",
                "법인명",
                "갱신 필요일",
                "인증키 / 계정",
                "버전",
                "노션",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-12 text-gray-400">
                  데이터 없음
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const days = daysUntil(r.renewalDate);
                const isUrgent = days !== null && days >= 0 && days <= 30;
                return (
                  <tr
                    key={r.id}
                    className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900 text-xs">
                        {r.swCategory}
                      </div>
                      {r.swDetail && (
                        <div className="text-xs text-gray-400">{r.swDetail}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          r.licenseType === "구독(업체)"
                            ? "bg-purple-50 text-purple-700"
                            : "bg-cyan-50 text-cyan-700"
                        }`}
                      >
                        {r.licenseType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 text-xs">{r.user || "—"}</div>
                      <div className="text-xs text-gray-400">{r.department || "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{r.company || "—"}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {r.renewalDate ? (
                        <span className={isUrgent ? "text-red-600 font-semibold" : "text-gray-600"}>
                          {fmtDate(r.renewalDate)}
                          {isUrgent && days !== null && (
                            <span className="ml-1 bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                              D-{days}
                            </span>
                          )}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 max-w-[160px] truncate">
                      {r.licenseKey || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {r.version.length > 0 ? r.version.join(", ") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {r.notionUrl && (
                        <a
                          href={r.notionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-700 text-xs underline"
                        >
                          보기
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
