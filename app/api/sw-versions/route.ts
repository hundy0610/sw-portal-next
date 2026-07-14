import { NextRequest, NextResponse } from "next/server";
import { fetchSwVersions, createSwVersion, updateSwVersion, archiveSwVersion } from "@/lib/notion";
import { getSessionFromCookieHeader, resolveCurrentName, resolveCurrentRole } from "@/lib/session";
import { appendAuditLog, summarizeChanges } from "@/lib/portal-store";
import { errorMessage } from "@/lib/api-error";

async function getSuperSession(req: NextRequest) {
  const s = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!s) return null;
  return (await resolveCurrentRole(s)) === "super" ? s : null;
}

export async function GET(req: NextRequest) {
  const all = req.nextUrl.searchParams.get("all") === "1";
  if (all && !(await getSuperSession(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const data = await fetchSwVersions(all ? false : true);
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ data: [], error: errorMessage(e) });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSuperSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const adminName = await resolveCurrentName(session);

  try {
    if (body._action === "delete") {
      const all = await fetchSwVersions(false);
      const target = all.find(v => v.id === body.id);
      await archiveSwVersion(body.id);
      await appendAuditLog({ adminId: session.userId, adminName, action: "delete", target: "swresources", itemTitle: target ? `${target.name} ${target.version}` : body.id, timestamp: new Date().toISOString() });
      return NextResponse.json({ ok: true });
    }
    if (body._action === "update") {
      const all = await fetchSwVersions(false);
      const target = all.find(v => v.id === body.id);
      await updateSwVersion(body.id, body.data);
      const detail = summarizeChanges(target, body.data, [
        { key: "visible", label: "공개 여부", format: v => (v ? "공개" : "숨김") },
        { key: "name",    label: "이름" },
        { key: "version", label: "버전" },
      ]);
      const title = body.data?.name ? `${body.data.name} ${body.data.version ?? ""}`.trim() : target ? `${target.name} ${target.version}` : body.id;
      await appendAuditLog({ adminId: session.userId, adminName, action: "update", target: "swresources", itemTitle: title, detail, timestamp: new Date().toISOString() });
      return NextResponse.json({ ok: true });
    }
    // create
    const id = await createSwVersion({
      name:        body.name        ?? "",
      version:     body.version     ?? "",
      category:    body.category    ?? "",
      tier:        body.tier        ?? "업무용",
      os:          body.os          ?? [],
      description: body.description ?? "",
      visible:     body.visible     ?? true,
      order:       body.order       ?? 0,
    });
    await appendAuditLog({ adminId: session.userId, adminName, action: "create", target: "swresources", itemTitle: `${body.name ?? ""} ${body.version ?? ""}`.trim(), timestamp: new Date().toISOString() });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
