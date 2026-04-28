import { NextRequest, NextResponse } from "next/server";
import { fetchAllHwRecords, computeHwStats, type HwRecord } from "@/lib/hw";
import { kvGet, kvSet } from "@/lib/kv-store";
import { memGet, memSet } from "@/lib/mem-cache";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search    = searchParams.get("search")?.trim()    || "";
  const company   = searchParams.get("company")?.trim()   || "";
  const status    = searchParams.get("status")?.trim()    || "";
  const location  = searchParams.get("location")?.trim()  || "";
  const returnDue = searchParams.get("returnDue") === "1";

  try {
    // 1. 인메모리 캐시 (0ms)
    let records = memGet<HwRecord[]>("hw:all");

    if (!records) {
      // 2. KV 캐시 (1~5ms, KV 미설정 시 null 반환)
      records = await kvGet<HwRecord[]>("hw:all");

      if (!records) {
        // 3. Notion 직접 조회 — hw:stats도 동시 저장하여 stats 엔드포인트 중복 fetch 방지
        records = await fetchAllHwRecords();
        const stats = computeHwStats(records);
        await Promise.all([
          kvSet("hw:all",   records),
          kvSet("hw:stats", stats),
        ]);
      }

      // 인메모리에 저장
      memSet("hw:all", records, 300);
    }

    // 메모리 필터링 (추가 DB 호출 없음)
    let filtered = records;
    if (company)   filtered = filtered.filter(r => r.company === company);
    if (status)    filtered = filtered.filter(r => r.status === status);
    if (location)  filtered = filtered.filter(r => r.location.includes(location));
    if (returnDue) filtered = filtered.filter(r => !!r.returnDue);
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(r =>
        r.user.toLowerCase().includes(q)    ||
        r.assetNo.toLowerCase().includes(q) ||
        r.model.toLowerCase().includes(q)   ||
        r.serial.toLowerCase().includes(q)
      );
    }
    if (returnDue) {
      filtered = [...filtered].sort((a, b) =>
        (a.returnDue || "9999") < (b.returnDue || "9999") ? -1 : 1
      );
    }

    return NextResponse.json({ ok: true, records: filtered }, {
      headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" },
    });
  } catch (e) {
    console.error("[API /hw]", e);
    return NextResponse.json(
      { ok: false, error: String(e), records: [] },
      { status: 500 }
    );
  }
}
