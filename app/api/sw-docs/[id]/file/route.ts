import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const isDownload = req.nextUrl.searchParams.get("download") === "1";

  try {
    const page = await notion.pages.retrieve({ page_id: id });
    if (!("properties" in page)) {
      return new NextResponse("Not found", { status: 404 });
    }

    const p = (page as PageObjectResponse).properties;
    const filesProp = p["파일과 미디어"];
    if (!filesProp || filesProp.type !== "files" || filesProp.files.length === 0) {
      return new NextResponse("No file attached", { status: 404 });
    }

    const file = filesProp.files[0];
    const fileUrl = "file" in file ? file.file.url : file.external.url;
    const fileName = file.name || "file";

    const upstream = await fetch(fileUrl);
    if (!upstream.ok) {
      return new NextResponse("File fetch failed", { status: 502 });
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const disposition = isDownload ? "attachment" : "inline";

    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${disposition}; filename="${encodeURIComponent(fileName)}"`,
        "Cache-Control": "private, max-age=1800",
      },
    });
  } catch {
    return new NextResponse("Error", { status: 500 });
  }
}
