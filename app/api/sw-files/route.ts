import { NextResponse } from "next/server";
import { fetchSwFiles } from "@/lib/notion";

export async function GET() {
  try {
    const files = await fetchSwFiles();
    return NextResponse.json({ data: files });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
