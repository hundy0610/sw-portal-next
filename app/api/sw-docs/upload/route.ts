import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSessionFromCookieHeader, resolveCurrentRole } from "@/lib/session";

const MAX_SIZE = 4 * 1024 * 1024; // 4 MB

// Notion 파일 직접업로드(file_uploads API)는 Notion 앞단 Cloudflare가 Vercel 서버리스
// IP 대역을 봇으로 판단해 요청을 차단하는 문제가 있어(재현 확인됨), Vercel Blob에 올리고
// 공개 URL을 Notion에 external 타입으로 등록하는 방식으로 대체한다.
export async function POST(req: NextRequest) {
  const s = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!s || (await resolveCurrentRole(s)) !== "super") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fd = await req.formData();
  const file = fd.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: `파일 크기가 ${(file.size / 1024 / 1024).toFixed(1)}MB입니다. 직접 업로드는 4MB 이하만 가능합니다.` },
      { status: 400 },
    );
  }

  try {
    const blob = await put(`sw-docs/${file.name}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type || "application/octet-stream",
    });
    return NextResponse.json({ ok: true, url: blob.url });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
