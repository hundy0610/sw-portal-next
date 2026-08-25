// SaaS 사용 현황(브라우저 방문 도메인) ↔ 구독 관리(등록된 라이선스) 대조.
//
// 배경: "이 PC가 이 SaaS를 정기적으로 쓰는데, 법인 명의로 결제 중인 구독이 없다"를
// 잡기 위한 기능. 처음에는 법인카드 명세(CardRow)와 직접 비교하는 방안을 검토했으나,
// CardRow에는 가맹점명 필드 자체가 없어(company/department/cardLast4/paidAt/amount/note
// 뿐) 카드 데이터로는 "어떤 서비스에 결제했는지"조차 알 수 없다. 반면 구독 관리
// (SubRow, lib/reportTypes.ts)는 swName·user(신청자)·company·department가 이미
// 구조화돼 있어 — 특히 사람 단위 배정까지 있어 — 이 목적에 훨씬 적합하다.
//
// 주의: 여기서 나오는 "미등록 사용 후보"는 결론이 아니라 확인이 필요한 후보 목록이다.
// 무료 티어일 수도, 동료의 공용 시트를 같이 쓰는 것일 수도, 아직 구독 관리에 등록만
// 안 된 정식 결제일 수도 있다 — 자동 통보가 아니라 검토 절차로 이어져야 한다.
import { normalizeDomain, type SaasAuditEntry } from "@/lib/saas-audit";
import type { SaasItem } from "@/types";

/** 구독 관리(SubRow)에서 대조에 필요한 최소 필드만 뽑은 형태. */
export interface SubscriptionLite {
  user: string;
  swName: string;
  company: string;
  department: string;
}

/** PC 자산실사 기록에서 얻은, 조직이 인식하는 실제 사용자 신원(수집 스크립트가
 * 보낸 원본 Windows 계정명이 아니라 이쪽을 신뢰한다). */
export interface PcIdentity {
  serial: string;
  pcName: string;
  userName: string;
  dept: string;
  corp: string;
}

function daysOf(e: { daysObserved?: number }): number {
  return e.daysObserved ?? 0;
}

export interface UnregisteredUsageCandidate {
  serial: string;
  pcName: string;
  userName: string;
  dept: string;
  corp: string;
  domain: string;
  /** SaaS 정책에 등록된 서비스명이 있으면 그 값, 없으면 도메인에서 추정한 이름 */
  serviceNameGuess: string;
  daysObserved: number;
  visitCount: number;
  lastVisitedAt: string;
}

function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "");
}

/** 도메인으로 서비스명을 추정한다 — 정책 DB에 등록돼 있으면 그 이름을, 없으면
 * 2단계 도메인 앞부분(chatgpt.com → chatgpt)을 힌트로 쓴다. */
function guessServiceName(domain: string, saasItems: SaasItem[]): string {
  const h = normalizeDomain(domain);
  const matched = saasItems.find(item => {
    const p = normalizeDomain(item.domain);
    return !!p && (h === p || h.endsWith(`.${p}`));
  });
  if (matched) return matched.name;
  const parts = h.split(".");
  return parts.length >= 2 ? parts[parts.length - 2] : h;
}

/** 이 사람 앞으로 등록된, 이 서비스와 이름이 겹치는 구독이 하나라도 있는지. */
function hasMatchingSubscription(userName: string, serviceNameGuess: string, subs: SubscriptionLite[]): boolean {
  const person = normalizeName(userName);
  if (!person) return false;
  const svc = normalizeName(serviceNameGuess);
  if (!svc) return false;
  return subs.some(s => {
    if (normalizeName(s.user) !== person) return false;
    const swn = normalizeName(s.swName);
    return swn.includes(svc) || svc.includes(swn);
  });
}

/**
 * PC별 SaaS 사용 현황(화이트/조건부/미확인만 — 이미 블랙리스트·예외는 별도 처리되므로
 * 제외)을 구독 관리와 대조해 "등록된 구독 없이 정기적으로 쓰는" 후보를 뽑는다.
 *
 * minDaysObserved: 몇 개의 서로 다른 날짜에 관측돼야 "정기적"으로 볼지 — 정책적
 * 판단이라 호출부에서 정하게 한다(기본값은 API 라우트에서 지정).
 */
export function findUnregisteredUsage(
  perPc: { identity: PcIdentity; entries: SaasAuditEntry[] }[],
  saasItems: SaasItem[],
  subs: SubscriptionLite[],
  minDaysObserved: number,
): UnregisteredUsageCandidate[] {
  const out: UnregisteredUsageCandidate[] = [];
  for (const { identity, entries } of perPc) {
    if (!identity.userName) continue; // 신원을 모르면 특정인을 지목할 수 없어 건너뜀
    for (const e of entries) {
      if (e.status === "blacklist" || e.status === "excluded") continue;
      if (daysOf(e) < minDaysObserved) continue;
      const serviceNameGuess = guessServiceName(e.host, saasItems);
      if (hasMatchingSubscription(identity.userName, serviceNameGuess, subs)) continue;
      out.push({
        serial: identity.serial, pcName: identity.pcName, userName: identity.userName,
        dept: identity.dept, corp: identity.corp,
        domain: e.host, serviceNameGuess,
        daysObserved: daysOf(e), visitCount: e.visitCount, lastVisitedAt: e.lastVisitedAt,
      });
    }
  }
  return out.sort((a, b) => b.daysObserved - a.daysObserved);
}
