import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookieHeader } from "@/lib/session";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VER = "2026-03-11";
const MAX_SIZE = 4 * 1024 * 1024; // 4 MB

function notionHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, "Notion-Version": NOTION_VER };
}

export async function POST(req: NextRequest) {
  const s = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (s?.role !== "super") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ error: "NOTION_TOKEN 미설정" }, { status: 500 });

  const fd = await req.formData();
  const file = fd.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext !== "html" && ext !== "htm") {
    return NextResponse.json({ error: "HTML 파일(.html, .htm)만 업로드할 수 있습니다." }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: `파일 크기가 ${(file.size / 1024 / 1024).toFixed(1)}MB입니다. 직접 업로드는 4MB 이하만 가능합니다.` },
      { status: 400 },
    );
  }

  // Step 1: 업로드 세션 생성 (single_part)
  const createRes = await fetch(`${NOTION_API}/file_uploads`, {
    method: "POST",
    headers: { ...notionHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "single_part",
      filename: file.name,
      content_type: "text/html",
    }),
  });
  if (!createRes.ok) {
    return NextResponse.json({ error: await createRes.text() }, { status: 500 });
  }
  const { id: fileUploadId } = await createRes.json();

  // Step 2: 파일 전송 (1회)
  const uploadFd = new FormData();
  uploadFd.append("file", file, file.name);

  const sendRes = await fetch(`${NOTION_API}/file_uploads/${fileUploadId}/send`, {
    method: "POST",
    headers: notionHeaders(token),
    body: uploadFd,
  });
  if (!sendRes.ok) {
    return NextResponse.json({ error: await sendRes.text() }, { status: 500 });
  }

  return NextResponse.json({ ok: true, fileUploadId });
}
