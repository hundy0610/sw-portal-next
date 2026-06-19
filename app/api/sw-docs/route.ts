import { NextRequest, NextResponse } from "next/server";
import { fetchSwDocs, createSwDoc, updateSwDoc, archiveSwDoc } from "@/lib/notion";
import { getSessionFromCookieHeader } from "@/lib/session";
import { errorMessage } from "@/lib/api-error";

function getSuperSession(req: NextRequest) {
  const s = getSessionFromCookieHeader(req.headers.get("cookie"));
  return s?.role === "super" ? s : null;
}

export async function GET(req: NextRequest) {
  const versionId = req.nextUrl.searchParams.get("versionId") ?? undefined;
  const all = req.nextUrl.searchParams.get("all") === "1";
  if (all && !getSuperSession(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const data = await fetchSwDocs(versionId, all ? false : true);
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
      await archiveSwDoc(body.id);
      return NextResponse.json({ ok: true });
    }
    if (body._action === "update") {
      await updateSwDoc(body.id, body.data, {
        fileUploadId:    body.data.fileUploadId    ?? undefined,
        externalFileUrl: body.data.externalFileUrl ?? undefined,
        externalFileName: body.data.externalFileName ?? undefined,
        clearFile:       body.data.clearFile       ?? undefined,
      });
      return NextResponse.json({ ok: true });
    }
    // create
    const id = await createSwDoc({
      name:        body.name        ?? "",
      type:        body.type        ?? "설치파일",
      description: body.description ?? "",
      versionId:   body.versionId   ?? "",
      visible:     body.visible     ?? true,
      order:       body.order       ?? 0,
    }, {
      fileUploadId:     body.fileUploadId     ?? undefined,
      externalFileUrl:  body.externalFileUrl  ?? undefined,
      externalFileName: body.externalFileName ?? undefined,
    });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
