import { NextRequest, NextResponse } from "next/server";
import { getResources, saveResources } from "@/lib/portal-store";
import type { Resource } from "@/types/portal";

function authOk(req: NextRequest) {
  const key = req.headers.get("x-manage-key");
  return key && key === process.env.MANAGE_SECRET_KEY;
}

export async function GET(req: NextRequest) {
  const all = req.nextUrl.searchParams.get("all") === "1";
  if (all && !authOk(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const resources = await getResources(!all);
  return NextResponse.json({ data: resources });
}

export async function POST(req: NextRequest) {
  if (!authOk(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const all = await getResources(false);

  if (body._action === "delete") {
    const updated = all.filter(r => r.id !== body.id);
    await saveResources(updated);
    return NextResponse.json({ ok: true });
  }

  if (body._action === "update") {
    const updated = all.map(r => r.id === body.id ? { ...r, ...body.data } : r);
    await saveResources(updated);
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
  return NextResponse.json({ ok: true, id: resource.id });
}
