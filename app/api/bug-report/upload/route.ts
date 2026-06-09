import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookieHeader } from "@/lib/session";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VER = "2026-03-11";

function notionHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, "Notion-Version": NOTION_VER };
}

export async function POST(req: NextRequest) {
  const s = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ error: "NOTION_TOKEN 미설정" }, { status: 500 });

  const ct = req.headers.get("content-type") ?? "";

  // ── JSON: 업로드 세션 초기화 ──────────────────────────────
  if (ct.includes("application/json")) {
    const { filename, contentType, size } = await req.json();
    const res = await fetch(`${NOTION_API}/file_uploads`, {
      method: "POST",
      headers: { ...notionHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "single_part", filename, content_type: contentType || "image/png" }),
    });
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 500 });
    const { id: fileUploadId } = await res.json();
    return NextResponse.json({ ok: true, fileUploadId });
  }

  // ── FormData: 파일 전송 ───────────────────────────────────
  const fd = await req.formData();
  const file = fd.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });

  const fileUploadId = fd.get("fileUploadId") as string;

  const uploadFd = new FormData();
  uploadFd.append("file", file, file.name);

  const res = await fetch(`${NOTION_API}/file_uploads/${fileUploadId}/send`, {
    method: "POST",
    headers: notionHeaders(token),
    body: uploadFd,
  });

  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 500 });
  return NextResponse.json({ ok: true, fileUploadId });
}
