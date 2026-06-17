import { NextRequest, NextResponse } from "next/server";
import { getEventOpen, setEventOpen } from "@/lib/portal-store";

export async function GET() {
  const open = await getEventOpen();
  return NextResponse.json({ open });
}

export async function POST(req: NextRequest) {
  const { open } = await req.json();
  await setEventOpen(!!open);
  return NextResponse.json({ ok: true, open: !!open });
}
