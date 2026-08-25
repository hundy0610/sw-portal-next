import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSetPermanent } from "@/lib/kv-store";
import { getSessionFromCookieHeader } from "@/lib/session";
import { errorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const KV_KEY = "exchange-rate:history";
const MAX_HISTORY = 200;

export interface ExchangeRateEntry {
  rate: number;
  appliedAt: string; // ISO
}

// GET /api/exchange-rate — 최신 환율(적용일자 포함) + 이력을 반환한다.
export async function GET(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  try {
    const history = (await kvGet<ExchangeRateEntry[]>(KV_KEY)) ?? [];
    return NextResponse.json({ ok: true, latest: history[0] ?? null, history });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

// POST /api/exchange-rate  { rate } — 화면에서 새로 조회한 환율을 이력에 기록한다.
// 같은 날 값이 이미 있으면 새 이력을 추가하지 않고 갱신만 해서, 페이지를 열 때마다
// 이력이 도배되는 것을 방지한다.
export async function POST(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  try {
    const { rate } = (await req.json()) as { rate: number };
    if (!Number.isFinite(rate) || rate <= 0) {
      return NextResponse.json({ ok: false, error: "유효하지 않은 환율 값입니다." }, { status: 400 });
    }
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const history = (await kvGet<ExchangeRateEntry[]>(KV_KEY)) ?? [];
    const latest = history[0];

    const next: ExchangeRateEntry[] =
      latest && latest.appliedAt.slice(0, 10) === today
        ? [{ rate, appliedAt: now.toISOString() }, ...history.slice(1)]
        : [{ rate, appliedAt: now.toISOString() }, ...history].slice(0, MAX_HISTORY);

    const saved = await kvSetPermanent(KV_KEY, next);
    if (!saved) {
      return NextResponse.json({ ok: false, error: "저장에 실패했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, latest: next[0] });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
