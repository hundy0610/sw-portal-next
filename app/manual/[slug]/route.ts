import { NextRequest, NextResponse } from "next/server";
import { fetchManualBySlug } from "@/lib/notion";
import { getSessionFromCookieHeader, resolveCurrentRole } from "@/lib/session";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const slug = params.slug.toLowerCase();
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  const allowHidden = session ? (await resolveCurrentRole(session)) === "super" : false;

  const manual = await fetchManualBySlug(slug, allowHidden);
  if (!manual) {
    return new NextResponse("매뉴얼을 찾을 수 없습니다.", { status: 404 });
  }
  if (!manual.fileUrl) {
    return new NextResponse("매뉴얼 파일이 첨부되지 않았습니다.", { status: 404 });
  }

  const fileRes = await fetch(manual.fileUrl);
  if (!fileRes.ok) {
    return new NextResponse("매뉴얼 파일을 불러올 수 없습니다.", { status: 502 });
  }
  const html = await fileRes.text();

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
