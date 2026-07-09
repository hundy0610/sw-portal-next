import { NextRequest, NextResponse } from "next/server";
import { fetchSwDocs, createSwDoc, updateSwDoc, archiveSwDoc } from "@/lib/notion";
import { getSessionFromCookieHeader, resolveCurrentName, resolveCurrentRole } from "@/lib/session";
import { appendAuditLog, summarizeChanges } from "@/lib/portal-store";
import { errorMessage } from "@/lib/api-error";

async function getSuperSession(req: NextRequest) {
  const s = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!s) return null;
  return (await resolveCurrentRole(s)) === "super" ? s : null;
}

export async function GET(req: NextRequest) {
  const versionId = req.nextUrl.searchParams.get("versionId") ?? undefined;
  const all = req.nextUrl.searchParams.get("all") === "1";
  if (all && !(await getSuperSession(req))) {
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
  const session = await getSuperSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const adminName = await resolveCurrentName(session);

  try {
    if (body._action === "delete") {
      const all = await fetchSwDocs(undefined, false);
      const target = all.find(d => d.id === body.id);
      await archiveSwDoc(body.id);
      await appendAuditLog({ adminId: session.userId, adminName, action: "delete", target: "swresources", itemTitle: target?.name ?? body.id, timestamp: new Date().toISOString() });
      return NextResponse.json({ ok: true });
    }
    if (body._action === "update") {
      const all = await fetchSwDocs(undefined, false);
      const target = all.find(d => d.id === body.id);
      await updateSwDoc(body.id, body.data, {
        fileUploadId:    body.data.fileUploadId    ?? undefined,
        externalFileUrl: body.data.externalFileUrl ?? undefined,
        externalFileName: body.data.externalFileName ?? undefined,
        clearFile:       body.data.clearFile       ?? undefined,
      });
      const detail = summarizeChanges(target, body.data, [
        { key: "visible", label: "공개 여부", format: v => (v ? "공개" : "숨김") },
        { key: "name",    label: "이름" },
      ]);
      const fileNote = (body.data.fileUploadId || body.data.externalFileUrl) ? "파일 첨부/변경" : undefined;
      const fullDetail = [detail, fileNote].filter(Boolean).join(", ") || undefined;
      await appendAuditLog({ adminId: session.userId, adminName, action: "update", target: "swresources", itemTitle: body.data?.name ?? target?.name ?? body.id, detail: fullDetail, timestamp: new Date().toISOString() });
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
    await appendAuditLog({ adminId: session.userId, adminName, action: "create", target: "swresources", itemTitle: body.name ?? "", timestamp: new Date().toISOString() });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
