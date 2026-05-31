"use client";

import { useEffect, useState, useMemo } from "react";
import type { MobileSession } from "@/app/admin/mobile/page";
import type { HwRecord } from "@/lib/hw";

interface Props {
  session: MobileSession;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  "사용":     { bg: "#EFF6FF", text: "#1D4ED8" },
  "재고":     { bg: "#F0FDF4", text: "#15803D" },
  "출고":     { bg: "#FFF7ED", text: "#C2410C" },
  "수리":     { bg: "#FEF3C7", text: "#92400E" },
  "반납":     { bg: "#F3F4F6", text: "#374151" },
  "폐기":     { bg: "#FEF2F2", text: "#991B1B" },
};

function statusColor(status: string) {
  for (const [key, val] of Object.entries(STATUS_COLORS)) {
    if (status.includes(key)) return val;
  }
  return { bg: "#F9FAFB", text: "#6B7280" };
}

function StatusBadge({ status }: { status: string }) {
  const c = statusColor(status);
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
      style={{ background: c.bg, color: c.text }}>
      {status || "—"}
    </span>
  );
}

function fmtDate(iso: string) {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-gray-400 w-20 flex-shrink-0 text-xs pt-0.5">{label}</span>
      <span className="flex-1 text-sm font-medium text-gray-900 break-all">{value || "—"}</span>
    </div>
  );
}

function DetailSheet({ record, onClose }: { record: HwRecord; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div className="bg-white rounded-t-3xl p-5 max-h-[85dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge status={record.status} />
              <span className="text-xs text-gray-400">{record.company}</span>
            </div>
            <div className="text-xl font-extrabold text-gray-900">{record.user || "미지정"}</div>
            <div className="text-sm text-gray-500 mt-0.5">{record.model || "—"}</div>
          </div>
          <button onClick={onClose} className="text-gray-400 p-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="space-y-2.5">
          <InfoRow label="자산번호" value={record.assetNo} />
          <InfoRow label="시리얼"   value={record.serial} />
          <InfoRow label="제조사"   value={record.maker} />
          <InfoRow label="CPU"      value={record.cpu} />
          <InfoRow label="RAM"      value={record.ram} />
          <InfoRow label="부서"     value={record.dept} />
          <InfoRow label="위치"     value={record.location} />
          <InfoRow label="사용일자" value={fmtDate(record.useDate)} />
          <InfoRow label="구매일자" value={fmtDate(record.purchaseDate)} />
          <InfoRow label="반납예정" value={fmtDate(record.returnDue)} />
          <InfoRow label="결재문서" value={record.docNo} />
          {record.note && <InfoRow label="기타" value={record.note} />}
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

// ── 드롭다운 컴포넌트 ─────────────────────────────────────────
function Select({ value, onChange, options, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <div className="relative flex-1">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 font-medium focus:outline-none focus:border-blue-400 pr-8"
      >
        {options.map(o => (
          <option key={o} value={o}>{o === "전체" ? placeholder : o}</option>
        ))}
      </select>
      <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400"
        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </div>
  );
}

export default function MobileHw({ session }: Props) {
  const [records,       setRecords]       = useState<HwRecord[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState("");
  const [filterStatus,  setFilterStatus]  = useState("재고");   // 재고현황 기본
  const [filterCompany, setFilterCompany] = useState("전체");
  const [selected,      setSelected]      = useState<HwRecord | null>(null);
  const [error,         setError]         = useState("");

  const isSuper = session.role === "super";
  const companyParam = !isSuper && session.company ? `?company=${encodeURIComponent(session.company)}` : "";

  useEffect(() => {
    fetch(`/api/hw${companyParam}`)
      .then(r => r.json())
      .then(data => {
        if (data.ok) setRecords(data.records ?? []);
        else setError(data.error ?? "오류");
      })
      .catch(() => setError("네트워크 오류"))
      .finally(() => setLoading(false));
  }, [companyParam]);

  const statusOptions = useMemo(() => {
    const set = new Set(records.map(r => r.status).filter(Boolean));
    return ["전체", ...Array.from(set).sort()];
  }, [records]);

  const companyOptions = useMemo(() => {
    if (!isSuper) return [];
    const set = new Set(records.map(r => r.company).filter(Boolean));
    return ["전체", ...Array.from(set).sort()];
  }, [records, isSuper]);

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (filterStatus  !== "전체" && r.status  !== filterStatus)  return false;
      if (filterCompany !== "전체" && r.company !== filterCompany) return false;
      if (search) {
        const q = search.toLowerCase();
        return [r.user, r.assetNo, r.serial, r.model, r.company, r.dept, r.location]
          .some(v => v?.toLowerCase().includes(q));
      }
      return true;
    });
  }, [records, filterStatus, filterCompany, search]);

  return (
    <div className="flex flex-col h-full">
      {/* 필터 영역 */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 space-y-2">
        {/* 검색 */}
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="이름 · 자산번호 · 시리얼 · 모델 검색..."
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400"
        />
        {/* 드롭다운 행 */}
        <div className="flex gap-2">
          <Select
            value={filterStatus}
            onChange={setFilterStatus}
            options={statusOptions}
            placeholder="전체 상태"
          />
          {isSuper && companyOptions.length > 1 && (
            <Select
              value={filterCompany}
              onChange={setFilterCompany}
              options={companyOptions}
              placeholder="전체 법인"
            />
          )}
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
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={r.status} />
                  <span className="text-xs text-gray-400">{r.company}</span>
                </div>
                <div className="font-bold text-gray-900 mt-1.5 text-sm">{r.user || "미지정"}</div>
                <div className="text-xs text-gray-500 mt-0.5">{r.model || "—"}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {r.assetNo}{r.dept ? ` · ${r.dept}` : ""}{r.location ? ` · ${r.location}` : ""}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0 text-right">
                {r.returnDue && (
                  <div className="text-xs text-gray-400">반납예정<br />{fmtDate(r.returnDue)}</div>
                )}
                {r.verified && (
                  <span className="text-[9px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full font-bold">실사확인</span>
                )}
              </div>
            </div>
          </button>
        ))}
        <div className="text-center text-xs text-gray-300 py-2">{filtered.length}건 / 전체 {records.length}건</div>
      </div>

      {selected && <DetailSheet record={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
