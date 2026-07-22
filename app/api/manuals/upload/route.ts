import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookieHeader, resolveCurrentRole } from "@/lib/session";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VER = "2026-03-11";
const MAX_SIZE = 4 * 1024 * 1024; // 4 MB

// User-Agent가 없는 서버 간 요청은 Notion 앞단의 Cloudflare가 봇으로 의심해 JSON 대신
// "Attention Required" HTML 챌린지 페이지를 돌려주는 경우가 있었음(간헐적) — 실제로
// 이 문제로 파일 업로드가 조용히 실패하며 "저장 실패: <!DOCTYPE html>..." 형태로 원문
// HTML이 그대로 에러 메시지에 노출됨. 일반적인 API 클라이언트처럼 User-Agent를 명시해
// 차단될 확률을 낮춘다.
function notionHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VER,
    "User-Agent": "sw-portal-next/manuals-upload",
  };
}

// 응답 본문이 JSON이 아니라 Cloudflare 챌린지 등 HTML이면, 그 긴 원문을 그대로 사용자에게
// 보여주는 대신 원인을 알 수 있는 짧은 메시지로 바꾼다.
async function readNotionError(res: Response): Promise<string> {
  const text = await res.text();
  const trimmed = text.trim();
  if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
    return `Notion 업로드가 일시적으로 차단됐습니다 (HTTP ${res.status}). 잠시 후 다시 시도해주세요.`;
  }
  return text;
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
    return NextResponse.json({ error: await readNotionError(createRes) }, { status: 500 });
  }
  const { id: fileUploadId } = await createRes.json();

  // Step 2: 파일 전송 — Cloudflare 챌린지처럼 일시적으로 막히는 경우가 있어 한 번 재시도한다
  let sendRes: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const uploadFd = new FormData();
    uploadFd.append("file", file, file.name);
    sendRes = await fetch(`${NOTION_API}/file_uploads/${fileUploadId}/send`, {
      method: "POST",
      headers: notionHeaders(token),
      body: uploadFd,
    });
    if (sendRes.ok) break;
    if (attempt === 0) await new Promise(r => setTimeout(r, 1000));
  }
  if (!sendRes || !sendRes.ok) {
    return NextResponse.json({ error: await readNotionError(sendRes!) }, { status: 500 });
  }

  return NextResponse.json({ ok: true, fileUploadId });
}
