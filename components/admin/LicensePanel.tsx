"use client";

import { useEffect, useState, useMemo } from "react";
import type { LicenseRecord } from "@/types";

const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  "사용중":   { bg: "bg-blue-50",   text: "text-blue-700",   dot: "bg-blue-500"   },
  "재고":     { bg: "bg-green-50",  text: "text-green-700",  dot: "bg-green-500"  },
  "지급대기": { bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-400" },
  "만료":     { bg: "bg-gray-100",  text: "text-gray-500",   dot: "bg-gray-400"   },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { bg: "bg-gray-100", text: "text-gray-500", dot: "bg-gray-400" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}

const SW_ICONS: Record<string, string> = {
  "MS Office": "📄",
  "MS Office 365": "🪟",
  "한컴": "🇰🇷",
  "ezPDF": "📑",
  "Adobe PDF": "🔖",
  "Adobe Creative Cloud": "🎨",
  "Adobe Photoshop": "🖼️",
  "Adobe Illustrator": "✏️",
  "Adobe Premiere Pro": "🎬",
  "AUTO CAD": "📐",
  "MAC Office": "🍎",
  "MAC 한컴": "🍏",
  "기타": "✨",
};

function fmtDate(d?: string) {
  if (!d) return "—";
  return d.slice(0, 10);
}

function daysLeft(d?: string): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

function SummaryCard({ label, value, sub, color }: { label: string; value: number; sub?: string; color: string }) {
  return (
    <div className={`bg-white border rounded-xl p-5 flex flex-col gap-1 shadow-sm border-l-4 ${color}`}>
      <div className="text-xs text-gray-500 font-medium">{label}</div>
      <div className="text-3xl font-bold text-gray-900">{value.toLocaleString()}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

function SwStatusCard({ name, total, using, stock, waiting, expired }: {
  name: string; total: number; using: number; stock: number; waiting: number; expired: number;
}) {
  const icon = SW_ICONS[name] ?? "📦";
  const usePct = total > 0 ? Math.round((using / total) * 100) : 0;
  const barColor = usePct >= 90 ? "bg-red-500" : usePct >= 70 ? "bg-orange-400" : "bg-blue-500";
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{icon}</span>
        <span className="font-bold text-sm text-gray-900 truncate">{name}</span>
        <span className="ml-auto text-xs text-gray-400 font-medium">{total}개</span>
      </div>
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>사용중 {using}</span>
          <span>{usePct}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${usePct}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1 text-center">
        <div className="bg-green-50 rounded-lg py-1.5">
          <div className="text-sm font-bold text-green-700">{stock}</div>
          <div className="text-xs text-green-600">재고</div>
        </div>
        <div className="bg-orange-50 rounded-lg py-1.5">
          <div className="text-sm font-bold text-orange-600">{waiting}</div>
          <div className="text-xs text-orange-500">지급대기</div>
        </div>
        <div className="bg-gray-50 rounded-lg py-1.5">
          <div className="text-sm font-bold text-gray-500">{expired}</div>
          <div className="text-xs text-gray-400">만료</div>
        </div>
      </div>
    </div>
  );
}

export default function LicensePanel() {
  const [records, setRecords] = useState<LicenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSynced, setLastSynced] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterSw, setFilterSw] = useState("전체");
  const [filterStatus, setFilterStatus] = useState("전체");
  const [filterCompany, setFilterCompany] = useState("전체");
  const [tab, setTab] = useState<"dashboard" | "detail">("dashboard");

  useEffect(() => {
    fetch("/api/licenses")
      .then((r) => r.json())
      .then((res) => {
        setRecords(res.data ?? []);
        setLastSynced(res.lastSynced ?? "");
        if (res.error) setError(res.error);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const summary = useMemo(() => {
    const total   = records.length;
    const using   = records.filter((r) => r.usageStatus === "사용중").length;
    const stock   = records.filter((r) => r.usageStatus === "재고").length;
    const waiting = records.filter((r) => r.usageStatus === "지급대기").length;
    const expired = records.filter((r) => r.usageStatus === "만료").length;
    const expiring = records.filter((r) => { const d = daysLeft(r.licenseExpiryDate); return d !== null && d >= 0 && d <= 30; }).length;
    return { total, using, stock, waiting, expired, expiring };
  }, [records]);

  const swList = useMemo(() => {
    const names = [...new Set(records.map((r) => r.software))].sort();
    return names.map((name) => {
      const recs = records.filter((r) => r.software === name);
      return {
        name, total: recs.length,
        using:   recs.filter((r) => r.usageStatus === "사용중").length,
        stock:   recs.filter((r) => r.usageStatus === "재고").length,
        waiting: recs.filter((r) => r.usageStatus === "지급대기").length,
        expired: recs.filter((r) => r.usageStatus === "만료").length,
      };
    });
  }, [records]);

  const swOptions   = useMemo(() => ["전체", ...new Set(records.map((r) => r.software)).values()], [records]);
  const companyOptions = useMemo(() => ["전체", ...new Set(records.map((r) => r.company).filter(Boolean)).values()], [records]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return records.filter((r) => {
      if (filterSw !== "전체" && r.software !== filterSw) return false;
      if (filterStatus !== "전체" && r.usageStatus !== filterStatus) return false;
      if (filterCompany !== "전체" && r.company !== filterCompany) return false;
      if (q) return (
        r.userName.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.software.toLowerCase().includes(q) ||
        r.softwareDetail.toLowerCase().includes(q) ||
        r.company.toLowerCase().includes(q)
      );
      return true;
    });
  }, [records, search, filterSw, filterStatus, filterCompany]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <div className="text-gray-400 text-sm">노션에서 라이선스 데이터를 불러오는 중…</div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-0.5">라이선스 현황</h2>
          <p className="text-sm text-gray-500">전사 소프트웨어 라이선스 사용 / 재고 현황 (Notion 연동)</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          마지막 동기화: {lastSynced ? new Date(lastSynced).toLocaleString("ko-KR") : "—"}
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          ⚠ {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <SummaryCard label="전체 라이선스" value={summary.total}   color="border-l-gray-300" />
        <SummaryCard label="사용중"         value={summary.using}   color="border-l-blue-500" sub={`${summary.total > 0 ? Math.round((summary.using / summary.total) * 100) : 0}% 사용`} />
        <SummaryCard label="재고"           value={summary.stock}   color="border-l-green-500" />
        <SummaryCard label="지급대기"       value={summary.waiting} color="border-l-orange-400" />
        <SummaryCard label="만료"           value={summary.expired} color="border-l-gray-400" />
        <SummaryCard label="만료 임박 (30일)" value={summary.expiring} color="border-l-red-500" sub="주의 필요" />
      </div>

      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {([["dashboard", "📊 SW별 현황"], ["detail", "🔍 상세 검색"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === id ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && (
        <div>
          {swList.length === 0 ? (
            <div className="text-center py-20 text-gray-400">데이터가 없습니다</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {swList.map((sw) => <SwStatusCard key={sw.name} {...sw} />)}
            </div>
          )}
        </div>
      )}

      {tab === "detail" && (
        <div>
          <div className="flex flex-wrap gap-3 mb-4">
            <input type="text" placeholder="이름, 부서, 이메일, SW명 검색…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-[220px] px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            <select value={filterSw} onChange={(e) => setFilterSw(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {swOptions.map((s) => <option key={s}>{s}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {["전체", "사용중", "재고", "지급대기", "만료"].map((s) => <option key={s}>{s}</option>)}
            </select>
            <select value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {companyOptions.map((s) => <option key={s}>{s}</option>)}
            </select>
            <div className="flex items-center text-xs text-gray-400 font-medium">{filtered.length}건</div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-auto shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {["SW", "버전", "사용자명", "부서", "법인명", "사용현황", "라이센스 만료일", "노션"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400">검색 결과가 없습니다</td></tr>
                ) : filtered.map((r) => {
                  const days = daysLeft(r.licenseExpiryDate);
                  const isExpiring = days !== null && days >= 0 && days <= 30;
                  const isExpired  = days !== null && days < 0;
                  return (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-blue-50/40 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{SW_ICONS[r.software] ?? "📦"}</span>
                          <div>
                            <div className="font-semibold text-gray-900 text-xs">{r.software}</div>
                            {r.softwareDetail && <div className="text-xs text-gray-400">{r.softwareDetail}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">{r.version || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 text-xs">{r.userName || "재고"}</div>
                        {r.email && <div className="text-xs text-gray-400">{r.email}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">{r.department || "—"}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{r.company || "—"}</td>
                      <td className="px-4 py-3"><StatusBadge status={r.usageStatus} /></td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {r.licenseExpiryDate ? (
                          <span className={isExpired ? "text-gray-400 line-through" : isExpiring ? "text-red-600 font-semibold" : "text-gray-600"}>
                            {fmtDate(r.licenseExpiryDate)}
                            {isExpiring && days !== null && (
                              <span className="ml-1 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">D-{days}</span>
                            )}
                            {isExpired && (
                              <span className="ml-1 text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">만료</span>
                            )}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <a href={r.notionUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 text-xs underline">보기</a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
