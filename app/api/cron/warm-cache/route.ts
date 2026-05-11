import { NextResponse } from "next/server";
import { fetchSwDb, fetchSwDatabase, fetchLicenseRecords, fetchSubscriptions, fetchTickets } from "@/lib/notion";
import { kvSet } from "@/lib/kv-store";

/**
 * GET /api/cron/warm-cache
 *
 * GitHub Actions에서 30분마다 호출.
 * SW/라이선스/티켓 데이터를 Upstash KV에 캐시.
 *
 * HW 데이터는 이 엔드포인트에서 제외 — Notion API 39회 호출로 Vercel 10초 타임아웃 초과.
 * HW는 .github/workflows/warm-hw.yml + .github/scripts/warm-hw.mjs 에서
 * GitHub Actions가 직접 Notion → Upstash로 push (타임아웃 없음).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();

  const [swR, swdbR, licensesR, subsR, ticketsR] = await Promise.allSettled([
    fetchSwDatabase(),
    fetchSwDb(),
    fetchLicenseRecords(),
    fetchSubscriptions(),
    fetchTickets(),
  ]);

  const get = <T>(r: PromiseSettledResult<T>, fallback: T): T =>
    r.status === "fulfilled" ? r.value : fallback;

  const sw            = get(swR,        [] as Awaited<ReturnType<typeof fetchSwDatabase>>);
  const swdb          = get(swdbR,      [] as Awaited<ReturnType<typeof fetchSwDb>>);
  const licenses      = get(licensesR,  [] as Awaited<ReturnType<typeof fetchLicenseRecords>>);
  const subscriptions = get(subsR,      [] as Awaited<ReturnType<typeof fetchSubscriptions>>);
  const tickets       = get(ticketsR,   [] as Awaited<ReturnType<typeof fetchTickets>>);

  await Promise.allSettled([
    sw.length            ? kvSet("sw:all",            sw)            : Promise.resolve(),
    swdb.length          ? kvSet("swdb:all",          swdb)          : Promise.resolve(),
    licenses.length      ? kvSet("licenses:all",      licenses)      : Promise.resolve(),
    subscriptions.length ? kvSet("subscriptions:all", subscriptions) : Promise.resolve(),
    tickets.length       ? kvSet("tickets:all",       tickets)       : Promise.resolve(),
  ]);

  const errors: string[] = [];
  if (swR.status        === "rejected") errors.push(`sw: ${swR.reason}`);
  if (swdbR.status      === "rejected") errors.push(`swdb: ${swdbR.reason}`);
  if (licensesR.status  === "rejected") errors.push(`licenses: ${licensesR.reason}`);
  if (subsR.status      === "rejected") errors.push(`subscriptions: ${subsR.reason}`);
  if (ticketsR.status   === "rejected") errors.push(`tickets: ${ticketsR.reason}`);

  if (errors.length) console.warn("[warm-cache] partial errors:", errors);

  return NextResponse.json({
    ok: true,
    elapsed: `${Date.now() - start}ms`,
    counts: {
      sw:            sw.length,
      swdb:          swdb.length,
      licenses:      licenses.length,
      subscriptions: subscriptions.length,
      tickets:       tickets.length,
    },
    note: "hw는 warm-hw.yml에서 직접 처리",
    errors: errors.length ? errors : undefined,
    warmedAt: new Date().toISOString(),
  });
}
