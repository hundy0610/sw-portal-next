import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/api-error";
import { uploadToBlob, isBlobEnabled } from "@/lib/blob-store";
import { readEntityOne, upsertEntity } from "@/lib/repo/mirror";
import { HR_ENTITY, HR_FILE_FIELDS } from "@/lib/hw-repair";
import type { HwRepairRecord } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 파일을 Vercel Blob 에 올리고 미러 레코드의 해당 필드(string[])에 append 한다.
// (5분 백업 러너가 Blob→Notion 재업로드)
export async function POST(req: NextRequest) {
  if (!isBlobEnabled()) return NextResponse.json({ ok: false, error: "BLOB_READ_WRITE_TOKEN 없음" }, { status: 503 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "FormData 파싱 실패" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const pageId = formData.get("pageId") as string | null;
  const fieldName = formData.get("fieldName") as string | null;

  if (!file || !pageId || !fieldName) {
    return NextResponse.json({ ok: false, error: "file, pageId, fieldName 필수" }, { status: 400 });
  }
  const field = HR_FILE_FIELDS[fieldName];
  if (!field) return NextResponse.json({ ok: false, error: "알 수 없는 파일 필드" }, { status: 400 });

  try {
    const base = await readEntityOne<HwRepairRecord>(HR_ENTITY, pageId);
    if (!base) return NextResponse.json({ ok: false, error: "대상 레코드를 찾을 수 없습니다." }, { status: 404 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const blobUrl = await uploadToBlob(buffer, file.name, file.type || "application/octet-stream", "hw-repair");

    const cur = (base[field] as string[]) || [];
    const urls = [...cur, blobUrl];
    const next: HwRepairRecord = { ...base, [field]: urls, lastEditedAt: new Date().toISOString() };

    const ok = await upsertEntity(HR_ENTITY, pageId, next);
    if (!ok) return NextResponse.json({ ok: false, error: "저장 실패(Postgres)" }, { status: 500 });

    return NextResponse.json({ ok: true, urls });
  } catch (e) {
    console.error("[API /hw-repair/upload]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
