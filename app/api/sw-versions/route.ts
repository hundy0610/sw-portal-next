import { NextRequest, NextResponse } from "next/server";
import { fetchSwVersions, createSwVersion, updateSwVersion, archiveSwVersion } from "@/lib/notion";
import { getSessionFromCookieHeader } from "@/lib/session";
import { errorMessage } from "@/lib/api-error";

function getSuperSession(req: NextRequest) {
  const s = getSessionFromCookieHeader(req.headers.get("cookie"));
  return s?.role === "super" ? s : null;
}

export async function GET(req: NextRequest) {
  const all = req.nextUrl.searchParams.get("all") === "1";
  if (all && !getSuperSession(req)) {
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
  if (!getSuperSession(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();

  try {
    if (body._action === "delete") {
      await archiveSwVersion(body.id);
      return NextResponse.json({ ok: true });
    }
    if (body._action === "update") {
      await updateSwVersion(body.id, body.data);
      return NextResponse.json({ ok: true });
    }
    // create
    const id = await createSwVersion({
      name:        body.name        ?? "",
      version:     body.version     ?? "",
      category:    body.category    ?? "",
      os:          body.os          ?? [],
      description: body.description ?? "",
      visible:     body.visible     ?? true,
      order:       body.order       ?? 0,
    });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
