import { NextResponse } from "next/server";
import { fetchEventEmployeeData } from "@/lib/notion";

export async function GET() {
  try {
    const data = await fetchEventEmployeeData();
    return NextResponse.json(data);
  } catch (e) {
    console.error("[event/employees]", e);
    return NextResponse.json({ corporations: [], departments: {} }, { status: 500 });
  }
}
