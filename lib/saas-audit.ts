// 브라우저 방문 도메인 ↔ SaaS 도메인 정책(화이트/블랙리스트) 대조.
//
// SwItem(설치형 SW)과 별개 대상이다 — 브라우저로 접속해서 쓰는 SaaS는 PC에 설치되지
// 않아 프로그램 목록 대조(lib/sw-audit.ts)로는 절대 잡히지 않는다. 수집 클라이언트가
// Chrome/Edge의 로컬 방문기록(History) DB에서 도메인만 추출해 보낸다 — 전체 URL 경로는
// 서버로 전송하지 않는다(프라이버시 최소화).
import type { SaasItem } from "@/types";

export type SaasMatchStatus = "whitelist" | "blacklist" | "unknown" | "excluded";

/** 수집 클라이언트가 보내는 원본 단위(도메인당 1건, PC당 여러 건). */
export interface VisitedDomain {
  host: string;
  visitCount: number;
  lastVisitedAt: string; // ISO 8601
  /**
   * 이 도메인이 관측된 서로 다른 날짜 수(수집 스크립트가 하루 1회 보고하는 것을
   * 전제로 함). "정기적으로 쓰는가"를 보려면 visitCount(브라우저 누적 방문수, 하루에
   * 몰아서 방문해도 크게 뛸 수 있음)보다 이 값이 더 정확한 지표다.
   *
   * 수집 클라이언트가 매 보고마다 보내는 원본 payload에는 이 값이 없다(서버가
   * mergeSaasUsageReport에서 누적 계산한다) — 그래서 optional이다. 저장소에서 읽어
   * 매칭용으로 변환할 때(domainsToVisitedList)는 항상 채워서 내려준다.
   */
  daysObserved?: number;
}

export interface SaasAuditEntry extends VisitedDomain {
  status: SaasMatchStatus;
  matchedItem?: SaasItem;
}

/** 대소문자·"www." 접두어 차이를 흡수하기 위한 호스트 정규화. */
export function normalizeDomain(host: string): string {
  return host.trim().toLowerCase().replace(/^www\./, "");
}

/** 방문 호스트가 정책 도메인과 같거나 그 하위 도메인인지. mail.notion.so → notion.so 매치. */
function domainMatches(visitedHost: string, policyDomain: string): boolean {
  const v = normalizeDomain(visitedHost);
  const p = normalizeDomain(policyDomain);
  if (!v || !p) return false;
  return v === p || v.endsWith(`.${p}`);
}

/** 이 호스트가 SaaS 도메인 정책(카탈로그)에 등록돼 있는지 — 상태(승인/금지/조건부/예외)는
 * 상관없이, 카탈로그에 존재하기만 하면 true. POST /api/saas-usage의 수집 필터링에 쓴다. */
export function isKnownDomain(host: string, saasItems: SaasItem[]): boolean {
  const h = normalizeDomain(host);
  if (!h) return false;
  return saasItems.some(item => domainMatches(h, item.domain));
}

/** 유효한 호스트명 형태인지 검사 — 영문/숫자/점/하이픈만, 길이 제한. 이상값·인젝션 방어. */
export function isValidHostname(host: string): boolean {
  if (typeof host !== "string") return false;
  const h = host.trim();
  if (!h || h.length > 253) return false;
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(h);
}

/** 엑셀 셀에 쓰기 전 방어적 정제 — =,+,-,@ 로 시작하면 수식으로 해석돼 열릴 수 있다(CSV/수식 인젝션). */
export function sanitizeForExcelCell(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

// ─────────────────────────────────────────────────────────────────────────────
// 자동 예외 판정 — SaaS DB에 등록돼 있지 않아도 순수 인프라/광고 트래킹 도메인이면
// "미확인"이 아니라 "excluded"로 분류한다. 사람이 서비스로 선택해서 방문한 게 아니라
// 페이지 로드 중 리다이렉트되거나 배경에서 호출되는 도메인들이다.
// ─────────────────────────────────────────────────────────────────────────────
const EXCLUDED_DOMAIN_PATTERNS = [
  "doubleclick.net", "googlesyndication.com", "googleadservices.com",
  "google-analytics.com", "googletagmanager.com", "adservice.google.com",
  "gstatic.com", "clients2.google.com", "clients4.google.com",
  "googleusercontent.com", "accounts.google.com",
];

function looksAutoExcluded(host: string): boolean {
  const h = normalizeDomain(host);
  return EXCLUDED_DOMAIN_PATTERNS.some(p => h === p || h.endsWith(`.${p}`));
}

/** 방문 도메인 목록을 SaaS DB(승인/조건부=화이트, 금지=블랙, 예외=제외)와 대조해 분류한다. */
export function matchDomainsAgainstSaasDb(domains: VisitedDomain[], saasItems: SaasItem[]): SaasAuditEntry[] {
  return domains.map(d => {
    const host = normalizeDomain(d.host);
    if (!host) return { ...d, status: "unknown" };
    const matched = saasItems.find(item => domainMatches(host, item.domain));
    if (matched) {
      if (matched.status === "banned") return { ...d, status: "blacklist", matchedItem: matched };
      if (matched.status === "excluded") return { ...d, status: "excluded", matchedItem: matched };
      return { ...d, status: "whitelist", matchedItem: matched };
    }
    if (looksAutoExcluded(host)) return { ...d, status: "excluded" };
    return { ...d, status: "unknown" };
  });
}

export interface UnknownDomainAggregateEntry {
  host: string;
  count: number; // 몇 대의 PC에서 발견됐는지
  pcNames: string[];
  totalVisits: number;
}

/** 여러 PC의 "미확인" 도메인을 호스트 기준으로 합쳐 몇 대에서 발견됐는지 집계한다. */
export function aggregateUnknownDomains(
  perPc: { pcName: string; entries: SaasAuditEntry[] }[],
): UnknownDomainAggregateEntry[] {
  const map = new Map<string, UnknownDomainAggregateEntry>();
  for (const { pcName, entries } of perPc) {
    for (const e of entries) {
      if (e.status !== "unknown") continue;
      const key = normalizeDomain(e.host);
      if (!key) continue;
      const existing = map.get(key);
      if (existing) {
        existing.totalVisits += e.visitCount;
        if (!existing.pcNames.includes(pcName)) { existing.pcNames.push(pcName); existing.count++; }
      } else {
        map.set(key, { host: e.host, count: 1, pcNames: [pcName], totalVisits: e.visitCount });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

// ─────────────────────────────────────────────────────────────────────────────
// 저장소 형태 — KV 한 키(portal:saas_usage)에 PC별 누적치를 하나의 객체로 보관한다
// (portal:swdb와 동일하게 "통째로 읽고 통째로 다시 쓰는" 방식). 원본 방문기록을
// 그대로 쌓지 않고 도메인별 누적 방문수 + 최초/최근 관측 시각만 남긴다 — 하루하루의
// 방문 로그가 아니라 "지금 이 PC가 어떤 SaaS를 쓰는가"라는 현재 상태만 필요하기
// 때문에, 시간이 지나도 저장량이 늘어나지 않는다.
// ─────────────────────────────────────────────────────────────────────────────

/** 수집 클라이언트(PowerShell)가 보내는 1회 보고 payload. */
export interface SaasUsageReport {
  pcName: string;
  /** PC 실사 스캔과 동일하게 serial을 식별 키로 쓴다 — pcName은 중복될 수 있다. */
  serial: string;
  userName?: string;
  email?: string;
  corp?: string;
  collectedAt: string; // ISO 8601, 수집 클라이언트의 보고 시각
  domains: VisitedDomain[];
}

export interface SaasUsagePcRecord {
  pcName: string;
  serial: string;
  userName?: string;
  email?: string;
  corp?: string;
  lastReportedAt: string;
  /** key = normalizeDomain 결과 */
  domains: Record<string, { visitCount: number; firstSeenAt: string; lastVisitedAt: string; daysObserved: number; lastReportDate: string }>;
}

/** KV 전체 값 — key = serial. */
export type SaasUsageStore = Record<string, SaasUsagePcRecord>;

// report.collectedAt(ISO)의 날짜 부분만 — 하루 여러 번 보고가 와도 daysObserved가
// 중복 증가하지 않도록 날짜 단위로 비교한다.
function reportDateOf(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * 새 보고를 기존 저장소에 병합한다.
 *
 * visitCount는 더하지 않고 최댓값으로 대체한다 — 예전에는 수집 클라이언트(작업
 * 스케줄러, 하루 1회)가 "그날의 증분"만 보낸다고 가정해 누적 합산이 맞았지만, 지금은
 * PC 자산실사 라운드(반기 1회)에 얹어 스냅샷으로 수집한다. Chrome/Edge의 History가
 * 이미 수개월치 방문수를 자체 누적해서 갖고 있어, 매 라운드 보고값 자체가 "그 시점까지
 * 누적된 총량"이다 — 여기에 다시 더하면 라운드를 거듭할수록 실제보다 훨씬 부풀려진다.
 * 최댓값을 쓰면 오탐(방문기록 삭제 등으로 이번 값이 더 작게 오는 경우)에도 방문수가
 * 줄어드는 이상한 일 없이 안전하다.
 */
export function mergeSaasUsageReport(store: SaasUsageStore, report: SaasUsageReport): SaasUsageStore {
  const key = report.serial.trim();
  if (!key) return store;
  const existing = store[key];
  const domains: SaasUsagePcRecord["domains"] = existing ? { ...existing.domains } : {};
  const reportDate = reportDateOf(report.collectedAt);
  for (const d of report.domains) {
    const host = normalizeDomain(d.host);
    if (!host) continue;
    const prev = domains[host];
    const isNewDay = !prev || prev.lastReportDate !== reportDate;
    domains[host] = {
      visitCount: Math.max(prev?.visitCount ?? 0, d.visitCount),
      // firstSeenAt은 브라우저의 실제 최초 방문시각이 아니라 "우리 시스템이 처음
      // 관측한 시각"이다 — 수집 클라이언트는 누적 방문수만 보내 브라우저 원본
      // 최초방문시각을 알 수 없다.
      firstSeenAt: prev ? prev.firstSeenAt : report.collectedAt,
      lastVisitedAt: prev && prev.lastVisitedAt > d.lastVisitedAt ? prev.lastVisitedAt : d.lastVisitedAt,
      daysObserved: (prev?.daysObserved ?? 0) + (isNewDay ? 1 : 0),
      lastReportDate: reportDate,
    };
  }
  return {
    ...store,
    [key]: {
      pcName: report.pcName, serial: key,
      userName: report.userName, email: report.email, corp: report.corp,
      lastReportedAt: report.collectedAt, domains,
    },
  };
}

/** 저장소의 도메인 맵을 매칭 함수 입력 형태(VisitedDomain[])로 변환. */
export function domainsToVisitedList(domains: SaasUsagePcRecord["domains"]): VisitedDomain[] {
  return Object.entries(domains).map(([host, v]) => ({ host, visitCount: v.visitCount, lastVisitedAt: v.lastVisitedAt, daysObserved: v.daysObserved }));
}
