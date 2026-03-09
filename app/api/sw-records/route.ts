import { NextResponse } from "next/server";
import { fetchSwDatabase } from "@/lib/notion";

export const revalidate = 60;

export async function GET() {
  try {
    const data = await fetchSwDatabase();
    return NextResponse.json({ data, lastSynced: new Date().toISOString() });
  } catch (e: any) {
    console.error("[sw-records] fetch error:", e?.message);
    return NextResponse.json(
      { data: [], error: e?.message, lastSynced: new Date().toISOString() },
      { status: 500 }
    );
  }
}
