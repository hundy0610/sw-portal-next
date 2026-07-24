import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/api-error";
import { uploadToBlob, isBlobEnabled } from "@/lib/blob-store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 파일을 Vercel Blob 에 업로드하고 공개 URL 을 반환한다(4.0verMACBOOK: Postgres 메인).
// 페이지 저장은 /api/sw/upload · /api/sw/update 에서 이 URL 을 미러 레코드(certificate/
// draftDocument)에 담고, 5분 백업 러너가 Blob→Notion 으로 재업로드한다.
// 반환 키(fileUploadId)는 기존 클라이언트 호환을 위해 그대로 두되, 값은 Blob URL 이다.
export async function POST(req: NextRequest) {
  if (!isBlobEnabled()) {
    return NextResponse.json({ ok: false, error: "BLOB_READ_WRITE_TOKEN 없음" }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "FormData 파싱 실패" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ ok: false, error: "파일이 없습니다." }, { status: 400 });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadToBlob(
      buffer,
      file.name,
      file.type || "application/octet-stream",
      "sw",
    );
    return NextResponse.json({ ok: true, fileUploadId: url, url, fileName: file.name });
  } catch (e) {
    console.error("[API /sw/cert-upload]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
