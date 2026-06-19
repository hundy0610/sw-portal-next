import { NextResponse } from "next/server";
import { fetchSwFiles } from "@/lib/notion";
import { errorMessage } from "@/lib/api-error";

export async function GET() {
  try {
    const files = await fetchSwFiles();
    return NextResponse.json({ data: files });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
