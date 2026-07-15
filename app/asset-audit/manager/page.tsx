"use client";

import { useEffect, useMemo, useState } from "react";
import { safeJson } from "@/lib/fetch-json";
import type { OrgTreeNode } from "@/lib/org-chart";

const C = {
  brand:      "var(--brand)",
  brandSoft:  "var(--brand-soft)",
  text1:      "var(--portal-text)",
  text2:      "var(--portal-text-2)",
  text3:      "var(--portal-text-3)",
  border:     "var(--portal-border)",
  bg:         "var(--portal-bg)",
  bgPage:     "var(--portal-bg-page)",
  good:       "var(--state-positive)",
  danger:     "var(--state-risk)",
} as const;

// ── 타입 스케일 (사용자 페이지와 동일한 단계) ──
const T = {
  h1: { fontSize: 26, fontWeight: 700 },
  h2: { fontSize: 18, fontWeight: 700 },
  h3: { fontSize: 15, fontWeight: 700 },
  body: { fontSize: 14, lineHeight: 1.7 },
  label: { fontSize: 13, fontWeight: 600 },
  caption: { fontSize: 12 },
} as const;

const balance = { textWrap: "balance" as const };
const pretty = { textWrap: "pretty" as const };

const TOKEN_KEY = "asset-audit-manager-token";

function pct(node: OrgTreeNode): number {
  const { total, verified } = node.rollupProgress;
  if (total === 0) return 0;
  return Math.round((verified / total) * 100);
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 rounded-full overflow-hidden shrink-0" style={{ background: C.border, width: 96 }}>
      <div className="h-full rounded-full" style={{ width: `${value}%`, background: value >= 100 ? C.good : C.brand }} />
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
  const value = pct(node);
  const complete = node.rollupProgress.total > 0 && node.rollupProgress.verified === node.rollupProgress.total;

  return (
    <div>
      <div
        className="flex items-center gap-2.5 py-2.5 rounded-lg"
        style={{ paddingLeft: 4 + depth * 20 }}
        onMouseEnter={e => (e.currentTarget.style.background = C.bg)}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      >
        <button
          onClick={() => hasChildren && onToggle(node.id)}
          className="w-4 shrink-0"
          style={{ ...T.caption, color: C.text3 }}
          disabled={!hasChildren}
        >
          {hasChildren ? (isOpen ? "▼" : "▶") : ""}
        </button>
        <span className="px-1.5 py-0.5 rounded shrink-0" style={{ ...T.caption, fontWeight: 600, background: C.brandSoft, color: C.text2 }}>
          {node.level}
        </span>
        <span className="truncate" style={{ fontSize: 14.5, fontWeight: 500, color: C.text1 }}>{node.name}</span>
        {node.managerName && (
          <span className="shrink-0" style={{ ...T.label, fontWeight: 500, color: C.text3 }}>담당: {node.managerName}</span>
        )}
        <div className="flex-1" />
        <span className="shrink-0" style={{ ...T.label, color: complete ? C.good : C.text3 }}>
          {node.rollupProgress.verified}/{node.rollupProgress.total}
        </span>
        <ProgressBar value={value} />
        <span className="shrink-0 w-9 text-right" style={{ ...T.label, color: complete ? C.good : C.text2 }}>{value}%</span>
      </div>
      {isOpen && node.children.map(child => (
        <TreeRow key={child.id} node={child} depth={depth + 1} expanded={expanded} onToggle={onToggle} />
      ))}
    </div>
  );
}

function collectIds(node: OrgTreeNode): string[] {
  return [node.id, ...node.children.flatMap(collectIds)];
}

export default function AssetAuditManagerPage() {
  const [email, setEmail] = useState("");
  const [code, setCode]   = useState("");
  const [step, setStep]   = useState<"email" | "code">("email");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const [token, setToken] = useState<string | null>(null);
  const [unit, setUnit]   = useState<OrgTreeNode | null>(null);
  const [loadingTree, setLoadingTree] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [reminding, setReminding] = useState(false);
  const [remindResult, setRemindResult] = useState<{ targetCount: number; sent: number } | null>(null);

  // 실사 페이지는 다크모드를 지원하지 않음 — 다른 포털 페이지에서 다크모드를
  // 켜둔 상태로 넘어와도 이 페이지에서는 항상 라이트 모드로 표시한다.
  useEffect(() => {
    document.documentElement.classList.remove("portal-dark");
  }, []);

  // 새로고침 시 세션 저장된 토큰으로 자동 재조회 (8시간 유효)
  useEffect(() => {
    const saved = typeof window !== "undefined" ? sessionStorage.getItem(TOKEN_KEY) : null;
    if (saved) {
      setToken(saved);
      loadTree(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function requestCode() {
    if (!email.trim()) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/asset-audit/manager-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const json = await safeJson(res);
      if (!json?.ok) { setError(json?.error ?? "인증코드 발송에 실패했습니다."); return; }
      setStep("code");
    } catch {
      setError("인증코드 발송 중 오류가 발생했습니다.");
    } finally {
      setSending(false);
    }
  }

  async function verifyCode() {
    if (!code.trim()) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/asset-audit/manager-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      });
      const json = await safeJson(res);
      if (!json?.ok) { setError(json?.error ?? "인증코드가 올바르지 않습니다."); return; }
      setToken(json.token);
      if (typeof window !== "undefined") sessionStorage.setItem(TOKEN_KEY, json.token);
      await loadTree(json.token);
    } catch {
      setError("인증 확인 중 오류가 발생했습니다.");
    } finally {
      setSending(false);
    }
  }

  async function loadTree(t: string) {
    setLoadingTree(true);
    try {
      const res = await fetch(`/api/asset-audit/manager-tree?token=${encodeURIComponent(t)}`, { cache: "no-store" });
      const json = await safeJson(res);
      if (!json?.ok) { setError(json?.error ?? "조회에 실패했습니다."); setToken(null); return; }
      setUnit(json.unit);
      setExpanded(new Set([json.unit.id]));
    } catch {
      setError("조회 중 오류가 발생했습니다.");
    } finally {
      setLoadingTree(false);
    }
  }

  async function sendReminders() {
    if (!token) return;
    setReminding(true);
    setRemindResult(null);
    try {
      const res = await fetch("/api/asset-audit/manager-remind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = await safeJson(res);
      if (json?.ok) setRemindResult({ targetCount: json.targetCount, sent: json.sent });
      else setError(json?.error ?? "독려 메일 발송에 실패했습니다.");
    } catch {
      setError("독려 메일 발송 중 오류가 발생했습니다.");
    } finally {
      setReminding(false);
    }
  }

  const allIds = useMemo(() => (unit ? collectIds(unit) : []), [unit]);
  const overallPct = unit ? pct(unit) : 0;
  const overallComplete = unit ? unit.rollupProgress.total > 0 && unit.rollupProgress.verified === unit.rollupProgress.total : false;

  return (
    <div className="min-h-screen" style={{ background: C.bgPage }}>
      <header className="flex items-center justify-between px-4 sm:px-6 md:px-10 h-16 bg-white" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-3 min-w-0">
          <img src="/logo.png" alt="로고" className="shrink-0" style={{ height: 26, width: "auto", maxWidth: 160, objectFit: "contain" }} />
          <span className="hidden sm:inline truncate" style={{ ...T.label, color: C.text3 }}>자산 실사 · 직책자</span>
        </div>
      </header>

      <div className="px-4 sm:px-6 md:px-10 py-10 md:py-14">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-[26px] sm:text-[30px] font-bold mb-2.5" style={{ ...balance, color: C.text1, letterSpacing: "-0.01em" }}>직책자 실사 현황 조회</h1>
            <p style={{ ...T.body, ...pretty, fontSize: 15, color: C.text3 }}>담당 조직의 자산 실사 진행률을 확인하고, 미완료 인원에게 독려 메일을 보낼 수 있습니다.</p>
          </div>

          {!token ? (
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm max-w-md mx-auto" style={{ border: `1px solid ${C.border}` }}>
              <h2 className="mb-4" style={{ ...T.h2, color: C.text1 }}>이메일 인증</h2>

              <div className="mb-4">
                <label className="block mb-1" style={{ ...T.label, color: C.text3 }}>직책자 이메일</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={step === "code"}
                  placeholder="name@company.com"
                  className="w-full px-3 py-2 rounded-lg disabled:bg-gray-50"
                  style={{ fontSize: 14.5, border: `1px solid ${C.border}` }}
                />
              </div>

              {step === "code" && (
                <div className="mb-4">
                  <label className="block mb-1" style={{ ...T.label, color: C.text3 }}>인증코드 (6자리)</label>
                  <input
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    placeholder="123456"
                    className="w-full px-3 py-2 rounded-lg tracking-widest"
                    style={{ fontSize: 14.5, border: `1px solid ${C.border}` }}
                  />
                  <p className="mt-1" style={{ ...T.caption, color: C.text3 }}>{email}로 발송된 인증코드를 입력해주세요.</p>
                </div>
              )}

              {error && <p className="mb-3" style={{ ...T.label, fontWeight: 500, color: C.danger }}>{error}</p>}

              <button
                onClick={step === "email" ? requestCode : verifyCode}
                disabled={sending || (step === "email" ? !email.trim() : !code.trim()) || loadingTree}
                className="w-full h-11 rounded-xl text-white disabled:opacity-40"
                style={{ fontSize: 15, fontWeight: 700, background: C.brand }}
              >
                {sending || loadingTree ? "처리 중…" : step === "email" ? "인증코드 받기" : "확인하고 조회하기"}
              </button>

              {step === "code" && (
                <button onClick={() => { setStep("email"); setCode(""); setError(""); }} className="w-full mt-3" style={{ ...T.label, fontWeight: 500, color: C.text3 }}>
                  이메일 다시 입력
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white rounded-3xl p-6 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
                <div className="flex items-center justify-between mb-1">
                  <h2 style={{ ...T.h2, color: C.text1 }}>{unit?.name ?? ""} 전체 진행률</h2>
                  <span style={{ fontSize: 19, fontWeight: 700, color: overallComplete ? C.good : C.text1 }}>{overallPct}%</span>
                </div>
                <p className="mb-3" style={{ ...T.body, color: C.text3 }}>
                  총 {unit?.rollupProgress.total ?? 0}건 중 {unit?.rollupProgress.verified ?? 0}건 실사 확인 완료
                </p>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: C.border }}>
                  <div className="h-full rounded-full" style={{ width: `${overallPct}%`, background: overallComplete ? C.good : C.brand }} />
                </div>

                <div className="flex flex-wrap items-center gap-3 mt-4">
                  <button
                    onClick={sendReminders}
                    disabled={reminding || overallComplete}
                    className="px-4 py-2 rounded-lg text-white disabled:opacity-40"
                    style={{ ...T.label, background: C.brand }}
                  >
                    {reminding ? "발송 중…" : "미완료 대상자에게 독려 메일 발송"}
                  </button>
                  {overallComplete && (
                    <span style={{ ...T.label, color: C.good }}>모든 대상자가 실사를 완료했습니다.</span>
                  )}
                  {remindResult && (
                    <span style={{ ...T.label, fontWeight: 500, color: C.text3 }}>
                      대상 {remindResult.targetCount}명 중 {remindResult.sent}건 발송 완료
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-3xl p-4 md:p-6 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
                <div className="flex items-center justify-between mb-2 px-1">
                  <h3 style={{ ...T.h3, color: C.text1 }}>조직별 상세 현황</h3>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setExpanded(new Set(allIds))} className="hover:underline" style={{ ...T.label, fontWeight: 500, color: C.brand }}>모두 펼치기</button>
                    <button onClick={() => setExpanded(new Set(unit ? [unit.id] : []))} className="hover:underline" style={{ ...T.label, fontWeight: 500, color: C.text3 }}>모두 접기</button>
                  </div>
                </div>
                {unit && <TreeRow node={unit} depth={0} expanded={expanded} onToggle={toggle} />}
              </div>

              {error && <p className="text-center" style={{ ...T.label, fontWeight: 500, color: C.danger }}>{error}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
