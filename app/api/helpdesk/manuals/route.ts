import { NextRequest, NextResponse } from "next/server";
import { listManuals, saveManual, deleteManual } from "@/lib/helpdesk-manuals";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const manuals = await listManuals();
    return NextResponse.json({ ok: true, manuals });
  } catch (e) {
    console.error("[API /helpdesk/manuals GET] MANUAL_LIST_FAILED", e);
    return NextResponse.json({ ok: false, error: "서버 오류", code: "MANUAL_LIST_FAILED" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { id, title, contentType, body, matchKeywords, updatedBy } = await req.json() as {
      id?: string; title?: string; contentType?: "html" | "url"; body?: string; matchKeywords?: string[]; updatedBy?: string;
    };
    if (!title || !body || (contentType !== "html" && contentType !== "url")) {
      return NextResponse.json({ ok: false, error: "title, body, contentType 필수", code: "MANUAL_SAVE_INVALID_INPUT" }, { status: 400 });
    }
    if (contentType === "url" && !/^https?:\/\//.test(body)) {
      return NextResponse.json({ ok: false, error: "올바른 URL이 아닙니다 (http:// 또는 https://로 시작해야 함)", code: "MANUAL_SAVE_INVALID_URL" }, { status: 400 });
    }
    const cleanKeywords = Array.isArray(matchKeywords) ? matchKeywords.filter(k => typeof k === "string") : undefined;
    const manual = await saveManual({ id, title, contentType, body, matchKeywords: cleanKeywords, updatedBy: updatedBy || "" });
    return NextResponse.json({ ok: true, manual });
  } catch (e) {
    console.error("[API /helpdesk/manuals POST] MANUAL_SAVE_FAILED", e);
    return NextResponse.json({ ok: false, error: "서버 오류", code: "MANUAL_SAVE_FAILED" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json() as { id?: string };
    if (!id) return NextResponse.json({ ok: false, error: "id 필수", code: "MANUAL_DELETE_INVALID_INPUT" }, { status: 400 });
    await deleteManual(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[API /helpdesk/manuals DELETE] MANUAL_DELETE_FAILED", e);
    return NextResponse.json({ ok: false, error: "서버 오류", code: "MANUAL_DELETE_FAILED" }, { status: 500 });
  }
}
