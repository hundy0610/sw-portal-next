import { NextRequest, NextResponse } from "next/server";
import { fetchManuals, createManual, updateManual, archiveManual } from "@/lib/notion";
import { getSessionFromCookieHeader, resolveCurrentName, resolveCurrentRole } from "@/lib/session";
import { appendAuditLog, summarizeChanges } from "@/lib/portal-store";
import { errorMessage } from "@/lib/api-error";

const SLUG_RE = /^[a-z0-9-]+$/;

async function getSuperSession(req: NextRequest) {
  const s = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!s) return null;
  return (await resolveCurrentRole(s)) === "super" ? s : null;
}

function normalizeSlug(raw: string): string {
  return raw.trim().toLowerCase();
}

export async function GET(req: NextRequest) {
  const all = req.nextUrl.searchParams.get("all") === "1";
  if (all && !(await getSuperSession(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const data = await fetchManuals(all ? false : true);
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
      const all = await fetchManuals(false);
      const target = all.find(m => m.id === body.id);
      await archiveManual(body.id);
      await appendAuditLog({ adminId: session.userId, adminName, action: "delete", target: "manuals", itemTitle: target?.title ?? body.id, timestamp: new Date().toISOString() });
      return NextResponse.json({ ok: true });
    }

    if (body._action === "update") {
      const all = await fetchManuals(false);
      const target = all.find(m => m.id === body.id);

      let slug: string | undefined;
      if (body.data.slug !== undefined) {
        slug = normalizeSlug(body.data.slug);
        if (!SLUG_RE.test(slug)) {
          return NextResponse.json({ error: "슬러그는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다." }, { status: 400 });
        }
        if (all.some(m => m.id !== body.id && m.slug === slug)) {
          return NextResponse.json({ error: "이미 사용 중인 슬러그입니다." }, { status: 400 });
        }
      }

      await updateManual(body.id, { ...body.data, slug }, {
        fileUploadId:    body.data.fileUploadId    ?? undefined,
        externalFileUrl: body.data.externalFileUrl ?? undefined,
      });
      const detail = summarizeChanges(target, body.data, [
        { key: "visible", label: "공개 여부", format: v => (v ? "공개" : "숨김") },
        { key: "title",   label: "제목" },
        { key: "slug",    label: "슬러그" },
      ]);
      const fileNote = (body.data.fileUploadId || body.data.externalFileUrl) ? "파일 변경" : undefined;
      const fullDetail = [detail, fileNote].filter(Boolean).join(", ") || undefined;
      await appendAuditLog({ adminId: session.userId, adminName, action: "update", target: "manuals", itemTitle: body.data?.title ?? target?.title ?? body.id, detail: fullDetail, timestamp: new Date().toISOString() });
      return NextResponse.json({ ok: true });
    }

    // create
    const slug = normalizeSlug(body.slug ?? "");
    if (!SLUG_RE.test(slug)) {
      return NextResponse.json({ error: "슬러그는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다." }, { status: 400 });
    }
    const all = await fetchManuals(false);
    if (all.some(m => m.slug === slug)) {
      return NextResponse.json({ error: "이미 사용 중인 슬러그입니다." }, { status: 400 });
    }

    const id = await createManual({
      title:       body.title       ?? "",
      slug,
      category:    body.category    ?? "",
      description: body.description ?? "",
      visible:     body.visible     ?? true,
      order:       body.order       ?? 0,
    }, {
      fileUploadId:    body.fileUploadId    ?? undefined,
      externalFileUrl: body.externalFileUrl ?? undefined,
    });
    await appendAuditLog({ adminId: session.userId, adminName, action: "create", target: "manuals", itemTitle: body.title ?? "", timestamp: new Date().toISOString() });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
