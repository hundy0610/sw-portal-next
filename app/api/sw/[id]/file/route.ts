import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { getSessionFromCookieHeader, companyScope } from "@/lib/session";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

// Notion이 내려주는 file 속성 URL은 발급 후 1시간만 유효한 임시 서명 URL이라
// 캐시에 저장해두면 곧 만료된다. 그래서 보기/다운로드 시점에 항상 Notion에서
// 새 URL을 다시 받아 리다이렉트한다 (app/api/sw-docs/[id]/file/route.ts와 동일 패턴).
const PROP_MAP = {
  certificate: "증서",
  draft: "기안문서",
} as const;

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const propKey = req.nextUrl.searchParams.get("prop");
  const notionPropName = PROP_MAP[propKey as keyof typeof PROP_MAP];
  if (!notionPropName) return new NextResponse("Invalid prop", { status: 400 });

  try {
    const page = await notion.pages.retrieve({ page_id: params.id });
    if (!("properties" in page)) {
      return new NextResponse("Not found", { status: 404 });
    }
    const properties = (page as PageObjectResponse).properties;

    const scope = companyScope(session);
    if (scope) {
      const companyProp = properties["법인명"];
      const company = companyProp?.type === "select" ? companyProp.select?.name : undefined;
      if (company !== scope) return new NextResponse("Forbidden", { status: 403 });
    }

    const filesProp = properties[notionPropName];
    if (!filesProp || filesProp.type !== "files" || filesProp.files.length === 0) {
      return new NextResponse("No file attached", { status: 404 });
    }

    const file = filesProp.files[0];
    const fileUrl = "file" in file ? file.file.url : file.external.url;

    return NextResponse.redirect(fileUrl);
  } catch {
    return new NextResponse("Error", { status: 500 });
  }
}
