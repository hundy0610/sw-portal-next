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
  text4:      "var(--portal-text-4)",
  border:     "var(--portal-border)",
  bg:         "var(--portal-bg)",
  bgPage:     "var(--portal-bg-page)",
  good:       "var(--state-positive)",
  goodSoft:   "var(--state-positive-soft)",
  danger:     "var(--state-risk)",
} as const;

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
        className="flex items-center gap-2.5 py-2.5 rounded-lg hover:bg-gray-50"
        style={{ paddingLeft: 4 + depth * 20 }}
      >
        <button
          onClick={() => hasChildren && onToggle(node.id)}
          className="w-4 text-[13px] shrink-0"
          style={{ color: C.text4 }}
          disabled={!hasChildren}
        >
          {hasChildren ? (isOpen ? "▼" : "▶") : ""}
        </button>
        <span className="px-1.5 py-0.5 text-[11px] font-semibold rounded shrink-0" style={{ background: C.brandSoft, color: C.text2 }}>
          {node.level}
        </span>
        <span className="text-[14.5px] font-medium truncate" style={{ color: C.text1 }}>{node.name}</span>
        {node.managerName && (
          <span className="text-[13px] shrink-0" style={{ color: C.text4 }}>담당: {node.managerName}</span>
        )}
        <div className="flex-1" />
        <span className="text-[13px] font-semibold shrink-0" style={{ color: complete ? C.good : C.text3 }}>
          {node.rollupProgress.verified}/{node.rollupProgress.total}
        </span>
        <ProgressBar value={value} />
        <span className="text-[13px] font-bold shrink-0 w-9 text-right" style={{ color: complete ? C.good : C.text2 }}>{value}%</span>
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

  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem("portal-dark");
    if (saved !== null) return saved === "1";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  function toggleDark() {
    setDarkMode(d => {
      const next = !d;
      localStorage.setItem("portal-dark", next ? "1" : "0");
      document.documentElement.classList.toggle("portal-dark", next);
      document.documentElement.classList.remove("admin-dark");
      window.dispatchEvent(new CustomEvent("portal-dark-change", { detail: next }));
      return next;
    });
  }

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
    <div className={`min-h-screen${darkMode ? " portal-dark" : ""}`} style={{ background: C.bgPage }}>
      <header className="flex items-center justify-between px-4 sm:px-6 lg:px-10 h-16 bg-white" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-3 min-w-0">
          <img src="/logo.png" alt="로고" className="shrink-0" style={{ height: 26, width: "auto", maxWidth: 160, objectFit: "contain" }} />
          <span className="hidden sm:inline text-sm font-semibold truncate" style={{ color: C.text3 }}>자산 실사 · 직책자</span>
        </div>
        <button onClick={toggleDark} className="shrink-0 text-xs font-semibold hover:underline" style={{ color: C.text4 }}>
          {darkMode ? "라이트 모드" : "다크 모드"}
        </button>
      </header>

      <div className="px-4 sm:px-6 lg:px-10 py-10 lg:py-14">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-[26px] sm:text-[30px] font-bold mb-2.5" style={{ color: C.text1, letterSpacing: "-0.01em" }}>직책자 실사 현황 조회</h1>
            <p className="text-[15px] leading-relaxed" style={{ color: C.text3 }}>담당 조직의 자산 실사 진행률을 확인하고, 미완료 인원에게 독려 메일을 보낼 수 있습니다.</p>
          </div>

          {!token ? (
            <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-sm max-w-md mx-auto" style={{ border: `1px solid ${C.border}` }}>
              <h2 className="text-[16px] font-bold mb-4" style={{ color: C.text1 }}>이메일 인증</h2>

              <div className="mb-4">
                <label className="block text-[13px] font-semibold mb-1" style={{ color: C.text4 }}>직책자 이메일</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={step === "code"}
                  placeholder="name@company.com"
                  className="w-full px-3 py-2 text-[14.5px] rounded-lg disabled:bg-gray-50"
                  style={{ border: `1px solid ${C.border}` }}
                />
              </div>

              {step === "code" && (
                <div className="mb-4">
                  <label className="block text-[13px] font-semibold mb-1" style={{ color: C.text4 }}>인증코드 (6자리)</label>
                  <input
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    placeholder="123456"
                    className="w-full px-3 py-2 text-[14.5px] rounded-lg tracking-widest"
                    style={{ border: `1px solid ${C.border}` }}
                  />
                  <p className="text-[12.5px] mt-1" style={{ color: C.text4 }}>{email}로 발송된 인증코드를 입력해주세요.</p>
                </div>
              )}

              {error && <p className="text-[13px] mb-3" style={{ color: C.danger }}>{error}</p>}

              <button
                onClick={step === "email" ? requestCode : verifyCode}
                disabled={sending || (step === "email" ? !email.trim() : !code.trim()) || loadingTree}
                className="w-full h-11 rounded-xl font-bold text-[15px] text-white disabled:opacity-40"
                style={{ background: C.brand }}
              >
                {sending || loadingTree ? "처리 중…" : step === "email" ? "인증코드 받기" : "확인하고 조회하기"}
              </button>

              {step === "code" && (
                <button onClick={() => { setStep("email"); setCode(""); setError(""); }} className="w-full text-[13px] mt-3" style={{ color: C.text4 }}>
                  이메일 다시 입력
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white rounded-3xl p-6 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-[16px] font-bold" style={{ color: C.text1 }}>{unit?.name ?? ""} 전체 진행률</h2>
                  <span className="text-[19px] font-bold" style={{ color: overallComplete ? C.good : C.text1 }}>{overallPct}%</span>
                </div>
                <p className="text-[13.5px] mb-3" style={{ color: C.text3 }}>
                  총 {unit?.rollupProgress.total ?? 0}건 중 {unit?.rollupProgress.verified ?? 0}건 실사 확인 완료
                </p>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: C.border }}>
                  <div className="h-full rounded-full" style={{ width: `${overallPct}%`, background: overallComplete ? C.good : C.brand }} />
                </div>

                <div className="flex flex-wrap items-center gap-3 mt-4">
                  <button
                    onClick={sendReminders}
                    disabled={reminding || overallComplete}
                    className="px-4 py-2 rounded-lg text-[13.5px] font-bold text-white disabled:opacity-40"
                    style={{ background: C.brand }}
                  >
                    {reminding ? "발송 중…" : "미완료 대상자에게 독려 메일 발송"}
                  </button>
                  {overallComplete && (
                    <span className="text-[13.5px] font-semibold" style={{ color: C.good }}>모든 대상자가 실사를 완료했습니다.</span>
                  )}
                  {remindResult && (
                    <span className="text-[13.5px]" style={{ color: C.text3 }}>
                      대상 {remindResult.targetCount}명 중 {remindResult.sent}건 발송 완료
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-3xl p-4 lg:p-6 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
                <div className="flex items-center justify-between mb-2 px-1">
                  <h3 className="text-[15px] font-bold" style={{ color: C.text1 }}>조직별 상세 현황</h3>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setExpanded(new Set(allIds))} className="text-[13px] hover:underline" style={{ color: C.brand }}>모두 펼치기</button>
                    <button onClick={() => setExpanded(new Set(unit ? [unit.id] : []))} className="text-[13px] hover:underline" style={{ color: C.text4 }}>모두 접기</button>
                  </div>
                </div>
                {unit && <TreeRow node={unit} depth={0} expanded={expanded} onToggle={toggle} />}
              </div>

              {error && <p className="text-[13px] text-center" style={{ color: C.danger }}>{error}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
