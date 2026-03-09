"use client";

import { useEffect, useState } from "react";
import type { SwItem, SwDbRecord } from "@/types";
import { ProgressBar } from "@/components/ui/ProgressBar";

export default function OverviewPanel() {
  const [swDb,    setSwDb]    = useState<SwItem[]>([]);
  const [swRecs,  setSwRecs]  = useState<SwDbRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/sw-db").then(r => r.json()),
      fetch("/api/sw-records").then(r => r.json()),
    ]).then(([sw, recs]) => {
      setSwDb(sw.data ?? []);
      setSwRecs(recs.data ?? []);
    }).finally(() => setLoading(false));
  }, []);

  const approved  = swDb.filter(s => s.status === "approved").length;
  const banned    = swDb.filter(s => s.status === "banned").length;

  // 구독 레코드 (구독(업체) + 구독(웹))
  const subRecs    = swRecs.filter(r => r.licenseType === "구독(업체)" || r.licenseType === "구독(웹)");
  const activeSubs = subRecs.filter(r => r.status === "사용중" || r.status === "신규등록").length;

  // 갱신 임박 (30일)
  const renewingSoon = swRecs.filter(r => {
    if (!r.renewalDate) return false;
    const d = Math.ceil((new Date(r.renewalDate).getTime() - Date.now()) / 86400000);
    return d >= 0 && d <= 30;
  }).length;

  const kpis = [
    {
      label: "전체 SW 레코드",
      val: `${swRecs.length}건`,
      sub: `영구 ${swRecs.filter(r => r.licenseType === "영구").length} · 구독 ${subRecs.length}`,
      color: "#0052CC", bg: "#EBF0FF",
    },
    {
      label: "구독 중인 SW",
      val: `${activeSubs}개`,
      sub: "SW 데이터베이스 기준",
      color: "#00875A", bg: "#E3FCEF",
    },
    {
      label: "갱신 임박 (30일)",
      val: `${renewingSoon}건`,
      sub: "갱신 필요일 기준",
      color: renewingSoon > 0 ? "#DE350B" : "#6B778C",
      bg: renewingSoon > 0 ? "#FFEBE6" : "#F4F5F7",
    },
    {
      label: "SW DB 관리",
      val: `${swDb.length}종`,
      sub: `승인 ${approved} · 금지 ${banned}`,
      color: "#6554C0", bg: "#EAE6FF",
    },
  ];

  if (loading) return <div className="text-center py-20 text-gray-400">노션 데이터 로딩 중...</div>;

  return (
    <div className="fade-in">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-gray-900 mb-0.5">관리자 대시보드</h2>
        <p className="text-sm text-gray-500">전사 소프트웨어 자산 현황 (실시간 Notion 연동)</p>
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="bg-white border border-gray-200 rounded-lg p-4"
            style={{ borderLeft: `3px solid ${k.color}` }}
          >
            <div className="text-2xl font-extrabold mb-1" style={{ color: k.color }}>{k.val}</div>
            <div className="text-sm font-semibold text-gray-800 mb-0.5">{k.label}</div>
            <div className="text-xs text-gray-500">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

        {/* ── SW 상태별 현황 ── */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="font-bold text-sm text-gray-900 mb-4">🗂 SW 상태별 현황</div>
          {swRecs.length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-6">데이터 없음</div>
          ) : (() => {
            const groups = [
              { label: "사용중",   color: "bg-blue-500",   count: swRecs.filter(r => r.status === "사용중").length },
              { label: "재고",     color: "bg-green-500",  count: swRecs.filter(r => r.status === "재고").length },
              { label: "갱신필요", color: "bg-red-500",    count: swRecs.filter(r => r.status === "갱신필요").length },
              { label: "만료",     color: "bg-gray-400",   count: swRecs.filter(r => r.status === "만료").length },
              { label: "반납예정", color: "bg-yellow-400", count: swRecs.filter(r => r.status === "반납예정").length },
              { label: "기타",     color: "bg-gray-300",   count: swRecs.filter(r => !["사용중","재고","갱신필요","만료","반납예정"].includes(r.status)).length },
            ];
            const total = swRecs.length;
            return (
              <div className="flex flex-col gap-3">
                {groups.filter(g => g.count > 0).map(g => {
                  const pct = Math.round((g.count / total) * 100);
                  return (
                    <div key={g.label}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-medium text-gray-800">{g.label}</span>
                        <span className="text-xs text-gray-400">{g.count}건 ({pct}%)</span>
                      </div>
                      <ProgressBar value={pct} height={5} />
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* ── 구독 현황 ── */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="font-bold text-sm text-gray-900 mb-4">💳 구독 SW 현황</div>
          {subRecs.length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-6">구독 데이터 없음</div>
          ) : (
            <div className="flex flex-col gap-1.5 overflow-y-auto" style={{ maxHeight: 280 }}>
              {subRecs
                .filter(r => r.status === "사용중" || r.status === "신규등록")
                .map(r => (
                  <div key={r.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50">
                    <span className="text-lg shrink-0">📦</span>
                    <div className="flex-1 overflow-hidden">
                      <div className="text-xs font-semibold text-gray-900 truncate">
                        {r.swCategory}{r.swDetail ? ` · ${r.swDetail}` : ""}
                      </div>
                      <div className="text-xs text-gray-400 truncate">
                        {r.department || "—"} · {r.user || "—"}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-gray-400">{r.licenseType}</div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 갱신 임박 ── */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-4">
        <div className="font-bold text-sm text-gray-900 mb-4">⏰ 갱신 임박 (30일 이내)</div>
        {(() => {
          const urgent = swRecs.filter(r => {
            if (!r.renewalDate) return false;
            const d = Math.ceil((new Date(r.renewalDate).getTime() - Date.now()) / 86400000);
            return d >= 0 && d <= 30;
          });

          if (urgent.length === 0)
            return <div className="text-sm text-gray-400 text-center py-4">30일 이내 갱신 임박 없음 ✓</div>;

          return (
            <div className="flex flex-col gap-2">
              {urgent.map(r => {
                const days = Math.ceil((new Date(r.renewalDate).getTime() - Date.now()) / 86400000);
                return (
                  <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-100">
                    <span className="text-xl shrink-0">
                      {r.licenseType === "영구" ? "🔑" : "💳"}
                    </span>
                    <div className="flex-1 overflow-hidden">
                      <div className="text-sm font-semibold text-gray-900">
                        {r.swCategory}{r.swDetail ? ` · ${r.swDetail}` : ""}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {r.department || "—"} · {r.user || "—"} · {r.licenseType}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-red-600">D-{days}</div>
                      <div className="text-xs text-gray-500">{r.renewalDate.slice(0, 10)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* ── 포털 관리 빠른 링크 ── */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="font-bold text-sm text-gray-900 mb-1">⚙️ 포털 관리</div>
        <p className="text-xs text-gray-400 mb-4">Notion에서 직접 데이터를 편집할 수 있습니다.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: "SW DB 편집",
              icon: "🗄",
              url: process.env.NEXT_PUBLIC_NOTION_TRACKER_URL || "#",
              desc: "화이트/블랙리스트",
              color: "hover:border-blue-300 hover:bg-blue-50",
            },
            {
              label: "SW 데이터베이스",
              icon: "📋",
              url: process.env.NEXT_PUBLIC_NOTION_SW_UNIFIED_URL || "#",
              desc: "라이선스/구독 통합편집",
              color: "hover:border-green-300 hover:bg-green-50",
            },
            {
              label: "라이선스 현황",
              icon: "🔑",
              url: process.env.NEXT_PUBLIC_NOTION_SW_UNIFIED_URL || "#",
              desc: "라이선스 추가/수정",
              color: "hover:border-yellow-300 hover:bg-yellow-50",
            },
            {
              label: "티켓 처리",
              icon: "🎫",
              url: "#",
              desc: "Notion에서 처리",
              color: "hover:border-purple-300 hover:bg-purple-50",
            },
          ].map((link) => (
            <a
              key={link.label}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 transition-all text-center ${link.color}`}
            >
              <span className="text-2xl">{link.icon}</span>
              <div className="text-xs font-semibold text-gray-800">{link.label}</div>
              <div className="text-xs text-gray-400">{link.desc}</div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
