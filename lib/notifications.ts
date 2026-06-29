import { kvGet } from "@/lib/kv-store";
import { memGet } from "@/lib/mem-cache";
import { fetchExchangeReturns } from "@/lib/exchange-return";
import { fetchHelpDeskTickets, type HelpDeskTicket } from "@/lib/notion";
import type { SwDbRecord, ExchangeReturnRecord } from "@/types";
import type { WorkFeedbackStore } from "@/types/work-feedback";
import type { AdminSession } from "@/lib/session";

export type NotifCategory = "sw-expiry" | "asset-ready" | "return-due" | "helpdesk-new" | "weekly-feedback";

export interface NotificationItem {
  id: string;
  category: NotifCategory;
  title: string;
  description: string;
  date?: string;
  severity: "urgent" | "warn" | "info";
  page: string;
}

// 월간: 14일 전 / 연간: 30일 전 알림 (RenewalAlertModal·api/sw/expiring 과 동일 기준)
const SW_ALERT_DAYS: Record<string, number> = { "월": 14, "연": 30 };
const ASSET_READY_DAYS = 3;
const RETURN_DUE_DAYS = 7;

function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysBetween(dateStr: string, from: Date): number {
  const diff = new Date(dateStr).getTime() - from.getTime();
  return Math.ceil(diff / 86400000);
}

// WorkFeedbackPanel.tsx 의 isExcludedAccount() 와 동일 규칙
function isExcludedAccount(a: { userId: string; name?: string; company?: string }): boolean {
  const name = a.name || "";
  const company = a.company || "";
  return a.userId === "test" || name.includes("엠서클") || company.includes("엠서클");
}

function currentWeekOfMonth(date: Date): number {
  return Math.min(Math.ceil(date.getDate() / 7), 5);
}

async function buildSwExpiryNotifications(): Promise<NotificationItem[]> {
  let data = memGet<SwDbRecord[]>("sw:all");
  if (!data) data = await kvGet<SwDbRecord[]>("sw:all");
  if (!data) return [];

  const today = todayStart();
  const groups = new Map<string, { company: string; department: string; renewalDate: string; cycle: string; sw: string[]; count: number }>();

  for (const r of data) {
    const cycle = r.renewalCycle ?? "";
    const alertBefore = SW_ALERT_DAYS[cycle];
    if (!alertBefore) continue;
    if (r.status !== "사용중") continue;
    if (!r.renewalDate) continue;

    const d = daysBetween(r.renewalDate, today);
    if (d < 0 || d > alertBefore) continue;

    const key = `${r.company}|${r.department || ""}|${r.renewalDate}|${cycle}`;
    if (!groups.has(key)) {
      groups.set(key, { company: r.company || "", department: r.department || "", renewalDate: r.renewalDate, cycle, sw: [], count: 0 });
    }
    const g = groups.get(key)!;
    g.count += 1;
    if (!g.sw.includes(r.swCategory)) g.sw.push(r.swCategory);
  }

  return [...groups.entries()].map(([key, g]) => {
    const d = daysBetween(g.renewalDate, today);
    const urgent = d <= (g.cycle === "월" ? 3 : 7);
    return {
      id: `sw-expiry:${key}`,
      category: "sw-expiry",
      title: `${g.company}${g.department ? ` · ${g.department}` : ""} SW 갱신임박`,
      description: `${g.sw.slice(0, 3).join(", ")}${g.sw.length > 3 ? ` 외 ${g.sw.length - 3}건` : ""} — D-${d} (${g.renewalDate})`,
      date: g.renewalDate,
      severity: urgent ? "urgent" : "warn",
      page: "license",
    };
  });
}

async function buildExchangeReturnNotifications(): Promise<NotificationItem[]> {
  let data = memGet<ExchangeReturnRecord[]>("exchange-return:all");
  if (!data) data = await fetchExchangeReturns();
  if (!data) return [];

  const today = todayStart();
  const items: NotificationItem[] = [];

  for (const r of data) {
    if ((r.stage === "기기준비" || r.stage === "기기준비완료") && r.useDate) {
      const d = daysBetween(r.useDate, today);
      if (d <= ASSET_READY_DAYS) {
        items.push({
          id: `asset-ready:${r.id}`,
          category: "asset-ready",
          title: `${r.company}${r.department ? ` · ${r.department}` : ""} 기기 준비 필요`,
          description: `${r.user} 사용예정일 ${d < 0 ? `초과 D+${-d}` : `D-${d}`} (${r.useDate}) · 현재 단계: ${r.stage}`,
          date: r.useDate,
          severity: d <= 0 ? "urgent" : "warn",
          page: "exchange-return",
        });
      }
    }

    if (r.stage === "반납요청" && r.returnDue) {
      const d = daysBetween(r.returnDue, today);
      if (d <= RETURN_DUE_DAYS) {
        items.push({
          id: `return-due:${r.id}`,
          category: "return-due",
          title: `${r.company}${r.department ? ` · ${r.department}` : ""} 반납 ${d < 0 ? "기한 초과" : "임박"}`,
          description: `${r.user} 반납예정일 ${d < 0 ? `초과 D+${-d}` : `D-${d}`} (${r.returnDue})`,
          date: r.returnDue,
          severity: d <= 0 ? "urgent" : "warn",
          page: "exchange-return",
        });
      }
    }
  }
  return items;
}

async function buildHelpdeskNotifications(): Promise<NotificationItem[]> {
  const cached = await kvGet<{ data: HelpDeskTicket[] }>("helpdesk:tickets");
  let data = cached?.data;
  if (!data) data = await fetchHelpDeskTickets();
  if (!data) return [];

  return data
    .filter(t => t.status === "시작 전")
    .map(t => ({
      id: `helpdesk-new:${t.id}`,
      category: "helpdesk-new" as const,
      title: `${t.company}${t.department ? ` · ${t.department}` : ""} 신규 문의 미처리`,
      description: `${t.requester} — ${t.inquiryType}${t.urgency ? ` (${t.urgency})` : ""}`,
      date: t.submittedAt,
      severity: t.urgency === "매우 급합니다" ? "urgent" as const : "warn" as const,
      page: "helpdesk",
    }));
}

async function buildWeeklyFeedbackNotification(session: AdminSession): Promise<NotificationItem[]> {
  const now = new Date();
  const weekday = now.getDay(); // 0=일 ... 3=수, 4=목, 5=금
  if (weekday < 3 || weekday > 5) return [];
  if (isExcludedAccount(session)) return [];

  const store = await kvGet<WorkFeedbackStore>("work-feedback:all");
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const week = currentWeekOfMonth(now);

  const exists = store?.weeklyEntries.some(
    e => e.userId === session.userId && e.year === year && e.month === month && e.week === week
  );
  if (exists) return [];

  return [{
    id: `weekly-feedback:${year}-${month}-${week}`,
    category: "weekly-feedback",
    title: "이번 주 업무 피드백 미작성",
    description: `${month}월 ${week}주차 업무 피드백을 아직 작성하지 않았습니다.`,
    severity: "info",
    page: "work-feedback",
  }];
}

export async function buildNotifications(session: AdminSession): Promise<NotificationItem[]> {
  const [sw, exchangeReturn, helpdesk, weekly] = await Promise.all([
    buildSwExpiryNotifications().catch(() => []),
    buildExchangeReturnNotifications().catch(() => []),
    buildHelpdeskNotifications().catch(() => []),
    buildWeeklyFeedbackNotification(session).catch(() => []),
  ]);

  return [...sw, ...exchangeReturn, ...helpdesk, ...weekly]
    .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));
}
