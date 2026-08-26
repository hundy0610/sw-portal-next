import { NextRequest, NextResponse } from "next/server";
import { fetchManuals, createManual, updateManual, archiveManual } from "@/lib/notion";
import { getSessionFromCookieHeader, resolveCurrentRole } from "@/lib/session";
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

  try {
    if (body._action === "delete") {
      await archiveManual(body.id);
      return NextResponse.json({ ok: true });
    }

    if (body._action === "update") {
      const all = await fetchManuals(false);

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
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
