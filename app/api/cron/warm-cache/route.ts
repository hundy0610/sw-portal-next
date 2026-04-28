import { NextResponse } from "next/server";
import { fetchSwDb, fetchSwDatabase, fetchLicenseRecords, fetchSubscriptions, fetchTickets } from "@/lib/notion";
import { fetchAllHwRecords, computeHwStats } from "@/lib/hw";
import { kvSet } from "@/lib/kv-store";

/**
 * GET /api/cron/warm-cache
 *
 * GitHub Actions에서 1분마다 호출.
 * Notion에서 전체 데이터를 직접 fetch하여 Vercel KV에 저장.
 * → 이후 사용자 요청은 KV에서 즉시 응답 (1~5ms)
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();

  // 개별 fetch 실패가 전체를 막지 않도록 allSettled 사용
  const [hwR, swR, swdbR, licensesR, subsR, ticketsR] = await Promise.allSettled([
    fetchAllHwRecords(),
    fetchSwDatabase(),
    fetchSwDb(),
    fetchLicenseRecords(),
    fetchSubscriptions(),
    fetchTickets(),
  ]);

  const get = <T>(r: PromiseSettledResult<T>, fallback: T): T =>
    r.status === "fulfilled" ? r.value : fallback;

  const hw            = get(hwR,        [] as Awaited<ReturnType<typeof fetchAllHwRecords>>);
  const sw            = get(swR,        [] as Awaited<ReturnType<typeof fetchSwDatabase>>);
  const swdb          = get(swdbR,      [] as Awaited<ReturnType<typeof fetchSwDb>>);
  const licenses      = get(licensesR,  [] as Awaited<ReturnType<typeof fetchLicenseRecords>>);
  const subscriptions = get(subsR,      [] as Awaited<ReturnType<typeof fetchSubscriptions>>);
  const tickets       = get(ticketsR,   [] as Awaited<ReturnType<typeof fetchTickets>>);

  const hwStats = computeHwStats(hw);

  // 각각 독립적으로 KV 저장 (하나 실패해도 나머지 저장)
  await Promise.allSettled([
    hw.length            ? kvSet("hw:all",            hw)            : Promise.resolve(),
    hw.length            ? kvSet("hw:stats",          hwStats)       : Promise.resolve(),
    sw.length            ? kvSet("sw:all",            sw)            : Promise.resolve(),
    swdb.length          ? kvSet("swdb:all",          swdb)          : Promise.resolve(),
    licenses.length      ? kvSet("licenses:all",      licenses)      : Promise.resolve(),
    subscriptions.length ? kvSet("subscriptions:all", subscriptions) : Promise.resolve(),
    tickets.length       ? kvSet("tickets:all",       tickets)       : Promise.resolve(),
  ]);

  const errors: string[] = [];
  if (hwR.status        === "rejected") errors.push(`hw: ${hwR.reason}`);
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
      hw:            hw.length,
      sw:            sw.length,
      swdb:          swdb.length,
      licenses:      licenses.length,
      subscriptions: subscriptions.length,
      tickets:       tickets.length,
    },
    errors: errors.length ? errors : undefined,
    warmedAt: new Date().toISOString(),
  });
}
