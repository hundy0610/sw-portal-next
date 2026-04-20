import { NextRequest, NextResponse } from "next/server";
import { getSwItems, saveSwItems, appendAuditLog } from "@/lib/portal-store";
import { getSessionFromCookieHeader } from "@/lib/session";
import type { SwItem } from "@/types";

export const revalidate = 0;

function getSuperSession(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session || session.role !== "super") return null;
  return session;
}

export async function GET() {
  try {
    const data = await getSwItems();
    return NextResponse.json({ data, lastSynced: new Date().toISOString() });
  } catch (error) {
    console.error("[API /sw-db]", error);
    return NextResponse.json({ data: [], error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = getSuperSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const items = await getSwItems();

  // 삭제
  if (body._action === "delete") {
    const target = items.find(i => i.id === body.id);
    const updated = items.filter(i => i.id !== body.id);
    await saveSwItems(updated);
    await appendAuditLog({ adminId: session.userId, adminName: session.name, action: "delete", target: "swdb", itemTitle: target?.name ?? body.id, timestamp: new Date().toISOString() });
    return NextResponse.json({ ok: true });
  }

  // 수정
  if (body._action === "update") {
    const updated = items.map(i => i.id === body.id ? { ...i, ...body.data } : i);
    await saveSwItems(updated);
    const target = items.find(i => i.id === body.id);
    await appendAuditLog({ adminId: session.userId, adminName: session.name, action: "update", target: "swdb", itemTitle: target?.name ?? body.id, timestamp: new Date().toISOString() });
    return NextResponse.json({ ok: true });
  }

  // 등록
  const newItem: SwItem = {
    id: `sw_${Date.now()}`,
    name:          body.name          ?? "",
    vendor:        body.vendor        ?? "",
    category:      body.category      ?? "",
    status:        body.status        ?? "conditional",
    totalLicenses: body.totalLicenses ?? 999,
    usedLicenses:  body.usedLicenses  ?? 0,
    alternatives:  body.alternatives  ?? [],
    mandatory:     body.mandatory     ?? false,
    description:   body.description   ?? "",
  };
  await saveSwItems([...items, newItem]);
  await appendAuditLog({ adminId: session.userId, adminName: session.name, action: "create", target: "swdb", itemTitle: newItem.name, timestamp: new Date().toISOString() });
  return NextResponse.json({ ok: true, id: newItem.id });
}
