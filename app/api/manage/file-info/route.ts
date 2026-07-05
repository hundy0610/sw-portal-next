import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookieHeader, resolveCurrentRole } from "@/lib/session";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "";
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 ** 2)   return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3)   return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function guessFileType(url: string): string {
  const clean = url.split("?")[0].split("#")[0];
  const ext = clean.split(".").pop()?.toUpperCase() ?? "";
  const known = ["PDF", "XLSX", "XLS", "DOCX", "DOC", "ZIP", "EXE", "PPT", "PPTX", "HWP", "CSV", "TXT"];
  return known.includes(ext) ? (ext === "XLS" ? "XLSX" : ext === "DOC" ? "DOCX" : ext === "PPT" ? "PPTX" : ext) : "";
}

export async function GET(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session || (await resolveCurrentRole(session)) !== "super") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url 파라미터가 필요합니다." }, { status: 400 });

  const fileType = guessFileType(url);
  let fileSize = "";

  try {
    // HEAD 요청으로 Content-Length 읽기
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(6000),
    });

    const contentLength = res.headers.get("content-length");
    if (contentLength) {
      fileSize = formatBytes(Number(contentLength));
    }

    // HEAD 미지원 서버 대응: GET + 스트림 즉시 중단
    if (!fileSize) {
      const res2 = await fetch(url, {
        method: "GET",
        headers: { "User-Agent": "Mozilla/5.0", Range: "bytes=0-0" },
        signal: AbortSignal.timeout(6000),
      });
      const cl = res2.headers.get("content-range"); // bytes 0-0/전체크기
      if (cl) {
        const total = cl.split("/")[1];
        if (total && total !== "*") fileSize = formatBytes(Number(total));
      }
    }
  } catch {
    // 네트워크 오류 시 크기만 빈값으로 반환
  }

  return NextResponse.json({ fileSize, fileType });
}
