import { NextRequest, NextResponse } from "next/server";
import { getSaasUsage, saveSaasUsage, getSaasItems } from "@/lib/portal-store";
import { mergeSaasUsageReport, matchDomainsAgainstSaasDb, aggregateUnknownDomains, domainsToVisitedList, type SaasUsageReport, type VisitedDomain } from "@/lib/saas-audit";
import { findUnregisteredUsage, type SubscriptionLite, type PcIdentity } from "@/lib/saas-subscription-check";
import { fetchSwDatabase } from "@/lib/notion";
import { fetchPcScans } from "@/lib/pc-scan";
import { getSessionFromCookieHeader, resolveCurrentRole } from "@/lib/session";
import { errorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

// 정기적 사용으로 볼 최소 관측 일수 — 정책값이라 쿼리스트링으로 조정 가능하게 둔다.
const DEFAULT_MIN_DAYS_OBSERVED = 5;

const MAX_DOMAINS_PER_REPORT = 2000;
const MAX_BODY_BYTES = 1 * 1024 * 1024;

// POST /api/saas-usage — 수집 클라이언트(PowerShell, 각 PC에서 작업 스케줄러로 실행) 전용.
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

  const domains: VisitedDomain[] = body.domains
    .filter((d): d is VisitedDomain => !!d && typeof d.host === "string" && d.host.trim().length > 0)
    .map(d => ({
      host: d.host.trim(),
      visitCount: Number.isFinite(d.visitCount) && d.visitCount > 0 ? Math.floor(d.visitCount) : 1,
      lastVisitedAt: typeof d.lastVisitedAt === "string" && d.lastVisitedAt ? d.lastVisitedAt : new Date().toISOString(),
    }));

  const collectedAt = typeof body.collectedAt === "string" && body.collectedAt ? body.collectedAt : new Date().toISOString();

  try {
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
    return NextResponse.json({ ok: true, domainsReceived: domains.length });
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
    const minDaysParam = Number(req.nextUrl.searchParams.get("minDays"));
    const minDaysObserved = Number.isFinite(minDaysParam) && minDaysParam > 0 ? minDaysParam : DEFAULT_MIN_DAYS_OBSERVED;

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

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const subs: SubscriptionLite[] = swRecords
      .filter(r => (r.licenseType ?? "").includes("구독"))
      .filter(r => r.status !== "만료" && r.status !== "반납")
      .filter(r => !r.renewalDate || new Date(r.renewalDate) >= today)
      .map(r => ({ user: r.user, swName: r.swDetail || r.swCategory || "", company: r.company, department: r.department }));

    const unregisteredUsage = findUnregisteredUsage(
      perPc.map(p => ({
        identity: identityBySerial.get(p.serial) ?? { serial: p.serial, pcName: p.pcName, userName: p.userName ?? "", dept: "", corp: p.corp ?? "" },
        entries: p.entries,
      })),
      saasItems, subs, minDaysObserved,
    );

    return NextResponse.json({ ok: true, perPcSummary, unknownAggregate, perPc, unregisteredUsage, minDaysObserved });
  } catch (e) {
    console.error("[GET /api/saas-usage]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
