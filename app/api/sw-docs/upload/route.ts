import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookieHeader } from "@/lib/session";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VER = "2026-03-11";

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

  const ct = req.headers.get("content-type") ?? "";

  // ── JSON 요청: 멀티파트 업로드 세션 초기화 ─────────────────
  if (ct.includes("application/json")) {
    const { filename, contentType, size } = await req.json();
    // 20MB 초과는 multi_part, 이하는 single_part (Content-Range 불필요)
    const mode = size > 20 * 1024 * 1024 ? "multi_part" : "single_part";
    const res = await fetch(`${NOTION_API}/file_uploads`, {
      method: "POST",
      headers: { ...notionHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ mode, filename, content_type: contentType || "application/octet-stream" }),
    });
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 500 });
    const { id: fileUploadId } = await res.json();
    return NextResponse.json({ ok: true, fileUploadId, mode });
  }

  // ── FormData 요청: 청크(파트) 전송 ────────────────────────
  const fd = await req.formData();
  const file = fd.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });

  const fileUploadId = fd.get("fileUploadId") as string;
  const start  = parseInt(fd.get("start")  as string, 10);
  const end    = parseInt(fd.get("end")    as string, 10);
  const total  = parseInt(fd.get("total")  as string, 10);
  const isMultiPart = fd.get("multiPart") === "1";

  const uploadFd = new FormData();
  uploadFd.append("file", file, file.name);

  const headers: Record<string, string> = { ...notionHeaders(token) };
  if (isMultiPart) {
    headers["Content-Range"] = `bytes ${start}-${end}/${total}`;
  }

  const res = await fetch(`${NOTION_API}/file_uploads/${fileUploadId}/send`, {
    method: "POST",
    headers,
    body: uploadFd,
  });

  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 500 });
  const data = await res.json();
  return NextResponse.json({ ok: true, status: data.status, fileUploadId });
}
