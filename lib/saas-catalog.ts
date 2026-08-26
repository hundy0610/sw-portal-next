import { pgKvGet, pgKvUpdate } from "./pg-kv";

// ─────────────────────────────────────────────────────────────────────────────
// SaaS 도메인 카탈로그(portal:saasdb) 조회 + SaaS 사용 현황(portal:saas_usage) 기록.
//
// 이 카탈로그는 assetify-for-desktop의 "SaaS 도메인 정책 관리" 화면에서 관리자가
// 등록·수정한다(core/saas-audit.ts). 여기서는 읽기만 한다 — 등록/수정은 데스크탑 앱의
// 몫이다.
//
// 프라이버시 원칙: PC 스캐닝 프로그램은 이 카탈로그에 있는 도메인만 방문기록에서
// 추출해 보내도록 스펙에 명시돼 있지만, 그건 "부탁"일 뿐 강제가 아니다 — 스캐닝
// 프로그램 구현 실수나 변조로 카탈로그 밖 도메인이 섞여 들어올 수 있다. 그래서
// 서버(여기)가 받은 도메인을 다시 한번 이 카탈로그로 걸러낸다(filterKnownDomains) —
// 카탈로그에 없는 도메인은 그 어떤 경우에도 저장되거나 파일에 남지 않는다.
//
// fail-closed: 카탈로그 조회 자체가 실패하면(DB 연결 불가 등) "알려진 도메인이
// 하나도 없다"로 취급한다 — 실패했다고 필터링을 건너뛰고 전부 통과시키면 안 된다.
// ─────────────────────────────────────────────────────────────────────────────

export const SAASDB_KV_KEY = "portal:saasdb";
export const SAAS_USAGE_KV_KEY = "portal:saas_usage";

export interface SaasItem {
  id: string;
  domain: string;
  name: string;
  vendor: string;
  category: string;
  status: "approved" | "banned" | "conditional" | "excluded";
  alternatives: string[];
  description: string;
  officialUrl?: string;
}

export function normalizeDomain(host: string): string {
  return host.trim().toLowerCase().replace(/^www\./, "");
}

function domainMatches(visitedHost: string, policyDomain: string): boolean {
  const v = normalizeDomain(visitedHost);
  const p = normalizeDomain(policyDomain);
  if (!v || !p) return false;
  return v === p || v.endsWith(`.${p}`);
}

/** 유효한 호스트명 형태인지 검사 — 영문/숫자/점/하이픈만, 길이 제한. 포뮬러 인젝션·이상값 방어. */
export function isValidHostname(host: string): boolean {
  if (typeof host !== "string") return false;
  const h = host.trim();
  if (!h || h.length > 253) return false;
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(h);
}

export async function fetchSaasCatalog(): Promise<SaasItem[] | null> {
  const items = await pgKvGet<SaasItem[]>(SAASDB_KV_KEY);
  if (!Array.isArray(items)) return null;
  return items;
}

/**
 * 방문 도메인 목록을 카탈로그로 걸러낸다. 카탈로그를 못 읽으면(null) 전부 버린다
 * (fail-closed) — 호출부가 이 반환값을 "카탈로그 없음"과 "매치 0건"으로 구분할 필요는
 * 없다, 어느 쪽이든 결과는 빈 배열이어야 안전하다.
 */
export function filterKnownDomains<T extends { host: string }>(
  domains: T[],
  catalog: SaasItem[] | null,
): T[] {
  if (!catalog || catalog.length === 0) return [];
  return domains.filter(d => isValidHostname(d.host) && catalog.some(item => domainMatches(d.host, item.domain)));
}

export interface SaasUsageDomainEntry {
  visitCount: number;
  firstSeenAt: string;
  lastVisitedAt: string;
  daysObserved: number;
  lastReportDate: string;
}

export interface SaasUsagePcRecord {
  pcName: string;
  serial: string;
  userName?: string;
  email?: string;
  corp?: string;
  lastReportedAt: string;
  domains: Record<string, SaasUsageDomainEntry>;
}

export type SaasUsageStore = Record<string, SaasUsagePcRecord>;

export interface IncomingDomainVisit {
  host: string;
  visitCount: number;
  lastVisitedAt: string;
}

// 스캐닝 프로그램이 보낼 수 있는 최대 도메인 건수 — 개발요청서 스펙과 동일.
// 상한이 없으면 한 요청으로 과도한 양의 데이터를 실어보내 저장소를 부풀리거나
// 처리 시간을 늘리는 것을 막을 수 없다.
export const MAX_INCOMING_DOMAINS = 2000;

/**
 * 요청 본문의 원시 값을 신뢰 가능한 IncomingDomainVisit[]로 정제한다. 형태가 안 맞는
 * 항목은 조용히 버린다(전체 요청을 실패시키지 않음 — HW/SW 정보는 정상 처리돼야 한다).
 * 호스트명 검증(isValidHostname)은 여기서도 한 번 더 걸어 잘못된 문자열이 뒤 단계
 * (엑셀 시트, KV)까지 흘러가지 않게 한다.
 */
export function sanitizeIncomingVisits(raw: unknown): IncomingDomainVisit[] {
  if (!Array.isArray(raw)) return [];
  const out: IncomingDomainVisit[] = [];
  for (const entry of raw.slice(0, MAX_INCOMING_DOMAINS)) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const host = typeof e.host === "string" ? e.host.trim() : "";
    if (!isValidHostname(host)) continue;
    const rawCount = typeof e.visitCount === "number" ? e.visitCount : Number(e.visitCount);
    const visitCount = Number.isFinite(rawCount) ? Math.max(0, Math.min(1_000_000, Math.trunc(rawCount))) : 0;
    const rawDate = typeof e.lastVisitedAt === "string" ? e.lastVisitedAt : "";
    const parsed = rawDate ? new Date(rawDate) : null;
    const lastVisitedAt = parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
    out.push({ host, visitCount, lastVisitedAt });
  }
  return out;
}

/** 엑셀 셀에 쓰기 전 방어적 정제 — =,+,-,@ 로 시작하면 수식으로 해석돼 열릴 수 있다(CSV/수식 인젝션). */
export function sanitizeForExcelCell(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

/**
 * 카탈로그로 걸러진 도메인 방문 기록을 해당 PC의 누적 SaaS 사용 현황에 병합한다.
 * 도메인별로 방문수는 이번 스냅샷 값으로 덮어쓰고(재실사 시점까지 브라우저에 누적된
 * 총량이므로 합산이 아니라 대체가 맞다), 최초 관측일(firstSeenAt)과 관측 일수만 누적한다.
 */
export function mergeSaasUsageForPc(
  store: SaasUsageStore | null,
  key: string,
  meta: { pcName: string; serial: string; userName?: string; email?: string; corp?: string },
  visits: IncomingDomainVisit[],
): SaasUsageStore {
  const next: SaasUsageStore = store ? { ...store } : {};
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const prevRecord = next[key];
  const domains: Record<string, SaasUsageDomainEntry> = prevRecord ? { ...prevRecord.domains } : {};

  for (const v of visits) {
    const host = normalizeDomain(v.host);
    if (!host) continue;
    const prev = domains[host];
    const lastVisitedAt = v.lastVisitedAt || now;
    domains[host] = {
      visitCount: v.visitCount,
      firstSeenAt: prev?.firstSeenAt || now,
      lastVisitedAt,
      daysObserved: prev && prev.lastReportDate === today ? prev.daysObserved : (prev?.daysObserved ?? 0) + 1,
      lastReportDate: today,
    };
  }

  next[key] = {
    pcName: meta.pcName,
    serial: meta.serial,
    userName: meta.userName,
    email: meta.email,
    corp: meta.corp,
    lastReportedAt: now,
    domains,
  };
  return next;
}

/** portal:saas_usage 를 읽기-수정-쓰기로 갱신한다. 동시 요청 간 lost-update를 줄인다. */
export async function updateSaasUsage(
  key: string,
  meta: { pcName: string; serial: string; userName?: string; email?: string; corp?: string },
  visits: IncomingDomainVisit[],
): Promise<boolean> {
  const { ok } = await pgKvUpdate<SaasUsageStore>(SAAS_USAGE_KV_KEY, (current) =>
    mergeSaasUsageForPc(current, key, meta, visits)
  );
  return ok;
}
