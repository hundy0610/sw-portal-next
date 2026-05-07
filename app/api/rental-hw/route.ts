import { NextResponse } from "next/server";
import { fetchRentalRecords } from "@/lib/rental-hw";
import { memGet, memSet, memDel } from "@/lib/mem-cache";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!process.env.NOTION_DB_RENTAL_HW) {
    return NextResponse.json({
      ok: false,
      missingEnv: "NOTION_DB_RENTAL_HW",
      error: "환경변수 NOTION_DB_RENTAL_HW 가 설정되지 않았습니다.",
    }, { status: 503 });
  }
  if (!process.env.NOTION_TOKEN) {
    return NextResponse.json({
      ok: false,
      missingEnv: "NOTION_TOKEN",
      error: "환경변수 NOTION_TOKEN 이 설정되지 않았습니다.",
    }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const refresh = searchParams.get("refresh") === "1";

  try {
    if (refresh) memDel("rental-hw:all");

    let data = memGet<Awaited<ReturnType<typeof fetchRentalRecords>>>("rental-hw:all");
    if (!data) {
      data = await fetchRentalRecords();
      memSet("rental-hw:all", data, 300);
    }

    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
