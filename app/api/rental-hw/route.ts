import { NextResponse } from "next/server";
import { fetchRentalRecords } from "@/lib/rental-hw";
import { memGet, memSet, memDel } from "@/lib/mem-cache";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
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
