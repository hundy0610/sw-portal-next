"use client";

import { useState, useEffect, useCallback } from "react";
import type { AnnualGoal, MonthlyGoal, WeeklyEntry, WorkFeedbackStore, Grade } from "@/types/work-feedback";

// ── Props ─────────────────────────────────────────────────────
interface Props {
  session: { role: "super" | "company" | "general"; userId: string; name: string };
}

// ── Constants ─────────────────────────────────────────────────
const GRADES: Grade[] = ["A+", "A", "B+", "B", "C+", "C"];
const GRADE_COLOR: Record<Grade, { bg: string; text: string }> = {
  "A+": { bg: "#ECFDF5", text: "#065F46" },
  "A":  { bg: "#D1FAE5", text: "#065F46" },
  "B+": { bg: "#EFF6FF", text: "#1E40AF" },
  "B":  { bg: "#DBEAFE", text: "#1E40AF" },
  "C+": { bg: "#FFFBEB", text: "#92400E" },
  "C":  { bg: "#FEF3C7", text: "#92400E" },
};
const MONTHS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
const WEEKS  = ["1주차","2주차","3주차","4주차","5주차"];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 2025 + 3 }, (_, i) => 2026 + i);

// ── Small helpers ─────────────────────────────────────────────
function GradeBadge({ grade }: { grade: Grade }) {
  const c = GRADE_COLOR[grade];
  return (
    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold" style={{ background: c.bg, color: c.text }}>
      {grade}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-bold text-gray-800 mb-3">{children}</h3>;
}

function TextArea({ label, value, onChange, rows = 3, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      <textarea
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
        rows={rows}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

// ── Annual Goal Form ──────────────────────────────────────────
function AnnualGoalForm({
  goal, userId, year, onSave, onCancel,
}: {
  goal?: AnnualGoal; userId: string; year: number;
  onSave: (g: Partial<AnnualGoal>) => void; onCancel: () => void;
}) {
  const [title,          setTitle]          = useState(goal?.title          ?? "");
  const [currentLevel,   setCurrentLevel]   = useState(goal?.currentLevel   ?? "");
  const [reason,         setReason]         = useState(goal?.reason         ?? "");
  const [businessEffect, setBusinessEffect] = useState(goal?.businessEffect ?? "");
  const [teamEffect,     setTeamEffect]     = useState(goal?.teamEffect     ?? "");

  function handleSave() {
    if (!title.trim()) { alert("목표 제목을 입력해주세요."); return; }
    onSave({ id: goal?.id, userId, year, title, currentLevel, reason, businessEffect, teamEffect });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">목표 제목 <span className="text-red-500">*</span></label>
        <input
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          value={title} onChange={e => setTitle(e.target.value)}
          placeholder="예) Adobe CC 라이선스 최적화 달성"
        />
      </div>
      <TextArea label="현 수준 진단" value={currentLevel} onChange={setCurrentLevel} rows={2}
        placeholder="현재 이 목표 관련 나의 수준/상태는 어떠한가?" />
      <TextArea label="왜 해야 하는가 (배경/필요성)" value={reason} onChange={setReason} rows={3}
        placeholder="이 목표를 달성해야 하는 이유, 배경, 문제의식을 작성하세요." />
      <div className="bg-blue-50 rounded-xl p-4 space-y-3">
        <div className="text-xs font-bold text-blue-700 mb-2">📈 기대효과</div>
        <TextArea label="현업 입장 기대효과" value={businessEffect} onChange={setBusinessEffect} rows={2}
          placeholder="달성 시 현업(고객/유관부서)에 어떤 긍정적 변화가 생기는가?" />
        <TextArea label="우리 팀 입장 기대효과" value={teamEffect} onChange={setTeamEffect} rows={2}
          placeholder="달성 시 우리 팀에 어떤 긍정적 변화가 생기는가?" />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">취소</button>
        <button onClick={handleSave} className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-semibold">저장</button>
      </div>
    </div>
  );
}

// ── Monthly Goal Form ─────────────────────────────────────────
function MonthlyGoalForm({
  goal, userId, year, month, annualGoals, onSave, onCancel,
}: {
  goal?: MonthlyGoal; userId: string; year: number; month: number;
  annualGoals: AnnualGoal[];
  onSave: (g: Partial<MonthlyGoal>) => void; onCancel: () => void;
}) {
  const [content,       setContent]       = useState(goal?.content       ?? "");
  const [selectedGoals, setSelectedGoals] = useState<string[]>(goal?.annualGoalIds ?? []);

  function toggleGoal(id: string) {
    setSelectedGoals(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function handleSave() {
    if (!content.trim()) { alert("월 목표 내용을 입력해주세요."); return; }
    onSave({ id: goal?.id, userId, year, month, annualGoalIds: selectedGoals, content });
  }

  return (
    <div className="space-y-4">
      {annualGoals.length > 0 && (
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-2">연결할 연목표</label>
          <div className="flex flex-wrap gap-2">
            {annualGoals.map(ag => (
              <button
                key={ag.id}
                onClick={() => toggleGoal(ag.id)}
                className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                  selectedGoals.includes(ag.id)
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-blue-400"
                }`}
              >
                {ag.title}
              </button>
            ))}
          </div>
        </div>
      )}
      <TextArea label={`${month}월 목표`} value={content} onChange={setContent} rows={5}
        placeholder={`이달에 달성할 구체적인 목표를 작성하세요.\n\n예)\n• Adobe CC 사용 현황 전수조사 완료\n• 불필요 라이선스 5개 이상 회수`}
      />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">취소</button>
        <button onClick={handleSave} className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-semibold">저장</button>
      </div>
    </div>
  );
}

// ── Weekly Entry Form ─────────────────────────────────────────
function WeeklyEntryForm({
  entry, userId, year, month, week, onSave, onCancel,
}: {
  entry?: WeeklyEntry; userId: string; year: number; month: number; week: number;
  onSave: (e: Partial<WeeklyEntry>) => void; onCancel: () => void;
}) {
  const [activities,     setActivities]     = useState(entry?.activities     ?? "");
  const [concerns,       setConcerns]       = useState(entry?.concerns       ?? "");
  const [feedbackNeeded, setFeedbackNeeded] = useState(entry?.feedbackNeeded ?? "");

  function handleSave() {
    onSave({ id: entry?.id, userId, year, month, week, activities, concerns, feedbackNeeded });
  }

  return (
    <div className="space-y-4">
      <div className="text-sm font-bold text-gray-700 flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">{week}</span>
        {month}월 {WEEKS[week - 1]} 주간 기록
      </div>
      <TextArea label="이번 주 활동 내용" value={activities} onChange={setActivities} rows={4}
        placeholder="목표 달성을 위해 이번 주에 한 활동을 구체적으로 작성하세요." />
      <TextArea label="고민 사항" value={concerns} onChange={setConcerns} rows={3}
        placeholder="현재 고민하고 있거나 해결되지 않은 문제, 막힌 부분을 작성하세요." />
      <TextArea label="피드백 요청" value={feedbackNeeded} onChange={setFeedbackNeeded} rows={3}
        placeholder="매니저 또는 팀에게 받고 싶은 피드백을 구체적으로 작성하세요." />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">취소</button>
        <button onClick={handleSave} className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-semibold">저장</button>
      </div>
    </div>
  );
}

// ── Evaluation Modal ──────────────────────────────────────────
function EvalModal({
  goal, onSave, onClose,
}: {
  goal: MonthlyGoal; onSave: (grade: Grade, comment: string) => void; onClose: () => void;
}) {
  const [grade,   setGrade]   = useState<Grade>(goal.evaluation?.grade   ?? "B");
  const [comment, setComment] = useState(goal.evaluation?.comment ?? "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.35)" }}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-[480px] max-w-[95vw]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800">{goal.year}년 {goal.month}월 종합 평가</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg">✕</button>
        </div>
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-600 mb-2">등급</label>
          <div className="flex gap-2 flex-wrap">
            {GRADES.map(g => (
              <button
                key={g}
                onClick={() => setGrade(g)}
                className={`px-4 py-2 rounded-lg text-sm font-bold border-2 transition-all ${
                  grade === g ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500 hover:border-gray-400"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
        <TextArea label="평가 코멘트" value={comment} onChange={setComment} rows={4}
          placeholder="이달 활동에 대한 종합 피드백을 작성하세요." />
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">취소</button>
          <button onClick={() => onSave(grade, comment)}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-semibold">
            평가 저장
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────
export default function WorkFeedbackPanel({ session }: Props) {
  const isSuper = session.role === "super";

  const [store,       setStore]       = useState<WorkFeedbackStore>({ annualGoals: [], monthlyGoals: [], weeklyEntries: [] });
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [year,        setYear]        = useState(Math.max(CURRENT_YEAR, 2026));
  const [month,       setMonth]       = useState(new Date().getMonth() + 1);
  const [tab,         setTab]         = useState<"annual" | "monthly" | "summary">("annual");
  const [viewUserId,  setViewUserId]  = useState(session.userId);
  const [accounts,    setAccounts]    = useState<{ userId: string; name: string }[]>([]);

  // forms open state
  const [annualFormOpen,  setAnnualFormOpen]  = useState(false);
  const [editingAnnual,   setEditingAnnual]   = useState<AnnualGoal | undefined>();
  const [monthlyFormOpen, setMonthlyFormOpen] = useState(false);
  const [editingMonthly,  setEditingMonthly]  = useState<MonthlyGoal | undefined>();
  const [weeklyFormOpen,  setWeeklyFormOpen]  = useState<number | null>(null); // week number
  const [editingWeekly,   setEditingWeekly]   = useState<WeeklyEntry | undefined>();
  const [evalModalGoal,   setEvalModalGoal]   = useState<MonthlyGoal | null>(null);

  // ── fetch data ──────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/work-feedback");
      const json = await res.json();
      if (json.ok) setStore(json.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── fetch accounts for super ─────────────────────────────────
  useEffect(() => {
    if (!isSuper) return;
    fetch("/api/admin/accounts")
      .then(r => r.json())
      .then(d => {
        if (d.ok && Array.isArray(d.accounts)) {
          setAccounts(d.accounts.map((a: { userId: string; name: string }) => ({ userId: a.userId, name: a.name })));
        }
      })
      .catch(() => {});
  }, [isSuper]);

  // ── derived data ─────────────────────────────────────────────
  const annualGoals   = store.annualGoals  .filter(g => g.userId === viewUserId && g.year === year);
  const monthlyGoal   = store.monthlyGoals .find(g  => g.userId === viewUserId && g.year === year && g.month === month);
  const weeklyEntries = store.weeklyEntries.filter(e => e.userId === viewUserId && e.year === year && e.month === month);

  // summary: all months for selected user/year
  const summaryMonths = MONTHS.map((label, i) => {
    const m = i + 1;
    const mg = store.monthlyGoals.find(g => g.userId === viewUserId && g.year === year && g.month === m);
    const we = store.weeklyEntries.filter(e => e.userId === viewUserId && e.year === year && e.month === m);
    return { month: m, label, monthlyGoal: mg, weeklyEntries: we };
  });

  const canEdit = isSuper || viewUserId === session.userId;

  // ── api calls ────────────────────────────────────────────────
  async function apiPost(type: string, payload: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch("/api/work-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, payload }),
      });
      const json = await res.json();
      if (json.ok) setStore(json.data);
    } finally {
      setSaving(false);
    }
  }

  async function apiPatch(monthlyGoalId: string, grade: Grade, comment: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/work-feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyGoalId, grade, comment }),
      });
      const json = await res.json();
      if (json.ok) setStore(json.data);
    } finally {
      setSaving(false);
    }
  }

  async function apiDelete(type: string, id: string) {
    if (!confirm("삭제하시겠습니까?")) return;
    setSaving(true);
    try {
      const res = await fetch("/api/work-feedback", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id, userId: viewUserId }),
      });
      const json = await res.json();
      if (json.ok) setStore(json.data);
    } finally {
      setSaving(false);
    }
  }

  // ── determine displayable members ───────────────────────────
  const members: { userId: string; name: string }[] = isSuper
    ? [
        // merge accounts list with any userId that appears in store but not in accounts
        ...accounts,
        ...(() => {
          const ids = new Set(accounts.map(a => a.userId));
          const extra: { userId: string; name: string }[] = [];
          [
            ...store.annualGoals.map(g => g.userId),
            ...store.monthlyGoals.map(g => g.userId),
            ...store.weeklyEntries.map(e => e.userId),
          ].forEach(uid => {
            if (!ids.has(uid)) { ids.add(uid); extra.push({ userId: uid, name: uid }); }
          });
          return extra;
        })(),
      ]
    : [{ userId: session.userId, name: session.name }];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="flex gap-6 h-full min-h-0">

      {/* ── Left sidebar ──────────────────────────────────────── */}
      <aside className="w-52 flex-shrink-0 flex flex-col gap-4">

        {/* Year */}
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <div className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">연도</div>
          <div className="flex flex-col gap-1">
            {YEARS.map(y => (
              <button key={y} onClick={() => setYear(y)}
                className={`px-3 py-1.5 text-sm rounded-lg text-left transition-colors ${
                  year === y ? "bg-blue-600 text-white font-bold" : "hover:bg-gray-50 text-gray-700"
                }`}>
                {y}년
              </button>
            ))}
          </div>
        </div>

        {/* Member (super only) */}
        {isSuper && (
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <div className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">담당자</div>
            <div className="flex flex-col gap-1">
              {members.map(m => (
                <button key={m.userId} onClick={() => setViewUserId(m.userId)}
                  className={`px-3 py-1.5 text-sm rounded-lg text-left truncate transition-colors ${
                    viewUserId === m.userId ? "bg-blue-600 text-white font-bold" : "hover:bg-gray-50 text-gray-700"
                  }`}>
                  {m.name || m.userId}
                </button>
              ))}
              {members.length === 0 && (
                <div className="text-xs text-gray-400 px-1">계정 없음</div>
              )}
            </div>
          </div>
        )}

        {/* Tab nav */}
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <div className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">메뉴</div>
          {(["annual", "monthly", "summary"] as const).map(t => {
            const labels = { annual: "📌 연목표 설정", monthly: "📅 월간 관리", summary: "📊 종합 평가" };
            return (
              <button key={t} onClick={() => setTab(t)}
                className={`w-full px-3 py-1.5 text-sm rounded-lg text-left transition-colors mb-0.5 ${
                  tab === t ? "bg-blue-600 text-white font-bold" : "hover:bg-gray-50 text-gray-700"
                }`}>
                {labels[t]}
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────── */}
      <main className="flex-1 min-w-0 overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-extrabold text-gray-900">
              {tab === "annual" && `${year}년 연목표`}
              {tab === "monthly" && `${year}년 월간 관리`}
              {tab === "summary" && `${year}년 종합 평가`}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {members.find(m => m.userId === viewUserId)?.name || viewUserId}
              {isSuper && viewUserId !== session.userId && " (조회 중)"}
            </p>
          </div>
          {saving && <span className="text-xs text-blue-500 animate-pulse">저장 중...</span>}
        </div>

        {/* ── Tab: 연목표 ─────────────────────────────────────── */}
        {tab === "annual" && (
          <div className="space-y-4">
            {/* Daewong Way guide */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-4">
              <div className="text-xs font-bold text-blue-700 mb-1">대웅 Way — 목표 설정 원칙</div>
              <div className="text-xs text-blue-600 space-y-0.5">
                <div>① 현 수준 진단 → ② 목표 설정 → ③ 필요성(왜?) → ④ 기대효과(현업 / 우리 팀)</div>
                <div>목표는 측정 가능하고 도전적이어야 하며, 현업의 문제를 해결하는 방향으로 설정합니다.</div>
              </div>
            </div>

            {/* Add button */}
            {canEdit && !annualFormOpen && (
              <button
                onClick={() => { setEditingAnnual(undefined); setAnnualFormOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-blue-300 text-blue-600 text-sm hover:bg-blue-50 transition-colors w-full justify-center"
              >
                <span className="text-lg">+</span> 연목표 추가
              </button>
            )}

            {/* Form */}
            {annualFormOpen && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="text-sm font-bold text-gray-700 mb-4">
                  {editingAnnual ? "연목표 수정" : "새 연목표 작성"}
                </div>
                <AnnualGoalForm
                  goal={editingAnnual}
                  userId={viewUserId}
                  year={year}
                  onSave={async (g) => {
                    await apiPost("annualGoal", g as Record<string, unknown>);
                    setAnnualFormOpen(false); setEditingAnnual(undefined);
                  }}
                  onCancel={() => { setAnnualFormOpen(false); setEditingAnnual(undefined); }}
                />
              </div>
            )}

            {/* List */}
            {annualGoals.length === 0 && !annualFormOpen && (
              <div className="text-center py-16 text-gray-400 text-sm">
                <div className="text-3xl mb-2">🎯</div>
                아직 작성된 연목표가 없습니다.
              </div>
            )}

            {annualGoals.map((ag, idx) => (
              <div key={ag.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </span>
                    <h4 className="font-bold text-gray-800 text-sm">{ag.title}</h4>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => { setEditingAnnual(ag); setAnnualFormOpen(true); }}
                        className="px-2.5 py-1 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600">수정</button>
                      <button onClick={() => apiDelete("annualGoal", ag.id)}
                        className="px-2.5 py-1 text-xs rounded-lg bg-red-50 hover:bg-red-100 text-red-500">삭제</button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 text-sm">
                  {ag.currentLevel && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs font-bold text-gray-500 mb-1">현 수준</div>
                      <div className="text-gray-700 whitespace-pre-wrap">{ag.currentLevel}</div>
                    </div>
                  )}
                  {ag.reason && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs font-bold text-gray-500 mb-1">왜 해야 하는가</div>
                      <div className="text-gray-700 whitespace-pre-wrap">{ag.reason}</div>
                    </div>
                  )}
                  {(ag.businessEffect || ag.teamEffect) && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="text-xs font-bold text-blue-600 mb-2">기대효과</div>
                      {ag.businessEffect && (
                        <div className="mb-2">
                          <div className="text-xs font-semibold text-gray-500">현업 입장</div>
                          <div className="text-gray-700 text-sm whitespace-pre-wrap">{ag.businessEffect}</div>
                        </div>
                      )}
                      {ag.teamEffect && (
                        <div>
                          <div className="text-xs font-semibold text-gray-500">우리 팀 입장</div>
                          <div className="text-gray-700 text-sm whitespace-pre-wrap">{ag.teamEffect}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Tab: 월간 관리 ───────────────────────────────────── */}
        {tab === "monthly" && (
          <div>
            {/* Month selector */}
            <div className="flex gap-1.5 flex-wrap mb-5">
              {MONTHS.map((label, i) => {
                const m = i + 1;
                const hasMg = !!store.monthlyGoals.find(g => g.userId === viewUserId && g.year === year && g.month === m);
                return (
                  <button key={m} onClick={() => setMonth(m)}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-colors relative ${
                      month === m ? "bg-blue-600 text-white font-bold" : "bg-white border border-gray-200 text-gray-600 hover:border-blue-400"
                    }`}>
                    {label}
                    {hasMg && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-green-400" />}
                  </button>
                );
              })}
            </div>

            <div className="space-y-5">
              {/* Monthly Goal */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <SectionTitle>📅 {month}월 목표</SectionTitle>
                  {canEdit && !monthlyFormOpen && (
                    <button
                      onClick={() => { setEditingMonthly(monthlyGoal); setMonthlyFormOpen(true); }}
                      className="px-3 py-1 text-xs rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold"
                    >
                      {monthlyGoal ? "수정" : "+ 작성"}
                    </button>
                  )}
                  {monthlyGoal?.evaluation && (
                    <GradeBadge grade={monthlyGoal.evaluation.grade} />
                  )}
                </div>

                {monthlyFormOpen ? (
                  <MonthlyGoalForm
                    goal={editingMonthly}
                    userId={viewUserId}
                    year={year}
                    month={month}
                    annualGoals={annualGoals}
                    onSave={async (g) => {
                      await apiPost("monthlyGoal", g as Record<string, unknown>);
                      setMonthlyFormOpen(false); setEditingMonthly(undefined);
                    }}
                    onCancel={() => { setMonthlyFormOpen(false); setEditingMonthly(undefined); }}
                  />
                ) : monthlyGoal ? (
                  <div>
                    {monthlyGoal.annualGoalIds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {monthlyGoal.annualGoalIds.map(id => {
                          const ag = store.annualGoals.find(g => g.id === id);
                          return ag ? (
                            <span key={id} className="px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100">
                              {ag.title}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                    <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">{monthlyGoal.content}</div>
                    {monthlyGoal.evaluation && (
                      <div className="mt-3 bg-green-50 rounded-lg p-3 border border-green-100">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-green-700">종합 평가</span>
                          <GradeBadge grade={monthlyGoal.evaluation.grade} />
                          <span className="text-xs text-gray-400">{monthlyGoal.evaluation.evaluatedBy} · {monthlyGoal.evaluation.evaluatedAt.slice(0, 10)}</span>
                        </div>
                        {monthlyGoal.evaluation.comment && (
                          <div className="text-xs text-gray-600 whitespace-pre-wrap">{monthlyGoal.evaluation.comment}</div>
                        )}
                      </div>
                    )}
                    {isSuper && (
                      <button onClick={() => setEvalModalGoal(monthlyGoal)}
                        className="mt-3 px-3 py-1 text-xs rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 font-semibold">
                        {monthlyGoal.evaluation ? "평가 수정" : "✍️ 평가하기"}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-gray-400 text-center py-6">
                    {canEdit ? "아직 월 목표가 없습니다. 작성 버튼을 눌러 추가하세요." : "월 목표가 작성되지 않았습니다."}
                  </div>
                )}
              </div>

              {/* Weekly entries */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <SectionTitle>📝 주간 활동 기록</SectionTitle>

                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map(w => {
                    const entry = weeklyEntries.find(e => e.week === w);
                    const isEditing = weeklyFormOpen === w;

                    return (
                      <div key={w} className="border border-gray-100 rounded-xl overflow-hidden">
                        {/* Week header */}
                        <div className="flex items-center justify-between bg-gray-50 px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">{w}</span>
                            <span className="text-xs font-semibold text-gray-700">{WEEKS[w - 1]}</span>
                            {entry && <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />}
                          </div>
                          {canEdit && !isEditing && (
                            <button
                              onClick={() => { setEditingWeekly(entry); setWeeklyFormOpen(w); }}
                              className="px-2.5 py-0.5 text-xs rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold"
                            >
                              {entry ? "수정" : "+ 작성"}
                            </button>
                          )}
                        </div>

                        {/* Form or content */}
                        <div className="p-4">
                          {isEditing ? (
                            <WeeklyEntryForm
                              entry={editingWeekly}
                              userId={viewUserId}
                              year={year}
                              month={month}
                              week={w}
                              onSave={async (e) => {
                                await apiPost("weeklyEntry", e as Record<string, unknown>);
                                setWeeklyFormOpen(null); setEditingWeekly(undefined);
                              }}
                              onCancel={() => { setWeeklyFormOpen(null); setEditingWeekly(undefined); }}
                            />
                          ) : entry ? (
                            <div className="space-y-3 text-sm">
                              {entry.activities && (
                                <div>
                                  <div className="text-xs font-bold text-gray-500 mb-1">활동 내용</div>
                                  <div className="text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">{entry.activities}</div>
                                </div>
                              )}
                              {entry.concerns && (
                                <div>
                                  <div className="text-xs font-bold text-amber-600 mb-1">고민 사항</div>
                                  <div className="text-gray-700 whitespace-pre-wrap bg-amber-50 rounded-lg p-3 border border-amber-100">{entry.concerns}</div>
                                </div>
                              )}
                              {entry.feedbackNeeded && (
                                <div>
                                  <div className="text-xs font-bold text-purple-600 mb-1">피드백 요청</div>
                                  <div className="text-gray-700 whitespace-pre-wrap bg-purple-50 rounded-lg p-3 border border-purple-100">{entry.feedbackNeeded}</div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-300 text-center py-3">
                              {canEdit ? "이 주차에 기록이 없습니다." : "기록 없음"}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: 종합 평가 ───────────────────────────────────── */}
        {tab === "summary" && (
          <div className="space-y-4">
            {/* Grade summary table */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm overflow-x-auto">
              <SectionTitle>📊 {year}년 월별 종합 평가 현황</SectionTitle>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 pr-4 text-xs font-bold text-gray-500 w-16">월</th>
                    <th className="text-left py-2 pr-4 text-xs font-bold text-gray-500 w-16">등급</th>
                    <th className="text-left py-2 pr-4 text-xs font-bold text-gray-500">목표 요약</th>
                    <th className="text-left py-2 pr-4 text-xs font-bold text-gray-500">평가 코멘트</th>
                    <th className="text-left py-2 text-xs font-bold text-gray-500 w-24">주간 기록</th>
                    {isSuper && <th className="text-right py-2 text-xs font-bold text-gray-500 w-20">액션</th>}
                  </tr>
                </thead>
                <tbody>
                  {summaryMonths.map(({ month: m, label, monthlyGoal: mg, weeklyEntries: we }) => (
                    <tr key={m} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="py-3 pr-4 font-semibold text-gray-700 text-xs">{label}</td>
                      <td className="py-3 pr-4">
                        {mg?.evaluation ? <GradeBadge grade={mg.evaluation.grade} /> : (
                          <span className="text-xs text-gray-300">미평가</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 max-w-xs">
                        {mg ? (
                          <span className="text-xs text-gray-600 line-clamp-2">{mg.content}</span>
                        ) : (
                          <span className="text-xs text-gray-300">미작성</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 max-w-xs">
                        {mg?.evaluation?.comment ? (
                          <span className="text-xs text-gray-600 line-clamp-2">{mg.evaluation.comment}</span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-xs text-gray-500">
                        {we.length > 0 ? (
                          <span className="text-green-600 font-semibold">{we.length}주 작성</span>
                        ) : (
                          <span className="text-gray-300">없음</span>
                        )}
                      </td>
                      {isSuper && (
                        <td className="py-3 text-right">
                          {mg && (
                            <button onClick={() => { setEvalModalGoal(mg); }}
                              className="px-2.5 py-1 text-xs rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100">
                              {mg.evaluation ? "수정" : "평가"}
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Grade statistics */}
            {(() => {
              const evaluated = summaryMonths.filter(s => s.monthlyGoal?.evaluation);
              const gradeCounts = GRADES.reduce((acc, g) => {
                acc[g] = evaluated.filter(s => s.monthlyGoal?.evaluation?.grade === g).length;
                return acc;
              }, {} as Record<Grade, number>);
              return evaluated.length > 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <SectionTitle>등급 분포 ({evaluated.length}개월 평가 완료)</SectionTitle>
                  <div className="flex gap-3 flex-wrap">
                    {GRADES.map(g => (
                      <div key={g} className="flex flex-col items-center gap-1">
                        <GradeBadge grade={g} />
                        <span className="text-lg font-extrabold text-gray-800">{gradeCounts[g]}</span>
                        <span className="text-xs text-gray-400">회</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}

            {/* Annual goals reference */}
            {annualGoals.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <SectionTitle>🎯 {year}년 연목표 ({annualGoals.length}개)</SectionTitle>
                <div className="space-y-2">
                  {annualGoals.map((ag, i) => (
                    <div key={ag.id} className="flex items-start gap-2 text-sm">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</span>
                      <span className="text-gray-700">{ag.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      {/* ── Evaluation Modal ───────────────────────────────────── */}
      {evalModalGoal && (
        <EvalModal
          goal={evalModalGoal}
          onSave={async (grade, comment) => {
            await apiPatch(evalModalGoal.id, grade, comment);
            setEvalModalGoal(null);
          }}
          onClose={() => setEvalModalGoal(null)}
        />
      )}
    </div>
  );
}
