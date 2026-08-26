import { NextRequest, NextResponse } from "next/server";
import { getSaasUsage, saveSaasUsage, getSaasItems } from "@/lib/portal-store";
import {
  mergeSaasUsageReport, matchDomainsAgainstSaasDb, aggregateUnknownDomains, domainsToVisitedList,
  isKnownDomain, isValidHostname, sanitizeForExcelCell,
  type SaasUsageReport, type VisitedDomain,
} from "@/lib/saas-audit";
import { findUnregisteredUsage, type SubscriptionLite, type PcIdentity } from "@/lib/saas-subscription-check";
import { fetchSwDatabase } from "@/lib/notion";
import { fetchPcScans, attachSaasDomainSheet } from "@/lib/pc-scan";
import { getSessionFromCookieHeader, resolveCurrentRole } from "@/lib/session";
import { errorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

// 정기적 사용으로 볼 최소 누적 방문수 — 정책값이라 쿼리스트링으로 조정 가능하게 둔다.
const DEFAULT_MIN_VISIT_COUNT = 10;

const MAX_DOMAINS_PER_REPORT = 2000;
const MAX_BODY_BYTES = 1 * 1024 * 1024;

// POST /api/saas-usage — 수집 클라이언트(PC 자산실사에 얹혀 반기 1회 실행) 전용.
// 로그인 세션이 없는 무인 실행이라 /api/pc-scan과 동일하게 사전 공유 키로 인증한다.
// PC 실사 수집(SCAN_INGEST_KEY)과 신뢰 경계를 분리하기 위해 별도 키를 쓴다 — 이 키가
// 유출돼도 자산실사 데이터에는 영향이 없다.
export async function POST(req: NextRequest) {
  const key = process.env.SAAS_SCAN_INGEST_KEY;
  if (!key || req.headers.get("x-scan-key") !== key) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: SaasUsageReport;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false, error: "요청 본문이 너무 큽니다 (최대 1MB)" }, { status: 400 });
    }
    body = JSON.parse(raw) as SaasUsageReport;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON 파싱 오류" }, { status: 400 });
  }

  const pcName = typeof body.pcName === "string" ? body.pcName.trim() : "";
  const serial = typeof body.serial === "string" ? body.serial.trim() : "";
  if (!pcName || !serial) {
    return NextResponse.json({ ok: false, error: "pcName, serial은 필수입니다" }, { status: 400 });
  }
  if (!Array.isArray(body.domains)) {
    return NextResponse.json({ ok: false, error: "domains는 배열이어야 합니다" }, { status: 400 });
  }
  if (body.domains.length > MAX_DOMAINS_PER_REPORT) {
    return NextResponse.json({ ok: false, error: `domains는 한 번에 최대 ${MAX_DOMAINS_PER_REPORT}건까지 허용됩니다` }, { status: 400 });
  }

  // 호스트명 형태 검증 — 이상한 문자열은 조용히 버린다(전체 요청을 실패시키지 않음).
  const parsed: VisitedDomain[] = body.domains
    .filter((d): d is VisitedDomain => !!d && typeof d.host === "string" && isValidHostname(d.host.trim()))
    .map(d => ({
      host: d.host.trim(),
      visitCount: Number.isFinite(d.visitCount) && d.visitCount > 0 ? Math.floor(d.visitCount) : 1,
      lastVisitedAt: typeof d.lastVisitedAt === "string" && d.lastVisitedAt ? d.lastVisitedAt : new Date().toISOString(),
    }));

  const collectedAt = typeof body.collectedAt === "string" && body.collectedAt ? body.collectedAt : new Date().toISOString();

  try {
    // 카탈로그(SaaS 도메인 정책)로 재검증한다 — 수집 클라이언트가 이미 걸러서 보내도록
    // 스펙에 있지만, 그건 강제할 수 없는 약속이다. fail-closed: 카탈로그 조회 자체가
    // 실패하면 아래 catch로 빠져 이 요청은 도메인을 하나도 저장하지 않고 통째로 실패
    // 처리된다 — "카탈로그를 확인 못 했으니 일단 다 저장"으로 새지 않는다.
    const saasItemsForFilter = await getSaasItems();
    const domains = parsed.filter(d => isKnownDomain(d.host, saasItemsForFilter));

    const store = await getSaasUsage();
    const updated = mergeSaasUsageReport(store, {
      pcName, serial, collectedAt, domains,
      userName: typeof body.userName === "string" ? body.userName.trim() : undefined,
      email: typeof body.email === "string" ? body.email.trim() : undefined,
      corp: typeof body.corp === "string" ? body.corp.trim() : undefined,
    });
    if (!(await saveSaasUsage(updated))) {
      return NextResponse.json({ ok: false, error: "저장에 실패했습니다" }, { status: 500 });
    }

    // 같은 실사 라운드에서 먼저 도착했을 /api/pc-scan 첨부(설치프로그램 엑셀)에 이번
    // SaaS 도메인을 두 번째 시트로 얹는다 — 부가 기능이라 실패해도 위 저장은 그대로 둔다.
    attachSaasDomainSheet(serial, domains, sanitizeForExcelCell).catch(e =>
      console.error("[saas-usage → pc-scan 엑셀 시트 병합 실패]", e)
    );

    return NextResponse.json({ ok: true, domainsReceived: domains.length, domainsDropped: parsed.length - domains.length });
  } catch (e) {
    console.error("[POST /api/saas-usage]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

// GET /api/saas-usage — 관리자 조회 전용. 저장된 PC별 누적치를 SaaS DB와 대조해
// 화이트/블랙/미확인/예외로 분류한 결과를 반환한다.
export async function GET(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session || (await resolveCurrentRole(session)) !== "super") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const minVisitsParam = Number(req.nextUrl.searchParams.get("minVisits"));
    const minVisitCount = Number.isFinite(minVisitsParam) && minVisitsParam > 0 ? minVisitsParam : DEFAULT_MIN_VISIT_COUNT;

    const [store, saasItems, pcScans, swRecords] = await Promise.all([
      getSaasUsage(), getSaasItems(), fetchPcScans(), fetchSwDatabase(),
    ]);
    const records = Object.values(store);

    const perPc = records.map(r => ({
      pcName: r.pcName, serial: r.serial, userName: r.userName, email: r.email, corp: r.corp,
      lastReportedAt: r.lastReportedAt,
      entries: matchDomainsAgainstSaasDb(domainsToVisitedList(r.domains), saasItems),
    }));

    const unknownAggregate = aggregateUnknownDomains(perPc.map(p => ({ pcName: p.pcName, entries: p.entries })));

    const perPcSummary = perPc.map(p => ({
      pcName: p.pcName, serial: p.serial, userName: p.userName, corp: p.corp, lastReportedAt: p.lastReportedAt,
      total: p.entries.length,
      whitelist: p.entries.filter(e => e.status === "whitelist").length,
      blacklist: p.entries.filter(e => e.status === "blacklist").length,
      unknown: p.entries.filter(e => e.status === "unknown").length,
      excluded: p.entries.filter(e => e.status === "excluded").length,
    }));

    // 조직이 인식하는 실제 신원(자산실사 스캔 기록)을 serial로 매핑한다 — 수집
    // 스크립트가 보낸 원본 Windows 계정명보다 이쪽이 인사/부서 정보와 일치한다.
    // 같은 serial에 여러 회차 스캔이 있을 수 있어 collectedAt 최신 것을 쓴다.
    const identityBySerial = new Map<string, PcIdentity & { _collectedAt: string }>();
    for (const s of pcScans) {
      if (!s.serial) continue;
      const prev = identityBySerial.get(s.serial);
      if (prev && prev._collectedAt >= (s.collectedAt || "")) continue;
      identityBySerial.set(s.serial, {
        serial: s.serial, pcName: s.pcName, userName: s.userName || "", dept: s.dept || "", corp: s.corp || "",
        _collectedAt: s.collectedAt || "",
      });
    }

    // 라이선스 유형을 구독으로 한정하지 않는다 — 같은 SaaS를 영구(설치형) 라이선스로
    // 등록해둔 사람이 웹 버전도 같이 쓰는 경우가 많아서, 구독만 보면 이미 정식
    // 라이선스가 있는 사람도 "미등록"으로 잘못 걸린다.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const subs: SubscriptionLite[] = swRecords
      .filter(r => r.status !== "만료" && r.status !== "반납")
      .filter(r => !r.renewalDate || new Date(r.renewalDate) >= today)
      .map(r => ({ user: r.user, swName: r.swDetail || r.swCategory || "", company: r.company, department: r.department }));

    const unregisteredUsage = findUnregisteredUsage(
      perPc.map(p => ({
        identity: identityBySerial.get(p.serial) ?? { serial: p.serial, pcName: p.pcName, userName: p.userName ?? "", dept: "", corp: p.corp ?? "" },
        entries: p.entries,
      })),
      saasItems, subs, minVisitCount,
    );

    return NextResponse.json({ ok: true, perPcSummary, unknownAggregate, perPc, unregisteredUsage, minVisitCount });
  } catch (e) {
    console.error("[GET /api/saas-usage]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
