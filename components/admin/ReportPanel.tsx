"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import type { ReportData, DeptSummary, SubRow } from "@/app/api/report/route";

// ── 숫자 포맷 헬퍼 ──────────────────────────────────────────────────────
function krw(n: number) {
  if (n === 0) return "–";
  if (n >= 100_000_000) return `₩${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `₩${(n / 10_000).toFixed(0)}만`;
  return `₩${n.toLocaleString()}`;
}
function krwFull(n: number) {
  return n === 0 ? "–" : `₩${n.toLocaleString()}`;
}

// ── KPI 카드 ──────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 flex flex-col gap-1 min-w-0">
      <span className="text-xs font-medium text-gray-400 tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-gray-900 truncate">{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  );
}

// ── 가로 비용 바 ─────────────────────────────────────────────────────────
function CostBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className="h-full rounded-full bg-indigo-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── 부서 행 (접힘/펼침) ──────────────────────────────────────────────────
function DeptRow({
  d,
  maxMonthly,
  hasCost,
  expanded,
  onToggle,
}: {
  d: DeptSummary;
  maxMonthly: number;
  hasCost: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="hover:bg-indigo-50/40 cursor-pointer border-b border-gray-100 transition-colors"
        onClick={onToggle}
      >
        <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{d.company}</td>
        <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">
          <span className="flex items-center gap-1.5">
            <span
              className={`text-xs transition-transform ${expanded ? "rotate-90" : ""}`}
              style={{ display: "inline-block" }}
            >
              ▶
            </span>
            {d.department || "미지정"}
          </span>
        </td>
        <td className="px-4 py-3 text-center font-semibold text-indigo-700">{d.swCount}</td>
        <td className="px-4 py-3 text-center text-gray-600">{d.licenseCount}</td>
        {hasCost && (
          <>
            <td className="px-4 py-3 text-right font-semibold text-gray-800 whitespace-nowrap">
              {krw(d.monthlyKrw)}
            </td>
            <td className="px-4 py-3 text-right font-semibold text-indigo-600 whitespace-nowrap">
              {krw(d.annualKrw)}
            </td>
            <td className="px-4 py-3 w-28">
              <CostBar value={d.monthlyKrw} max={maxMonthly} />
            </td>
          </>
        )}
      </tr>
      {expanded && (
        <tr className="bg-indigo-50/30">
          <td colSpan={hasCost ? 7 : 4} className="px-0 py-0">
            <table className="w-full text-xs border-t border-indigo-100">
              <thead>
                <tr className="bg-indigo-100/50 text-indigo-700 font-semibold">
                  <th className="px-6 py-2 text-left">SW 명</th>
                  <th className="px-4 py-2 text-center">라이선스 수</th>
                  {hasCost && (
                    <>
                      <th className="px-4 py-2 text-right">월 금액</th>
                      <th className="px-4 py-2 text-right">연간 금액</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {d.swList.map((sw, i) => (
                  <tr key={i} className="border-t border-indigo-50">
                    <td className="px-6 py-1.5 text-gray-700 font-medium">{sw.swName}</td>
                    <td className="px-4 py-1.5 text-center text-gray-500">{sw.licenseCount}건</td>
                    {hasCost && (
                      <>
                        <td className="px-4 py-1.5 text-right text-gray-600">{krwFull(sw.monthlyKrw)}</td>
                        <td className="px-4 py-1.5 text-right text-indigo-600 font-semibold">{krwFull(sw.annualKrw)}</td>
                      </>
                    )}
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
// 서버에서 전체 rows를 받아 클라이언트에서 필터링 + 집계
// → 필터 변경 시 네트워크 요청 없이 즉시 반영
function buildView(rows: SubRow[], company: string, dept: string) {
  let filtered = rows;
  if (company) filtered = filtered.filter(r => r.company === company);
  if (dept)    filtered = filtered.filter(r => r.department === dept);

  const deptMap = new Map<string, DeptSummary>();
  for (const row of filtered) {
    const key = `${row.company}__${row.department}`;
    if (!deptMap.has(key)) {
      deptMap.set(key, { company: row.company, department: row.department,
        swCount: 0, licenseCount: 0, monthlyKrw: 0, annualKrw: 0, swList: [] });
    }
    const s = deptMap.get(key)!;
    s.licenseCount++;
    s.monthlyKrw += row.monthlyKrw;
    s.annualKrw  += row.annualKrw;
    const existing = s.swList.find(sw => sw.swName === row.swName);
    if (existing) {
      existing.licenseCount++;
      existing.monthlyKrw += row.monthlyKrw;
      existing.annualKrw  += row.annualKrw;
    } else {
      s.swList.push({ swName: row.swName, licenseCount: 1,
        monthlyKrw: row.monthlyKrw, annualKrw: row.annualKrw });
      s.swCount++;
    }
  }
  const deptSummary = [...deptMap.values()]
    .sort((a, b) => b.monthlyKrw - a.monthlyKrw || a.department.localeCompare(b.department));
  deptSummary.forEach(d => d.swList.sort((a, b) => b.monthlyKrw - a.monthlyKrw));

  const totalMonthlyKrw = filtered.reduce((s, r) => s + r.monthlyKrw, 0);
  const totalAnnualKrw  = filtered.reduce((s, r) => s + r.annualKrw,  0);
  const hasCostData     = filtered.some(r => r.monthlyKrw > 0);

  return { deptSummary, totalMonthlyKrw, totalAnnualKrw, hasCostData };
}

// ── 메인 패널 ────────────────────────────────────────────────────────────
export default function ReportPanel() {
  // fullData: 최초 1회 fetch 후 보관 (이후 재요청 없음)
  const [fullData, setFullData]     = useState<ReportData | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [company, setCompany]       = useState("");
  const [dept, setDept]             = useState("");
  const [expanded, setExpanded]     = useState<Set<string>>(new Set());
  const [exporting, setExporting]   = useState(false);

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

  // 최초 마운트 시 1회만 fetch
  useEffect(() => { fetchData(); }, [fetchData]);

  // 필터 변경 시 네트워크 요청 없이 클라이언트에서 즉시 집계
  const view = useMemo(() => {
    if (!fullData) return null;
    return buildView(fullData.rows, company, dept);
  }, [fullData, company, dept]);

  // 현재 표시할 데이터 (fullData 메타 + 클라이언트 집계 결과 병합)
  const data: ReportData | null = useMemo(() => {
    if (!fullData || !view) return null;
    return { ...fullData, ...view };
  }, [fullData, view]);

  const handleCompany = (v: string) => { setCompany(v); setDept(""); };
  const handleDept    = (v: string) => { setDept(v); };

  const toggleDept = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const maxMonthly = data
    ? Math.max(...data.deptSummary.map(d => d.monthlyKrw), 1)
    : 1;

  // ── Excel 다운로드 ─────────────────────────────────────────────────────
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

      // Sheet 1: 부서별 요약
      const sum = [
        ["법인", "부서", "구독 SW 종류", "라이선스 수", "월간 금액(KRW)", "연간 금액(KRW)"],
        ...data.deptSummary.map(d => [
          d.company, d.department, d.swCount, d.licenseCount, d.monthlyKrw, d.annualKrw,
        ]),
        [],
        ["합계", "", "", data.deptSummary.reduce((s, d) => s + d.licenseCount, 0),
          data.totalMonthlyKrw, data.totalAnnualKrw],
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sum), "부서별 요약");

      // Sheet 2: 부서×SW 상세
      const swDetail = [
        ["법인", "부서", "SW명", "라이선스 수", "월 금액(KRW)", "연간 금액(KRW)"],
        ...data.deptSummary.flatMap(d =>
          d.swList.map(sw => [d.company, d.department, sw.swName, sw.licenseCount, sw.monthlyKrw, sw.annualKrw])
        ),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(swDetail), "SW별 상세");

      // Sheet 3: 전체 레코드
      const detail = [
        ["법인", "부서", "SW명", "라이선스 유형", "사용자", "갱신일", "월 금액(KRW)", "연간 금액(KRW)"],
        ...data.rows.map(r => [
          r.company, r.department, r.swName, r.licenseType,
          r.user, r.renewalDate, r.monthlyKrw, r.annualKrw,
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

  // ── 렌더 ──────────────────────────────────────────────────────────────
  const hasCost = data?.hasCostData ?? false;

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
        <div className="flex items-center gap-2">
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
          onChange={e => handleDept(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="">전체 부서</option>
          {data?.filters.departments.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        {(company || dept) && (
          <button
            onClick={() => { setCompany(""); setDept(""); }}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            필터 초기화
          </button>
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
              sub="중복 제외"
            />
            <KpiCard
              label="활성 구독 수"
              value={`${data.rows.length}건`}
              sub="만료 제외"
            />
            <KpiCard
              label="월간 총 비용"
              value={hasCost ? krw(data.totalMonthlyKrw) : "–"}
              sub={hasCost ? "KRW" : "Notion에 월 금액 필드 필요"}
            />
            <KpiCard
              label="연간 총 비용"
              value={hasCost ? krw(data.totalAnnualKrw) : "–"}
              sub={hasCost ? "KRW (월×12)" : "Notion에 월 금액 필드 필요"}
            />
          </div>

          {/* 비용 미입력 안내 */}
          {!hasCost && (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm px-4 py-3 rounded-xl">
              💡 Notion SW DB에 <strong>월 금액</strong> (숫자 유형) 컬럼을 추가하면 부서별 비용을 자동으로 집계합니다.
            </div>
          )}

          {/* 부서별 현황 테이블 */}
          {data.deptSummary.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-4xl mb-3">📭</div>
              <div className="text-sm">조건에 맞는 구독 데이터가 없습니다.</div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <span className="font-semibold text-gray-800 text-sm">
                  부서별 구독 현황
                </span>
                <span className="text-xs text-gray-400">행 클릭 시 SW 목록 펼치기</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs font-semibold">
                      <th className="px-4 py-3 text-left whitespace-nowrap">법인</th>
                      <th className="px-4 py-3 text-left whitespace-nowrap">부서</th>
                      <th className="px-4 py-3 text-center whitespace-nowrap">SW 종류</th>
                      <th className="px-4 py-3 text-center whitespace-nowrap">라이선스 수</th>
                      {hasCost && (
                        <>
                          <th className="px-4 py-3 text-right whitespace-nowrap">월간 금액</th>
                          <th className="px-4 py-3 text-right whitespace-nowrap">연간 금액</th>
                          <th className="px-4 py-3 whitespace-nowrap w-28">비중</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data.deptSummary.map((d, i) => {
                      const key = `${d.company}__${d.department}`;
                      return (
                        <DeptRow
                          key={i}
                          d={d}
                          maxMonthly={maxMonthly}
                          hasCost={hasCost}
                          expanded={expanded.has(key)}
                          onToggle={() => toggleDept(key)}
                        />
                      );
                    })}
                  </tbody>
                  {hasCost && (
                    <tfoot>
                      <tr className="bg-indigo-50 font-bold text-sm border-t-2 border-indigo-200">
                        <td className="px-4 py-3 text-gray-500" colSpan={2}>합계</td>
                        <td className="px-4 py-3 text-center text-indigo-700">
                          {new Set(data.rows.map(r => r.swName)).size}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-600">{data.rows.length}</td>
                        <td className="px-4 py-3 text-right text-gray-800">{krwFull(data.totalMonthlyKrw)}</td>
                        <td className="px-4 py-3 text-right text-indigo-700">{krwFull(data.totalAnnualKrw)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
