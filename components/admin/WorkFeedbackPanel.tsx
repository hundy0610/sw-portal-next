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

// 제외할 계정 (대소문자 무관, 이름/company 모두 체크)
function isExcludedAccount(a: { userId: string; name?: string; company?: string }): boolean {
  const id      = (a.userId  ?? "").toLowerCase();
  const name    = (a.name    ?? "").toLowerCase();
  const company = (a.company ?? "").toLowerCase();
  return id === "test" || name.includes("엠서클") || company.includes("엠서클");
}

// 평가 권한자
const EVALUATOR_NAME = "권정훈";

// ── Helpers ───────────────────────────────────────────────────
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
  goal, memberName, onSave, onClose,
}: {
  goal: MonthlyGoal; memberName: string;
  onSave: (grade: Grade, comment: string) => void; onClose: () => void;
}) {
  const [grade,   setGrade]   = useState<Grade>(goal.evaluation?.grade   ?? "B");
  const [comment, setComment] = useState(goal.evaluation?.comment ?? "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.35)" }}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-[480px] max-w-[95vw]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-gray-800">{goal.year}년 {goal.month}월 종합 평가</h3>
            <p className="text-xs text-gray-400 mt-0.5">{memberName}</p>
          </div>
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
  const isEvaluator = session.name === EVALUATOR_NAME;

  const [store,       setStore]       = useState<WorkFeedbackStore>({ annualGoals: [], monthlyGoals: [], weeklyEntries: [] });
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [year,        setYear]        = useState(Math.max(CURRENT_YEAR, 2026));
  const [month,       setMonth]       = useState(new Date().getMonth() + 1);
  const [tab,         setTab]         = useState<"annual" | "monthly" | "summary">("annual");

  // 종합평가 탭에서 평가자가 선택하는 멤버 (자신의 userId가 기본값)
  const [evalViewUserId, setEvalViewUserId] = useState(session.userId);
  const [members,        setMembers]        = useState<{ userId: string; name: string }[]>([]);

  // forms open state
  const [annualFormOpen,  setAnnualFormOpen]  = useState(false);
  const [editingAnnual,   setEditingAnnual]   = useState<AnnualGoal | undefined>();
  const [monthlyFormOpen, setMonthlyFormOpen] = useState(false);
  const [editingMonthly,  setEditingMonthly]  = useState<MonthlyGoal | undefined>();
  const [weeklyFormOpen,  setWeeklyFormOpen]  = useState<number | null>(null);
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

  // ── fetch accounts (평가자만 멤버 목록 필요) ─────────────────
  useEffect(() => {
    if (!isEvaluator) return;
    fetch("/api/admin/accounts")
      .then(r => r.json())
      .then(d => {
        if (d.ok && Array.isArray(d.accounts)) {
          const filtered = d.accounts
            .filter((a: { userId: string; name: string; company?: string; active?: boolean }) =>
              a.active !== false && !isExcludedAccount(a)
            )
            .map((a: { userId: string; name: string }) => ({ userId: a.userId, name: a.name }));
          setMembers(filtered);
        }
      })
      .catch(() => {});
  }, [isEvaluator]);

  // ── 연목표/월간관리: 항상 본인 데이터 ───────────────────────
  const myUserId    = session.userId;
  const myAnnualGoals   = store.annualGoals  .filter(g => g.userId === myUserId && g.year === year);
  const myMonthlyGoal   = store.monthlyGoals .find(g  => g.userId === myUserId && g.year === year && g.month === month);
  const myWeeklyEntries = store.weeklyEntries.filter(e => e.userId === myUserId && e.year === year && e.month === month);

  // ── 종합평가: 선택된 멤버 데이터 ────────────────────────────
  const evalUserId      = isEvaluator ? evalViewUserId : myUserId;
  const evalMemberName  = isEvaluator
    ? (members.find(m => m.userId === evalUserId)?.name || evalUserId)
    : session.name;

  const summaryMonths = MONTHS.map((label, i) => {
    const m = i + 1;
    const mg = store.monthlyGoals.find(g => g.userId === evalUserId && g.year === year && g.month === m);
    const we = store.weeklyEntries.filter(e => e.userId === evalUserId && e.year === year && e.month === m);
    return { month: m, label, monthlyGoal: mg, weeklyEntries: we };
  });

  const evalAnnualGoals = store.annualGoals.filter(g => g.userId === evalUserId && g.year === year);

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

  async function apiDelete(type: string, id: string, userId: string) {
    if (!confirm("삭제하시겠습니까?")) return;
    setSaving(true);
    try {
      const res = await fetch("/api/work-feedback", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id, userId }),
      });
      const json = await res.json();
      if (json.ok) setStore(json.data);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="flex gap-6 h-full min-h-0">

      {/* ── Left sidebar: 연도 + 탭 ───────────────────────────── */}
      <aside className="w-48 flex-shrink-0 flex flex-col gap-4">

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

        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <div className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">메뉴</div>
          {(["annual", "monthly", ...(isEvaluator ? ["summary"] : [])] as ("annual" | "monthly" | "summary")[]).map(t => {
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

        {/* 본인 정보 */}
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <div className="text-xs text-gray-400 mb-1">작성자</div>
          <div className="text-sm font-bold text-gray-800">{session.name || session.userId}</div>
          {isEvaluator && (
            <div className="mt-1.5 px-2 py-0.5 bg-purple-50 rounded text-xs text-purple-600 font-semibold text-center">
              평가자
            </div>
          )}
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────── */}
      <main className="flex-1 min-w-0 overflow-y-auto">

        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-extrabold text-gray-900">
              {tab === "annual"  && `${year}년 연목표`}
              {tab === "monthly" && `${year}년 ${month}월 월간 관리`}
              {tab === "summary" && `${year}년 종합 평가`}
            </h2>
            {tab !== "summary" && (
              <p className="text-xs text-gray-400 mt-0.5">{session.name || session.userId}</p>
            )}
          </div>
          {saving && <span className="text-xs text-blue-500 animate-pulse">저장 중...</span>}
        </div>

        {/* ── Tab: 연목표 ─────────────────────────────────────── */}
        {tab === "annual" && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-4">
              <div className="text-xs font-bold text-blue-700 mb-1">대웅 Way — 목표 설정 원칙</div>
              <div className="text-xs text-blue-600 space-y-0.5">
                <div>① 현 수준 진단 → ② 목표 설정 → ③ 필요성(왜?) → ④ 기대효과(현업 / 우리 팀)</div>
                <div>목표는 측정 가능하고 도전적이어야 하며, 현업의 문제를 해결하는 방향으로 설정합니다.</div>
              </div>
            </div>

            {!annualFormOpen && (
              <button
                onClick={() => { setEditingAnnual(undefined); setAnnualFormOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-blue-300 text-blue-600 text-sm hover:bg-blue-50 transition-colors w-full justify-center"
              >
                <span className="text-lg">+</span> 연목표 추가
              </button>
            )}

            {annualFormOpen && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="text-sm font-bold text-gray-700 mb-4">
                  {editingAnnual ? "연목표 수정" : "새 연목표 작성"}
                </div>
                <AnnualGoalForm
                  goal={editingAnnual}
                  userId={myUserId}
                  year={year}
                  onSave={async (g) => {
                    await apiPost("annualGoal", g as Record<string, unknown>);
                    setAnnualFormOpen(false); setEditingAnnual(undefined);
                  }}
                  onCancel={() => { setAnnualFormOpen(false); setEditingAnnual(undefined); }}
                />
              </div>
            )}

            {myAnnualGoals.length === 0 && !annualFormOpen && (
              <div className="text-center py-16 text-gray-400 text-sm">
                <div className="text-3xl mb-2">🎯</div>
                아직 작성된 연목표가 없습니다.
              </div>
            )}

            {myAnnualGoals.map((ag, idx) => (
              <div key={ag.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </span>
                    <h4 className="font-bold text-gray-800 text-sm">{ag.title}</h4>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => { setEditingAnnual(ag); setAnnualFormOpen(true); }}
                      className="px-2.5 py-1 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600">수정</button>
                    <button onClick={() => apiDelete("annualGoal", ag.id, myUserId)}
                      className="px-2.5 py-1 text-xs rounded-lg bg-red-50 hover:bg-red-100 text-red-500">삭제</button>
                  </div>
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
            <div className="flex gap-1.5 flex-wrap mb-5">
              {MONTHS.map((label, i) => {
                const m = i + 1;
                const hasMg = !!store.monthlyGoals.find(g => g.userId === myUserId && g.year === year && g.month === m);
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
                  <div className="flex items-center gap-2">
                    {myMonthlyGoal?.evaluation && <GradeBadge grade={myMonthlyGoal.evaluation.grade} />}
                    {!monthlyFormOpen && (
                      <button
                        onClick={() => { setEditingMonthly(myMonthlyGoal); setMonthlyFormOpen(true); }}
                        className="px-3 py-1 text-xs rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold"
                      >
                        {myMonthlyGoal ? "수정" : "+ 작성"}
                      </button>
                    )}
                  </div>
                </div>

                {monthlyFormOpen ? (
                  <MonthlyGoalForm
                    goal={editingMonthly}
                    userId={myUserId}
                    year={year}
                    month={month}
                    annualGoals={myAnnualGoals}
                    onSave={async (g) => {
                      await apiPost("monthlyGoal", g as Record<string, unknown>);
                      setMonthlyFormOpen(false); setEditingMonthly(undefined);
                    }}
                    onCancel={() => { setMonthlyFormOpen(false); setEditingMonthly(undefined); }}
                  />
                ) : myMonthlyGoal ? (
                  <div>
                    {myMonthlyGoal.annualGoalIds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {myMonthlyGoal.annualGoalIds.map(id => {
                          const ag = store.annualGoals.find(g => g.id === id);
                          return ag ? (
                            <span key={id} className="px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100">
                              {ag.title}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                    <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">{myMonthlyGoal.content}</div>
                    {myMonthlyGoal.evaluation && (
                      <div className="mt-3 bg-green-50 rounded-lg p-3 border border-green-100">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-green-700">종합 평가</span>
                          <GradeBadge grade={myMonthlyGoal.evaluation.grade} />
                          <span className="text-xs text-gray-400">
                            {myMonthlyGoal.evaluation.evaluatedBy} · {myMonthlyGoal.evaluation.evaluatedAt.slice(0, 10)}
                          </span>
                        </div>
                        {myMonthlyGoal.evaluation.comment && (
                          <div className="text-xs text-gray-600 whitespace-pre-wrap">{myMonthlyGoal.evaluation.comment}</div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-gray-400 text-center py-6">
                    아직 월 목표가 없습니다. 작성 버튼을 눌러 추가하세요.
                  </div>
                )}
              </div>

              {/* Weekly entries */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <SectionTitle>📝 주간 활동 기록</SectionTitle>
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map(w => {
                    const entry = myWeeklyEntries.find(e => e.week === w);
                    const isEditing = weeklyFormOpen === w;

                    return (
                      <div key={w} className="border border-gray-100 rounded-xl overflow-hidden">
                        <div className="flex items-center justify-between bg-gray-50 px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">{w}</span>
                            <span className="text-xs font-semibold text-gray-700">{WEEKS[w - 1]}</span>
                            {entry && <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />}
                          </div>
                          {!isEditing && (
                            <button
                              onClick={() => { setEditingWeekly(entry); setWeeklyFormOpen(w); }}
                              className="px-2.5 py-0.5 text-xs rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold"
                            >
                              {entry ? "수정" : "+ 작성"}
                            </button>
                          )}
                        </div>
                        <div className="p-4">
                          {isEditing ? (
                            <WeeklyEntryForm
                              entry={editingWeekly}
                              userId={myUserId}
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
                            <div className="text-xs text-gray-300 text-center py-3">이 주차에 기록이 없습니다.</div>
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

        {/* ── Tab: 종합 평가 (평가자 전용) ─────────────────────── */}
        {tab === "summary" && isEvaluator && (
          <div className="space-y-4">

            {/* 평가자: 멤버 선택 */}
            {isEvaluator && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="text-xs font-bold text-gray-500 mb-2">평가 대상 선택</div>
                <div className="flex flex-wrap gap-2">
                  {members.map(m => (
                    <button key={m.userId} onClick={() => setEvalViewUserId(m.userId)}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors border ${
                        evalViewUserId === m.userId
                          ? "bg-blue-600 text-white border-blue-600 font-bold"
                          : "bg-white text-gray-600 border-gray-200 hover:border-blue-400"
                      }`}>
                      {m.name || m.userId}
                    </button>
                  ))}
                  {members.length === 0 && (
                    <span className="text-xs text-gray-400">계정 목록을 불러오는 중...</span>
                  )}
                </div>
              </div>
            )}

            {/* 평가 대상 헤더 */}
            <div className="flex items-center gap-2">
              <div className="text-sm font-bold text-gray-700">{evalMemberName}</div>
              <div className="text-xs text-gray-400">— {year}년 월별 현황</div>
            </div>

            {/* 연목표 요약 */}
            {evalAnnualGoals.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="text-xs font-bold text-gray-500 mb-2">연목표</div>
                <div className="flex flex-wrap gap-2">
                  {evalAnnualGoals.map((ag, i) => (
                    <span key={ag.id} className="px-3 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100">
                      {i + 1}. {ag.title}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 월별 평가 테이블 */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 w-14">월</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 w-16">등급</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500">월 목표</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500">평가 코멘트</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 w-20">주간기록</th>
                    {isEvaluator && <th className="px-4 py-3 w-16" />}
                  </tr>
                </thead>
                <tbody>
                  {summaryMonths.map(({ month: m, label, monthlyGoal: mg, weeklyEntries: we }) => (
                    <tr key={m} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-semibold text-gray-700 text-xs">{label}</td>
                      <td className="px-4 py-3">
                        {mg?.evaluation
                          ? <GradeBadge grade={mg.evaluation.grade} />
                          : <span className="text-xs text-gray-300">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        {mg
                          ? <span className="text-xs text-gray-600 line-clamp-2">{mg.content}</span>
                          : <span className="text-xs text-gray-300">미작성</span>
                        }
                      </td>
                      <td className="px-4 py-3 max-w-[220px]">
                        {mg?.evaluation?.comment
                          ? <span className="text-xs text-gray-600 line-clamp-2">{mg.evaluation.comment}</span>
                          : <span className="text-xs text-gray-300">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {we.length > 0
                          ? <span className="text-green-600 font-semibold">{we.length}주</span>
                          : <span className="text-gray-300">없음</span>
                        }
                      </td>
                      {isEvaluator && (
                        <td className="px-4 py-3">
                          {mg && (
                            <button onClick={() => setEvalModalGoal(mg)}
                              className="px-2.5 py-1 text-xs rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 font-semibold whitespace-nowrap">
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

            {/* 등급 분포 */}
            {(() => {
              const evaluated = summaryMonths.filter(s => s.monthlyGoal?.evaluation);
              if (evaluated.length === 0) return null;
              const gradeCounts = GRADES.reduce((acc, g) => {
                acc[g] = evaluated.filter(s => s.monthlyGoal?.evaluation?.grade === g).length;
                return acc;
              }, {} as Record<Grade, number>);
              return (
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                  <div className="text-xs font-bold text-gray-500 mb-3">등급 분포 ({evaluated.length}개월 평가 완료)</div>
                  <div className="flex gap-4 flex-wrap">
                    {GRADES.map(g => gradeCounts[g] > 0 && (
                      <div key={g} className="flex items-center gap-2">
                        <GradeBadge grade={g} />
                        <span className="text-sm font-bold text-gray-700">{gradeCounts[g]}회</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </main>

      {/* ── Evaluation Modal ───────────────────────────────────── */}
      {evalModalGoal && (
        <EvalModal
          goal={evalModalGoal}
          memberName={evalMemberName}
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
