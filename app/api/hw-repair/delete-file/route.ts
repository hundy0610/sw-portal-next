import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/api-error";
import { readEntityOne, upsertEntity } from "@/lib/repo/mirror";
import { HR_ENTITY, HR_FILE_FIELDS } from "@/lib/hw-repair";
import type { HwRepairRecord } from "@/types";

export const dynamic = "force-dynamic";

// 미러 레코드의 파일 필드(string[])를 remainingUrls 로 교체한다(삭제 반영).
export async function POST(req: NextRequest) {
  let body: { pageId: string; fieldName: string; remainingUrls: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON 파싱 실패" }, { status: 400 });
  }

  const { pageId, fieldName, remainingUrls } = body;
  if (!pageId || !fieldName || !Array.isArray(remainingUrls)) {
    return NextResponse.json({ ok: false, error: "pageId, fieldName, remainingUrls 필수" }, { status: 400 });
  }
  const field = HR_FILE_FIELDS[fieldName];
  if (!field) return NextResponse.json({ ok: false, error: "알 수 없는 파일 필드" }, { status: 400 });

  try {
    const base = await readEntityOne<HwRepairRecord>(HR_ENTITY, pageId);
    if (!base) return NextResponse.json({ ok: false, error: "대상 레코드를 찾을 수 없습니다." }, { status: 404 });

    const next: HwRepairRecord = { ...base, [field]: remainingUrls, lastEditedAt: new Date().toISOString() };
    const ok = await upsertEntity(HR_ENTITY, pageId, next);
    if (!ok) return NextResponse.json({ ok: false, error: "저장 실패(Postgres)" }, { status: 500 });

    return NextResponse.json({ ok: true, urls: remainingUrls });
  } catch (e) {
    console.error("[API /hw-repair/delete-file]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
