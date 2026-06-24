"use client";

import { useEffect, useState, useCallback } from "react";
import { safeJson } from "@/lib/fetch-json";

interface ExpiringGroup {
  company: string;
  department: string;
  renewalDate: string;
  count: number;
  ids: string[];
  sw: string[];
}

interface Props { company?: string; }

const DISMISS_KEY = "renewal-alert-dismissed";

export default function RenewalAlertModal({ company = "" }: Props) {
  const [groups, setGroups]   = useState<ExpiringGroup[]>([]);
  const [open,   setOpen]     = useState(false);
  const [acting, setActing]   = useState(false);
  const [result, setResult]   = useState<{ msg: string; type: "ok" | "warn" } | null>(null);

  const load = useCallback(async () => {
    // 오늘 이미 닫았으면 스킵
    const dismissed = sessionStorage.getItem(DISMISS_KEY);
    if (dismissed === new Date().toDateString()) return;

    const url = company
      ? `/api/sw/expiring?company=${encodeURIComponent(company)}`
      : "/api/sw/expiring";
    try {
      const res  = await fetch(url);
      const json = await safeJson(res);
      if (json.ok && (json.groups ?? []).length > 0) {
        setGroups(json.groups);
        setOpen(true);
      }
    } catch { /* silent */ }
  }, [company]);

  useEffect(() => { load(); }, [load]);

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, new Date().toDateString());
    setOpen(false);
  };

  const handleAction = async (action: "renew" | "expire") => {
    const allIds = groups.flatMap(g => g.ids);
    setActing(true);
    try {
      const res  = await fetch("/api/sw/bulk-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: allIds, action }),
      });
      const json = await safeJson(res);
      if (json.ok) {
        setResult(action === "renew"
          ? { msg: `✅ ${json.success}건 갱신 완료 — 갱신일이 1개월 연장되었습니다.`, type: "ok" }
          : { msg: `⚠️ ${json.success}건 만료 처리 — 14일 후 자동 삭제됩니다.`, type: "warn" }
        );
        setTimeout(dismiss, 3000);
      } else {
        setResult({ msg: `오류: ${json.error}`, type: "warn" });
      }
    } catch (e) {
      setResult({ msg: "처리 중 오류가 발생했습니다.", type: "warn" });
    } finally {
      setActing(false);
    }
  };

  if (!open) return null;

  const total = groups.reduce((s, g) => s + g.count, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* 헤더 */}
        <div className="bg-amber-500 px-5 py-4 flex items-center gap-3">
          <span className="text-2xl select-none">⏰</span>
          <div className="flex-1">
            <div className="font-bold text-white text-base">구독 갱신 알림</div>
            <div className="text-amber-100 text-xs mt-0.5">
              7일 이내 만료 예정 — 총 <strong>{total}건</strong> (월간 구독)
            </div>
          </div>
          <button onClick={dismiss}
            className="text-amber-200 hover:text-white text-xl leading-none ml-2">✕</button>
        </div>

        {/* 그룹 목록 */}
        <div className="px-5 py-4 space-y-2 max-h-60 overflow-y-auto">
          {groups.map((g, i) => (
            <div key={i} className="flex items-start justify-between bg-amber-50 rounded-xl px-3.5 py-3 border border-amber-200">
              <div className="min-w-0 flex-1 pr-3">
                <div className="font-semibold text-slate-800 text-sm">
                  {g.company}
                  {g.department && <span className="text-slate-500 font-normal text-xs ml-1.5">· {g.department}</span>}
                </div>
                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span className="text-amber-700 font-medium">{g.renewalDate} 만료</span>
                  <span className="text-slate-300">·</span>
                  <span>{g.sw.slice(0, 3).join(" · ")}{g.sw.length > 3 ? ` 외 ${g.sw.length-3}개` : ""}</span>
                </div>
              </div>
              <span className="shrink-0 text-amber-700 font-bold text-sm bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-full">
                {g.count}명
              </span>
            </div>
          ))}
        </div>

        {/* 결과 메시지 */}
        {result && (
          <div className={`px-5 py-2.5 text-sm font-medium ${
            result.type === "ok" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
          }`}>
            {result.msg}
          </div>
        )}

        {/* 안내 문구 */}
        {!result && (
          <div className="px-5 pb-1 text-xs text-slate-400">
            · 일괄 갱신: 갱신일 +1개월 &nbsp;·&nbsp; 갱신 취소 → 만료 처리, 14일 후 자동 삭제
          </div>
        )}

        {/* 버튼 */}
        {!result && (
          <div className="px-5 py-4 border-t border-slate-100 flex gap-2">
            <button onClick={dismiss}
              className="py-2.5 px-4 border border-slate-200 rounded-xl text-sm text-slate-500 hover:bg-slate-50 transition-colors">
              나중에
            </button>
            <button onClick={() => handleAction("expire")} disabled={acting}
              className="py-2.5 px-4 border border-red-200 rounded-xl text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
              갱신 취소
            </button>
            <button onClick={() => handleAction("renew")} disabled={acting}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors">
              {acting ? "처리 중…" : "일괄 갱신 (+1개월)"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
