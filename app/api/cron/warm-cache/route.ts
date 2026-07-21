import { NextResponse } from "next/server";
import { fetchSwDatabase, fetchLicenseRecords } from "@/lib/notion";
import { kvSetPermanent } from "@/lib/kv-store";
import { compactSwRecords } from "@/lib/sw-compact";

/**
 * GET /api/cron/warm-cache
 *
 * GitHub Actions에서 30분마다 호출.
 * SW/라이선스 데이터를 Upstash KV에 캐시.
 *
 * swdb/subscriptions/tickets는 제거함 — 이 세 키는 아무 라우트도 kvGet으로 읽지 않는
 * 죽은 코드였음(subscriptions/tickets는 이미 별도의 인메모리 캐시로 서비스되고 있었음).
 * 확인 결과 sw:all/licenses:all만 실제로 읽히고 있어(sw-records, sw/expiring, licenses,
 * notifications, report 등), 이 둘만 남김 — Redis 명령·Notion API 호출 모두 절감.
 *
 * HW 데이터는 이 엔드포인트에서 제외 — Notion API 39회 호출로 Vercel 10초 타임아웃 초과.
 * HW는 .github/workflows/warm-hw.yml + .github/scripts/warm-hw.mjs 에서
 * GitHub Actions가 직접 Notion → Upstash로 push (타임아웃 없음).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();

  const [swR, licensesR] = await Promise.allSettled([
    fetchSwDatabase(),
    fetchLicenseRecords(),
  ]);

  const get = <T>(r: PromiseSettledResult<T>, fallback: T): T =>
    r.status === "fulfilled" ? r.value : fallback;

  const sw       = get(swR,       [] as Awaited<ReturnType<typeof fetchSwDatabase>>);
  const licenses = get(licensesR, [] as Awaited<ReturnType<typeof fetchLicenseRecords>>);

  // TTL 없이 영구 저장 — warm-cache 30분 주기로 덮어씌우므로 TTL 불필요
  // TTL이 있으면 warm-cache 실패 시 24h 후 데이터 소멸 문제 발생
  await Promise.allSettled([
    sw.length       ? kvSetPermanent("sw:all", compactSwRecords(sw)) : Promise.resolve(),
    licenses.length ? kvSetPermanent("licenses:all", licenses)       : Promise.resolve(),
  ]);

  const errors: string[] = [];
  if (swR.status       === "rejected") errors.push(`sw: ${swR.reason}`);
  if (licensesR.status === "rejected") errors.push(`licenses: ${licensesR.reason}`);

  if (errors.length) console.warn("[warm-cache] partial errors:", errors);

  return NextResponse.json({
    ok: true,
    elapsed: `${Date.now() - start}ms`,
    counts: {
      sw:       sw.length,
      licenses: licenses.length,
    },
    note: "hw는 warm-hw.yml에서 직접 처리, swdb/subscriptions/tickets는 미사용 캐시라 제거함",
    errors: errors.length ? errors : undefined,
    warmedAt: new Date().toISOString(),
  });
}
