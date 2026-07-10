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
// 결재방식에 "쉐어드" 포함 → 외부 청구분 (띄어쓰기 방식에 무관하게 처리)
// "대웅 쉐어드 청구", "대웅 쉐어드청구" 등 모든 표기 대응
const isShared = (r: SubRow) => !!(r.billingType && r.billingType.includes("쉐어드"));

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
                      {info.billingType?.includes("쉐어드") && <span className="text-[8px] font-bold text-amber-600">(쉐어드)</span>}
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
              {fmt(totalKrwConverted)}원
            </span>
            {hasShared && (
              <div className="text-[11px] text-gray-400 mt-0.5">
                쉐어드 {fmt(sharedKrwConverted)}원 포함
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

// ─── 부서 상세 행 (접기/펼치기) ──────────────────────────────────────────
function DeptDetail({
  dept, rows, dTotal, dShared, dNet, dHas, rate, mode, periodLabel,
}: {
  dept: string; rows: SubRow[]; dTotal: number; dShared: number; dNet: number; dHas: boolean;
  rate: number; mode: PeriodMode; periodLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const users = [...new Set(rows.map(r => r.user).filter(Boolean))];
  const swSet = [...new Set(rows.map(r => r.swName))];
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
        onClick={() => setOpen(o => !o)}>
        <svg className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
          fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
        </svg>
        <span className="font-semibold text-slate-800 text-sm w-28 flex-shrink-0 truncate">{dept}</span>
        <div className="flex flex-wrap gap-1 flex-1 min-w-0">
          {swSet.slice(0,5).map(sw => (
            <span key={sw} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded border border-slate-200">{sw}</span>
          ))}
          {swSet.length > 5 && <span className="text-[10px] text-slate-400">+{swSet.length-5}개</span>}
        </div>
        <span className="text-xs text-slate-400 flex-shrink-0 hidden sm:block">{users.length}명</span>
        <div className="flex-shrink-0 ml-auto text-right">
          <div className="text-sm font-bold text-blue-700">
            ₩{fmt(dTotal)}<span className="text-xs font-normal text-slate-400 ml-0.5">/{periodLabel}</span>
          </div>
          {dHas && (
            <div className="text-[10px] text-gray-400">
              쉐어드 ₩{fmt(dShared)} 포함
            </div>
          )}
        </div>
      </button>
      {open && (() => {
        // SW별 그룹핑 (비용 내림차순)
        const swGroups = new Map<string, {
          swName: string; category: string; billing: string;
          users: string[]; count: number;
          totalKrw: number; totalUsd: number; totalConv: number;
          shared: boolean;
        }>();
        for (const r of rows) {
          const key = `${r.swName}||${r.billingType||""}`;
          if (swGroups.has(key)) {
            const g = swGroups.get(key)!;
            g.count++;
            g.totalKrw  += periodKrw(r.annualKrw, mode);
            g.totalUsd  += periodUsd(r.annualUsd, mode);
            g.totalConv += convertedKrw(r.annualKrw, r.annualUsd, rate, mode);
            if (r.user && !g.users.includes(r.user)) g.users.push(r.user);
          } else {
            swGroups.set(key, {
              swName: r.swName, category: r.category,
              billing: r.billingType || "", users: r.user ? [r.user] : [],
              count: 1,
              totalKrw:  periodKrw(r.annualKrw, mode),
              totalUsd:  periodUsd(r.annualUsd, mode),
              totalConv: convertedKrw(r.annualKrw, r.annualUsd, rate, mode),
              shared: isShared(r),
            });
          }
        }
        const swList = [...swGroups.values()].sort((a, b) => b.totalConv - a.totalConv);
        const ownList    = swList.filter(g => !g.shared);
        const sharedList = swList.filter(g =>  g.shared);

        const TableSection = ({ list, isSharedSection }: { list: typeof swList; isSharedSection: boolean }) => (
          <>
            {list.map((g, i) => (
              <tr key={`${g.swName}-${i}`}
                className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                {/* SW명 + 카테고리 */}
                <td className="px-4 py-2.5">
                  <div className="font-semibold text-slate-800 text-xs leading-tight">{g.swName}</div>
                  <div className="mt-0.5">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold ${CATEGORY_BADGE[g.category] || CATEGORY_BADGE["기타"]}`}>
                      {g.category}
                    </span>
                  </div>
                </td>
                {/* 사용자 */}
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1 max-w-xs">
                    {g.users.length > 0
                      ? g.users.map(u => (
                          <span key={u} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-medium whitespace-nowrap">
                            {u}
                          </span>
                        ))
                      : <span className="text-slate-300 text-xs">—</span>
                    }
                  </div>
                </td>
                {/* 건수 */}
                <td className="px-3 py-2.5 text-center">
                  <span className="text-xs font-bold text-slate-600 bg-slate-100 rounded-full w-5 h-5 inline-flex items-center justify-center">
                    {g.count}
                  </span>
                </td>
                {/* 월 KRW */}
                <td className="px-3 py-2.5 text-right font-mono text-xs text-slate-600">
                  {g.totalKrw > 0 ? fmt(Math.round(g.totalKrw)) : <span className="text-slate-300">—</span>}
                </td>
                {/* 월 USD */}
                <td className="px-3 py-2.5 text-right font-mono text-xs text-emerald-600">
                  {g.totalUsd > 0 ? `$${g.totalUsd.toFixed(2)}` : <span className="text-slate-300">—</span>}
                </td>
                {/* 원화환산 */}
                <td className="px-4 py-2.5 text-right">
                  <span className={`text-xs font-bold ${isSharedSection ? "text-slate-400" : "text-blue-700"}`}>
                    {g.totalConv > 0 ? fmt(Math.round(g.totalConv)) : "—"}
                  </span>
                </td>
              </tr>
            ))}
          </>
        );

        return (
          <div className="border-t border-slate-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-2 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wide w-36">SW · 카테고리</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wide">사용자</th>
                  <th className="px-3 py-2 text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wide w-10">건</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-wide w-24">월 KRW</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-wide w-20">월 USD</th>
                  <th className="px-4 py-2 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-wide w-24">원화환산</th>
                </tr>
              </thead>
              <tbody>
                {/* 법인 부담 항목 */}
                {ownList.length > 0 && <TableSection list={ownList} isSharedSection={false} />}

                {/* 쉐어드 구분선 */}
                {sharedList.length > 0 && (
                  <>
                    <tr>
                      <td colSpan={6} className="px-4 py-1.5 bg-amber-50 border-y border-amber-200">
                        <span className="text-[10px] font-semibold text-amber-700 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block"/>
                          외부 쉐어드 청구 항목
                        </span>
                      </td>
                    </tr>
                    <TableSection list={sharedList} isSharedSection={true} />
                  </>
                )}
              </tbody>

              {/* 소계 */}
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td colSpan={2} className="px-4 py-2">
                    <span className="text-[10px] font-semibold text-slate-500">
                      SW {swList.length}종 · {rows.length}건
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-[10px] font-bold text-slate-500">{rows.length}</td>
                  <td colSpan={2} className="px-3 py-2" />
                  <td className="px-4 py-2 text-right">
                    <div className="text-xs font-bold text-blue-800">₩{fmt(dTotal)}</div>
                    {dHas && <div className="text-[10px] text-slate-400">쉐어드 ₩{fmt(dShared)} 포함</div>}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        );
      })()}
    </div>
  );
}

// ─── 법인 블록 (요약 + 바 차트 + 부서 상세) ──────────────────────────────
function CompanyBlock({
  co, coRows, coTotal, coShared, coNet, coHas,
  deptList, maxDept, rate, mode, periodLabel,
}: {
  co: string; coRows: SubRow[];
  coTotal: number; coShared: number; coNet: number; coHas: boolean;
  deptList: { dept: string; rows: SubRow[]; dTotal: number; dShared: number; dNet: number; dHas: boolean; users: string[]; sws: string[] }[];
  maxDept: number; rate: number; mode: PeriodMode; periodLabel: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm mb-4">
      {/* 법인 헤더 */}
      <div className="bg-slate-900 px-5 py-3.5 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-base">{co}</span>
            <span className="text-slate-400 text-xs">{coRows.length}건 구독</span>
          </div>
          {coHas && (
            <div className="text-xs text-slate-500 mt-0.5">
              쉐어드 ₩{fmt(coShared)} 포함
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-blue-300">₩{fmt(coTotal)}</div>
          <div className="text-xs text-slate-400">/ {periodLabel}</div>
        </div>
      </div>

      {/* 부서별 바 차트 */}
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
        <div className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wide">부서별 지출 현황</div>
        <div className="flex flex-col gap-2">
          {deptList.map(({ dept, dTotal, dNet, dHas, users, sws }) => {
            const pct = maxDept > 0 ? (dTotal / maxDept * 100) : 0;
            const isHigh = pct > 60;
            return (
              <div key={dept} className="flex items-center gap-3">
                <div className="w-24 text-xs font-medium text-slate-700 text-right flex-shrink-0 truncate">{dept}</div>
                <div className="flex-1 relative h-7 bg-slate-200 rounded-md overflow-hidden">
                  <div className={`h-full rounded-md transition-all duration-500 ${isHigh?"bg-blue-700":"bg-blue-500"}`}
                    style={{ width: `${pct}%` }} />
                  <div className="absolute inset-0 flex items-center px-2">
                    <span className={`text-[10px] font-semibold ${pct>25?"text-white":"text-slate-500"}`}>
                      {users.length}명 · {sws.length}개 SW
                    </span>
                  </div>
                </div>
                <div className="w-36 text-right flex-shrink-0">
                  <span className={`text-xs font-bold ${isHigh?"text-blue-700":"text-slate-700"}`}>₩{fmt(dTotal)}</span>
                  {dHas && (
                    <div className="text-[10px] text-gray-400">
                      쉐어드 ₩{fmt(dShared)} 포함
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-blue-700 rounded inline-block"/>최고 지출</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-blue-500 rounded inline-block"/>일반</span>
          </div>
          <span className="text-xs text-slate-400">최대: {deptList[0]?.dept} ₩{fmt(deptList[0]?.dTotal||0)}</span>
        </div>
      </div>

      {/* 부서 상세 */}
      <div>
        <div className="px-5 py-2 bg-white border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wide">
          부서 상세 — 클릭하여 사용자·SW 내역 확인
        </div>
        {deptList.map(({ dept, rows, dTotal, dShared, dNet, dHas }) => (
          <DeptDetail key={dept} dept={dept} rows={rows}
            dTotal={dTotal} dShared={dShared} dNet={dNet} dHas={dHas}
            rate={rate} mode={mode} periodLabel={periodLabel}/>
        ))}
      </div>
    </div>
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

  // ─── 월별 인쇄 리포트용 데이터 (항상 monthly 모드, 필터 없음)
  const printNow = () => {
    // 인쇄 전: 어드민 크롬·제어버튼 숨기고 리포트만 표시
    const header   = document.querySelector<HTMLElement>(".admin-header");
    const sidenav  = document.querySelector<HTMLElement>(".sidenav");
    const content  = document.querySelector<HTMLElement>(".report-screen-view");
    const hideEls  = document.querySelectorAll<HTMLElement>("[data-print-hide]");

    const prev = {
      header:  header?.style.display,
      sidenav: sidenav?.style.display,
      zoom:    content?.style.zoom,
      hides:   [...hideEls].map(el => el.style.display),
    };

    if (header)  { header.style.setProperty("display","none","important"); }
    if (sidenav) { sidenav.style.setProperty("display","none","important"); }
    if (content) { content.style.zoom = "0.72"; }
    hideEls.forEach(el => el.style.setProperty("display","none","important"));

    // 인쇄 후: 원상복구
    const restore = () => {
      if (header)  header.style.display  = prev.header  ?? "";
      if (sidenav) sidenav.style.display = prev.sidenav ?? "";
      if (content) content.style.zoom    = prev.zoom    ?? "";
      hideEls.forEach((el, i) => { el.style.display = prev.hides[i] ?? ""; });
    };

    window.addEventListener("afterprint", restore, { once: true });
    setTimeout(restore, 60_000); // fallback

    window.print();
  };
  const printYear  = new Date().getFullYear();
  const printMonth = new Date().getMonth() + 1;
  // 인쇄: 현재 화면에서 선택된 법인만 출력 (전체 선택 시 모든 법인)
  const printTargetCo = filterCompany || company || "";
  const { coMap: printCoMap, grandTotal: printGrand, sharedTotal: printShared, netTotal: printNet, hasShared: printHasShared } =
    buildView(data.rows, rate, "monthly", printTargetCo, "", "");

  return (
    <>
    {/* ════════════════════════════════
        화면용 (인쇄 시 숨김)
    ════════════════════════════════ */}
    {/* ── @page 설정만 CSS로, 나머지는 JS DOM 조작 ── */}
    <style>{`
      @page { size: A4 portrait; margin: 8mm 7mm; }
      @media print {
        html, body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      }
    `}</style>

    <div className="report-screen-view print:block">

      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-slate-900">구독 SW 현황 리포트</h2>
          <p className="text-xs text-slate-400 mt-0.5">법인·부서별 구독 비용 현황</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap" data-print-hide>
          {/* 기간 토글 */}
          <div className="inline-flex rounded-md border border-slate-200 overflow-hidden bg-white shadow-sm">
            <button onClick={() => setMode("monthly")}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors ${mode==="monthly" ? "bg-blue-700 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
              월간
            </button>
            <button onClick={() => setMode("annual")}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors ${mode==="annual" ? "bg-blue-700 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
              연간
            </button>
          </div>
          {/* 법인 탭 (2개 이상일 때) */}
          {!company && data.filters.companies.length > 1 && (
            <div className="inline-flex rounded-md border border-slate-200 overflow-hidden bg-white shadow-sm">
              <button onClick={() => setFilterCompany("")}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${filterCompany==="" ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
                전체
              </button>
              {data.filters.companies.map(c => (
                <button key={c} onClick={() => setFilterCompany(c)}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors border-l border-slate-200 ${filterCompany===c ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
                  {c}
                </button>
              ))}
            </div>
          )}
          {/* 환율 */}
          <span className="text-xs text-slate-400 font-medium hidden sm:block">$1 = ₩{fmt(rate)}</span>
          {/* 인쇄 */}
          <button onClick={printNow}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded-md hover:bg-slate-700 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z"/>
            </svg>
            인쇄
          </button>
          <button onClick={load} title="새로고침"
            className="p-1.5 rounded-md border border-slate-200 text-slate-400 hover:bg-slate-50 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── 법인별 대시보드 ── */}
      {[...coMap.entries()].map(([co, deptMap]) => {
        const coRows   = [...deptMap.values()].flat();
        const coTotal  = coRows.reduce((s,r) => s + convertedKrw(r.annualKrw, r.annualUsd, rate, mode), 0);
        const coShared = coRows.filter(isShared).reduce((s,r) => s + convertedKrw(r.annualKrw, r.annualUsd, rate, mode), 0);
        const coNet    = coTotal - coShared;
        const coHas    = coRows.some(isShared);
        const periodLabel = mode === "monthly" ? "월" : "연";

        // 부서별 데이터 계산 (비용 내림차순) — 쉐어드 실부담 분리 포함
        const deptList = [...deptMap.entries()].map(([dept, rows]) => {
          const dTotal  = rows.reduce((s,r) => s + convertedKrw(r.annualKrw, r.annualUsd, rate, mode), 0);
          const dShared = rows.filter(isShared).reduce((s,r) => s + convertedKrw(r.annualKrw, r.annualUsd, rate, mode), 0);
          const dNet    = dTotal - dShared;
          const dHas    = rows.some(isShared);
          const users   = [...new Set(rows.map(r => r.user).filter(Boolean))];
          const sws     = [...new Set(rows.map(r => r.swName))];
          return { dept, rows, dTotal, dShared, dNet, dHas, users, sws };
        }).sort((a, b) => b.dTotal - a.dTotal);

        const maxDept = deptList[0]?.dTotal || 1;

        return (
          <CompanyBlock
            key={co}
            co={co} coRows={coRows} coTotal={coTotal} coShared={coShared} coNet={coNet} coHas={coHas}
            deptList={deptList} maxDept={maxDept} rate={rate} mode={mode} periodLabel={periodLabel}
          />
        );
      })}

      {/* ── 전체 합계 (법인 2개 이상일 때) ── */}
      {coMap.size > 1 && (
        <div className="flex items-center justify-between bg-slate-900 text-white rounded-xl px-5 py-3.5">
          <span className="text-sm font-semibold text-slate-300">
            전체 합계 · {coMap.size}개 법인 · {totalLicenses}건
          </span>
          <div className="text-right">
            <div className="text-xl font-bold text-blue-300">₩{fmt(grandTotal)}<span className="text-sm ml-1">/{mode==="monthly"?"월":"년"}</span></div>
            {hasShared && <div className="text-xs text-slate-500 mt-0.5">쉐어드 ₩{fmt(sharedTotal)} 포함</div>}
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400 text-right">
        * 환율 $1 = ₩{fmt(rate)} (실시간) · 금액은 쉐어드청구 포함 총액 기준
      </p>
    </div>{/* /화면용 */}


    {/* ════════════════════════════════
        인쇄 전용 뷰 (A4 세로, 화면에서는 숨김)
    ════════════════════════════════ */}
    <div className="report-print-only hidden" style={{fontFamily:"'Apple SD Gothic Neo','Noto Sans KR',sans-serif",color:"#0f172a",fontSize:"7.5pt",lineHeight:1.35}}>
      <style>{`
        @page { size: A4 portrait; margin: 8mm 7mm; }
        @media print {
          html,body { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
          .pa { break-inside:avoid; }
          .pb { break-after:page; }
          table { table-layout:fixed; }
        }
      `}</style>

      {/* ── 법인별 페이지 ── */}
      {[...printCoMap.entries()].map(([co, deptMap], coIdx) => {
        const coRows   = [...deptMap.values()].flat();
        const coTotal  = coRows.reduce((s,r) => s + convertedKrw(r.annualKrw, r.annualUsd, rate, "monthly"), 0);
        const coShared = coRows.filter(isShared).reduce((s,r) => s + convertedKrw(r.annualKrw, r.annualUsd, rate, "monthly"), 0);
        const coNet    = coTotal - coShared;
        const coHas    = coRows.some(isShared);
        // 선택 법인이면 페이지 구분 없음, 전체 출력 시 법인별 페이지 구분
        const isLast   = coIdx === [...printCoMap.keys()].length - 1;

        // 부서별 데이터 (비용 내림차순)
        const deptList = [...deptMap.entries()].map(([dept, dRows]) => {
          const dTotal   = dRows.reduce((s,r) => s + convertedKrw(r.annualKrw, r.annualUsd, rate, "monthly"), 0);
          const dShared  = dRows.filter(isShared).reduce((s,r) => s + convertedKrw(r.annualKrw, r.annualUsd, rate, "monthly"), 0);
          const dNet     = dTotal - dShared;
          const dHas     = dRows.some(isShared);
          // 부서 내 SW 집계
          const swMap = new Map<string,{count:number;mKrw:number;mUsd:number;billing:string}>();
          for (const r of dRows) {
            const key = `${r.swName}||${r.billingType||""}`;
            if (swMap.has(key)) { const g=swMap.get(key)!; g.count++; g.mKrw+=Math.round((r.annualKrw||0)/12); g.mUsd+=(r.annualUsd||0)/12; }
            else swMap.set(key,{count:1,mKrw:Math.round((r.annualKrw||0)/12),mUsd:(r.annualUsd||0)/12,billing:r.billingType||""});
          }
          const swList = [...swMap.entries()].map(([k,g])=>({swName:k.split("||")[0],billing:g.billing,...g}));
          return { dept, dRows, dTotal, dShared, dNet, dHas, swList };
        }).sort((a,b) => b.dTotal - a.dTotal);

        const maxDept = deptList[0]?.dTotal || 1;

        return (
          <div key={co} className={isLast ? "pa" : "pa pb"}>

            {/* ① 리포트 헤더 + 법인 요약 (한 줄로 압축) */}
            <div className="pa" style={{marginBottom:"2.5mm",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"2px solid #1e3a8a",paddingBottom:"2mm"}}>
              <div>
                <div style={{fontSize:"11pt",fontWeight:800,color:"#1e3a8a"}}>구독 SW 월간 현황 · {co}</div>
                <div style={{fontSize:"7pt",color:"#71717A",marginTop:"0.5mm"}}>IT 자산관리 파트 · {coRows.length}건 구독 · {[...deptMap.keys()].length}개 부서</div>
              </div>
              <div style={{textAlign:"right",display:"flex",gap:"4mm",alignItems:"center"}}>
                <div style={{textAlign:"center",background:"#1e3a8a",color:"white",borderRadius:"1.5mm",padding:"1mm 3mm"}}>
                  <div style={{fontSize:"6.5pt",color:"#bfdbfe"}}>{printYear}년 {printMonth}월 기준</div>
                  <div style={{fontSize:"10pt",fontWeight:800}}>₩{fmt(coTotal)}</div>
                  {coHas && <div style={{fontSize:"6pt",color:"#A5B4FC",marginTop:"0.3mm"}}>쉐어드 ₩{fmt(coShared)} 포함</div>}
                </div>
                <div style={{fontSize:"6.5pt",color:"#A1A1AA",textAlign:"right"}}>
                  <div>{printYear}.{String(printMonth).padStart(2,"0")}</div>
                  <div>$1=₩{fmt(rate)}</div>
                </div>
              </div>
            </div>

            {/* ② 부서별 바 차트 (컴팩트) */}
            <div className="pa" style={{marginBottom:"2mm",padding:"2mm 3mm",background:"#FAFAFA",border:"1px solid #E4E4E7",borderRadius:"1.5mm"}}>
              <div style={{fontSize:"7pt",fontWeight:700,color:"#52525B",marginBottom:"1.5mm"}}>부서별 지출 현황</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(55mm,1fr))",gap:"1mm 3mm"}}>
                {deptList.map(({dept, dTotal, dNet, dHas}) => {
                  const pct = (dTotal / maxDept * 100).toFixed(1);
                  return (
                    <div key={dept} style={{display:"flex",alignItems:"center",gap:"1.5mm"}}>
                      <div style={{width:"18mm",textAlign:"right",fontSize:"7pt",fontWeight:600,color:"#334155",flexShrink:0,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{dept}</div>
                      <div style={{flex:1,height:"4mm",background:"#E4E4E7",borderRadius:"1mm",overflow:"hidden"}}>
                        <div style={{height:"100%",background:"#1e40af",width:`${pct}%`}}/>
                      </div>
                      <div style={{width:"20mm",textAlign:"right",flexShrink:0}}>
                        <span style={{fontSize:"7pt",fontWeight:700,color:"#1e3a8a"}}>₩{fmt(dTotal)}</span>
                        {dHas && <div style={{fontSize:"5.5pt",color:"#A1A1AA"}}>쉐어드 ₩{fmt(dNet > 0 ? dTotal - dNet : 0)} 포함</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ③ 부서별 SW 요약 + 상세를 하나의 통합 테이블로 */}
            <div className="pa">
              <div style={{fontSize:"7pt",fontWeight:700,color:"#334155",marginBottom:"1.5mm",paddingBottom:"1mm",borderBottom:"1.5px solid #1e3a8a",display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                <span>사용자별 구독 현황 상세</span>
                <span style={{fontSize:"6.5pt",color:"#71717A",fontWeight:400}}>* [쉐] 쉐어드청구 항목 · 금액은 총액 기준</span>
              </div>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:"6.5pt"}}>
                <thead>
                  <tr style={{background:"#1e3a8a",color:"white"}}>
                    <th style={{padding:"1.2mm 1.5mm",textAlign:"left",fontWeight:700,width:"13%"}}>부서</th>
                    <th style={{padding:"1.2mm 1.5mm",textAlign:"left",fontWeight:700,width:"12%"}}>사용자</th>
                    <th style={{padding:"1.2mm 1.5mm",textAlign:"left",fontWeight:700,width:"20%"}}>SW 명칭</th>
                    <th style={{padding:"1.2mm 1.5mm",textAlign:"center",fontWeight:700,width:"8%"}}>카테고리</th>
                    <th style={{padding:"1.2mm 1.5mm",textAlign:"right",fontWeight:700,width:"13%"}}>월 KRW</th>
                    <th style={{padding:"1.2mm 1.5mm",textAlign:"right",fontWeight:700,width:"10%"}}>월 USD</th>
                    <th style={{padding:"1.2mm 1.5mm",textAlign:"right",fontWeight:700,width:"13%"}}>원화환산</th>
                    <th style={{padding:"1.2mm 1.5mm",textAlign:"center",fontWeight:700,width:"11%"}}>갱신일</th>
                  </tr>
                </thead>
                <tbody>
                  {deptList.flatMap(({dept, dRows, dTotal, dNet, dHas}) => {
                    const deptRows = dRows.map((r, ri) => {
                      const mKrw = Math.round((r.annualKrw||0)/12);
                      const mUsd = (r.annualUsd||0)/12;
                      const conv = convertedKrw(r.annualKrw, r.annualUsd, rate, "monthly");
                      const shared = isShared(r);
                      return (
                        <tr key={r.id} style={{background:shared?"#fffbeb":ri%2===0?"#ffffff":"#FAFAFA",borderBottom:"1px solid #F4F4F5"}}>
                          <td style={{padding:"1mm 1.5mm",color:"#334155",verticalAlign:"top",fontWeight:ri===0?700:400,borderLeft:ri===0?"3px solid #1e3a8a":"3px solid transparent"}}>
                            {ri===0 ? dept : ""}
                          </td>
                          <td style={{padding:"1mm 1.5mm",color:"#52525B",verticalAlign:"top"}}>{r.user||"—"}</td>
                          <td style={{padding:"1mm 1.5mm",fontWeight:600,color:shared?"#92400e":"#0f172a",verticalAlign:"top"}}>
                            {r.swName}{shared&&<span style={{fontSize:"6pt",marginLeft:"0.5mm"}}>[쉐]</span>}
                          </td>
                          <td style={{padding:"1mm 1.5mm",textAlign:"center",color:"#52525B",verticalAlign:"top"}}>{r.category}</td>
                          <td style={{padding:"1mm 1.5mm",textAlign:"right",color:"#334155",verticalAlign:"top"}}>{mKrw>0?fmt(mKrw):"—"}</td>
                          <td style={{padding:"1mm 1.5mm",textAlign:"right",color:"#059669",verticalAlign:"top"}}>{mUsd>0?`$${mUsd.toFixed(2)}`:"—"}</td>
                          <td style={{padding:"1mm 1.5mm",textAlign:"right",fontWeight:600,color:shared?"#92400e":"#1e3a8a",verticalAlign:"top"}}>{conv>0?fmt(conv):"—"}</td>
                          <td style={{padding:"1mm 1.5mm",textAlign:"center",color:"#71717A",verticalAlign:"top"}}>{r.renewalDate?r.renewalDate.slice(0,7):"—"}</td>
                        </tr>
                      );
                    });
                    // 부서 소계
                    deptRows.push(
                      <tr key={`${dept}-sub`} style={{background:"#EEF2FF",borderTop:"1px solid #bfdbfe",borderBottom:"1.5px solid #bfdbfe"}}>
                        <td colSpan={6} style={{padding:"0.8mm 1.5mm",color:"#1e3a8a",fontSize:"6.5pt"}}>
                          {dept} 소계 ({dRows.length}건){dHas&&<span style={{color:"#A1A1AA",marginLeft:"2mm",fontWeight:400}}>쉐어드 ₩{fmt(dTotal-dNet)} 포함</span>}
                        </td>
                        <td style={{padding:"0.8mm 1.5mm",textAlign:"right",fontWeight:700,color:"#1e3a8a",fontSize:"6.5pt"}}>₩{fmt(dTotal)}</td>
                        <td/>
                      </tr>
                    );
                    return deptRows;
                  })}
                </tbody>
                <tfoot>
                  <tr style={{background:"#1e3a8a",color:"white"}}>
                    <td colSpan={6} style={{padding:"1.5mm",fontWeight:700,fontSize:"7.5pt"}}>
                      {co} 합계 · {[...deptMap.keys()].length}개 부서 · {coRows.length}건
                      {coHas&&<span style={{color:"#A5B4FC",marginLeft:"2mm",fontWeight:400,fontSize:"6.5pt"}}>쉐어드 ₩{fmt(coShared)} 포함</span>}
                    </td>
                    <td style={{padding:"1.5mm",textAlign:"right",fontWeight:800,fontSize:"8.5pt",color:"#fbbf24"}}>₩{fmt(coTotal)}</td>
                    <td/>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* 주석 */}
            <div style={{marginTop:"1.5mm",fontSize:"6pt",color:"#A1A1AA",display:"flex",justifyContent:"space-between"}}>
              <span>환율 $1=₩{fmt(rate)} (실시간 기준) · 금액은 쉐어드청구 포함 총액 기준 · [쉐] 쉐어드청구 항목</span>
              <span>IT 자산관리 포털 · {printYear}.{String(printMonth).padStart(2,"0")}</span>
            </div>
          </div>
        );
      })}

    </div>{/* /인쇄 전용 */}
    </>
  );
}
