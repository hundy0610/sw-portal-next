import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookieHeader, resolveCurrentRole } from "@/lib/session";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VER = "2026-03-11";
const MAX_SIZE = 4 * 1024 * 1024; // 4 MB

function notionHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, "Notion-Version": NOTION_VER };
}

// Notion(Cloudflare 포함) 쪽 일시적 차단/과부하(403/429/5xx)에 대비한 재시도
const RETRYABLE_STATUS = new Set([403, 429, 500, 502, 503, 504]);
async function fetchWithRetry(url: string, init: RequestInit, maxRetries = 2): Promise<Response> {
  let res = await fetch(url, init);
  for (let i = 0; i < maxRetries && !res.ok && RETRYABLE_STATUS.has(res.status); i++) {
    await new Promise(r => setTimeout(r, 800 * (i + 1)));
    res = await fetch(url, init);
  }
  return res;
}

export async function POST(req: NextRequest) {
  const s = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!s || (await resolveCurrentRole(s)) !== "super") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ error: "NOTION_TOKEN 미설정" }, { status: 500 });

  const fd = await req.formData();
  const file = fd.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: `파일 크기가 ${(file.size / 1024 / 1024).toFixed(1)}MB입니다. 직접 업로드는 4MB 이하만 가능합니다.` },
      { status: 400 },
    );
  }

  // Step 1: 업로드 세션 생성 (single_part)
  const createRes = await fetchWithRetry(`${NOTION_API}/file_uploads`, {
    method: "POST",
    headers: { ...notionHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "single_part",
      filename: file.name,
      content_type: file.type || "application/octet-stream",
    }),
  });
  if (!createRes.ok) {
    return NextResponse.json({ error: await createRes.text() }, { status: 500 });
  }
  const { id: fileUploadId } = await createRes.json();

  // Step 2: 파일 전송 (1회)
  const uploadFd = new FormData();
  uploadFd.append("file", file, file.name);

  const sendRes = await fetchWithRetry(`${NOTION_API}/file_uploads/${fileUploadId}/send`, {
    method: "POST",
    headers: notionHeaders(token),
    body: uploadFd,
  });
  if (!sendRes.ok) {
    return NextResponse.json({ error: await sendRes.text() }, { status: 500 });
  }

  return NextResponse.json({ ok: true, fileUploadId });
}
