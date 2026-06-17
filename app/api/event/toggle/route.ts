import { NextRequest, NextResponse } from "next/server";
import { getEventIsOpen, setEventIsOpen } from "@/lib/notion";

export async function GET() {
  const open = await getEventIsOpen();
  return NextResponse.json({ open });
}

export async function POST(req: NextRequest) {
  const { open } = await req.json();
  await setEventIsOpen(!!open);
  return NextResponse.json({ ok: true, open: !!open });
}
