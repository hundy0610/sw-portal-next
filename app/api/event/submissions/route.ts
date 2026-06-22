import { NextResponse } from "next/server";
import { fetchEventSubmissions } from "@/lib/notion";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const data = await fetchEventSubmissions();
    return NextResponse.json({ data });
  } catch (e) {
    console.error("[event/submissions]", e);
    return NextResponse.json({ data: [] }, { status: 500 });
  }
}
