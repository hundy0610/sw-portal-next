import { kvGet, kvSetPermanent } from "@/lib/kv-store";

// ─────────────────────────────────────────────────────────────────────────────
// 구독 관리 알림 (F5) — 판정 로직 + 설정 저장
//
// ⚠️ 이 모듈은 "알림 대상을 판정해서 화면에 표시"하는 것까지만 담당한다. 메일을
// 직접 발송하지 않는다. 포털의 자동 메일 발송은 2026-07-28(9b67936)에 의도적으로
// 무력화됐고(중복발송 사고 이력), 발송 주체는 맥북 폴러로 이전됐다. 또한 트리거로
// 쓰던 GitHub Actions 크론 4종도 2026-07-29(4178562)에 삭제된 상태다.
// 나중에 발송이 필요해지면 buildAlerts() 결과를 그대로 읽어가는 쪽(맥북 폴러 등)에서
// 처리하면 되도록, 판정과 발송을 분리해 둔다.
// ─────────────────────────────────────────────────────────────────────────────

const KV_BUDGETS   = "subscription:budgets";
const KV_DEADLINES = "subscription:submission-deadlines";

/** 법인·부서별 월 예산 상한 */
export interface BudgetConfig {
  company: string;
  department: string;
  monthlyLimitKrw: number;
}

/** 법인별 월간 자료(카드명세) 제출기한 — 매월 N일 */
export interface DeadlineConfig {
  company: string;
  dayOfMonth: number; // 1~31
}

export type AlertType = "renewal" | "budget" | "submission";
export type AlertSeverity = "urgent" | "warn" | "info";

export interface SubscriptionAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  detail: string;
  company: string;
  department?: string;
  dueDate?: string;
  daysLeft?: number;
}

// ─── 설정 저장 ───────────────────────────────────────────────────────────────

export async function getBudgets(): Promise<BudgetConfig[]> {
  return (await kvGet<BudgetConfig[]>(KV_BUDGETS)) ?? [];
}
export async function saveBudgets(list: BudgetConfig[]): Promise<boolean> {
  return kvSetPermanent(KV_BUDGETS, list);
}

export async function getDeadlines(): Promise<DeadlineConfig[]> {
  return (await kvGet<DeadlineConfig[]>(KV_DEADLINES)) ?? [];
}
export async function saveDeadlines(list: DeadlineConfig[]): Promise<boolean> {
  return kvSetPermanent(KV_DEADLINES, list);
}

// ─── 종량제 실사용금액 조회 (확장 지점) ──────────────────────────────────────

/**
 * 부서별 "이번 달 실제 지출"을 구한다.
 *
 * 현재 구현: 포털에 등록된 구독 금액(월 환산)의 합계를 쓴다.
 * 향후 확장: 종량제(사용량 기반) 구독은 벤더가 usage API를 제공하는 경우가 많아
 * (예: OpenAI/Anthropic 등), 해당 API/MCP로 실제 사용금액을 가져와 이 함수의
 * 반환값만 교체하면 나머지 판정 로직은 그대로 동작한다. 그래서 알림 판정부와
 * 금액 조회부를 분리해 둔다.
 */
export interface DeptSpend {
  company: string;
  department: string;
  monthlyKrw: number;
  /** 금액 출처 — 나중에 벤더 API 연동분과 구분해서 표시하기 위함 */
  source: "registered" | "vendor-api";
}

// ─── 판정 로직 ───────────────────────────────────────────────────────────────

export interface RenewalTarget {
  id: string;
  company: string;
  department: string;
  swName: string;
  user: string;
  renewalDate: string;
}

const RENEWAL_THRESHOLDS = [7, 30] as const; // D-7(urgent), D-30(warn)

function daysUntil(dateStr: string, today: Date): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / 86_400_000);
}

/**
 * 알림 대상을 판정한다(발송하지 않음).
 * @param submittedCompanies 이번 달 카드명세가 업로드된 법인 집합(F4 배치 기준)
 */
export function buildAlerts(opts: {
  renewals: RenewalTarget[];
  spends: DeptSpend[];
  budgets: BudgetConfig[];
  deadlines: DeadlineConfig[];
  submittedCompanies: Set<string>;
  now?: Date;
}): SubscriptionAlert[] {
  const now = opts.now ?? new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const alerts: SubscriptionAlert[] = [];

  // 1) 계약 갱신 임박 — D-7 이내는 urgent, D-30 이내는 warn
  for (const r of opts.renewals) {
    const d = daysUntil(r.renewalDate, today);
    if (d === null || d < 0) continue;
    const threshold = RENEWAL_THRESHOLDS.find(t => d <= t);
    if (threshold === undefined) continue;
    alerts.push({
      id: `renewal-${r.id}`,
      type: "renewal",
      severity: threshold === 7 ? "urgent" : "warn",
      title: `갱신 D-${d} · ${r.swName}`,
      detail: `${r.department || "부서 미지정"}${r.user ? ` · ${r.user}` : ""} · 갱신일 ${r.renewalDate}`,
      company: r.company,
      department: r.department,
      dueDate: r.renewalDate,
      daysLeft: d,
    });
  }

  // 2) 예산 초과 — 법인·부서별 월 상한 대비
  const budgetKey = (c: string, d: string) => `${c}__${d}`;
  const budgetMap = new Map(opts.budgets.map(b => [budgetKey(b.company, b.department), b]));
  for (const s of opts.spends) {
    const b = budgetMap.get(budgetKey(s.company, s.department));
    if (!b || b.monthlyLimitKrw <= 0) continue;
    if (s.monthlyKrw <= b.monthlyLimitKrw) continue;
    const over = s.monthlyKrw - b.monthlyLimitKrw;
    const pct = Math.round((s.monthlyKrw / b.monthlyLimitKrw) * 100);
    alerts.push({
      id: `budget-${s.company}-${s.department}`,
      type: "budget",
      severity: "urgent",
      title: `예산 초과 ${pct}% · ${s.department || "부서 미지정"}`,
      detail: `월 ${s.monthlyKrw.toLocaleString("ko-KR")}원 / 상한 ${b.monthlyLimitKrw.toLocaleString("ko-KR")}원 (${over.toLocaleString("ko-KR")}원 초과)`,
      company: s.company,
      department: s.department,
    });
  }

  // 3) 자료 제출기한 — D-3/D-day는 warn, 기한 넘겼는데 미제출이면 urgent
  const y = now.getFullYear(), m = now.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  for (const dl of opts.deadlines) {
    if (opts.submittedCompanies.has(dl.company)) continue; // 이번 달 이미 제출됨
    const day = Math.min(Math.max(1, dl.dayOfMonth), lastDay);
    const due = new Date(y, m, day);
    due.setHours(0, 0, 0, 0);
    const d = Math.ceil((due.getTime() - today.getTime()) / 86_400_000);
    if (d > 3) continue; // 아직 여유 있음
    alerts.push({
      id: `submission-${dl.company}`,
      type: "submission",
      severity: d < 0 ? "urgent" : "warn",
      title: d < 0
        ? `카드명세 미제출 D+${Math.abs(d)} · ${dl.company}`
        : `카드명세 제출 ${d === 0 ? "당일" : `D-${d}`} · ${dl.company}`,
      detail: `${y}년 ${m + 1}월 제출기한 ${day}일`,
      company: dl.company,
      dueDate: due.toISOString().slice(0, 10),
      daysLeft: d,
    });
  }

  const rank: Record<AlertSeverity, number> = { urgent: 0, warn: 1, info: 2 };
  return alerts.sort((a, b) =>
    rank[a.severity] - rank[b.severity] || (a.daysLeft ?? 999) - (b.daysLeft ?? 999)
  );
}
