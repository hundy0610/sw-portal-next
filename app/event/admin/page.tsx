"use client";

import { useEffect, useState, useMemo } from "react";
import type { EventSubmission } from "@/lib/notion";
import type { EventConfig, ParticipationMode } from "@/lib/event-config";
import { safeJson } from "@/lib/fetch-json";

const C = {
  brand:   "#16a34a",
  primary: "#22c55e",
  soft:    "#f0fdf4",
  border:  "#bbf7d0",
  text1:   "#14532d",
  text2:   "#166534",
  text3:   "#4b5563",
  text4:   "#9ca3af",
  bg:      "#f0fdf4",
  bgPage:  "#f9fafb",
} as const;

function formatDate(iso: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// <input type="datetime-local"> 은 타임존 없는 "YYYY-MM-DDTHH:mm" 형식을 요구
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const AUTO_REFRESH_SEC = 30;

type AdminConfig = EventConfig & { effectiveOpen: boolean; previousParticipantsCount: number };

export default function EventAdminPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authorized, setAuthorized]   = useState(false);

  const [submissions, setSubmissions] = useState<EventSubmission[]>([]);
  const [cfg, setCfg]                 = useState<AdminConfig | null>(null);
  const [loading, setLoading]         = useState(true);
  const [loadError, setLoadError]     = useState("");
  const [toggling, setToggling]       = useState(false);
  const [search, setSearch]           = useState("");
  const [corpFilter, setCorpFilter]   = useState("all");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [countdown, setCountdown]     = useState(AUTO_REFRESH_SEC);

  // 설정 폼 (저장 전까지의 임시 입력값)
  const [settingsDraft, setSettingsDraft] = useState({
    teamA: "", teamB: "", title: "", description: "", matchDate: "",
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved]   = useState(false);

  const [closeAtDraft, setCloseAtDraft]   = useState("");
  const [closeAtSaving, setCloseAtSaving] = useState(false);

  const [modeSaving, setModeSaving]   = useState(false);
  const [snapshotting, setSnapshotting] = useState(false);
  const [startingRound, setStartingRound] = useState(false);

  const [resultDraft, setResultDraft] = useState({
    answerA: "", answerB: "", resultPublished: false, resultRevealAt: "",
  });
  const [resultSaving, setResultSaving] = useState(false);
  const [resultSaved, setResultSaved]   = useState(false);

  // 슈퍼어드민 권한 확인
  useEffect(() => {
    fetch("/api/admin/auth")
      .then(r => safeJson(r))
      .then(data => {
        if (data.ok && data.role === "super") {
          setAuthorized(true);
        } else {
          window.location.href = "/admin/login?redirect=/event/admin";
        }
      })
      .catch(() => { window.location.href = "/admin/login?redirect=/event/admin"; })
      .finally(() => setAuthChecked(true));
  }, []);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    setLoadError("");
    try {
      const [subResp, cfgResp] = await Promise.all([
        fetch("/api/event/submissions", { cache: "no-store" }),
        fetch("/api/event/config", { cache: "no-store" }),
      ]);
      if (!subResp.ok) {
        const err = await safeJson(subResp);
        setLoadError(`참여자 조회 실패 (${subResp.status}): ${err.error ?? "서버 오류"}`);
        return;
      }
      const [subRes, cfgRes]: [{ data: EventSubmission[] }, AdminConfig] = await Promise.all([
        safeJson(subResp),
        safeJson(cfgResp),
      ]);
      setSubmissions(subRes.data ?? []);
      setCfg(cfgRes);
      setSettingsDraft({
        teamA: cfgRes.teamA, teamB: cfgRes.teamB, title: cfgRes.title,
        description: cfgRes.description, matchDate: cfgRes.matchDate,
      });
      setCloseAtDraft(toDatetimeLocal(cfgRes.closeAt));
      setResultDraft({
        answerA: cfgRes.answerA?.toString() ?? "",
        answerB: cfgRes.answerB?.toString() ?? "",
        resultPublished: cfgRes.resultPublished,
        resultRevealAt: toDatetimeLocal(cfgRes.resultRevealAt),
      });
      setLastUpdated(new Date());
      setCountdown(AUTO_REFRESH_SEC);
    } catch (e) {
      setLoadError(`네트워크 오류: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (authorized) load(); }, [authorized]);

  // 자동 새로고침
  useEffect(() => {
    if (!authorized) return;
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          load(true);
          return AUTO_REFRESH_SEC;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [authorized]);

  async function patchConfig(patch: Record<string, unknown>) {
    const res = await fetch("/api/event/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const json = await safeJson(res);
    return json;
  }

  async function handleToggleOpen() {
    if (!cfg) return;
    setToggling(true);
    await patchConfig({ open: !cfg.open });
    await load(true);
    setToggling(false);
  }

  async function handleSaveSettings() {
    setSettingsSaving(true);
    setSettingsSaved(false);
    await patchConfig({
      teamA: settingsDraft.teamA,
      teamB: settingsDraft.teamB,
      title: settingsDraft.title,
      description: settingsDraft.description,
      matchDate: settingsDraft.matchDate,
    });
    await load(true);
    setSettingsSaving(false);
    setSettingsSaved(true);
  }

  async function handleSaveCloseAt() {
    setCloseAtSaving(true);
    await patchConfig({ closeAt: closeAtDraft ? new Date(closeAtDraft).toISOString() : null });
    await load(true);
    setCloseAtSaving(false);
  }

  async function handleChangeMode(mode: ParticipationMode) {
    setModeSaving(true);
    await patchConfig({ participationMode: mode });
    await load(true);
    setModeSaving(false);
  }

  async function handleStartNewRound() {
    if (!window.confirm(
      "새 회차를 시작하시겠습니까?\n\n" +
      "- 이전 회차 참여 기록은 Notion에 남지만, 이번 회차의 중복확인·현황·결과 집계에서는 제외됩니다.\n" +
      "- 직전 회차의 정답·결과공개 설정은 초기화됩니다."
    )) return;
    setStartingRound(true);
    await fetch("/api/event/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start_new_round" }),
    });
    await load(true);
    setStartingRound(false);
  }

  async function handleSnapshot() {
    setSnapshotting(true);
    await fetch("/api/event/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "snapshot_previous" }),
    });
    await load(true);
    setSnapshotting(false);
  }

  async function handleSaveResult() {
    setResultSaving(true);
    setResultSaved(false);
    await patchConfig({
      answerA: resultDraft.answerA === "" ? null : Number(resultDraft.answerA),
      answerB: resultDraft.answerB === "" ? null : Number(resultDraft.answerB),
      resultPublished: resultDraft.resultPublished,
      resultRevealAt: resultDraft.resultRevealAt ? new Date(resultDraft.resultRevealAt).toISOString() : null,
    });
    await load(true);
    setResultSaving(false);
    setResultSaved(true);
  }

  const corporations = useMemo(
    () => Array.from(new Set(submissions.map(s => s.corporation))).sort(),
    [submissions]
  );

  const filtered = useMemo(() => {
    return submissions.filter(s => {
      const matchCorp = corpFilter === "all" || s.corporation === corpFilter;
      const q = search.toLowerCase();
      const matchSearch = !q || s.name.toLowerCase().includes(q) || s.department.toLowerCase().includes(q);
      return matchCorp && matchSearch;
    });
  }, [submissions, corpFilter, search]);

  // 법인별 참여 수
  const corpCounts = useMemo(() => {
    const map: Record<string, number> = {};
    submissions.forEach(s => { map[s.corporation] = (map[s.corporation] ?? 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [submissions]);

  // 한국 점수 분포
  const koreaDistribution = useMemo(() => {
    const map: Record<number, number> = {};
    submissions.forEach(s => { map[s.koreaScore] = (map[s.koreaScore] ?? 0) + 1; });
    return Object.entries(map)
      .map(([score, count]) => ({ score: Number(score), count }))
      .sort((a, b) => a.score - b.score);
  }, [submissions]);

  // 멕시코 점수 분포
  const mexicoDistribution = useMemo(() => {
    const map: Record<number, number> = {};
    submissions.forEach(s => { map[s.mexicoScore] = (map[s.mexicoScore] ?? 0) + 1; });
    return Object.entries(map)
      .map(([score, count]) => ({ score: Number(score), count }))
      .sort((a, b) => a.score - b.score);
  }, [submissions]);

  const maxKorea  = Math.max(...koreaDistribution.map(d => d.count), 1);
  const maxMexico = Math.max(...mexicoDistribution.map(d => d.count), 1);

  const inputCls = "h-9 px-3 rounded-lg text-sm focus:outline-none w-full";
  const inputStyle = { border: `1px solid ${C.border}`, color: C.text1 };
  const cardCls = "bg-white rounded-2xl p-6";
  const cardStyle = { border: `1px solid ${C.border}` };
  const labelCls = "block text-xs font-semibold mb-1.5";

  if (!authChecked || !authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.bgPage, color: C.text4 }}>
        확인 중...
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: C.bgPage }}>
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-extrabold" style={{ color: C.text1 }}>
              ⚽ 토토 이벤트 관리자
            </h1>
            <p className="text-sm mt-1" style={{ color: C.text3 }}>
              {cfg ? `${cfg.teamA} vs ${cfg.teamB}` : "한국 vs 멕시코"} 점수 예측 참여 현황
            </p>
            {lastUpdated && (
              <p className="text-xs mt-1" style={{ color: C.text4 }}>
                마지막 업데이트: {lastUpdated.toLocaleTimeString("ko-KR")} · {countdown}초 후 자동 갱신
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${cfg?.effectiveOpen ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
              {cfg?.effectiveOpen ? "이벤트 진행 중" : "이벤트 마감"}
            </span>
            <button
              onClick={() => load()}
              className="px-4 py-2 rounded-xl text-sm font-bold"
              style={{ background: C.soft, color: C.brand, border: `1px solid ${C.border}` }}>
              새로고침
            </button>
          </div>
        </div>

        {loadError && (
          <div className="mb-6 p-4 rounded-2xl text-sm font-medium"
            style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
            ⚠️ {loadError}
          </div>
        )}

        {loading || !cfg ? (
          <div className="text-center py-20" style={{ color: C.text4 }}>불러오는 중...</div>
        ) : (
          <>
            {/* 회차 관리 */}
            <div className={`${cardCls} mb-6`} style={cardStyle}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <span className="font-bold text-sm" style={{ color: C.text1 }}>회차 관리</span>
                  <p className="text-xs mt-1" style={{ color: C.text4 }}>
                    현 회차 시작: {cfg.roundStartedAt ? formatDate(cfg.roundStartedAt) : "설정 안 됨 (전체 기간 기준)"}
                  </p>
                </div>
                <button
                  onClick={handleStartNewRound}
                  disabled={startingRound}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                  style={{ background: "#dc2626" }}>
                  {startingRound ? "처리 중..." : "새 회차 시작"}
                </button>
              </div>
              <p className="text-xs mt-3" style={{ color: C.text4 }}>
                새 회차를 시작하면 이전 회차 참여자가 다시 참여할 수 있고, 현황·결과는 새 회차 데이터만 집계됩니다.
              </p>
            </div>

            {/* 마감 제어 */}
            <div className={`${cardCls} mb-6`} style={cardStyle}>
              <div className="flex items-center justify-between mb-4">
                <span className="font-bold text-sm" style={{ color: C.text1 }}>마감 제어</span>
                <button
                  role="switch"
                  aria-checked={cfg.open}
                  onClick={handleToggleOpen}
                  disabled={toggling}
                  className="relative w-14 h-7 rounded-full transition-colors disabled:opacity-50"
                  style={{ background: cfg.open ? C.brand : "#d1d5db" }}>
                  <span
                    className="absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white transition-transform shadow"
                    style={{ transform: cfg.open ? "translateX(28px)" : "translateX(0)" }}
                  />
                </button>
              </div>
              <label className={labelCls} style={{ color: C.text2 }}>예약 자동 마감 (비워두면 사용 안 함)</label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="datetime-local"
                  value={closeAtDraft}
                  onChange={e => setCloseAtDraft(e.target.value)}
                  className={inputCls} style={{ ...inputStyle, width: 220 }}
                />
                <button
                  onClick={handleSaveCloseAt}
                  disabled={closeAtSaving}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50"
                  style={{ background: C.brand }}>
                  {closeAtSaving ? "저장 중..." : "저장"}
                </button>
                <span className="text-xs" style={{ color: C.text4 }}>
                  이 시각이 지나면 토글이 켜져 있어도 자동으로 마감됩니다.
                </span>
              </div>
            </div>

            {/* 이벤트 설정 */}
            <div className={`${cardCls} mb-6`} style={cardStyle}>
              <span className="font-bold text-sm" style={{ color: C.text1 }}>이벤트 설정</span>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className={labelCls} style={{ color: C.text2 }}>팀 A 국가명</label>
                  <input className={inputCls} style={inputStyle} value={settingsDraft.teamA}
                    onChange={e => setSettingsDraft(d => ({ ...d, teamA: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: C.text2 }}>팀 B 국가명</label>
                  <input className={inputCls} style={inputStyle} value={settingsDraft.teamB}
                    onChange={e => setSettingsDraft(d => ({ ...d, teamB: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls} style={{ color: C.text2 }}>제목</label>
                  <input className={inputCls} style={inputStyle} value={settingsDraft.title}
                    onChange={e => setSettingsDraft(d => ({ ...d, title: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls} style={{ color: C.text2 }}>설명 멘트</label>
                  <input className={inputCls} style={inputStyle} value={settingsDraft.description}
                    onChange={e => setSettingsDraft(d => ({ ...d, description: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: C.text2 }}>경기일 (표시용)</label>
                  <input className={inputCls} style={inputStyle} value={settingsDraft.matchDate}
                    placeholder="예: 6월 17일"
                    onChange={e => setSettingsDraft(d => ({ ...d, matchDate: e.target.value }))} />
                </div>
              </div>
              <button
                onClick={handleSaveSettings}
                disabled={settingsSaving}
                className="mt-4 px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: C.brand }}>
                {settingsSaving ? "저장 중..." : settingsSaved ? "저장됨 ✓" : "설정 저장"}
              </button>
            </div>

            {/* 참여 제한 */}
            <div className={`${cardCls} mb-6`} style={cardStyle}>
              <span className="font-bold text-sm" style={{ color: C.text1 }}>참여 제한</span>
              <div className="flex flex-wrap items-center gap-2 mt-4">
                {([
                  { v: "all", label: "전체 허용" },
                  { v: "employee_list", label: "직원 명단만" },
                  { v: "previous", label: "이전 참여자만" },
                ] as { v: ParticipationMode; label: string }[]).map(opt => (
                  <button
                    key={opt.v}
                    onClick={() => handleChangeMode(opt.v)}
                    disabled={modeSaving}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50"
                    style={{
                      background: cfg.participationMode === opt.v ? C.brand : C.soft,
                      color: cfg.participationMode === opt.v ? "#fff" : C.brand,
                      border: `1px solid ${C.border}`,
                    }}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={handleSnapshot}
                  disabled={snapshotting}
                  className="px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
                  style={{ background: C.soft, color: C.brand, border: `1px solid ${C.border}` }}>
                  {snapshotting ? "저장 중..." : "현재 참여자 → 이전 참여자 명단 저장"}
                </button>
                <span className="text-xs" style={{ color: C.text4 }}>
                  현재 저장된 이전 참여자: {cfg.previousParticipantsCount}명
                </span>
              </div>
            </div>

            {/* 결과 관리 */}
            <div className={`${cardCls} mb-8`} style={cardStyle}>
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm" style={{ color: C.text1 }}>결과 관리</span>
                <a href="/event/result" target="_blank" className="text-xs font-semibold" style={{ color: C.brand }}>
                  결과 페이지 열기 →
                </a>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className={labelCls} style={{ color: C.text2 }}>정답 — {settingsDraft.teamA || "팀 A"}</label>
                  <input type="number" className={inputCls} style={inputStyle} value={resultDraft.answerA}
                    onChange={e => setResultDraft(d => ({ ...d, answerA: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: C.text2 }}>정답 — {settingsDraft.teamB || "팀 B"}</label>
                  <input type="number" className={inputCls} style={inputStyle} value={resultDraft.answerB}
                    onChange={e => setResultDraft(d => ({ ...d, answerB: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls} style={{ color: C.text2 }}>결과 공개 예약시간 (비워두면 토글로만 제어)</label>
                  <input type="datetime-local" className={inputCls} style={{ ...inputStyle, width: 220 }}
                    value={resultDraft.resultRevealAt}
                    onChange={e => setResultDraft(d => ({ ...d, resultRevealAt: e.target.value }))} />
                </div>
              </div>
              <div className="flex items-center gap-3 mt-4">
                <button
                  role="switch"
                  aria-checked={resultDraft.resultPublished}
                  onClick={() => setResultDraft(d => ({ ...d, resultPublished: !d.resultPublished }))}
                  className="relative w-14 h-7 rounded-full transition-colors"
                  style={{ background: resultDraft.resultPublished ? C.brand : "#d1d5db" }}>
                  <span
                    className="absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white transition-transform shadow"
                    style={{ transform: resultDraft.resultPublished ? "translateX(28px)" : "translateX(0)" }}
                  />
                </button>
                <span className="text-xs font-semibold" style={{ color: C.text2 }}>
                  {resultDraft.resultPublished ? "결과 공개 켜짐" : "결과 공개 꺼짐"}
                </span>
                <button
                  onClick={handleSaveResult}
                  disabled={resultSaving}
                  className="ml-auto px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                  style={{ background: C.brand }}>
                  {resultSaving ? "저장 중..." : resultSaved ? "저장됨 ✓" : "결과 설정 저장"}
                </button>
              </div>
            </div>

            {/* 요약 카드 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-2xl p-5" style={{ border: `1px solid ${C.border}` }}>
                <div className="text-3xl font-extrabold" style={{ color: C.brand }}>{submissions.length}</div>
                <div className="text-xs mt-1" style={{ color: C.text3 }}>총 참여자</div>
              </div>
              {corpCounts.slice(0, 3).map(([corp, count]) => (
                <div key={corp} className="bg-white rounded-2xl p-5" style={{ border: `1px solid ${C.border}` }}>
                  <div className="text-3xl font-extrabold" style={{ color: C.brand }}>{count}</div>
                  <div className="text-xs mt-1" style={{ color: C.text3 }}>{corp}</div>
                </div>
              ))}
            </div>

            {/* 점수 분포 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
              {/* 팀 A 점수 분포 */}
              <div className="bg-white rounded-2xl p-6" style={{ border: `1px solid ${C.border}` }}>
                <div className="flex items-center gap-2 mb-5">
                  <span className="font-bold text-sm" style={{ color: C.text1 }}>{cfg.teamA} 점수 분포</span>
                </div>
                {koreaDistribution.length === 0 ? (
                  <div className="text-sm text-center py-4" style={{ color: C.text4 }}>데이터 없음</div>
                ) : (
                  <div className="space-y-2">
                    {koreaDistribution.map(({ score, count }) => (
                      <div key={score} className="flex items-center gap-3">
                        <span className="w-6 text-right text-xs font-bold" style={{ color: "#1e40af" }}>{score}</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                          <div
                            className="h-full rounded-full flex items-center justify-end pr-2 transition-all"
                            style={{
                              width: `${Math.max((count / maxKorea) * 100, 8)}%`,
                              background: "#3b82f6",
                            }}>
                            <span className="text-white text-[10px] font-bold">{count}</span>
                          </div>
                        </div>
                        <span className="text-xs w-5 text-right" style={{ color: C.text4 }}>{count}명</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 팀 B 점수 분포 */}
              <div className="bg-white rounded-2xl p-6" style={{ border: `1px solid ${C.border}` }}>
                <div className="flex items-center gap-2 mb-5">
                  <span className="font-bold text-sm" style={{ color: C.text1 }}>{cfg.teamB} 점수 분포</span>
                </div>
                {mexicoDistribution.length === 0 ? (
                  <div className="text-sm text-center py-4" style={{ color: C.text4 }}>데이터 없음</div>
                ) : (
                  <div className="space-y-2">
                    {mexicoDistribution.map(({ score, count }) => (
                      <div key={score} className="flex items-center gap-3">
                        <span className="w-6 text-right text-xs font-bold" style={{ color: "#78350f" }}>{score}</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                          <div
                            className="h-full rounded-full flex items-center justify-end pr-2 transition-all"
                            style={{
                              width: `${Math.max((count / maxMexico) * 100, 8)}%`,
                              background: "#eab308",
                            }}>
                            <span className="text-white text-[10px] font-bold">{count}</span>
                          </div>
                        </div>
                        <span className="text-xs w-5 text-right" style={{ color: C.text4 }}>{count}명</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 테이블 필터 */}
            <div className="bg-white rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
              <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3"
                style={{ borderBottom: `1px solid ${C.border}` }}>
                <span className="font-bold text-sm" style={{ color: C.text1 }}>
                  참여자 목록 ({filtered.length}명)
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={corpFilter}
                    onChange={e => setCorpFilter(e.target.value)}
                    className="h-8 px-3 rounded-lg text-xs focus:outline-none"
                    style={{ border: `1px solid ${C.border}`, color: C.text3 }}>
                    <option value="all">전체 법인</option>
                    {corporations.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input
                    type="text"
                    placeholder="이름·부서 검색"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="h-8 px-3 rounded-lg text-xs focus:outline-none"
                    style={{ border: `1px solid ${C.border}`, width: 140, color: C.text3 }}
                  />
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="py-12 text-center text-sm" style={{ color: C.text4 }}>
                  참여 데이터가 없습니다.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.soft }}>
                        {["이름", "법인", "부서", "예측 점수", "참여시각"].map(h => (
                          <th key={h} className="px-5 py-3 text-left text-xs font-bold"
                            style={{ color: C.text2 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((s, i) => (
                        <tr key={s.id}
                          style={{ borderBottom: `1px solid #f1f5f9`, background: i % 2 === 1 ? "#fafafa" : "#fff" }}>
                          <td className="px-5 py-3 font-semibold" style={{ color: C.text1 }}>{s.name}</td>
                          <td className="px-5 py-3" style={{ color: C.text3 }}>{s.corporation}</td>
                          <td className="px-5 py-3" style={{ color: C.text3 }}>{s.department}</td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-sm" style={{ color: "#1e40af" }}>{s.koreaScore}</span>
                              <span className="text-xs font-bold" style={{ color: C.text4 }}>:</span>
                              <span className="font-extrabold text-sm" style={{ color: "#78350f" }}>{s.mexicoScore}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-xs" style={{ color: C.text4 }}>
                            {formatDate(s.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        <div className="mt-6 text-center">
          <a href="/" className="text-xs" style={{ color: C.text4 }}>← 포털로 돌아가기</a>
        </div>
      </div>
    </div>
  );
}
