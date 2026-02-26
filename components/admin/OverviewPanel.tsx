"use client";

import { useEffect, useState } from "react";
import type { SwItem, Ticket, Subscription } from "@/types";
import { ProgressBar } from "@/components/ui/ProgressBar";

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function OverviewPanel() {
  const [swDb, setSwDb] = useState<SwItem[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/sw-db").then(r => r.json()),
      fetch("/api/tickets").then(r => r.json()),
      fetch("/api/subscriptions").then(r => r.json()),
    ]).then(([sw, tk, sub]) => {
      setSwDb(sw.data ?? []);
      setTickets(tk.data ?? []);
      setSubs(sub.data ?? []);
    }).finally(() => setLoading(false));
  }, []);

  const approved = swDb.filter(s => s.status === "approved").length;
  const saturated = swDb.filter(s => s.totalLicenses < 999 && s.usedLicenses / s.totalLicenses >= 0.9).length;
  const pending = tickets.filter(t => t.status !== "완료").length;
  const activeSubs = subs.filter(s => s.status === "구독 중").length;

  const kpis = [
    { label: "관리 소프트웨어", val: `${swDb.length}종`, sub: `승인 ${approved}종`, color: "#0052CC", bg: "#EBF0FF" },
    { label: "라이선스 포화 경고", val: `${saturated}종`, sub: "90% 이상 사용 중", color: "#FF991F", bg: "#FFFAE6" },
    { label: "미처리 티켓", val: `${pending}건`, sub: "전체 티켓 기준", color: "#6554C0", bg: "#EAE6FF" },
    { label: "구독 중인 SW", val: `${activeSubs}개`, sub: "구독 관리 DB 기준", color: "#00875A", bg: "#E3FCEF" },
  ];

  // 만료 임박 (30일 이내)
  const expiringSoon = swDb
    .filter(s => s.totalLicenses > 0)
    .flatMap(s => []) as { name: string; days: number }[];

  if (loading) return <div className="text-center py-20 text-gray-400">노션 데이터 로딩 중...</div>;

  return (
    <div className="fade-in">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-gray-900 mb-0.5">대시보드</h2>
        <p className="text-sm text-gray-500">전사 소프트웨어 자산 현황 (실시간 Notion 연동)</p>
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white border border-gray-200 rounded-lg p-4" style={{ borderLeft: `3px solid ${k.color}` }}>
            <div className="text-2xl font-extrabold mb-1" style={{ color: k.color }}>{k.val}</div>
            <div className="text-sm font-semibold text-gray-800 mb-0.5">{k.label}</div>
            <div className="text-xs text-gray-500">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* 라이선스 사용률 */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="font-bold text-sm text-gray-900 mb-4">주요 라이선스 사용률</div>
          {swDb.filter(s => s.totalLicenses > 0 && s.totalLicenses < 999).length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-6">라이선스 데이터 없음</div>
          ) : (
            <div className="flex flex-col gap-3">
              {swDb.filter(s => s.totalLicenses > 0 && s.totalLicenses < 999).map(s => {
                const pct = Math.round((s.usedLicenses / s.totalLicenses) * 100);
                return (
                  <div key={s.id}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-medium text-gray-800 truncate max-w-40">{s.name}</span>
                      <span className="text-xs font-semibold ml-2" style={{ color: pct >= 90 ? "#DE350B" : pct >= 75 ? "#FF991F" : "#0052CC" }}>
                        {pct}%
                      </span>
                    </div>
                    <ProgressBar value={pct} height={5} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 최근 티켓 */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="font-bold text-sm text-gray-900 mb-4">최근 미처리 티켓</div>
          {tickets.filter(t => t.status !== "완료").length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-6">미처리 티켓 없음 ✓</div>
          ) : (
            <div className="flex flex-col gap-2">
              {tickets.filter(t => t.status !== "완료").slice(0, 6).map(t => (
                <div key={t.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${t.priority === "높음" ? "bg-red-500" : t.priority === "중간" ? "bg-yellow-500" : "bg-gray-400"}`} />
                  <div className="flex-1 overflow-hidden">
                    <div className="text-xs font-medium text-gray-900 truncate">{t.title}</div>
                    <div className="text-xs text-gray-400">{t.requester} · {t.createdAt}</div>
                  </div>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded shrink-0 ${
                    t.status === "처리중" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"
                  }`}>{t.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 구독 결제 임박 */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="font-bold text-sm text-gray-900 mb-4">결제 임박 구독 (30일 이내)</div>
        {(() => {
          const urgent = subs.filter(s => {
            if (s.status !== "구독 중" || !s.startDate) return false;
            const d = new Date(s.startDate);
            const now = new Date();
            if (s.cycle === "월") {
              while (d <= now) d.setMonth(d.getMonth() + 1);
            } else {
              while (d <= now) d.setFullYear(d.getFullYear() + 1);
            }
            const diff = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            return diff <= 30;
          });
          if (urgent.length === 0)
            return <div className="text-sm text-gray-400 text-center py-4">30일 이내 결제 임박 없음</div>;
          return (
            <div className="flex flex-col gap-2">
              {urgent.map(s => {
                const d = new Date(s.startDate);
                const now = new Date();
                if (s.cycle === "월") {
                  while (d <= now) d.setMonth(d.getMonth() + 1);
                } else {
                  while (d <= now) d.setFullYear(d.getFullYear() + 1);
                }
                const days = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg bg-red-50 border border-red-100">
                    <span className="text-xl">{s.logo}</span>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-gray-900">{s.name}</div>
                      <div className="text-xs text-gray-500">{s.team}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-red-600">D-{days}</div>
                      <div className="text-xs text-gray-500">{s.krw ? `₩${s.krw.toLocaleString()}` : `$${s.usd}`}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
