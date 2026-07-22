import { NextRequest, NextResponse } from "next/server";
import { getNotices, saveNotices } from "@/lib/portal-store";
import { getSessionFromCookieHeader, resolveCurrentRole } from "@/lib/session";
import type { Notice } from "@/types/portal";

async function getSuperSession(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session || (await resolveCurrentRole(session)) !== "super") return null;
  return session;
}

export async function GET(req: NextRequest) {
  const all = req.nextUrl.searchParams.get("all") === "1";
  if (all && !(await getSuperSession(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const notices = await getNotices(!all);
  return NextResponse.json({ data: notices });
}

export async function POST(req: NextRequest) {
  const session = await getSuperSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const all = await getNotices(false);

  if (body._action === "delete") {
    await saveNotices(all.filter(n => n.id !== body.id));
    return NextResponse.json({ ok: true });
  }

  if (body._action === "update") {
    await saveNotices(all.map(n => n.id === body.id ? { ...n, ...body.data } : n));
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
