import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookieHeader } from "@/lib/session";
import { readEntityOne, upsertEntity } from "@/lib/repo/mirror";
import { SW_ENTITY } from "@/lib/sw-notion";
import type { SwDbRecord } from "@/types";

export const dynamic = "force-dynamic";

/** 갱신주기에 따라 날짜 연장: 월간 +1개월 / 연간 +1년 */
function extendDate(dateStr: string, cycle: string): string {
  const d = new Date(dateStr);
  if (cycle === "연") {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const { ids, action } = await req.json() as { ids: string[]; action: "renew" | "expire" };

    if (!Array.isArray(ids) || ids.length === 0)
      return NextResponse.json({ ok: false, error: "ids 필수" }, { status: 400 });
    if (!["renew", "expire"].includes(action))
      return NextResponse.json({ ok: false, error: "action은 renew 또는 expire" }, { status: 400 });

    let success = 0, failed = 0;

    for (const id of ids) {
      const base = await readEntityOne<SwDbRecord>(SW_ENTITY, id);
      if (!base) { failed++; continue; }

      const next: SwDbRecord = { ...base };
      if (action === "renew") {
        const baseDate = base.renewalDate || new Date().toISOString().slice(0, 10);
        next.renewalDate = extendDate(baseDate, base.renewalCycle || "월");
        next.status = "사용중";
      } else {
        next.status = "만료";
      }
      const ok = await upsertEntity(SW_ENTITY, id, next);
      if (ok) success++; else failed++;
    }

    return NextResponse.json({ ok: true, success, failed, action });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
