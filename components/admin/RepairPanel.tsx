"use client";

import { useEffect, useState } from "react";
import type { RepairTicket } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { SyncBanner } from "@/components/ui/SyncBanner";

type StatusFilter = "all" | "시작 전" | "진행 중" | "완료" | "이관" | "기타";

const STATUS_COLORS: Record<string, string> = {
  "시작 전": "text-gray-700",
  "진행 중": "text-orange-600",
  "완료":   "text-green-600",
  "이관":   "text-blue-600",
  "기타":   "text-purple-600",
};

const PRIORITY_LABEL: Record<string, string> = {
  "매우 급합니다.":   "높음",
  "조금 급합니다.":   "중간",
  "기다릴 수 있어요.": "낮음",
};

export default function RepairPanel() {
  const [tickets, setTickets] = useState<RepairTicket[]>([]);
  const [lastSynced, setLastSynced] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("all");

  const load = () => {
    setLoading(true);
    fetch("/api/repair-tickets")
      .then((r) => r.json())
      .then((res) => {
        setTickets(res.data ?? []);
        setLastSynced(res.lastSynced ?? "");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const list = filter === "all" ? tickets : tickets.filter((t) => t.status === filter);

  if (loading) return <div className="text-center py-20 text-gray-400">노션에서 불러오는 중...</div>;

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-0.5">수리 접수 현황</h2>
          <p className="text-sm text-gray-500">IT 기기 수리 접수 및 처리 현황</p>
        </div>
        <button onClick={load} className="text-xs font-medium px-3 py-1.5 rounded border bg-white text-gray-600 border-gray-300 hover:border-gray-400 flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
          </svg>
          새로고침
        </button>
      </div>

      <SyncBanner lastSynced={lastSynced} />

      {/* 상태 요약 */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {(["시작 전", "진행 중", "완료", "이관", "기타"] as const).map((s) => {
          const cnt = tickets.filter((t) => t.status === s).length;
          return (
            <div key={s} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className={`text-2xl font-extrabold mb-1 ${STATUS_COLORS[s]}`}>{cnt}</div>
              <div className="text-sm font-medium text-gray-600">{s}</div>
            </div>
          );
        })}
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(["all", "시작 전", "진행 중", "완료", "이관", "기타"] as const).map((f) => (
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
        <table className="data-table">
          <thead>
            <tr>
              {["티켓", "고장증상", "고장내역", "법인", "자산번호", "긴급도", "상태", "문의자", "담당자", "수리일정", "동의서", "노션"].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={12} className="text-center text-gray-400 py-10">데이터 없음</td></tr>
            ) : list.map((t) => (
              <tr key={t.id}>
                <td className="text-xs text-gray-400 font-mono">{t.ticketNumber || "—"}</td>
                <td className="font-medium text-gray-900 max-w-xs">
                  <div className="truncate" title={t.title}>{t.title}</div>
                  {t.actionNote && (
                    <div className="text-xs text-gray-400 truncate mt-0.5" title={t.actionNote}>{t.actionNote}</div>
                  )}
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {t.faultTypes.map((f) => (
                      <span key={f} className="text-xs bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded font-medium">{f}</span>
                    ))}
                  </div>
                </td>
                <td className="text-sm text-gray-600">{t.company || "—"}</td>
                <td className="text-sm text-gray-500 font-mono">{t.assetId || "—"}</td>
                <td>
                  <Badge value={PRIORITY_LABEL[t.priority] ?? t.priority} />
                </td>
                <td><Badge value={t.status} /></td>
                <td className="text-sm text-gray-600">{t.requester || "—"}</td>
                <td className="text-sm text-gray-500">{t.assignee || "—"}</td>
                <td className="text-sm text-gray-500">{t.repairDate || "—"}</td>
                <td>
                  {t.consentGiven
                    ? <span className="text-green-600 text-xs font-medium">✓</span>
                    : <span className="text-gray-300 text-xs">—</span>
                  }
                </td>
                <td>
                  {t.notionUrl && (
                    <a href={t.notionUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-xs flex items-center gap-1 hover:underline">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                        <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
                      보기
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
