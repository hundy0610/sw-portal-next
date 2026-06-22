"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import type { ReportData, SubRow } from "@/lib/reportTypes";
import EnvVarMissing from "@/components/ui/EnvVarMissing";
import { safeJson } from "@/lib/fetch-json";

// ─── 카테고리 색상 맵 ────────────────────────────────────────────────────
const CATEGORY_BADGE: Record<string, string> = {
  "사무":    "bg-blue-100 text-blue-700",
  "문서작성": "bg-cyan-100 text-cyan-700",
  "정부":    "bg-teal-100 text-teal-700",
  "설계":    "bg-amber-100 text-amber-700",
  "디자인":  "bg-pink-100 text-pink-700",
  "AI":     "bg-violet-100 text-violet-700",
  "개발":    "bg-green-100 text-green-700",
  "협업":    "bg-orange-100 text-orange-700",
  "원격":    "bg-sky-100 text-sky-700",
  "RPA":    "bg-rose-100 text-rose-700",
  "기타":    "bg-slate-100 text-slate-500",
};

const CATEGORY_CHIP: Record<string, string> = {
  "사무":    "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  "문서작성": "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200",
  "정부":    "bg-teal-50 text-teal-700 ring-1 ring-teal-200",
  "설계":    "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  "디자인":  "bg-pink-50 text-pink-700 ring-1 ring-pink-200",
  "AI":     "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  "개발":    "bg-green-50 text-green-700 ring-1 ring-green-200",
  "협업":    "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
  "원격":    "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  "RPA":    "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  "기타":    "bg-slate-50 text-slate-500 ring-1 ring-slate-200",
};

const CATEGORY_COUNT: Record<string, string> = {
  "사무":    "text-blue-600",
  "문서작성": "text-cyan-600",
  "정부":    "text-teal-600",
  "설계":    "text-amber-600",
  "디자인":  "text-pink-600",
  "AI":     "text-violet-600",
  "개발":    "text-green-600",
  "협업":    "text-orange-600",
  "원격":    "text-sky-600",
  "RPA":    "text-rose-600",
  "기타":    "text-slate-500",
};

const CAT_ORDER = ["사무","문서작성","정부","설계","디자인","AI","개발","협업","원격","RPA","기타"];

// ─── 헬퍼 ───────────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString("ko-KR");
// 결재방식이 "XXX 쉐어드청구" 형태인 항목 → 총액 제외 대상
const isShared = (r: SubRow) => !!r.billingType?.endsWith("쉐어드청구");

// 기간별 금액 계산
function periodKrw(annualKrw: number, mode: "monthly" | "annual") {
  return mode === "monthly" ? Math.round(annualKrw / 12) : annualKrw;
}
function periodUsd(annualUsd: number, mode: "monthly" | "annual") {
  return mode === "monthly" ? annualUsd / 12 : annualUsd;
}
function convertedKrw(annualKrw: number, annualUsd: number, rate: number, mode: "monthly" | "annual") {
  const krw = periodKrw(annualKrw, mode);
  const usd = periodUsd(annualUsd, mode);
  return krw + Math.round(usd * rate);
}

// ─── KPI 카드 ────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className={`rounded-xl border border-indigo-100 bg-white p-4 shadow-sm ${color || ""}`}>
      <p className="text-xs font-medium text-indigo-400 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-bold text-indigo-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-indigo-300">{sub}</p>}
    </div>
  );
}

// ─── Notion 링크 버튼 ────────────────────────────────────────────────────
function NotionBtn({ url }: { url: string }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="ml-1 inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium bg-indigo-50 text-indigo-500 hover:bg-indigo-100 transition-colors">
      <svg className="w-2.5 h-2.5" viewBox="0 0 16 16" fill="currentColor">
        <path d="M2.5 1A1.5 1.5 0 0 0 1 2.5v11A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-11A1.5 1.5 0 0 0 13.5 1h-11zm5.5 2.5h3.5v1.5H8V3.5zm-4 3h11v1.5h-11V6.5zm0 3h8v1.5h-8V9.5z"/>
      </svg>
      Notion
    </a>
  );
}

// ─── 쉐어드청구 배지 ──────────────────────────────────────────────────────
function SharedBadge({ label }: { label?: string }) {
  return (
    <span className="ml-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-700 ring-1 ring-amber-300">
      🔗 {label || "쉐어드청구"}
    </span>
  );
}

// ─── 부서 행 (통합 테이블) ────────────────────────────────────────────────
type PeriodMode = "monthly" | "annual";

function DeptRowUnified({
  dept, rows, rate, mode,
}: {
  dept: string;
  rows: SubRow[];
  rate: number;
  mode: PeriodMode;
}) {
  const [open, setOpen] = useState(false);

  // 카테고리별 그룹핑
  const catGroups = CAT_ORDER.map(cat => {
    const catRows = rows.filter(r => r.category === cat);
    if (!catRows.length) return null;
    // 이름별 집계
    const swMap = new Map<string, { count: number; annualKrw: number; annualUsd: number; billingType?: string; notionUrl: string }>();
    for (const r of catRows) {
      const key = r.swName;
      const ex = swMap.get(key);
      if (ex) {
        ex.count++;
        ex.annualKrw += r.annualKrw;
        ex.annualUsd += r.annualUsd;
      } else {
        swMap.set(key, { count: 1, annualKrw: r.annualKrw, annualUsd: r.annualUsd, billingType: r.billingType, notionUrl: r.notionUrl });
      }
    }
    return { cat, swMap };
  }).filter(Boolean) as { cat: string; swMap: Map<string, { count: number; annualKrw: number; annualUsd: number; billingType?: string; notionUrl: string }> }[];

  const totalKrwConverted  = rows.reduce((s, r) => s + convertedKrw(r.annualKrw, r.annualUsd, rate, mode), 0);
  const sharedKrwConverted = rows.filter(isShared).reduce((s, r) => s + convertedKrw(r.annualKrw, r.annualUsd, rate, mode), 0);
  const netKrwConverted    = totalKrwConverted - sharedKrwConverted;
  const hasShared          = rows.some(isShared);

  return (
    <>
      {/* 부서 행 */}
      <tr
        className="cursor-pointer border-b border-indigo-100 hover:bg-indigo-50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <td className="px-4 py-3 font-medium text-indigo-800 whitespace-nowrap">
          <span className="mr-2 text-indigo-300">{open ? "▼" : "▶"}</span>
          {dept}
          <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-[10px] font-bold">
            {rows.length}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1.5">
            {catGroups.map(({ cat, swMap }) => {
              const chipCls = CATEGORY_CHIP[cat] || CATEGORY_CHIP["기타"];
              const cntCls = CATEGORY_COUNT[cat] || "text-slate-500";
              return (
                <span key={cat} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${chipCls}`}>
                  {cat}
                  {[...swMap.entries()].map(([sw, info]) => (
                    <span key={sw} className="inline-flex items-center gap-0.5">
                      <span className="font-normal opacity-80">{sw}</span>
                      <span className={`font-bold ${cntCls}`}>×{info.count}</span>
                      {info.billingType?.endsWith("쉐어드청구") && <span className="text-[8px] font-bold text-amber-600">(쉐어드)</span>}
                    </span>
                  ))}
                </span>
              );
            })}
          </div>
        </td>
        <td className="px-4 py-3 text-right whitespace-nowrap">
          <div>
            <span className="text-amber-700 font-bold text-[15px]">
              {fmt(netKrwConverted)}원
            </span>
            {hasShared && (
              <div className="text-[11px] text-amber-500 mt-0.5">
                🔗 쉐어드 {fmt(sharedKrwConverted)}원 제외됨
              </div>
            )}
          </div>
        </td>
      </tr>

      {/* 펼침: 개별 항목 목록 */}
      {open && (
        <tr>
          <td colSpan={3} className="p-0">
            <div className="bg-indigo-50 border-b border-indigo-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-indigo-100 text-indigo-600 text-xs">
                    <th className="px-6 py-2 text-left font-semibold w-40">사용자</th>
                    <th className="px-4 py-2 text-left font-semibold">SW</th>
                    <th className="px-4 py-2 text-left font-semibold">카테고리</th>
                    <th className="px-4 py-2 text-right font-semibold">
                      {mode === "monthly" ? "월 KRW" : "연 KRW"}
                    </th>
                    <th className="px-4 py-2 text-right font-semibold">
                      {mode === "monthly" ? "월 USD" : "연 USD"}
                    </th>
                    <th className="px-4 py-2 text-right font-semibold">원화환산</th>
                    <th className="px-4 py-2 text-center font-semibold w-20">갱신일</th>
                    <th className="px-4 py-2 text-center font-semibold w-16">링크</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const pKrw = periodKrw(r.annualKrw, mode);
                    const pUsd = periodUsd(r.annualUsd, mode);
                    const conv = convertedKrw(r.annualKrw, r.annualUsd, rate, mode);
                    const shared = isShared(r);
                    return (
                      <tr key={r.id} className={`border-t border-indigo-100 ${shared ? "bg-amber-50/50" : "bg-white/70"} hover:bg-indigo-100/50`}>
                        <td className="px-6 py-2 text-indigo-700 truncate max-w-[140px]">{r.user || "—"}</td>
                        <td className="px-4 py-2 font-medium text-indigo-900">
                          {r.swName}
                          {shared && <SharedBadge label={r.billingType} />}
                        </td>
                        <td className="px-4 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${CATEGORY_BADGE[r.category] || CATEGORY_BADGE["기타"]}`}>
                            {r.category}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right text-indigo-800 font-mono">
                          {pKrw > 0 ? fmt(pKrw) : <span className="text-indigo-200">—</span>}
                        </td>
                        <td className="px-4 py-2 text-right text-emerald-700 font-mono">
                          {pUsd > 0 ? `$${pUsd.toFixed(2)}` : <span className="text-indigo-200">—</span>}
                        </td>
                        <td className="px-4 py-2 text-right font-bold text-amber-700">
                          {conv > 0 ? `${fmt(conv)}원` : <span className="text-indigo-200">—</span>}
                        </td>
                        <td className="px-4 py-2 text-center text-xs text-indigo-500">
                          {r.renewalDate || <span className="text-indigo-200">—</span>}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <NotionBtn url={r.notionUrl} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── 뷰 빌더 (법인 그룹핑) ───────────────────────────────────────────────
function buildView(
  rows: SubRow[],
  rate: number,
  mode: PeriodMode,
  filterCompany: string,
  filterDept: string,
  filterCat: string,
) {
  let filtered = rows;
  if (filterCompany) filtered = filtered.filter(r => r.company === filterCompany);
  if (filterDept)    filtered = filtered.filter(r => r.department === filterDept);
  if (filterCat)     filtered = filtered.filter(r => r.category === filterCat);

  // 법인별 그룹
  const coMap = new Map<string, Map<string, SubRow[]>>();
  for (const r of filtered) {
    if (!coMap.has(r.company)) coMap.set(r.company, new Map());
    const deptMap = coMap.get(r.company)!;
    if (!deptMap.has(r.department)) deptMap.set(r.department, []);
    deptMap.get(r.department)!.push(r);
  }

  const grandTotal   = filtered.reduce((s, r) => s + convertedKrw(r.annualKrw, r.annualUsd, rate, mode), 0);
  const sharedTotal  = filtered.filter(isShared).reduce((s, r) => s + convertedKrw(r.annualKrw, r.annualUsd, rate, mode), 0);
  const netTotal     = grandTotal - sharedTotal;
  const hasShared    = filtered.some(isShared);

  return { coMap, grandTotal, sharedTotal, netTotal, hasShared, totalLicenses: filtered.length, filtered };
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────
export default function ReportPanel({ company = "" }: { company?: string }) {
  const [data,       setData]       = useState<ReportData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [missingEnv, setMissingEnv] = useState<string | null>(null);
  const [rate, setRate]   = useState<number>(1380);

  // 필터 (법인 담당자면 company가 이미 고정됨)
  const [filterCompany, setFilterCompany] = useState(company);
  const [filterDept,    setFilterDept]    = useState("");
  const [filterCat,     setFilterCat]     = useState("");

  // 기간 모드 (월간 / 연간)
  const [mode, setMode] = useState<PeriodMode>("monthly");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const url = company ? `/api/report?company=${encodeURIComponent(company)}` : "/api/report";
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await safeJson(res);
      if (json.missingEnv) { setMissingEnv(json.missingEnv); return; }
      if (!json.ok) throw new Error(json.error || "API 오류");
      setData(json.data);
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [company]);

  useEffect(() => { load(); }, [load]);

  // 환율 조회
  useEffect(() => {
    fetch("https://open.er-api.com/v6/latest/USD")
      .then(r => safeJson(r))
      .then(d => { if (d?.rates?.KRW) setRate(Math.round(d.rates.KRW)); })
      .catch(() => {});
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-400 border-t-transparent"/>
      <span className="ml-3 text-indigo-500 font-medium">데이터 로드 중...</span>
    </div>
  );
  if (missingEnv) return <EnvVarMissing varName={missingEnv} />;
  if (error) return (
    <div className="p-6 bg-red-50 rounded-xl border border-red-200">
      <p className="text-red-600 font-semibold">오류 발생</p>
      <p className="text-red-500 text-sm mt-1">{error}</p>
      <button onClick={load} className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200 transition-colors">
        다시 시도
      </button>
    </div>
  );
  if (!data) return null;

  const { coMap, grandTotal, sharedTotal, netTotal, hasShared, totalLicenses, filtered } = buildView(
    data.rows, rate, mode, filterCompany, filterDept, filterCat
  );

  const periodLabel  = mode === "monthly" ? "월간" : "연간";
  const periodSuffix = mode === "monthly" ? "/월" : "/년";

  return (
    <div className="space-y-6">

      {/* ── 상단 배너 ── */}
      <div className="rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-amber-900">SW 구독 현황 리포트</h2>
            <p className="text-sm text-amber-600 mt-0.5">법인·부서별 라이선스 및 구독 비용 현황</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* 기간 토글 */}
            <div className="inline-flex rounded-lg border border-indigo-200 bg-white overflow-hidden shadow-sm">
              <button
                onClick={() => setMode("monthly")}
                className={`px-4 py-2 text-sm font-semibold transition-colors ${
                  mode === "monthly"
                    ? "bg-indigo-600 text-white"
                    : "text-indigo-500 hover:bg-indigo-50"
                }`}
              >
                월간
              </button>
              <button
                onClick={() => setMode("annual")}
                className={`px-4 py-2 text-sm font-semibold transition-colors ${
                  mode === "annual"
                    ? "bg-indigo-600 text-white"
                    : "text-indigo-500 hover:bg-indigo-50"
                }`}
              >
                연간
              </button>
            </div>
            {/* 환율 배지 */}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
              $1 = ₩{fmt(rate)}
            </span>
            <button onClick={load} title="새로고침"
              className="rounded-full p-2 bg-white border border-amber-200 text-amber-500 hover:bg-amber-50 transition-colors shadow-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
            </button>
          </div>
        </div>

        {/* 합산 배너 */}
        <div className="mt-4 flex flex-wrap gap-3 items-end">
          <div>
            <p className="text-xs text-amber-600 font-medium">{periodLabel} 원화환산 합계</p>
            <p className="text-3xl font-extrabold text-amber-800">{fmt(grandTotal)}<span className="text-lg ml-1">원</span></p>
          </div>
          {hasShared && (
            <>
              <div className="pb-1 text-amber-400 font-bold text-lg">—</div>
              <div>
                <p className="text-xs text-orange-500 font-medium">쉐어드 청구분</p>
                <p className="text-xl font-bold text-orange-600">{fmt(sharedTotal)}<span className="text-sm ml-1">원</span></p>
              </div>
              <div className="pb-1 text-amber-400 font-bold text-lg">=</div>
              <div>
                <p className="text-xs text-indigo-600 font-medium">법인 실부담</p>
                <p className="text-2xl font-extrabold text-indigo-800">{fmt(netTotal)}<span className="text-base ml-1">원</span></p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── KPI ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="구독 SW 종류" value={`${new Set(filtered.map(r => r.category)).size}개`} sub="카테고리" />
        <KpiCard label="총 라이선스" value={`${totalLicenses}개`} sub="사용 중" />
        <KpiCard label={`${periodLabel} USD 합계`}
          value={`$${filtered.reduce((s,r) => s + periodUsd(r.annualUsd, mode), 0).toFixed(0)}`}
          sub={periodSuffix} />
        <KpiCard label={`${periodLabel} KRW 합계`}
          value={`₩${fmt(filtered.reduce((s,r) => s + periodKrw(r.annualKrw, mode), 0))}`}
          sub={periodSuffix} />
      </div>

      {/* ── 필터 ── */}
      <div className="flex flex-wrap gap-2">
        {!company && (
          <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)}
            className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-sm text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300">
            <option value="">전체 법인</option>
            {data.filters.companies.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
          className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-sm text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300">
          <option value="">전체 부서</option>
          {data.filters.departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-sm text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300">
          <option value="">전체 카테고리</option>
          {data.filters.categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {((filterCompany && !company) || filterDept || filterCat) && (
          <button onClick={() => { if (!company) setFilterCompany(""); setFilterDept(""); setFilterCat(""); }}
            className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm text-indigo-500 hover:bg-indigo-100 transition-colors">
            필터 초기화
          </button>
        )}
      </div>

      {/* ── 통합 테이블 ── */}
      <div className="rounded-xl border border-indigo-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-indigo-50 border-b border-indigo-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold text-indigo-600 uppercase tracking-wide w-44">부서</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-indigo-600 uppercase tracking-wide">구독 SW</th>
              <th className="px-4 py-3 text-right text-xs font-bold text-indigo-600 uppercase tracking-wide w-52">
                {periodLabel} 원화환산 합계
              </th>
            </tr>
          </thead>
          <tbody>
            {[...coMap.entries()].map(([co, deptMap]) => {
              const coRows = [...deptMap.values()].flat();
              const coTotal      = coRows.reduce((s, r) => s + convertedKrw(r.annualKrw, r.annualUsd, rate, mode), 0);
              const coShared     = coRows.filter(isShared).reduce((s, r) => s + convertedKrw(r.annualKrw, r.annualUsd, rate, mode), 0);
              const coNet        = coTotal - coShared;
              const coHasShared  = coRows.some(isShared);

              return (
                <Fragment key={co}>
                  {/* 법인 헤더 */}
                  <tr className="bg-indigo-900">
                    <td colSpan={2} className="px-4 py-2.5 text-white font-bold text-sm">
                      🏢 {co}
                      <span className="ml-2 text-indigo-300 text-xs font-normal">{coRows.length}개 라이선스</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-amber-300 font-bold">{fmt(coTotal)}원</span>
                      {coHasShared && (
                        <div className="text-[10px] text-orange-300 mt-0.5">
                          법인 실부담 {fmt(coNet)}원
                        </div>
                      )}
                    </td>
                  </tr>

                  {/* 부서 행들 */}
                  {[...deptMap.entries()].map(([dept, deptRows]) => (
                    <DeptRowUnified key={dept} dept={dept} rows={deptRows} rate={rate} mode={mode} />
                  ))}

                  {/* 법인 소계 */}
                  <tr className="bg-indigo-100 border-t border-indigo-300">
                    <td colSpan={2} className="px-4 py-2 text-indigo-700 font-semibold text-xs">
                      {co} 소계 ({[...deptMap.keys()].length}개 부서)
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span className="text-indigo-800 font-bold">{fmt(coTotal)}원</span>
                      {coHasShared && (
                        <div className="text-[10px] text-orange-500 mt-0.5">
                          쉐어드 {fmt(coShared)}원 | 실부담 {fmt(coNet)}원
                        </div>
                      )}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>

          {/* 전체 합계 */}
          <tfoot>
            <tr className="bg-indigo-900">
              <td colSpan={2} className="px-4 py-3 text-white font-bold text-sm">
                전체 합계
                <span className="ml-2 text-indigo-300 text-xs font-normal">
                  ({[...coMap.keys()].length}개 법인 · {totalLicenses}개 라이선스)
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="text-amber-300 font-bold text-base">{fmt(grandTotal)}원</div>
                {hasShared && (
                  <div className="text-[11px] mt-1 space-y-0.5">
                    <div className="text-orange-300">쉐어드 청구 {fmt(sharedTotal)}원</div>
                    <div className="text-emerald-300 font-semibold">법인 실부담 {fmt(netTotal)}원</div>
                  </div>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 주석 */}
      <p className="text-xs text-indigo-300 text-right">
        * 원화환산 기준: $1 = ₩{fmt(rate)} (실시간 환율) · 데이터 출처: Notion SW DB
        {hasShared && " · 쉐어드청구 항목은 법인 실부담에서 제외됩니다"}
      </p>
    </div>
  );
}
