"use client";
import { useEffect, useState } from "react";

interface SubItem {
  id: string;
  name: string;
  status: string;
  krw?: number | null;
  usd?: number | null;
  cycle?: string | null;
  team?: string;
  division?: string;
  userCount?: number | null;
  user?: string;
  startDate?: string | null;
  version?: string;
  paymentMethod?: string | null;
}

export default function SubscriptionPanel() {
  const [subs, setSubs] = useState<SubItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/subscriptions")
      .then((r) => r.json())
      .then((data) => {
        if (data && data.error) {
          setError(data.error);
        } else {
          setSubs(Array.isArray(data) ? data : []);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("데이터를 불러오지 못했습니다.");
        setLoading(false);
      });
  }, []);

  const filtered = subs.filter(
    (s) =>
      !search ||
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.team?.toLowerCase().includes(search.toLowerCase()) ||
      s.division?.toLowerCase().includes(search.toLowerCase())
  );

  const totalMonthlyKRW = subs.reduce((acc, s) => {
    const krw = s.krw ?? (s.usd ? Math.round(s.usd * 1350) : 0);
    return acc + (s.cycle === "연" ? Math.round(krw / 12) : krw);
  }, 0);

  const totalUsers = subs.reduce((acc, s) => acc + (s.userCount ?? 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        데이터 불러오는 중...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-red-500 text-sm">오류: {error}</p>
        <p className="text-xs text-gray-400">
          Vercel 환경 변수(NOTION_TOKEN)를 확인하세요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "구독 중인 SW", value: subs.length, unit: "개", icon: "💳" },
          {
            label: "월 비용 (추산)",
            value: `₩${totalMonthlyKRW.toLocaleString()}`,
            unit: "",
            icon: "💰",
          },
          { label: "총 사용자 수", value: totalUsers, unit: "명", icon: "👥" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl border border-gray-200 p-5"
          >
            <div className="text-2xl mb-2">{stat.icon}</div>
            <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-900">
              {stat.value}
              {stat.unit && (
                <span className="text-sm font-normal text-gray-500 ml-1">
                  {stat.unit}
                </span>
              )}
            </p>
          </div>
        ))}
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="SW명, 팀명, 사업부 검색..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">
                  SW명
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">
                  팀 / 사업부
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">
                  결제 금액
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 whitespace-nowrap">
                  주기
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 whitespace-nowrap">
                  인원
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">
                  결제 방식
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">
                  시작일
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-gray-400"
                  >
                    {search ? "검색 결과가 없습니다." : "구독 중인 SW가 없습니다."}
                  </td>
                </tr>
              ) : (
                filtered.map((s) => {
                  const krw =
                    s.krw ?? (s.usd ? Math.round(s.usd * 1350) : null);
                  const costStr = s.usd
                    ? `$${s.usd}${krw ? ` (₩${krw.toLocaleString()})` : ""}`
                    : krw
                    ? `₩${krw.toLocaleString()}`
                    : "-";

                  return (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{s.name}</div>
                        {s.version && (
                          <div className="text-xs text-gray-400 mt-0.5">
                            v{s.version}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        <div>{s.team || "-"}</div>
                        {s.division && (
                          <div className="text-xs text-gray-400 mt-0.5">
                            {s.division}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900 whitespace-nowrap">
                        {costStr}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            s.cycle === "연"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {s.cycle ?? "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700">
                        {s.userCount != null ? `${s.userCount}명` : "-"}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                        {s.paymentMethod ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {s.startDate ?? "-"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
