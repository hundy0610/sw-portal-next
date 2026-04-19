import { NextRequest, NextResponse } from "next/server";
import { getNotices, saveNotices } from "@/lib/portal-store";
import type { Notice } from "@/types/portal";

function authOk(req: NextRequest) {
  const key = req.headers.get("x-manage-key");
  return key && key === process.env.MANAGE_SECRET_KEY;
}

export async function GET(req: NextRequest) {
  const all = req.nextUrl.searchParams.get("all") === "1";
  if (all && !authOk(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const notices = await getNotices(!all);
  return NextResponse.json({ data: notices });
}

export async function POST(req: NextRequest) {
  if (!authOk(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const all = await getNotices(false);

  if (body._action === "delete") {
    const updated = all.filter(n => n.id !== body.id);
    await saveNotices(updated);
    return NextResponse.json({ ok: true });
  }

  if (body._action === "update") {
    const updated = all.map(n => n.id === body.id ? { ...n, ...body.data } : n);
    await saveNotices(updated);
    return NextResponse.json({ ok: true });
  }

  // create
  const notice: Notice = {
    id: `n_${Date.now()}`,
    title:    body.title    ?? "",
    content:  body.content  ?? "",
    date:     body.date     ?? new Date().toISOString().slice(0, 10),
    urgent:   body.urgent   ?? false,
    imageUrl: body.imageUrl ?? "",
    visible:  body.visible  ?? true,
    createdAt: new Date().toISOString(),
  };
  await saveNotices([notice, ...all]);
  return NextResponse.json({ ok: true, id: notice.id });
}
