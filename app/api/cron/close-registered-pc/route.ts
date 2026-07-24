import { NextRequest, NextResponse } from "next/server";
import { fetchPcScans, updatePcScan } from "@/lib/pc-scan";
import { errorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/close-registered-pc
 *
 * GitHub Actions에서 매일 호출.
 * PC 신규 등록(자산 실사 방식)에서 운영자가 등록 완료 처리한(등록완료=true) 건 중,
 * 등록일시가 이번 달보다 이전 달인 것을 "종료" 케이스로 표시해 기본 목록에서 정리한다.
 * (등록완료 여부는 Redis 캐시가 아닌 Notion 체크박스로 관리하므로, 이 크론도 그 값을
 * 그대로 신뢰한다 — 캐시 갱신 지연/유실과 무관하게 항상 정확함)
 */

function kstYearMonth(iso: string): { y: number; m: number } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return { y: kst.getUTCFullYear(), m: kst.getUTCMonth() };
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (
    process.env.NODE_ENV === "production" &&
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const scans = await fetchPcScans("NOTION_DB_PC_REGISTER");
    const nowYm = kstYearMonth(new Date().toISOString())!;

    const toClose = scans.filter(s => {
      if (!s.registered || s.closed) return false;
      const ym = kstYearMonth(s.registeredAt);
      if (!ym) return false;
      return ym.y < nowYm.y || (ym.y === nowYm.y && ym.m < nowYm.m);
    });

    let closed = 0, errors = 0;
    for (const s of toClose) {
      try {
        await updatePcScan(s.id, { closed: true }, "NOTION_DB_PC_REGISTER");
        closed++;
      } catch {
        errors++;
      }
      // Notion API rate limit 방지
      await new Promise(r => setTimeout(r, 350));
    }

    return NextResponse.json({
      ok: true,
      checked: toClose.length,
      closed,
      errors,
      closedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[GET /api/cron/close-registered-pc]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
