"use client";

import { useEffect, useState, useCallback } from "react";
import { safeJson } from "@/lib/fetch-json";

interface ExpiringGroup {
  company: string;
  department: string;
  renewalDate: string;
  cycle: string;          // "월" | "연"
  count: number;
  ids: string[];
  sw: string[];
}

interface Props {
  company?: string;
  open?: boolean;
  onClose?: () => void;
  onCountChange?: (n: number) => void;
}

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - new Date().setHours(0,0,0,0);
  return Math.ceil(diff / 86400000);
}

export default function RenewalAlertModal({ company = "", open: openProp, onClose, onCountChange }: Props) {
  const [groups, setGroups] = useState<ExpiringGroup[]>([]);
  const [acting, setActing] = useState(false);
  const [result, setResult] = useState<{ msg: string; type: "ok" | "warn" } | null>(null);

  const open = openProp ?? false;

  // 그룹을 월간/연간으로 분리
  const monthlyGroups = groups.filter(g => g.cycle === "월");
  const annualGroups  = groups.filter(g => g.cycle === "연");

  const load = useCallback(async () => {
    const url = company
      ? `/api/sw/expiring?company=${encodeURIComponent(company)}`
      : "/api/sw/expiring";
    try {
      const json = await fetch(url).then(r => safeJson(r));
      if (json.ok) {
        const grps = json.groups ?? [];
        setGroups(grps);
        onCountChange?.(grps.reduce((s: number, g: ExpiringGroup) => s + g.count, 0));
      }
    } catch { /* silent */ }
  }, [company, onCountChange]);

  useEffect(() => { load(); }, [load]);

  // 열릴 때마다 결과 초기화
  useEffect(() => { if (open) setResult(null); }, [open]);

  const dismiss = () => {
    onClose?.();
  };

  const handleAction = async (action: "renew" | "expire", targetGroups: ExpiringGroup[]) => {
    const ids = targetGroups.flatMap(g => g.ids);
    if (ids.length === 0) return;
    setActing(true);
    try {
      const json = await fetch("/api/sw/bulk-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action }),
      }).then(r => safeJson(r));

      if (json.ok) {
        setResult(action === "renew"
          ? { msg: `✅ ${json.success}건 갱신 완료 — 갱신일이 연장되었습니다.`, type: "ok" }
          : { msg: `⚠️ ${json.success}건 만료 처리 — 30일 후 자동 삭제됩니다.`, type: "warn" }
        );
        setTimeout(dismiss, 3500);
      } else {
        setResult({ msg: `오류: ${json.error}`, type: "warn" });
      }
    } catch {
      setResult({ msg: "처리 중 오류가 발생했습니다.", type: "warn" });
    } finally {
      setActing(false);
    }
  };

  if (!open) return null;

  const totalCount = groups.reduce((s, g) => s + g.count, 0);

  const GroupSection = ({
    list, label, badge, daysLabel,
  }: {
    list: ExpiringGroup[]; label: string; badge: string; daysLabel: string;
  }) => {
    if (list.length === 0) return null;
    const sectionIds = list.flatMap(g => g.ids);

    return (
      <div className="mb-3">
        {/* 섹션 헤더 */}
        <div className="flex items-center justify-between mb-1.5 px-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{badge}</span>
            <span className="text-xs font-semibold text-slate-700">{label}</span>
            <span className="text-[10px] text-slate-400">({daysLabel} 이내)</span>
          </div>
          {/* 섹션별 일괄 액션 */}
          {!result && (
            <div className="flex gap-1">
              <button
                onClick={() => handleAction("expire", list)}
                disabled={acting}
                className="text-[10px] px-2 py-0.5 border border-red-200 rounded text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                갱신 취소
              </button>
              <button
                onClick={() => handleAction("renew", list)}
                disabled={acting}
                className="text-[10px] px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                일괄 갱신
              </button>
            </div>
          )}
        </div>

        {/* 그룹 목록 */}
        <div className="space-y-1.5">
          {list.map((g, i) => {
            const d = daysUntil(g.renewalDate);
            const urgent = d <= (g.cycle === "월" ? 3 : 7);
            return (
              <div key={i}
                className={`flex items-start justify-between rounded-xl px-3.5 py-2.5 border ${
                  urgent ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
                }`}
              >
                <div className="min-w-0 flex-1 pr-3">
                  <div className="font-semibold text-slate-800 text-sm">
                    {g.company}
                    {g.department && (
                      <span className="text-slate-500 font-normal text-xs ml-1.5">· {g.department}</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <span className={`font-semibold ${urgent ? "text-red-600" : "text-amber-700"}`}>
                      D-{d} ({g.renewalDate})
                    </span>
                    <span className="text-slate-300">·</span>
                    <span>{g.sw.slice(0, 3).join(" · ")}{g.sw.length > 3 ? ` 외 ${g.sw.length - 3}개` : ""}</span>
                  </div>
                </div>
                <span className={`shrink-0 font-bold text-sm px-2.5 py-1 rounded-full border ${
                  urgent
                    ? "bg-red-100 border-red-300 text-red-700"
                    : "bg-amber-100 border-amber-300 text-amber-700"
                }`}>
                  {g.count}명
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* 헤더 */}
        <div className="bg-amber-500 px-5 py-4 flex items-center gap-3">
          <span className="text-2xl select-none">⏰</span>
          <div className="flex-1">
            <div className="font-bold text-white text-base">구독 갱신 알림</div>
            <div className="text-amber-100 text-xs mt-0.5">
              갱신 예정 구독 — 총 <strong>{totalCount}건</strong>
              {monthlyGroups.length > 0 && <span className="ml-1">(월간 {monthlyGroups.reduce((s,g)=>s+g.count,0)}건</span>}
              {annualGroups.length > 0 && <span className="ml-0.5">/ 연간 {annualGroups.reduce((s,g)=>s+g.count,0)}건)</span>}
              {annualGroups.length === 0 && monthlyGroups.length > 0 && <span>)</span>}
            </div>
          </div>
          <button onClick={dismiss}
            className="text-amber-200 hover:text-white text-xl leading-none">✕</button>
        </div>

        {/* 그룹 목록 */}
        <div className="px-5 py-4 max-h-80 overflow-y-auto">
          <GroupSection
            list={monthlyGroups}
            label="월간 구독"
            badge="월"
            daysLabel="14일"
          />
          <GroupSection
            list={annualGroups}
            label="연간 구독"
            badge="연"
            daysLabel="30일"
          />
        </div>

        {/* 결과 메시지 */}
        {result && (
          <div className={`px-5 py-3 text-sm font-medium ${
            result.type === "ok" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
          }`}>
            {result.msg}
          </div>
        )}

        {/* 안내 */}
        {!result && (
          <div className="px-5 pb-1 text-[10px] text-slate-400 leading-relaxed">
            · 일괄 갱신 — 갱신일 +1개월(월간) / +1년(연간) 자동 연장<br/>
            · 갱신 취소 — 만료 처리, <strong>30일 후 자동 삭제</strong>
          </div>
        )}

        {/* 전체 일괄 액션 버튼 */}
        {!result && (
          <div className="px-5 py-4 border-t border-slate-100 flex gap-2">
            <button onClick={dismiss}
              className="py-2.5 px-4 border border-slate-200 rounded-xl text-sm text-slate-500 hover:bg-slate-50 transition-colors">
              나중에
            </button>
            <button onClick={() => handleAction("expire", groups)} disabled={acting}
              className="py-2.5 px-4 border border-red-200 rounded-xl text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
              전체 만료
            </button>
            <button onClick={() => handleAction("renew", groups)} disabled={acting}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors">
              {acting ? "처리 중…" : "전체 갱신"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
