import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NOTION_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Notion-Version": "2026-03-11",
});

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
  const pageId = formData.get("pageId") as string | null;
  const fieldName = formData.get("fieldName") as string | null;
  const existingUrlsRaw = formData.get("existingUrls") as string | null;

  if (!file || !pageId || !fieldName) {
    return NextResponse.json({ ok: false, error: "file, pageId, fieldName 필수" }, { status: 400 });
  }

  let existingUrls: string[] = [];
  try {
    if (existingUrlsRaw) existingUrls = JSON.parse(existingUrlsRaw);
  } catch { /* 파싱 실패 시 무시 */ }

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
    const { id: uploadId } = await createRes.json();

    // Step 2: 파일 바이너리 전송
    const fd = new FormData();
    fd.append("file", file, file.name);
    const sendRes = await fetch(`https://api.notion.com/v1/file_uploads/${uploadId}/send`, {
      method: "POST",
      headers: NOTION_HEADERS(token),
      body: fd,
    });
    if (!sendRes.ok) throw new Error(`파일 전송 실패: ${await sendRes.text()}`);

    // Step 3: 기존 URL + 신규 file_upload 로 페이지 업데이트
    const existingFileRefs = existingUrls.map((url, i) =>
      url.includes("prod-files-secure.s3")
        ? { type: "file", name: `${fieldName}_${i + 1}`, file: { url } }
        : { type: "external", name: `${fieldName}_${i + 1}`, external: { url } }
    );

    const updateRes = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: "PATCH",
      headers: { ...NOTION_HEADERS(token), "Content-Type": "application/json" },
      body: JSON.stringify({
        properties: {
          [fieldName]: {
            files: [
              ...existingFileRefs,
              { type: "file_upload", file_upload: { id: uploadId } },
            ],
          },
        },
      }),
    });
    if (!updateRes.ok) throw new Error(`페이지 업데이트 실패: ${await updateRes.text()}`);

    // Step 4: 업데이트된 페이지에서 전체 파일 URL 추출
    const updated = await updateRes.json();
    type NotionFileEntry = { type: string; file?: { url: string }; external?: { url: string } };
    const fileProp: NotionFileEntry[] = updated.properties?.[fieldName]?.files ?? [];
    const urls = fileProp
      .map((f) => f.file?.url ?? f.external?.url ?? "")
      .filter(Boolean);

    return NextResponse.json({ ok: true, urls });
  } catch (e) {
    console.error("[API /hw-repair/upload]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
