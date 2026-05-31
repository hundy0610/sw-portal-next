"use client";

import { useEffect, useState } from "react";
import type { MobileSession } from "@/app/admin/mobile/page";
import type { HwStats } from "@/lib/hw";

interface Props {
  session: MobileSession;
  onNavigate: (tab: string) => void;
}

interface DashData {
  hwStats: HwStats | null;
  exchangeActive: number;
  helpdeskOpen: number;
  repairOpen: number;
}

const STAGE_COLORS: Record<string, string> = {
  "교체요청": "#94A3B8",
  "요청기안": "#3B82F6",
  "기기준비": "#8B5CF6",
  "기기준비완료": "#10B981",
  "사용자수령": "#F97316",
  "반납요청": "#EAB308",
  "반납완료": "#22C55E",
};

function StatCard({ label, value, sub, color, onClick }: {
  label: string; value: number | string; sub?: string; color: string; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 bg-white rounded-2xl p-4 text-left shadow-sm active:opacity-70 transition-opacity ${onClick ? "cursor-pointer" : "cursor-default"}`}
    >
      <div className="text-2xl font-extrabold" style={{ color }}>{value.toLocaleString()}</div>
      <div className="text-xs font-semibold text-gray-700 mt-1">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </button>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{children}</div>;
}

export default function MobileDashboard({ session, onNavigate }: Props) {
  const [data, setData] = useState<DashData>({ hwStats: null, exchangeActive: 0, helpdeskOpen: 0, repairOpen: 0 });
  const [loading, setLoading] = useState(true);
  const isSuper = session.role === "super";
  const companyParam = !isSuper && session.company ? `?company=${encodeURIComponent(session.company)}` : "";

  useEffect(() => {
    const fetches = [
      fetch(`/api/hw/stats${companyParam}`).then(r => r.json()).catch(() => null),
      isSuper ? fetch("/api/exchange-return").then(r => r.json()).catch(() => null) : Promise.resolve(null),
      fetch(`/api/helpdesk${companyParam}`).then(r => r.json()).catch(() => null),
      fetch(`/api/repair-tickets${companyParam}`).then(r => r.json()).catch(() => null),
    ];

    Promise.all(fetches).then(([hwRes, erRes, hdRes, repRes]) => {
      const hwStats = hwRes?.ok ? hwRes.stats : null;
      const exchangeActive = Array.isArray(erRes?.data)
        ? (erRes.data as { stage: string; isClosed: boolean }[]).filter(r => !r.isClosed && r.stage !== "반납완료").length
        : 0;
      const helpdeskOpen = Array.isArray(hdRes?.data)
        ? (hdRes.data as { status: string }[]).filter(t => t.status !== "완료").length
        : 0;
      const repairOpen = Array.isArray(repRes?.data)
        ? (repRes.data as { status: string }[]).filter(t => t.status !== "완료").length
        : 0;
      setData({ hwStats, exchangeActive, helpdeskOpen, repairOpen });
      setLoading(false);
    });
  }, [companyParam, isSuper]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="text-gray-400 text-sm">데이터 로딩 중...</div>
      </div>
    );
  }

  const hw = data.hwStats;

  return (
    <div className="p-4 space-y-5">
      {/* HW 자산 요약 */}
      <div>
        <SectionTitle>HW 자산 현황</SectionTitle>
        <div className="flex gap-3">
          <StatCard label="전체" value={hw?.total ?? 0} color="#1C2B4A" onClick={() => onNavigate("hw")} />
          <StatCard label="사용 중" value={hw?.activeCount ?? 0} color="#2563EB" onClick={() => onNavigate("hw")} />
          <StatCard label="재고" value={hw?.stockCount ?? 0} color="#059669" onClick={() => onNavigate("hw")} />
        </div>
        <div className="flex gap-3 mt-3">
          <StatCard label="반납 대기" value={hw?.returnCount ?? 0} color="#D97706" onClick={() => onNavigate("hw")} />
          <StatCard label="수리" value={hw?.repairCount ?? 0} color="#DC2626" onClick={() => onNavigate("hw")} />
          <StatCard label="폐기" value={hw?.disposalCount ?? 0} color="#9CA3AF" />
        </div>
      </div>

      {/* 법인별 현황 (상위 5개) */}
      {hw && hw.companyTable.length > 0 && (
        <div>
          <SectionTitle>법인별 현황</SectionTitle>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {hw.companyTable.slice(0, 5).map((row, i) => (
              <div key={row.company} className={`flex items-center px-4 py-3 ${i > 0 ? "border-t border-gray-100" : ""}`}>
                <div className="flex-1 text-sm font-medium text-gray-900 truncate">{row.company}</div>
                <div className="flex gap-3 text-xs">
                  <span className="text-gray-400">전체 <strong className="text-gray-700">{row.total}</strong></span>
                  <span className="text-blue-500">사용 <strong>{row.active}</strong></span>
                  <span className="text-green-500">재고 <strong>{row.stock}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 진행 중인 업무 */}
      <div>
        <SectionTitle>진행 중인 업무</SectionTitle>
        <div className="space-y-2">
          {isSuper && (
            <button onClick={() => onNavigate("exchange-return")}
              className="w-full bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4 active:opacity-70 transition-opacity">
              <span className="text-2xl">📲</span>
              <div className="flex-1 text-left">
                <div className="font-semibold text-gray-900 text-sm">자산흐름 관리</div>
                <div className="text-xs text-gray-400 mt-0.5">교체·반납 진행 중</div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-lg font-extrabold text-orange-500">{data.exchangeActive}</span>
                <span className="text-xs text-gray-400">진행 중</span>
              </div>
            </button>
          )}

          <button onClick={() => onNavigate("helpdesk")}
            className="w-full bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4 active:opacity-70 transition-opacity">
            <span className="text-2xl">🎫</span>
            <div className="flex-1 text-left">
              <div className="font-semibold text-gray-900 text-sm">헬프데스크</div>
              <div className="text-xs text-gray-400 mt-0.5">미완료 문의</div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-lg font-extrabold text-blue-500">{data.helpdeskOpen}</span>
              <span className="text-xs text-gray-400">미완료</span>
            </div>
          </button>

          <button onClick={() => onNavigate("helpdesk")}
            className="w-full bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4 active:opacity-70 transition-opacity">
            <span className="text-2xl">🔧</span>
            <div className="flex-1 text-left">
              <div className="font-semibold text-gray-900 text-sm">수리 접수</div>
              <div className="text-xs text-gray-400 mt-0.5">처리 대기</div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-lg font-extrabold text-purple-500">{data.repairOpen}</span>
              <span className="text-xs text-gray-400">진행 중</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
