import { NextRequest, NextResponse } from "next/server";
import { fetchAllHwRecords, type HwRecord } from "@/lib/hw";
import { kvGet, kvSet } from "@/lib/kv-store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search    = searchParams.get("search")?.trim()    || "";
  const company   = searchParams.get("company")?.trim()   || "";
  const status    = searchParams.get("status")?.trim()    || "";
  const location  = searchParams.get("location")?.trim()  || "";
  const returnDue = searchParams.get("returnDue") === "1";

  try {
    // ✅ KV에서 즉시 읽기 (1~5ms)
    let records = await kvGet<HwRecord[]>("hw:all");

    if (!records) {
      // KV 미스 (최초 배포 or KV 만료): Notion fetch 후 KV 저장
      records = await fetchAllHwRecords();
      await kvSet("hw:all", records);
    }

    // 메모리 필터링 (추가 DB 호출 없음)
    if (company)   records = records.filter(r => r.company === company);
    if (status)    records = records.filter(r => r.status === status);
    if (location)  records = records.filter(r => r.location.includes(location));
    if (returnDue) records = records.filter(r => !!r.returnDue);
    if (search) {
      const q = search.toLowerCase();
      records = records.filter(r =>
        r.user.toLowerCase().includes(q)    ||
        r.assetNo.toLowerCase().includes(q) ||
        r.model.toLowerCase().includes(q)   ||
        r.serial.toLowerCase().includes(q)
      );
    }
    if (returnDue) {
      records = [...records].sort((a, b) =>
        (a.returnDue || "9999") < (b.returnDue || "9999") ? -1 : 1
      );
    }

    return NextResponse.json({ ok: true, records }, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" },
    });
  } catch (e) {
    console.error("[API /hw]", e);
    return NextResponse.json(
      { ok: false, error: String(e), records: [] },
      { status: 500 }
    );
  }
}
