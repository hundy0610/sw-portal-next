import { NextResponse } from "next/server";
import { fetchRepairTickets } from "@/lib/notion";

export const revalidate = 30;

export async function GET() {
  try {
    const data = await fetchRepairTickets();
    return NextResponse.json({
      data,
      lastSynced: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[API GET /repair-tickets]", error);
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
