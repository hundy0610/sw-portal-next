"use client";

import { useEffect, useState } from "react";
import type { Ticket } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { SyncBanner } from "@/components/ui/SyncBanner";

export default function TicketPanel() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [lastSynced, setLastSynced] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "접수" | "처리중" | "완료">("all");

  const load = () => {
    setLoading(true);
    fetch("/api/tickets")
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
          <h2 className="text-xl font-bold text-gray-900 mb-0.5">티켓 관리</h2>
          <p className="text-sm text-gray-500">IT 지원 요청 접수 및 처리 현황</p>
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
      <div className="grid grid-cols-3 gap-3 mb-6">
        {(["접수","처리중","완료"] as const).map((s) => {
          const cnt = tickets.filter((t) => t.status === s).length;
          const colors: Record<string, string> = { "접수": "text-gray-700", "처리중": "text-blue-600", "완료": "text-green-600" };
          return (
            <div key={s} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className={`text-2xl font-extrabold mb-1 ${colors[s]}`}>{cnt}</div>
              <div className="text-sm font-medium text-gray-600">{s}</div>
            </div>
          );
        })}
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-4">
        {(["all","접수","처리중","완료"] as const).map((f) => (
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
              {["제목", "카테고리", "우선순위", "상태", "요청자", "담당자", "접수일", "노션"].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={8} className="text-center text-gray-400 py-10">데이터 없음</td></tr>
            ) : list.map((t) => (
              <tr key={t.id}>
                <td className="font-medium text-gray-900 max-w-xs">
                  <div className="truncate" title={t.title}>{t.title}</div>
                  {t.description && (
                    <div className="text-xs text-gray-400 truncate mt-0.5">{t.description}</div>
                  )}
                </td>
                <td><span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">{t.category}</span></td>
                <td><Badge value={t.priority} /></td>
                <td><Badge value={t.status} /></td>
                <td className="text-sm text-gray-600">{t.requester}</td>
                <td className="text-sm text-gray-500">{t.assignee || "—"}</td>
                <td className="text-sm text-gray-500">{t.createdAt}</td>
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
