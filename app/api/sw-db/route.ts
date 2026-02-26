import { NextResponse } from "next/server";
import { fetchSwDb } from "@/lib/notion";

// 캐시: 60초 (revalidate)
export const revalidate = 60;

export async function GET() {
  try {
    const data = await fetchSwDb();
    return NextResponse.json({
      data,
      lastSynced: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[API /sw-db]", error);
    return NextResponse.json(
      {
        data: [],
        lastSynced: new Date().toISOString(),
        error: error instanceof Error ? error.message : "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}
