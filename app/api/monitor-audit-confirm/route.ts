import { NextResponse, type NextRequest } from "next/server";
import { findItemLocation, recordAuditConfirm } from "@/lib/monitor-map";
import { errorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

// POST /api/monitor-audit-confirm — QR 확인 화면의 "정상이에요" 탭. 인증 없음,
// 폼도 없음 — 한 번 눌러서 "이 좌석 확인함"만 이력에 남긴다.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as { itemId?: string } | null;
    const itemId = typeof body?.itemId === "string" ? body.itemId.trim() : "";
    if (!itemId) {
      return NextResponse.json({ ok: false, error: "itemId는 필수입니다" }, { status: 400 });
    }
    const loc = await findItemLocation(itemId);
    if (!loc) {
      return NextResponse.json({ ok: false, error: "등록되지 않은 좌석입니다." }, { status: 404 });
    }
    const ok = await recordAuditConfirm(loc, "QR 스캔(익명)");
    if (!ok) return NextResponse.json({ ok: false, error: "저장에 실패했습니다." }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/monitor-audit-confirm]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
