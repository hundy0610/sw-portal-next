"use client";

import { useEffect, useState } from "react";
import type { Subscription } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { SyncBanner } from "@/components/ui/SyncBanner";

const USD_RATE = 1380;

function calcNextPayment(start: string, cycle: "월" | "연"): string {
  if (!start) return "—";
  const d = new Date(start);
  const now = new Date();
  if (cycle === "월") {
    while (d <= now) d.setMonth(d.getMonth() + 1);
  } else {
    while (d <= now) d.setFullYear(d.getFullYear() + 1);
  }
  return d.toISOString().split("T")[0];
}

function daysUntil(dateStr: string): number | null {
  if (!dateStr || dateStr === "—") return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function SubscriptionPanel() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [lastSynced, setLastSynced] = useState("");
  const [filter, setFilter] = useState<"all" | "구독 중" | "구독 해지">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/subscriptions")
      .then((r) => r.json())
      .then((res) => {
        setSubs(res.data ?? []);
        setLastSynced(res.lastSynced ?? "");
        if (res.error) setError(res.error);
      })
      .catch(() => setError("데이터를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  const active = subs.filter((s) => s.status === "구독 중");

  const totalMonthlyKRW = active.reduce((acc, s) => {
    if (s.krw && s.cycle === "월") return acc + s.krw * (s.userCount || 1);
    if (s.usd && s.cycle === "월") return acc + s.usd * USD_RATE * (s.userCount || 1);
    if (s.krw && s.cycle === "연") return acc + (s.krw * (s.userCount || 1)) / 12;
    if (s.usd && s.cycle === "연") return acc + (s.usd * USD_RATE * (s.userCount || 1)) / 12;
    return acc;
  }, 0);

  const totalAnnualUSD = active.reduce((acc, s) => {
    const count = s.userCount || 1;
    if (s.usd) return acc + (s.cycle === "연" ? s.usd : s.usd * 12) * count;
    if (s.krw) return acc + (s.cycle === "연" ? s.krw : s.krw * 12) * count / USD_RATE;
    return acc;
  }, 0);

  const list = filter === "all" ? subs : subs.filter((s) => s.status === filter);

  if (loading) return <div className="text-center py-20 text-gray-400">노션에서 불러오는 중...</div>;
  if (error) return <div className="text-center py-20 text-red-500">오류: {error}</div>;

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-0.5">구독 관리</h2>
          <p className="text-sm text-gray-500">전사 구독형 SW의 결제 현황과 계정 정보</p>
        </div>
      </div>

      <SyncBanner lastSynced={lastSynced} notionUrl={process.env.NEXT_PUBLIC_NOTION_SUBSCRIBE_URL} />

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "구독 중", val: `${active.length}몜`, color: "#0052CC", bg: "#DEEBFF" },
          { label: "월 환산 (KRW)", val: `₩${Math.round(totalMonthlyKRW).toLocaleString()}`, color: "#E34234", bg: "#FFEBE6" },
          { label: "연간 총비용 (USD)", val: `$${totalAnnualUSD.toFixed(0)}`, color: "#6554C0", bg: "#EAE6FF" },
          { label: "해지됨", val: `${subs.filter(s => s.status === "구독 해지").length}개`, color: "#6B778C", bg: "#F4F5F7" },
        ].map((k) => (
          <div key={k.label} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-xs text-gray-500 mb-1">{k.label}</div>
            <div className="text-lg font-extrabold" style={{ color: k.color }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-4">
        {(["all", "구독 중", "구독 해지"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs font-medium px-3 py-1.5 rounded border transition-colors ${
              filter === f
                ? "bg-gray-800 text-white border-gray-800"
                : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
            }`}
          >
            {f === "all" ? "전체" : f}
          </button>
        ))}
      </div>

      {/* 테이블 */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-auto">
        <table className="data-table" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              {["서비스", "상태", "팀 / 사용자", "주기", "금액", "결제 방식", "다음 결제일", "노션"].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={8} className="text-center text-gray-400 py-10">데이터 없음</td></tr>
            ) : list.map((s) => {
              const next = calcNextPayment(s.startDate, s.cycle);
              const d = daysUntil(next);
              const isUrgent = d !== null && d < 30;
              return (
                <tr key={s.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{s.logo}</span>
                      <div>
                        <div className="font-semibold text-gray-900">{s.name}</div>
                        {s.version && <div className="text-xs text-gray-400">{s.version}</div>}
                      </div>
                    </div>
                  </td>
                  <td><Badge value={s.status} /></td>
                  <td>
                    <div className="font-medium text-gray-800">{s.team}</div>
                    {s.user && (
                      <div className="text-xs text-gray-400">
                        {s.user}{s.userCount > 1 ? ` 외 ${s.userCount - 1}箪��� : ""}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.cycle === "연" ? "bg-purple-50 text-purple-700" : "bg-green-50 text-green-700"}`}>
                      {s.cycle === "연" ? "연간" : "월간"}
                    </span>
                  </td>
                  <td className="font-bold text-gray-900">
                    {s.krw ? `₩${(s.krw).toLocaleString()}` : s.usd ? `$${s.usd}` : "—"}
                    {s.userCount > 1 && <span className="font-normal text-xs text-gray-400"> ×{s.userCount}</span>}
                  </td>
                  <td>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.paymentMethod.includes("개인") ? "bg-yellow-50 text-yellow-700" : "bg-green-50 text-green-700"}`}>
                      {s.paymentMethod}
                    </span>
                  </td>
                  <td>
                    <div className={`font-medium ${isUrgent ? "text-red-500" : "text-gray-800"}`}>{next}</div>
                    {d !== null && <div className={`text-xs ${isUrgent ? "text-red-400" : "text-gray-400"}`}>D-{d}</div>}
                  </td>
                  <td>
                    {s.notionUrl && (
                      <a href={s.notionUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-xs flex items-center gap-1 hover:underline">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                          <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                        보기
                      </a>
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
