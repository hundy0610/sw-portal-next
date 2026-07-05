import { NextRequest, NextResponse } from "next/server";
import { getNotices, saveNotices, appendAuditLog, summarizeChanges } from "@/lib/portal-store";
import { getSessionFromCookieHeader, resolveCurrentName, resolveCurrentRole } from "@/lib/session";
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
  const adminName = await resolveCurrentName(session);

  if (body._action === "delete") {
    const target = all.find(n => n.id === body.id);
    await saveNotices(all.filter(n => n.id !== body.id));
    await appendAuditLog({
      adminId: session.userId, adminName,
      action: "delete", target: "notices",
      itemTitle: target?.title ?? body.id,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  }

  if (body._action === "update") {
    const target = all.find(n => n.id === body.id);
    await saveNotices(all.map(n => n.id === body.id ? { ...n, ...body.data } : n));
    const detail = summarizeChanges(target, body.data, [
      { key: "title",   label: "제목" },
      { key: "visible", label: "공개 여부", format: v => (v ? "공개" : "숨김") },
      { key: "urgent",  label: "긴급",     format: v => (v ? "긴급" : "일반") },
    ]);
    await appendAuditLog({
      adminId: session.userId, adminName,
      action: "update", target: "notices",
      itemTitle: body.data?.title ?? target?.title ?? body.id,
      detail,
      timestamp: new Date().toISOString(),
    });
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
  await appendAuditLog({
    adminId: session.userId, adminName,
    action: "create", target: "notices",
    itemTitle: notice.title,
    timestamp: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true, id: notice.id });
}
