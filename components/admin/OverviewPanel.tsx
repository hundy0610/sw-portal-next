"use client";
import { useEffect, useState } from "react";

interface SwItem {
  id: string;
  name: string;
  category?: string;
  status: string;
  totalLicenses?: number;
  usedLicenses?: number;
}

interface SubItem {
  id: string;
  name: string;
  status: string;
  team?: string;
  user?: string;
  userCount?: number;
  krw?: number;
  usd?: number;
  cycle?: string;
  nextPayment?: string;
}

export default function OverviewPanel() {
  const [swList, setSwList]   = useState<SwItem[]>([]);
  const [subs, setSubs]       = useState<SubItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/sw-db").then((r) => r.json()),
      fetch("/api/subscriptions").then((r) => r.json()),
    ])
      .then(([sw, sub]) => {
        setSwList(Array.isArray(sw)  ? sw  : []);
        setSubs(Array.isArray(sub) ? sub : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        데이터 불러오는 중...
      </div>
    );
  }

  const activeSubs   = subs.filter((s) => s.status === "구독 중");
  const licenseItems = swList.filter((s) => (s.totalLicenses ?? 0) > 0);
  const warningItems = licenseItems.filter(
    (s) => (s.totalLicenses ?? 0) > 0 && (s.usedLicenses ?? 0) / (s.totalLicenses ?? 1) >= 0.8
  );

  const totalMonthlyKRW = activeSubs.reduce((acc, s) => {
    const krw = s.krw ?? (s.usd ? Math.round(s.usd * 1350) : 0);
    return acc + (s.cycle === "연" ? Math.round(krw / 12) : krw);
  }, 0);

  const today = new Date();
  const urgentSubs = activeSubs.filter((s) => {
    if (!s.nextPayment) return false;
    const diff = (new Date(s.nextPayment).getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  });

  const kpis = [
    { icon: "🗄",  label: "관리 SW 총 수",      value: swList.length,                  unit: "개",  color: "blue"   },
    { icon: "⚠️", label: "라이선스 포화 경고",   value: warningItems.length,            unit: "개",  color: "red"    },
    { icon: "💳", label: "구독 중인 SW",          value: activeSubs.length,              unit: "개",  color: "green"  },
    { icon: "💰", label: "월 구독 비용 (추산)",   value: totalMonthlyKRW.toLocaleString(), unit: "원", color: "purple" },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-2xl mb-2">{k.icon}</div>
            <p className="text-xs text-gray-500 mb-1">{k.label}</p>
            <p className="text-2xl font-bold text-gray-900">
              {k.value}
              <span className="text-sm font-normal text-gray-500 ml-1">{k.unit}</span>
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 라이선스 재고 현황 */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <span>🔑</span>
            <h3 className="font-semibold text-gray-900">라이선스 재고 현황</h3>
          </div>
          <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
            {licenseItems.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-gray-400">라이선스 정보 없음</p>
            ) : (
              licenseItems.map((s) => {
                const used  = s.usedLicenses ?? 0;
                const total = s.totalLicenses ?? 0;
                const ratio = total > 0 ? used / total : 0;
                const remaining = total - used;
                const isWarning = ratio >= 0.8;
                return (
                  <div key={s.id} className="px-5 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-800">{s.name}</span>
                      <span className={`text-xs font-medium ${isWarning ? "text-red-600" : "text-gray-500"}`}>
                        {used} / {total}석
                        {isWarning && " ⚠️"}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          isWarning ? "bg-red-500" : ratio >= 0.5 ? "bg-yellow-400" : "bg-green-400"
                        }`}
                        style={{ width: `${Math.min(ratio * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">잔여 {remaining}석</p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 실제 사용 현황 */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <span>👥</span>
            <h3 className="font-semibold text-gray-900">실제 사용 현황 (팀별 구독)</h3>
          </div>
          <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
            {activeSubs.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-gray-400">구독 중인 SW 없음</p>
            ) : (
              activeSubs.map((s) => (
                <div key={s.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{s.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {s.team && <span className="mr-2">🏢 {s.team}</span>}
                      {s.user && <span>👤 {s.user}</span>}
                    </p>
                  </div>
                  {s.userCount != null && (
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                      {s.userCount}명
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 결제 임박 */}
      {urgentSubs.length > 0 && (
        <div className="bg-white rounded-xl border border-orange-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-orange-100 flex items-center gap-2 bg-orange-50">
            <span>🔔</span>
            <h3 className="font-semibold text-orange-900">결제 임박 구독 (30일 이내)</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {urgentSubs.map((s) => {
              const krw = s.krw ?? (s.usd ? Math.round(s.usd * 1350) : 0);
              const diff = Math.round(
                (new Date(s.nextPayment!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
              );
              return (
                <div key={s.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{s.name}</p>
                    <p className="text-xs text-gray-500">
                      {s.nextPayment} ({diff}일 후)
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-orange-700">
                    {krw > 0 ? `₩${krw.toLocaleString()}` : "-"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 포털 관리 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <span>🛠</span>
          <h3 className="font-semibold text-gray-900">포털 관리</h3>
        </div>
        <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: "🗄",  label: "SW DB 편집",     href: "https://notion.so", desc: "승인/금지 목록" },
            { icon: "💳", label: "구독 관리",         href: "https://notion.so", desc: "구독 SW 목록"   },
            { icon: "🔑", label: "라이선스 관리",     href: "https://notion.so", desc: "시트 현황"       },
            { icon: "📋", label: "티켓 처리 (Notion)", href: "https://notion.so", desc: "요청 처리"       },
          ].map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1 p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-center"
            >
              <span className="text-2xl">{link.icon}</span>
              <p className="text-xs font-medium text-gray-800">{link.label}</p>
              <p className="text-xs text-gray-400">{link.desc}</p>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
