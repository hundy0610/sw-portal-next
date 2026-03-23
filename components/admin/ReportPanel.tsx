"use client";

import { useEffect, useState, useCallback, useMemo, Fragment } from "react";
import type { ReportData, DeptSummary, SubRow } from "@/lib/reportTypes";

// ── 카테고리 색상 정의 (SW사용직군 기준) ──────────────────────────────────
const CATEGORY_BADGE: Record<string, string> = {
  "사무":     "bg-blue-100 text-blue-700",
  "문서작성": "bg-sky-100 text-sky-700",
  "정부":     "bg-slate-100 text-slate-700",
  "설계":     "bg-cyan-100 text-cyan-700",
  "디자인":   "bg-pink-100 text-pink-700",
  "AI":       "bg-violet-100 text-violet-700",
  "개발":     "bg-green-100 text-green-700",
  "협업":     "bg-orange-100 text-orange-700",
  "원격":     "bg-teal-100 text-teal-700",
  "RPA":      "bg-rose-100 text-rose-700",
  "기타":     "bg-gray-100 text-gray-500",
};

const CATEGORY_TAB_ACTIVE: Record<string, string> = {
  "":         "bg-gray-800 text-white",
  "사무":     "bg-blue-600 text-white",
  "문서작성": "bg-sky-600 text-white",
  "정부":     "bg-slate-600 text-white",
  "설계":     "bg-cyan-600 text-white",
  "디자인":   "bg-pink-600 text-white",
  "AI":       "bg-violet-600 text-white",
  "개발":     "bg-green-600 text-white",
  "협업":     "bg-orange-500 text-white",
  "원격":     "bg-teal-600 text-white",
  "RPA":      "bg-rose-600 text-white",
  "기타":     "bg-gray-600 text-white",
};

const LICENSE_BADGE: Record<string, string> = {
  "구독(업체)": "bg-amber-100 text-amber-700",
  "구독(웹)":   "bg-teal-100 text-teal-700",
};

const CAT_ORDER = ["사무", "문서작성", "정부", "설계", "디자인", "AI", "개발", "협업", "원격", "RPA", "기타"];

// ── 숫자 포맷 헬퍼 ───────────────────────────────────────────────────────
function krw(n: number) {
  if (n === 0) return "–";
  if (n >= 100_000_000) return `₩${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `₩${(n / 10_000).toFixed(0)}만`;
  return `₩${n.toLocaleString()}`;
}
function krwFull(n: number) {
  return n === 0 ? "–" : `₩${n.toLocaleString()}`;
}
function usd(n: number) {
  if (n === 0) return "–";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
function usdFull(n: number) {
  return n === 0 ? "–" : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function convertedKrw(annualKrw: number, annualUsd: number, rate: number | null): number {
  return annualKrw + (rate ? Math.round(annualUsd * rate) : 0);
}

// ── KPI 카드 ─────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 flex flex-col gap-1 min-w-0">
      <span className="text-xs font-medium text-gray-400 tracking-wide">{label}</span>
      <span className={`text-2xl font-bold truncate ${accent ?? "text-gray-900"}`}>{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  );
}

// ── 노션 링크 버튼 ───────────────────────────────────────────────────────
function NotionBtn({ url }: { url: string }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      title="Notion에서 보기"
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 text-gray-500 text-xs font-medium transition-colors whitespace-nowrap"
    >
      <svg className="w-3 h-3 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
      Notion
    </a>
  );
}

// ── 통합 부서 행 (카테고리별 SW 뱃지 + 접힘/펼침) ────────────────────────
function DeptRowUnified({
  d,
  rows,
  usdToKrw,
  expanded,
  onToggle,
  hasKrw,
  hasUsd,
}: {
  d: DeptSummary;
  rows: SubRow[];
  usdToKrw: number | null;
  expanded: boolean;
  onToggle: () => void;
  hasKrw: boolean;
  hasUsd: boolean;
}) {
  const deptRows = useMemo(
    () => rows.filter(r => r.company === d.company && r.department === d.department),
    [rows, d.company, d.department]
  );

  // catGroups: category → swName → count
  const catGroups = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const r of deptRows) {
      const cat = r.category || "기타";
      if (!map.has(cat)) map.set(cat, new Map());
      const m = map.get(cat)!;
      m.set(r.swName, (m.get(r.swName) ?? 0) + 1);
    }
    return map;
  }, [deptRows]);

  const usedCats = CAT_ORDER.filter(c => catGroups.has(c));
  const totalConverted = convertedKrw(d.annualKrw, d.annualUsd, usdToKrw);
  const colCount = 4 + (hasKrw ? 1 : 0) + (hasUsd ? 1 : 0);

  return (
    <>
      <tr
        className="hover:bg-indigo-50/40 cursor-pointer border-b border-gray-100 transition-colors"
        onClick={onToggle}
      >
        {/* 부서명 */}
        <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap align-top">
          <span className="flex items-center gap-1.5">
            <span
              className={`text-xs transition-transform inline-block ${expanded ? "rotate-90" : ""}`}
            >▶</span>
            {d.department || "미지정"}
          </span>
        </td>
        {/* 직군별 SW 목록 */}
        <td className="px-4 py-3 align-top">
          <div className="flex flex-col gap-1.5">
            {usedCats.map(cat => (
              <div key={cat} className="flex items-start gap-1 flex-wrap">
                <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${CATEGORY_BADGE[cat] ?? "bg-gray-100 text-gray-500"}`}>
                  {cat}
                </span>
                <div className="flex flex-wrap gap-1">
                  {[...catGroups.get(cat)!.entries()]
                    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
                    .map(([sw, cnt]) => (
                      <span
                        key={sw}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-gray-100 rounded-full text-[10px] text-gray-600 whitespace-nowrap"
                      >
                        {sw}
                        <span className="font-bold text-indigo-500 ml-0.5">×{cnt}</span>
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </td>
        {/* 라이선스 수 */}
        <td className="px-4 py-3 text-center font-semibold text-indigo-700 whitespace-nowrap align-top">
          {d.licenseCount}
        </td>
        {/* 원화환산 합계 */}
        <td className="px-4 py-3 text-right font-bold text-gray-900 whitespace-nowrap align-top">
          {totalConverted > 0 ? krwFull(totalConverted) : "–"}
          {usdToKrw && d.annualUsd > 0 && d.annualKrw > 0 && (
            <div className="text-[10px] text-gray-400 font-normal mt-0.5">
              KRW+USD환산
            </div>
          )}
        </td>
        {/* 연간 KRW */}
        {hasKrw && (
          <td className="px-4 py-3 text-right font-semibold text-indigo-700 whitespace-nowrap align-top">
            {d.annualKrw > 0 ? krwFull(d.annualKrw) : "–"}
          </td>
        )}
        {/* 연간 USD */}
        {hasUsd && (
          <td className="px-4 py-3 text-right font-semibold text-emerald-700 whitespace-nowrap align-top">
            {d.annualUsd > 0 ? usdFull(d.annualUsd) : "–"}
            {usdToKrw && d.annualUsd > 0 && (
              <div className="text-[10px] text-gray-400 font-normal mt-0.5">
                ≈ {krwFull(Math.round(d.annualUsd * usdToKrw))}
              </div>
            )}
          </td>
        )}
      </tr>
      {/* 펼침: 개별 레코드 */}
      {expanded && (
        <tr className="bg-indigo-50/30">
          <td colSpan={colCount} className="px-0 py-0">
            <table className="w-full text-xs border-t border-indigo-100">
              <thead>
                <tr className="bg-indigo-100/50 text-indigo-700 font-semibold">
                  <th className="px-6 py-2 text-left">SW 명</th>
                  <th className="px-4 py-2 text-left">직군</th>
                  <th className="px-4 py-2 text-left">구독 유형</th>
                  <th className="px-4 py-2 text-left">사용자</th>
                  <th className="px-4 py-2 text-left">갱신일</th>
                  {hasKrw && <th className="px-4 py-2 text-right">연간(KRW)</th>}
                  {hasUsd && <th className="px-4 py-2 text-right">연간(USD)</th>}
                  <th className="px-4 py-2 text-center">링크</th>
                </tr>
              </thead>
              <tbody>
                {deptRows.map(row => (
                  <tr key={row.id} className="border-t border-indigo-50 hover:bg-white/60 transition-colors">
                    <td className="px-6 py-2 text-gray-700 font-medium">{row.swName}</td>
                    <td className="px-4 py-2">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${CATEGORY_BADGE[row.category] ?? "bg-gray-100 text-gray-500"}`}>
                        {row.category}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${LICENSE_BADGE[row.licenseType] ?? "bg-gray-100 text-gray-600"}`}>
                        {row.licenseType}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-600">{row.user || "–"}</td>
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{row.renewalDate || "–"}</td>
                    {hasKrw && (
                      <td className="px-4 py-2 text-right text-gray-700">{krwFull(row.annualKrw)}</td>
                    )}
                    {hasUsd && (
                      <td className="px-4 py-2 text-right text-emerald-700 font-semibold">{usdFull(row.annualUsd)}</td>
                    )}
                    <td className="px-4 py-2 text-center">
                      <NotionBtn url={row.notionUrl} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}

// ── 클라이언트 집계 함수 ─────────────────────────────────────────────────
function buildView(rows: SubRow[], company: string, dept: string, category: string) {
  let filtered = rows;
  if (company)  filtered = filtered.filter(r => r.company === company);
  if (dept)     filtered = filtered.filter(r => r.department === dept);
  if (category) filtered = filtered.filter(r => r.category === category);

  const deptMap = new Map<string, DeptSummary>();
  for (const row of filtered) {
    const key = `${row.company}__${row.department}`;
    if (!deptMap.has(key)) {
      deptMap.set(key, {
        company:      row.company,
        department:   row.department,
        swCount:      0,
        licenseCount: 0,
        annualUsd:    0,
        annualKrw:    0,
        swList:       [],
      });
    }
    const s = deptMap.get(key)!;
    s.licenseCount++;
    s.annualUsd += row.annualUsd;
    s.annualKrw += row.annualKrw;
    const existing = s.swList.find(sw => sw.swName === row.swName);
    if (existing) {
      existing.licenseCount++;
      existing.annualUsd += row.annualUsd;
      existing.annualKrw += row.annualKrw;
    } else {
      s.swList.push({ swName: row.swName, licenseCount: 1, annualUsd: row.annualUsd, annualKrw: row.annualKrw });
      s.swCount++;
    }
  }

  const deptSummary = [...deptMap.values()].sort((a, b) =>
    b.annualKrw - a.annualKrw || b.annualUsd - a.annualUsd || a.department.localeCompare(b.department)
  );
  deptSummary.forEach(d => d.swList.sort((a, b) => b.annualKrw - a.annualKrw || b.annualUsd - a.annualUsd));

  const totalAnnualUsd = filtered.reduce((s, r) => s + r.annualUsd, 0);
  const totalAnnualKrw = filtered.reduce((s, r) => s + r.annualKrw, 0);
  const hasUsdData     = filtered.some(r => r.annualUsd > 0);
  const hasKrwData     = filtered.some(r => r.annualKrw > 0);

  return { rows: filtered, deptSummary, totalAnnualUsd, totalAnnualKrw, hasUsdData, hasKrwData };
}

// ── 메인 패널 ────────────────────────────────────────────────────────────
export default function ReportPanel() {
  const [fullData, setFullData]   = useState<ReportData | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [company, setCompany]     = useState("");
  const [dept, setDept]           = useState("");
  const [category, setCategory]   = useState("");
  const [expanded, setExpanded]   = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [usdToKrw, setUsdToKrw]   = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/report");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "오류");
      setFullData(json.data);
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 실시간 환율 조회 (USD → KRW)
  useEffect(() => {
    fetch("https://open.er-api.com/v6/latest/USD")
      .then(r => r.json())
      .then(d => { if (d.rates?.KRW) setUsdToKrw(Math.round(d.rates.KRW)); })
      .catch(() => {});
  }, []);

  // 선택된 법인에 속한 부서만 표시
  const availableDepts = useMemo(() => {
    if (!fullData) return [];
    const base = company ? fullData.rows.filter(r => r.company === company) : fullData.rows;
    return [...new Set(base.map(r => r.department).filter(Boolean))].sort();
  }, [fullData, company]);

  // 필터 변경 시 클라이언트 집계 (네트워크 요청 없음)
  const view = useMemo(() => {
    if (!fullData) return null;
    return buildView(fullData.rows, company, dept, category);
  }, [fullData, company, dept, category]);

  const data: ReportData | null = useMemo(() => {
    if (!fullData || !view) return null;
    return { ...fullData, ...view };
  }, [fullData, view]);

  const handleCompany = (v: string) => { setCompany(v); setDept(""); };

  const toggleDept = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // 현재 필터 기준으로 존재하는 카테고리 목록 (탭 표시용)
  const availableCategories = useMemo(() => {
    if (!fullData) return [];
    let base = fullData.rows;
    if (company) base = base.filter(r => r.company === company);
    if (dept)    base = base.filter(r => r.department === dept);
    const used = new Set(base.map(r => r.category));
    return CAT_ORDER.filter(c => used.has(c));
  }, [fullData, company, dept]);

  // 법인별 그룹핑 순서
  const companiesInView = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.deptSummary.map(d => d.company))];
  }, [data]);

  // ── Excel 다운로드 ────────────────────────────────────────────────────
  const handleExcelDownload = async () => {
    if (!data) return;
    setExporting(true);
    try {
      await new Promise<void>((resolve, reject) => {
        if ((window as { XLSX?: unknown }).XLSX) { resolve(); return; }
        const s = document.createElement("script");
        s.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("SheetJS 로드 실패"));
        document.head.appendChild(s);
      });
      const XLSX = (window as unknown as { XLSX: {
        utils: {
          book_new: () => unknown;
          aoa_to_sheet: (data: unknown[][]) => unknown;
          book_append_sheet: (wb: unknown, ws: unknown, name: string) => void;
        };
        writeFile: (wb: unknown, name: string) => void;
      } }).XLSX;

      const wb = XLSX.utils.book_new();

      // Sheet 1: 법인·부서별 요약
      const sum = [
        ["법인", "부서", "구독 SW 종류", "라이선스 수", "원화환산합계", "연간 금액(KRW)", "연간 금액(USD)"],
        ...data.deptSummary.map(d => [
          d.company, d.department, d.swCount, d.licenseCount,
          convertedKrw(d.annualKrw, d.annualUsd, usdToKrw) || "",
          d.annualKrw || "", d.annualUsd || "",
        ]),
        [],
        ["합계", "", "", data.deptSummary.reduce((s, d) => s + d.licenseCount, 0),
          convertedKrw(data.totalAnnualKrw, data.totalAnnualUsd, usdToKrw) || "",
          data.totalAnnualKrw || "", data.totalAnnualUsd || ""],
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sum), "부서별 요약");

      // Sheet 2: 전체 레코드 (직군 포함)
      const detail = [
        ["법인", "부서", "직군", "SW명", "라이선스 유형", "사용자", "갱신일", "연간 금액(KRW)", "연간 금액(USD)"],
        ...data.rows.map(r => [
          r.company, r.department, r.category, r.swName, r.licenseType,
          r.user, r.renewalDate, r.annualKrw || "", r.annualUsd || "",
        ]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detail), "전체 레코드");

      const today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `구독SW리포트_${today}.xlsx`);
    } catch {
      alert("엑셀 생성 중 오류가 발생했습니다.");
    } finally {
      setExporting(false);
    }
  };

  // ── 렌더 ─────────────────────────────────────────────────────────────
  const hasKrw = data?.hasKrwData ?? false;
  const hasUsd = data?.hasUsdData ?? false;
  const totalConverted = data ? convertedKrw(data.totalAnnualKrw, data.totalAnnualUsd, usdToKrw) : 0;

  return (
    <div className="flex flex-col gap-6 p-6 min-h-0">

      {/* 헤더 + 액션 */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">구독 SW 현황 리포트</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            만료·영구 라이선스 제외 · 구독 중인 SW만 표시
            {data && (
              <span className="ml-2 text-xs text-gray-300">
                (기준: {new Date(data.generatedAt).toLocaleString("ko-KR")})
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {usdToKrw && (
            <span className="text-xs text-gray-400 flex items-center gap-1 px-3 py-2 bg-gray-50 rounded-xl border border-gray-100">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
              실시간 환율 $1 = ₩{usdToKrw.toLocaleString()}
            </span>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            title="Notion 데이터 새로고침"
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-600 text-sm font-medium rounded-xl transition-colors"
          >
            <span className={loading ? "animate-spin inline-block" : ""}>↻</span>
            새로고침
          </button>
          <button
            onClick={handleExcelDownload}
            disabled={!data || exporting}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            {exporting ? "⏳ 생성 중..." : "📥 엑셀 다운로드"}
          </button>
        </div>
      </div>

      {/* 필터 바 */}
      <div className="flex flex-col gap-3">
        {/* 법인 / 부서 드롭다운 */}
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={company}
            onChange={e => handleCompany(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="">전체 법인</option>
            {data?.filters.companies.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={dept}
            onChange={e => setDept(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="">전체 부서</option>
            {availableDepts.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          {(company || dept || category) && (
            <button
              onClick={() => { setCompany(""); setDept(""); setCategory(""); }}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              필터 초기화
            </button>
          )}
        </div>

        {/* 직군 탭 */}
        {availableCategories.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setCategory("")}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                category === ""
                  ? CATEGORY_TAB_ACTIVE[""]
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              전체
            </button>
            {availableCategories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(prev => prev === cat ? "" : cat)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  category === cat
                    ? CATEGORY_TAB_ACTIVE[cat] ?? "bg-gray-800 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {cat}
                {data && (
                  <span className="ml-1 opacity-70">
                    ({fullData?.rows.filter(r =>
                      r.category === cat &&
                      (!company || r.company === company) &&
                      (!dept || r.department === dept)
                    ).length ?? 0})
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 오류 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
          ❌ {error}
        </div>
      )}

      {/* 로딩 */}
      {loading && (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
          <svg className="animate-spin h-5 w-5 mr-2 text-indigo-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          데이터 불러오는 중...
        </div>
      )}

      {!loading && data && (
        <>
          {/* KPI 카드 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KpiCard
              label="구독 SW 종류"
              value={`${new Set(data.rows.map(r => r.swName)).size}개`}
              sub={category ? `${category} 직군` : "중복 제외"}
            />
            <KpiCard
              label="활성 구독 수"
              value={`${data.rows.length}건`}
              sub="만료 제외"
            />
            <KpiCard
              label="연간 비용 (KRW)"
              value={hasKrw ? krw(data.totalAnnualKrw) : "–"}
              sub={hasKrw ? "원화 결제 합계" : "원화 데이터 없음"}
              accent="text-indigo-700"
            />
            <KpiCard
              label="연간 비용 (USD)"
              value={hasUsd ? usd(data.totalAnnualUsd) : "–"}
              sub={hasUsd
                ? (usdToKrw
                    ? `달러 결제 합계 ≈ ${krw(Math.round(data.totalAnnualUsd * usdToKrw))}`
                    : "달러 결제 합계")
                : "달러 데이터 없음"}
              accent="text-emerald-700"
            />
          </div>

          {/* 원화환산 합계 배너 */}
          {(hasKrw || hasUsd) && totalConverted > 0 && (
            <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 rounded-2xl px-6 py-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-indigo-500 mb-0.5">원화환산 총 합계 (연간)</div>
                <div className="text-2xl font-bold text-indigo-800">{krwFull(totalConverted)}</div>
                <div className="text-xs text-indigo-400 mt-0.5">
                  {hasKrw && `KRW ${krwFull(data.totalAnnualKrw)}`}
                  {hasKrw && hasUsd && " + "}
                  {hasUsd && `USD ${usdFull(data.totalAnnualUsd)}`}
                  {usdToKrw && hasUsd && ` × ₩${usdToKrw.toLocaleString()}/$ 환산 포함`}
                </div>
              </div>
              <div className="text-5xl opacity-10 font-bold text-indigo-800 select-none">₩</div>
            </div>
          )}

          {/* 비용 미입력 안내 */}
          {!hasKrw && !hasUsd && (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm px-4 py-3 rounded-xl">
              💡 Notion SW DB에 <strong>연 비용 (KRW)</strong> 또는 <strong>연 비용 (USD)</strong> 컬럼을 추가하면 비용을 자동으로 집계합니다.
            </div>
          )}

          {/* 통합 테이블 (법인별 그룹핑) */}
          {data.deptSummary.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-4xl mb-3">📭</div>
              <div className="text-sm">조건에 맞는 구독 데이터가 없습니다.</div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <span className="font-semibold text-gray-800 text-sm">법인·부서별 구독 현황</span>
                <span className="text-xs text-gray-400">부서 행 클릭 시 상세 레코드 펼치기</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs font-semibold">
                      <th className="px-4 py-3 text-left whitespace-nowrap">부서</th>
                      <th className="px-4 py-3 text-left">구독 중인 SW (직군별)</th>
                      <th className="px-4 py-3 text-center whitespace-nowrap">라이선스</th>
                      <th className="px-4 py-3 text-right whitespace-nowrap text-gray-700">원화환산 합계</th>
                      {hasKrw && (
                        <th className="px-4 py-3 text-right whitespace-nowrap text-indigo-600">연간(KRW)</th>
                      )}
                      {hasUsd && (
                        <th className="px-4 py-3 text-right whitespace-nowrap text-emerald-600">연간(USD)</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {companiesInView.map(co => {
                      const coDepts = data.deptSummary.filter(d => d.company === co);
                      const coKrw   = coDepts.reduce((s, d) => s + d.annualKrw, 0);
                      const coUsd   = coDepts.reduce((s, d) => s + d.annualUsd, 0);
                      const coLic   = coDepts.reduce((s, d) => s + d.licenseCount, 0);
                      const coConv  = convertedKrw(coKrw, coUsd, usdToKrw);
                      const coSwSet = new Set(
                        data.rows.filter(r => r.company === co).map(r => r.swName)
                      );
                      return (
                        <Fragment key={co}>
                          {/* 법인 헤더 행 */}
                          <tr className="bg-gray-800 text-white">
                            <td className="px-4 py-2.5 font-bold text-sm" colSpan={2}>
                              🏢 {co}
                              <span className="ml-2 text-gray-400 text-xs font-normal">
                                {coSwSet.size}개 SW · {coDepts.length}개 부서
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-center text-gray-300 text-xs whitespace-nowrap">
                              {coLic}건
                            </td>
                            <td className="px-4 py-2.5 text-right font-bold text-yellow-300 whitespace-nowrap">
                              {coConv > 0 ? krwFull(coConv) : "–"}
                            </td>
                            {hasKrw && (
                              <td className="px-4 py-2.5 text-right text-indigo-300 whitespace-nowrap text-xs">
                                {coKrw > 0 ? krwFull(coKrw) : "–"}
                              </td>
                            )}
                            {hasUsd && (
                              <td className="px-4 py-2.5 text-right text-emerald-300 whitespace-nowrap text-xs">
                                {coUsd > 0 ? usdFull(coUsd) : "–"}
                              </td>
                            )}
                          </tr>
                          {/* 부서 행들 */}
                          {coDepts.map(d => {
                            const key = `${d.company}__${d.department}`;
                            return (
                              <DeptRowUnified
                                key={key}
                                d={d}
                                rows={data.rows}
                                usdToKrw={usdToKrw}
                                hasKrw={hasKrw}
                                hasUsd={hasUsd}
                                expanded={expanded.has(key)}
                                onToggle={() => toggleDept(key)}
                              />
                            );
                          })}
                          {/* 법인 소계 (부서 2개 이상일 때만) */}
                          {coDepts.length > 1 && (
                            <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold text-xs">
                              <td className="px-4 py-2 text-gray-500" colSpan={2}>
                                <span className="text-gray-400 mr-1">{co}</span>소계
                              </td>
                              <td className="px-4 py-2 text-center text-gray-700">{coLic}</td>
                              <td className="px-4 py-2 text-right font-bold text-gray-800 whitespace-nowrap">
                                {coConv > 0 ? krwFull(coConv) : "–"}
                              </td>
                              {hasKrw && (
                                <td className="px-4 py-2 text-right text-indigo-700 whitespace-nowrap">
                                  {coKrw > 0 ? krwFull(coKrw) : "–"}
                                </td>
                              )}
                              {hasUsd && (
                                <td className="px-4 py-2 text-right text-emerald-700 whitespace-nowrap">
                                  {coUsd > 0 ? usdFull(coUsd) : "–"}
                                </td>
                              )}
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                  {/* 전체 합계 */}
                  <tfoot>
                    <tr className="bg-indigo-50 font-bold text-sm border-t-2 border-indigo-200">
                      <td className="px-4 py-3 text-gray-500" colSpan={2}>
                        전체 합계
                        <span className="ml-2 text-xs font-normal text-gray-400">
                          {new Set(data.rows.map(r => r.swName)).size}개 SW · {data.rows.length}건
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700">{data.rows.length}</td>
                      <td className="px-4 py-3 text-right font-bold text-indigo-800 whitespace-nowrap">
                        {totalConverted > 0 ? krwFull(totalConverted) : "–"}
                        {usdToKrw && (
                          <div className="text-[10px] text-gray-400 font-normal">
                            환율 ₩{usdToKrw.toLocaleString()}/$
                          </div>
                        )}
                      </td>
                      {hasKrw && (
                        <td className="px-4 py-3 text-right text-indigo-700 whitespace-nowrap">
                          {krwFull(data.totalAnnualKrw)}
                        </td>
                      )}
                      {hasUsd && (
                        <td className="px-4 py-3 text-right text-emerald-700 whitespace-nowrap">
                          {usdFull(data.totalAnnualUsd)}
                          {usdToKrw && data.totalAnnualUsd > 0 && (
                            <div className="text-[10px] text-gray-400 font-normal mt-0.5">
                              ≈ {krwFull(Math.round(data.totalAnnualUsd * usdToKrw))}
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
