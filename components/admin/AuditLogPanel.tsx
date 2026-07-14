"use client";

import { useEffect, useState } from "react";
import type { AuditLog } from "@/lib/portal-store";
import { safeJson } from "@/lib/fetch-json";

const ACTION_STYLE: Record<AuditLog["action"], { label: string; bg: string; text: string }> = {
  create: { label: "등록", bg: "bg-emerald-100", text: "text-emerald-700" },
  update: { label: "수정", bg: "bg-amber-100",   text: "text-amber-700" },
  delete: { label: "삭제", bg: "bg-red-100",     text: "text-red-700" },
  "bulk-update": { label: "일괄수정", bg: "bg-blue-100", text: "text-blue-700" },
};

const TARGET_LABEL: Record<AuditLog["target"], string> = {
  notices: "공지사항", courses: "교육과정", swdb: "SW 검색", swresources: "SW 자료실", manuals: "매뉴얼",
  exchangeReturn: "자산 흐름", hw: "노트북/데스크탑", hwRepair: "수리/과실청구",
  rentalHw: "임대노트북", credentials: "계정 관리", repairTicket: "모니터 수리",
  meetingRental: "회의실 대여", meetingEquipment: "회의실 장비", contract: "계약",
  account: "계정 권한",
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AuditLogPanel() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/audit-log")
      .then(r => safeJson(r))
      .then(res => setLogs(res?.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="fade-in">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-gray-900 mb-0.5">감사 로그</h2>
        <p className="text-sm text-gray-500">관리자의 admin 페이지 변경 이력 (최근 {logs.length}건)</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">불러오는 중...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-xl text-gray-400 text-sm">
          아직 기록된 활동이 없습니다.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {["일시", "관리자", "액션", "대상", "항목", "상세"].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map(log => {
                const as = ACTION_STYLE[log.action];
                return (
                  <tr key={log.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatTime(log.timestamp)}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-gray-900">{log.adminName}</span>
                      <span className="text-gray-400 ml-1">({log.adminId})</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full font-semibold ${as.bg} ${as.text}`}>{as.label}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{TARGET_LABEL[log.target]}</td>
                    <td className="px-4 py-3 text-gray-700 max-w-[220px] truncate">{log.itemTitle}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-[280px] truncate">{log.detail ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
