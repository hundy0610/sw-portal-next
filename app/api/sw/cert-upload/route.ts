import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NOTION_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Notion-Version": "2026-03-11",
});

// 파일을 Notion file_uploads API에 업로드하고 fileUploadId를 반환합니다.
// 페이지 생성은 /api/sw/upload에서 fileUploadId를 받아 처리합니다.
export async function POST(req: NextRequest) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return NextResponse.json({ ok: false, error: "NOTION_TOKEN 없음" }, { status: 503 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "FormData 파싱 실패" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ ok: false, error: "파일이 없습니다." }, { status: 400 });

  try {
    // Step 1: 업로드 세션 생성
    const createRes = await fetch("https://api.notion.com/v1/file_uploads", {
      method: "POST",
      headers: { ...NOTION_HEADERS(token), "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "single_part",
        filename: file.name,
        content_type: file.type || "application/octet-stream",
      }),
    });
    if (!createRes.ok) throw new Error(`업로드 세션 생성 실패: ${await createRes.text()}`);
    const { id: fileUploadId } = await createRes.json();

    // Step 2: 파일 바이너리 전송
    const fd = new FormData();
    fd.append("file", file, file.name);
    const sendRes = await fetch(`https://api.notion.com/v1/file_uploads/${fileUploadId}/send`, {
      method: "POST",
      headers: NOTION_HEADERS(token),
      body: fd,
    });
    if (!sendRes.ok) throw new Error(`파일 전송 실패: ${await sendRes.text()}`);

    return NextResponse.json({ ok: true, fileUploadId });
  } catch (e) {
    console.error("[API /sw/cert-upload]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
