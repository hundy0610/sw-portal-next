import { NextResponse } from "next/server";
import { fetchSubscriptions } from "@/lib/notion";

export const revalidate = 60;

export async function GET() {
  try {
    const data = await fetchSubscriptions();
    return NextResponse.json({
      data,
      lastSynced: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[API /subscriptions]", error);
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
