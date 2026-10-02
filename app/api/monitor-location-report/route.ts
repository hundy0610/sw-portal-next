import { NextResponse, type NextRequest } from "next/server";
import { findItemLocation, recordLocationReport } from "@/lib/monitor-map";
import { errorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const MAX_NOTE_LEN = 300;

// POST /api/monitor-location-report — QR 확인 화면의 "다른 곳이에요" 응답. 인증 없음.
// "확인 대기" 상태로만 남긴다 — 배치도에 바로 반영하지 않는다(관리자가 실제로 가서
// 확인한 뒤 다음 실사 때 반영). note는 선택 — 없어도 신고 자체는 접수된다.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as { itemId?: string; note?: string } | null;
    const itemId = typeof body?.itemId === "string" ? body.itemId.trim() : "";
    if (!itemId) {
      return NextResponse.json({ ok: false, error: "itemId는 필수입니다" }, { status: 400 });
    }
    const note = typeof body?.note === "string" ? body.note.trim().slice(0, MAX_NOTE_LEN) : "";

    const loc = await findItemLocation(itemId);
    if (!loc) {
      return NextResponse.json({ ok: false, error: "등록되지 않은 좌석입니다." }, { status: 404 });
    }
    const ok = await recordLocationReport(loc, note, "QR 스캔(익명)");
    if (!ok) return NextResponse.json({ ok: false, error: "저장에 실패했습니다." }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/monitor-location-report]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
