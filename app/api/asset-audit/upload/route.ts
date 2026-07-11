import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getSessionFromCookieHeader, resolveCurrentRole } from "@/lib/session";

export const dynamic = "force-dynamic";

// 클라이언트가 Blob에 직접 업로드할 수 있도록 토큰만 발급한다.
// 업로드 완료 후 실제 설정(fileUrl 등) 반영은 클라이언트가 /api/asset-audit/config로 별도 저장한다.
export async function POST(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session || (await resolveCurrentRole(session)) !== "super") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          "application/octet-stream",
          "application/x-msdownload",
          "application/x-msi",
          "application/zip",
          "application/vnd.microsoft.portable-executable",
        ],
        addRandomSuffix: true,
        maximumSizeInBytes: 300 * 1024 * 1024,
      }),
    });
    return NextResponse.json(jsonResponse);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
