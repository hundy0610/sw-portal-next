import { NextRequest, NextResponse } from "next/server";
import { type HwRecord } from "@/lib/hw";
import { kvGet } from "@/lib/kv-store";
import { memGet, memSet, memDel } from "@/lib/mem-cache";
import { triggerWarmHw } from "@/lib/trigger-warm-hw";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!process.env.NOTION_TOKEN) return NextResponse.json({ missingEnv: "NOTION_TOKEN", error: "환경변수 NOTION_TOKEN 이 설정되지 않았습니다." }, { status: 503 });
  const { searchParams } = new URL(req.url);
  const search    = searchParams.get("search")?.trim()    || "";
  const company   = searchParams.get("company")?.trim()   || "";
  const status    = searchParams.get("status")?.trim()    || "";
  const location  = searchParams.get("location")?.trim()  || "";
  const returnDue = searchParams.get("returnDue") === "1";
  const refresh   = searchParams.get("refresh") === "1";

  try {
    // refresh=1 이면 인메모리 캐시 무효화
    if (refresh) memDel("hw:all", "hw:stats");

    // 1. 인메모리 캐시 (0ms)
    let records = memGet<HwRecord[]>("hw:all");

    if (!records) {
      // 2. KV 캐시 (1~5ms, KV 미설정 시 null 반환)
      records = await kvGet<HwRecord[]>("hw:all");

      if (!records) {
        // 3. KV 미스 — Vercel 10s 타임아웃으로 Notion 직접 조회 불가
        // GitHub Actions warm-hw.yml 자동 트리거 (비동기, ~200ms 후 리턴)
        await triggerWarmHw();
        return NextResponse.json({
          ok: true,
          records: [],
          warming: true,
          message: "HW 데이터 캐시를 갱신하고 있습니다. 잠시 후 자동으로 재시도합니다.",
        });
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
