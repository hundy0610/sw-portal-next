"use client";

import { useEffect, useMemo, useState } from "react";
import { safeJson } from "@/lib/fetch-json";
import type { OrgTreeNode } from "@/lib/org-chart";
import type { AssetAuditDashboardData } from "@/app/api/asset-audit/dashboard/route";

function pct(node: OrgTreeNode): number {
  const { total, verified } = node.rollupProgress;
  if (total === 0) return 0;
  return Math.round((verified / total) * 100);
}

function ProgressBar({ value }: { value: number }) {
  const complete = value >= 100;
  return (
    <div className="h-1.5 rounded-full overflow-hidden shrink-0 bg-gray-100" style={{ width: 96 }}>
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.min(value, 100)}%`, background: complete ? "var(--state-positive)" : "var(--state-progress)" }}
      />
    </div>
  );
}

function TreeRow({ node, depth, expanded, onToggle }: {
  node: OrgTreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}) {
  const isOpen = expanded.has(node.id);
  const hasChildren = node.children.length > 0;
  const hasMembers = node.memberStatus.length > 0;
  const canExpand = hasChildren || hasMembers;
  const value = pct(node);
  const complete = node.rollupProgress.total > 0 && node.rollupProgress.verified === node.rollupProgress.total;

  return (
    <div>
      <div className="flex items-center gap-2.5 py-2 rounded-lg hover:bg-gray-50" style={{ paddingLeft: 4 + depth * 20 }}>
        <button onClick={() => canExpand && onToggle(node.id)} className="w-4 text-xs text-gray-400 shrink-0" disabled={!canExpand}>
          {canExpand ? (isOpen ? "▼" : "▶") : ""}
        </button>
        <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-gray-100 text-gray-600 shrink-0">{node.level}</span>
        <span className="text-sm font-medium text-gray-900 truncate">{node.name}</span>
        {node.company && <span className="text-xs text-gray-400 shrink-0">· {node.company}</span>}
        <div className="flex-1" />
        <span className="text-xs font-semibold shrink-0" style={{ color: complete ? "var(--state-positive)" : "#4b5563" }}>
          {node.rollupProgress.verified}/{node.rollupProgress.total}
        </span>
        <ProgressBar value={value} />
        <span className="text-xs font-bold shrink-0 w-9 text-right" style={{ color: complete ? "var(--state-positive)" : "#374151", fontVariantNumeric: "tabular-nums" }}>{value}%</span>
      </div>
      {isOpen && hasMembers && (
        <div className="rounded-lg bg-gray-50 my-1 py-1" style={{ marginLeft: 24 + depth * 20 }}>
          {node.memberStatus.map(m => (
            <div key={m.email} className="flex items-center gap-2 px-2.5 py-1 text-xs">
              <span className="shrink-0 rounded-full" style={{ width: 6, height: 6, background: m.submitted ? "var(--state-positive)" : "#D1D5DB" }} />
              <span className={m.submitted ? "text-gray-700 font-medium" : "text-gray-400"}>{m.name || m.email}</span>
              <span className="text-gray-300 truncate">{m.email}</span>
              <span className="ml-auto shrink-0 font-semibold" style={{ color: m.submitted ? "var(--state-positive)" : "#9CA3AF" }}>
                {m.submitted ? "완료" : "미제출"}
              </span>
            </div>
          ))}
        </div>
      )}
      {isOpen && node.children.map(child => (
        <TreeRow key={child.id} node={child} depth={depth + 1} expanded={expanded} onToggle={onToggle} />
      ))}
    </div>
  );
}

export default function AssetAuditDashboardPanel() {
  const [data, setData]     = useState<AssetAuditDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/asset-audit/dashboard", { cache: "no-store" })
      .then(r => safeJson(r))
      .then(json => {
        if (json?.ok) {
          setData(json.data);
          setExpanded(new Set(json.data.tree.map((n: OrgTreeNode) => n.id)));
        } else {
          setError(json?.error ?? "조회 실패");
        }
      })
      .catch(() => setError("조회 중 오류가 발생했습니다."))
      .finally(() => setLoading(false));
  }, []);

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const allIds = useMemo(() => {
    function collect(node: OrgTreeNode): string[] {
      return [node.id, ...node.children.flatMap(collect)];
    }
    return data ? data.tree.flatMap(collect) : [];
  }, [data]);

  const achievementComplete = !!data && data.contractQtyTotal > 0 && data.hwVerified >= data.contractQtyTotal;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">자산 실사 진행률 대시보드</h2>
        <p className="text-xs text-gray-400 mt-0.5">계약 수량 대비 실사 확인 달성률과 조직별 진행 현황을 확인합니다.</p>
      </div>

      {loading ? (
        <p className="text-xs text-gray-400">불러오는 중…</p>
      ) : error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : data && (
        <>
          {/* ── 계약 수량 대비 달성률 배너 ── */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-400 mb-1">계약 수량 대비 실사 달성률</p>
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-4xl font-extrabold"
                    style={{ color: achievementComplete ? "var(--state-positive)" : "var(--brand)", fontVariantNumeric: "tabular-nums" }}
                  >
                    {data.achievementRate}%
                  </span>
                  <span className="text-sm text-gray-400">
                    계약 {data.contractQtyTotal.toLocaleString()}대 중 {data.hwVerified.toLocaleString()}대 확인
                  </span>
                </div>
              </div>
              <div className="text-right text-xs text-gray-400">
                <p>전체 자산 {data.hwTotal.toLocaleString()}대</p>
                <p>실사 확인 {data.hwVerified.toLocaleString()}대</p>
              </div>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden bg-gray-100 mt-4">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.min(data.achievementRate, 100)}%`, background: achievementComplete ? "var(--state-positive)" : "var(--brand)" }}
              />
            </div>
          </div>

          {/* ── 법인별 요약 ── */}
          {data.byCompany.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-3">법인별 현황</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.byCompany.map(c => {
                  const rate = c.hwTotal > 0 ? Math.round((c.hwVerified / c.hwTotal) * 100) : 0;
                  return (
                    <div key={c.company} className="border border-gray-100 rounded-xl p-3.5">
                      <p className="text-sm font-semibold text-gray-900 mb-1 truncate">{c.company || "(미지정)"}</p>
                      <p className="text-xs text-gray-400 mb-2">계약 {c.contractQty.toLocaleString()}대 · 자산 {c.hwTotal.toLocaleString()}대</p>
                      <div className="flex items-center gap-2">
                        <ProgressBar value={rate} />
                        <span className="text-xs font-bold text-gray-700" style={{ fontVariantNumeric: "tabular-nums" }}>{rate}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── 조직별 상세 트리 ── */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4 lg:p-5">
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-sm font-bold text-gray-900">조직별 상세 진행률</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => setExpanded(new Set(allIds))} className="text-xs hover:underline" style={{ color: "var(--brand)" }}>모두 펼치기</button>
                <button onClick={() => setExpanded(new Set(data.tree.map(n => n.id)))} className="text-xs text-gray-400 hover:underline">모두 접기</button>
              </div>
            </div>
            {data.tree.length === 0 ? (
              <p className="text-xs text-gray-400 px-1 py-4">등록된 조직이 없습니다. &quot;조직도 관리&quot;에서 먼저 조직을 등록해주세요.</p>
            ) : (
              data.tree.map(node => <TreeRow key={node.id} node={node} depth={0} expanded={expanded} onToggle={toggle} />)
            )}
          </div>
        </>
      )}
    </div>
  );
}
