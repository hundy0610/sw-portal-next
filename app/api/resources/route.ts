import { NextRequest, NextResponse } from "next/server";
import { getResources, saveResources, appendAuditLog } from "@/lib/portal-store";
import { getSessionFromCookieHeader } from "@/lib/session";
import type { Resource } from "@/types/portal";

function getSuperSession(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session || session.role !== "super") return null;
  return session;
}

export async function GET(req: NextRequest) {
  const all = req.nextUrl.searchParams.get("all") === "1";
  if (all && !getSuperSession(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const resources = await getResources(!all);
  return NextResponse.json({ data: resources });
}

export async function POST(req: NextRequest) {
  const session = getSuperSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const all = await getResources(false);

  if (body._action === "delete") {
    const target = all.find(r => r.id === body.id);
    await saveResources(all.filter(r => r.id !== body.id));
    await appendAuditLog({
      adminId: session.userId, adminName: session.name,
      action: "delete", target: "resources",
      itemTitle: target?.title ?? body.id,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  }

  if (body._action === "update") {
    const target = all.find(r => r.id === body.id);
    await saveResources(all.map(r => r.id === body.id ? { ...r, ...body.data } : r));
    await appendAuditLog({
      adminId: session.userId, adminName: session.name,
      action: "update", target: "resources",
      itemTitle: body.data?.title ?? target?.title ?? body.id,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  }

  // create
  const resource: Resource = {
    id:          `r_${Date.now()}`,
    title:       body.title       ?? "",
    category:    body.category    ?? "install",
    fileUrl:     body.fileUrl     ?? "",
    fileType:    body.fileType    ?? "PDF",
    fileSize:    body.fileSize    ?? "",
    description: body.description ?? "",
    updatedAt:   body.updatedAt   ?? new Date().toISOString().slice(0, 10),
    order:       body.order       ?? all.length,
    visible:     body.visible     ?? true,
    createdAt:   new Date().toISOString(),
  };
  await saveResources([...all, resource]);
  await appendAuditLog({
    adminId: session.userId, adminName: session.name,
    action: "create", target: "resources",
    itemTitle: resource.title,
    timestamp: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true, id: resource.id });
}
