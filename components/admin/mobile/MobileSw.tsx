"use client";

import { useEffect, useState, useMemo } from "react";
import type { MobileSession } from "@/app/admin/mobile/page";
import type { SwDbRecord } from "@/types";

interface Props {
  session: MobileSession;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  "사용중":   { bg: "#EFF6FF", text: "#1D4ED8" },
  "재고":     { bg: "#F0FDF4", text: "#15803D" },
  "만료":     { bg: "#F1F5F9", text: "#64748B" },
  "갱신필요": { bg: "#FFF7ED", text: "#C2410C" },
  "신규등록": { bg: "#F5F3FF", text: "#6D28D9" },
  "출고준비중": { bg: "#ECFDF5", text: "#065F46" },
  "반납예정": { bg: "#FEFCE8", text: "#A16207" },
};

const LICENSE_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  "영구":        { bg: "#F0FDF4", text: "#15803D" },
  "구독(업체)":  { bg: "#EFF6FF", text: "#1D4ED8" },
  "구독(웹)":    { bg: "#F5F3FF", text: "#6D28D9" },
};

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? { bg: "#F1F5F9", text: "#64748B" };
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
      style={{ background: c.bg, color: c.text }}>{status || "—"}</span>
  );
}

function DetailSheet({ record, onClose }: { record: SwDbRecord; onClose: () => void }) {
  const lc = LICENSE_TYPE_COLORS[record.licenseType] ?? { bg: "#F1F5F9", text: "#64748B" };
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div className="bg-white rounded-t-3xl p-5 max-h-[85dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 pr-3">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <StatusBadge status={record.status} />
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: lc.bg, color: lc.text }}>{record.licenseType}</span>
            </div>
            <div className="text-base font-extrabold text-gray-900">{record.swDetail || record.swCategory}</div>
            <div className="text-xs text-gray-500 mt-0.5">{record.swCategory}</div>
          </div>
          <button onClick={onClose} className="text-gray-400 p-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="space-y-2.5 text-sm">
          {([
            ["사용자",   record.user],
            ["법인",     record.company],
            ["부서",     record.department],
            ["버전",     record.version?.join(", ")],
            ["사용일자", record.usageDate?.slice(0, 10)],
            ["갱신일자", record.renewalDate?.slice(0, 10)],
            ["구매일자", record.purchaseDate?.slice(0, 10)],
            ["결제방식", record.billingType],
            ["계정유형", record.accountType],
          ] as [string, string][]).map(([label, val]) => val ? (
            <div key={label} className="flex items-start gap-2">
              <span className="text-gray-400 w-20 flex-shrink-0 text-xs pt-0.5">{label}</span>
              <span className="flex-1 font-medium text-gray-900 text-sm break-all">{val}</span>
            </div>
          ) : null)}
        </div>
        {record.notionUrl && (
          <a href={record.notionUrl} target="_blank" rel="noopener noreferrer"
            className="mt-4 flex items-center justify-center gap-1.5 text-xs text-gray-400 py-2">
            Notion에서 보기 ↗
          </a>
        )}
      </div>
    </div>
  );
}

export default function MobileSw({ session }: Props) {
  const [records,  setRecords]  = useState<SwDbRecord[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [filterStatus, setFilterStatus] = useState("전체");
  const [selected, setSelected] = useState<SwDbRecord | null>(null);
  const [error,    setError]    = useState("");

  const isSuper = session.role === "super";
  const companyParam = !isSuper && session.company ? `?company=${encodeURIComponent(session.company)}` : "";

  useEffect(() => {
    fetch(`/api/sw-records${companyParam}`)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.data)) setRecords(d.data);
        else if (d.error) setError(d.error);
      })
      .catch(() => setError("네트워크 오류"))
      .finally(() => setLoading(false));
  }, [companyParam]);

  const statusOptions = useMemo(() => {
    const set = new Set(records.map(r => r.status).filter(Boolean));
    return Array.from(set).sort();
  }, [records]);

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (filterStatus !== "전체" && r.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        return [r.swDetail, r.swCategory, r.user, r.company, r.department].some(v => v?.toLowerCase().includes(q));
      }
      return true;
    });
  }, [records, filterStatus, search]);

  return (
    <div className="flex flex-col h-full">
      {/* 필터 */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 space-y-2">
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="SW명 · 사용자 · 법인 검색..."
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400"
        />
        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {["전체", ...statusOptions].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors
                ${filterStatus === s ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* 목록 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading && <div className="text-center text-gray-400 text-sm py-8">로딩 중...</div>}
        {error   && <div className="text-center text-red-500 text-sm py-8">{error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-8">검색 결과가 없습니다</div>
        )}
        {filtered.map(r => (
          <button key={r.id} onClick={() => setSelected(r)}
            className="w-full bg-white rounded-2xl shadow-sm p-4 text-left active:opacity-70 transition-opacity">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <StatusBadge status={r.status} />
                  <span className="text-xs text-gray-400">{r.licenseType}</span>
                </div>
                <div className="font-bold text-gray-900 text-sm">{r.swDetail || r.swCategory || "—"}</div>
                <div className="text-xs text-gray-500 mt-0.5">{r.swCategory}</div>
                <div className="text-xs text-gray-400 mt-0.5">{r.user || "미배정"} · {r.company}</div>
              </div>
              {r.renewalDate && (
                <div className="text-right flex-shrink-0">
                  <div className="text-[10px] text-gray-400">갱신일</div>
                  <div className="text-xs text-gray-600 font-medium">{r.renewalDate.slice(0, 10)}</div>
                </div>
              )}
            </div>
          </button>
        ))}
        <div className="text-center text-xs text-gray-300 py-2">{filtered.length}건 / 전체 {records.length}건</div>
      </div>

      {selected && <DetailSheet record={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
