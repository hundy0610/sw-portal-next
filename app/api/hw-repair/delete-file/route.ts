import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const NOTION_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Notion-Version": "2026-03-11",
  "Content-Type": "application/json",
});

export async function POST(req: NextRequest) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ ok: false, error: "NOTION_TOKEN 없음" }, { status: 503 });

  let body: { pageId: string; fieldName: string; remainingUrls: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON 파싱 실패" }, { status: 400 });
  }

  const { pageId, fieldName, remainingUrls } = body;
  if (!pageId || !fieldName || !Array.isArray(remainingUrls)) {
    return NextResponse.json({ ok: false, error: "pageId, fieldName, remainingUrls 필수" }, { status: 400 });
  }

  try {
    const fileRefs = remainingUrls.map((url, i) =>
      url.includes("prod-files-secure.s3")
        ? { type: "file", name: `${fieldName}_${i + 1}`, file: { url } }
        : { type: "external", name: `${fieldName}_${i + 1}`, external: { url } }
    );

    const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: "PATCH",
      headers: NOTION_HEADERS(token),
      body: JSON.stringify({
        properties: {
          [fieldName]: { files: fileRefs },
        },
      }),
    });

    if (!res.ok) throw new Error(`Notion PATCH 실패: ${await res.text()}`);

    return NextResponse.json({ ok: true, urls: remainingUrls });
  } catch (e) {
    console.error("[API /hw-repair/delete-file]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
