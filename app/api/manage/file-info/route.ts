import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookieHeader } from "@/lib/session";
import { Client } from "@notionhq/client";
import type { BlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 ** 2)   return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3)   return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function guessFileType(filename: string): string {
  const ext = filename.split("?")[0].split("#")[0].split(".").pop()?.toUpperCase() ?? "";
  const map: Record<string, string> = { XLS: "XLSX", DOC: "DOCX", PPT: "PPTX" };
  const known = ["PDF","XLSX","DOCX","ZIP","EXE","PPT","PPTX","HWP","CSV","TXT","PNG","JPG","JPEG"];
  return map[ext] ?? (known.includes(ext) ? ext : "");
}

// Notion 페이지 URL에서 ID 추출
// 예: https://www.notion.so/Title-2b667f4bfdac806483efc2d7d330a308
function extractNotionPageId(url: string): string | null {
  const match = url.match(/([a-f0-9]{32})(?:\?|$|#)/i)
    ?? url.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})(?:\?|$|#)/i);
  if (!match) return null;
  const raw = match[1].replace(/-/g, "");
  // UUID 형식으로 변환
  return `${raw.slice(0,8)}-${raw.slice(8,12)}-${raw.slice(12,16)}-${raw.slice(16,20)}-${raw.slice(20)}`;
}

// S3 URL에서 HEAD 요청으로 파일 크기 읽기
async function fetchSizeFromUrl(fileUrl: string): Promise<number> {
  try {
    const res = await fetch(fileUrl, {
      method: "HEAD",
      signal: AbortSignal.timeout(8000),
    });
    const cl = res.headers.get("content-length");
    if (cl) return Number(cl);

    // HEAD 미지원 서버: Range 요청
    const res2 = await fetch(fileUrl, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
      signal: AbortSignal.timeout(8000),
    });
    const cr = res2.headers.get("content-range"); // bytes 0-0/전체크기
    if (cr) {
      const total = cr.split("/")[1];
      if (total && total !== "*") return Number(total);
    }
  } catch { /* 무시 */ }
  return 0;
}

type FileResult = { fileSize: string; fileType: string; fileName: string };

// 블록 목록에서 파일 정보 추출 (재귀로 컨테이너 블록 내부도 탐색)
async function scanBlocks(blockId: string, depth = 0): Promise<FileResult | string | null> {
  if (depth > 3) return null; // 최대 3단계 깊이
  const blocks = await notion.blocks.children.list({ block_id: blockId, page_size: 50 });

  let bookmarkUrl = "";

  for (const block of blocks.results) {
    const b = block as BlockObjectResponse;

    // 직접 첨부 파일 블록
    if (b.type === "file") {
      const f = b.file;
      const fileUrl = f.type === "file" ? f.file.url : f.external?.url ?? "";
      const fileName = (b as any).file?.name ?? "";
      const fileType = guessFileType(fileName || fileUrl);
      const bytes = fileUrl ? await fetchSizeFromUrl(fileUrl) : 0;
      return { fileSize: formatBytes(bytes), fileType, fileName };
    }

    if (b.type === "pdf") {
      const p = (b as any).pdf;
      const fileUrl = p?.type === "file" ? p.file?.url : p?.external?.url ?? "";
      const bytes = fileUrl ? await fetchSizeFromUrl(fileUrl) : 0;
      return { fileSize: formatBytes(bytes), fileType: "PDF", fileName: "" };
    }

    // bookmark / embed / link_preview — 첫 번째 것 기억
    if (!bookmarkUrl) {
      const u =
        (b as any).bookmark?.url ??
        (b as any).embed?.url ??
        (b as any).link_preview?.url ??
        "";
      if (u && !u.includes("notion.so")) bookmarkUrl = u;
    }

    // 컨테이너 블록(컬럼, 토글, 콜아웃 등) 내부 재귀 탐색
    const isContainer = ["column_list","column","toggle","callout","quote","bulleted_list_item","numbered_list_item","synced_block","template","table"].includes(b.type);
    if (isContainer && (b as any).has_children) {
      const nested = await scanBlocks(b.id, depth + 1);
      if (nested && typeof nested === "object") return nested; // FileResult 발견
      if (nested && typeof nested === "string" && !bookmarkUrl) bookmarkUrl = nested;
    }
  }

  // bookmark URL을 상위로 전달
  return bookmarkUrl || null;
}

// Notion 페이지 블록에서 첨부파일 정보 추출
async function getNotionFileInfo(pageId: string): Promise<FileResult | null> {
  try {
    const result = await scanBlocks(pageId);

    if (result && typeof result === "object") return result;

    // bookmark URL만 찾은 경우
    if (result && typeof result === "string") {
      const fileType = guessFileType(result);
      const bytes = await fetchSizeFromUrl(result);
      const fileName = result.split("/").pop()?.split("?")[0] ?? "";
      return { fileSize: formatBytes(bytes), fileType, fileName };
    }

    // 첨부 블록 없음 → 페이지 제목에서 형식만 추측
    const page = await notion.pages.retrieve({ page_id: pageId });
    const props = (page as any).properties;
    const titleProp = props?.["제목"] ?? props?.["Name"] ?? props?.["이름"];
    const title = titleProp?.title?.[0]?.plain_text ?? "";
    return { fileSize: "", fileType: guessFileType(title), fileName: title };

  } catch (e) {
    console.error("[file-info] Notion error:", e);
    return null;
  }
}

async function collectBlockTypes(blockId: string, depth = 0, out: string[] = []): Promise<string[]> {
  if (depth > 3) return out;
  try {
    const blocks = await notion.blocks.children.list({ block_id: blockId, page_size: 50 });
    for (const block of blocks.results) {
      const b = block as BlockObjectResponse;
      out.push(`${"  ".repeat(depth)}[${b.type}]`);
      const isContainer = ["column_list","column","toggle","callout","quote","synced_block","template","table"].includes(b.type);
      if (isContainer && (b as any).has_children) {
        await collectBlockTypes(b.id, depth + 1, out);
      }
    }
  } catch (e) {
    out.push(`${"  ".repeat(depth)}[ERROR: ${String(e)}]`);
  }
  return out;
}

export async function GET(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session || session.role !== "super") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url 파라미터가 필요합니다." }, { status: 400 });

  const debug = req.nextUrl.searchParams.get("debug") === "1";

  // ── Notion 페이지 링크 처리 ──────────────────────────────────
  if (url.includes("notion.so") || url.includes("notion.site")) {
    const pageId = extractNotionPageId(url);
    if (!pageId) return NextResponse.json({ fileSize: "", fileType: "", _debug: "pageId 추출 실패" });

    if (debug) {
      const blockTypes = await collectBlockTypes(pageId);
      return NextResponse.json({ _debug: { pageId, blockTypes } });
    }

    const info = await getNotionFileInfo(pageId);
    return NextResponse.json(info ?? { fileSize: "", fileType: "" });
  }

  // ── 일반 직접 링크 처리 ──────────────────────────────────────
  const fileType = guessFileType(url);
  const bytes = await fetchSizeFromUrl(url);
  return NextResponse.json({ fileSize: formatBytes(bytes), fileType, fileName: "" });
}
