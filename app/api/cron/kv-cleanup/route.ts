import { NextResponse } from "next/server";
import { kvSweepExpired } from "@/lib/kv-store";

/**
 * GET /api/cron/kv-cleanup
 *
 * 맥북 중앙 Postgres 의 kv 테이블에서 만료된(expires_at < now) 행을 물리 삭제한다.
 * (Upstash 는 TTL 자동 만료였지만 Postgres 는 수동 정리가 필요 — 조회는 이미 만료분을
 *  제외하므로 이 작업은 저장공간 청소 목적이다.)
 *
 * GitHub Actions(.github/workflows/kv-cleanup.yml)에서 주기적으로 호출.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  const deleted = await kvSweepExpired();
  return NextResponse.json({
    ok: true,
    deleted,
    elapsed: `${Date.now() - start}ms`,
    cleanedAt: new Date().toISOString(),
  });
}
