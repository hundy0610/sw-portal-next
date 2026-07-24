import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookieHeader, companyScope } from "@/lib/session";
import { readEntityOne } from "@/lib/repo/mirror";
import { SW_ENTITY } from "@/lib/sw-notion";
import type { SwDbRecord } from "@/types";

// 4.0verMACBOOK: 파일은 Vercel Blob(공개·영구 URL)에 저장된다. 미러 레코드의
// certificate/draftDocument 에 담긴 Blob URL 로 리다이렉트한다.
const PROP_MAP = {
  certificate: "certificate",
  draft: "draftDocument",
} as const;

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const propKey = req.nextUrl.searchParams.get("prop");
  const field = PROP_MAP[propKey as keyof typeof PROP_MAP];
  if (!field) return new NextResponse("Invalid prop", { status: 400 });

  try {
    const rec = await readEntityOne<SwDbRecord>(SW_ENTITY, params.id);
    if (!rec) return new NextResponse("Not found", { status: 404 });

    const scope = companyScope(session);
    if (scope && (rec.company ?? "") !== scope) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const fileUrl = (rec[field] as string) || "";
    if (!fileUrl) return new NextResponse("No file attached", { status: 404 });

    return NextResponse.redirect(fileUrl);
  } catch {
    return new NextResponse("Error", { status: 500 });
  }
}
