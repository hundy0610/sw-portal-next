import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const page = await notion.pages.retrieve({ page_id: params.id });
    if (!("properties" in page)) {
      return new NextResponse("Not found", { status: 404 });
    }

    const filesProp = (page as PageObjectResponse).properties["파일과 미디어"];
    if (!filesProp || filesProp.type !== "files" || filesProp.files.length === 0) {
      return new NextResponse("No file attached", { status: 404 });
    }

    const file = filesProp.files[0];
    const fileUrl = "file" in file ? file.file.url : file.external.url;

    // Vercel 경유 없이 Notion CDN / 외부 URL로 직접 리다이렉트
    return NextResponse.redirect(fileUrl);
  } catch {
    return new NextResponse("Error", { status: 500 });
  }
}
