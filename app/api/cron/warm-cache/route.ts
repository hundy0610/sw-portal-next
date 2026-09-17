import { NextResponse } from "next/server";
import { fetchSwDatabase } from "@/lib/notion";
import { kvSetPermanent } from "@/lib/kv-store";
import { compactSwRecords } from "@/lib/sw-compact";

/**
 * GET /api/cron/warm-cache
 *
 * GitHub Actions에서 30분마다 호출. SW 데이터를 KV에 캐시한다.
 *
 * swdb/subscriptions/tickets는 예전에 제거함 — 아무 라우트도 kvGet으로 읽지 않는
 * 죽은 캐시였음.
 *
 * licenses:all도 제거함 — 이 키를 읽는 곳은 /api/licenses 하나뿐이었고 그 라우트를
 * 읽는 화면이 없었다(라이선스 트래커 Notion DB 13개는 제목에 "이전완료/수정금지"가
 * 붙어 있고 내용은 SW 데이터베이스로 이미 이관됨). 주기마다 그 13개 DB를 전부
 * 훑던 Notion API 호출이 함께 사라진다.
 *
 * HW 데이터는 이 엔드포인트에서 제외 — 맥북 Postgres 미러(getHwAllFromPostgres)를
 * 직접 조회하므로 이 캐시가 필요 없음(과거 warm-hw.yml/Upstash 캐시 경로는 4.0에서 제거).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();

  const swR = await Promise.allSettled([fetchSwDatabase()]).then(r => r[0]);

  const sw = swR.status === "fulfilled" ? swR.value : [];

  // TTL 없이 영구 저장 — warm-cache 30분 주기로 덮어씌우므로 TTL 불필요
  // TTL이 있으면 warm-cache 실패 시 24h 후 데이터 소멸 문제 발생
  if (sw.length) await kvSetPermanent("sw:all", compactSwRecords(sw));

  const errors: string[] = [];
  if (swR.status === "rejected") errors.push(`sw: ${swR.reason}`);

  if (errors.length) console.warn("[warm-cache] partial errors:", errors);

  return NextResponse.json({
    ok: true,
    elapsed: `${Date.now() - start}ms`,
    counts: {
      sw: sw.length,
    },
    note: "hw는 Postgres 미러 직접 조회라 캐시 불필요, swdb/subscriptions/tickets/licenses는 미사용 캐시라 제거함",
    errors: errors.length ? errors : undefined,
    warmedAt: new Date().toISOString(),
  });
}
