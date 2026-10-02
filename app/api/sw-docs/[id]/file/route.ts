import { NextRequest, NextResponse } from "next/server";
import { findSwDocFileUrl } from "@/lib/sw-resources-store";

// 예전에는 요청마다 Notion 페이지를 조회해 1시간짜리 서명 URL 로 리다이렉트했다.
// 이제 첨부 원본이 Vercel Blob(또는 사내 드라이브 링크)이고 fileUrl 이 영구 주소라
// 미러에서 읽어 바로 보낸다 — Notion 왕복이 사라진다.
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const file = await findSwDocFileUrl(params.id);
    if (!file) return new NextResponse("No file attached", { status: 404 });
    return NextResponse.redirect(file.url);
  } catch {
    return new NextResponse("Error", { status: 500 });
  }
}
