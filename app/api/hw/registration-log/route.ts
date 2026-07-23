import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSetPermanent } from "@/lib/kv-store";
import { errorMessage } from "@/lib/api-error";

const KV_KEY = "hw-registration-log";

export interface RegistrationRecord {
  id: string;
  registeredAt: string;   // ISO timestamp (sort key)
  assetNo: string;
  model: string;
  serial: string;
  user: string;
  company: string;
  dept: string;
  maker: string;
  price: number;           // 단가 (구매금액 집계용)
  purchaseDate: string;
  useDate: string;
  registeredBy: string;    // 등록자 (이름 + id)
}

// GET /api/hw/registration-log
export async function GET() {
  try {
    const log = (await kvGet<RegistrationRecord[]>(KV_KEY)) ?? [];
    return NextResponse.json({ ok: true, log });
  } catch (e) {
    console.error("[registration-log GET]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

// DELETE /api/hw/registration-log?id=xxx  — 단건 삭제
// DELETE /api/hw/registration-log          — 전체 삭제
export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    const existing = (await kvGet<RegistrationRecord[]>(KV_KEY)) ?? [];
    const saved = await kvSetPermanent(KV_KEY, id ? existing.filter(r => r.id !== id) : []);
    if (!saved) {
      return NextResponse.json({ ok: false, error: "삭제에 실패했습니다. 잠시 후 다시 시도해주세요.", code: "REGISTRATION_LOG_SAVE_FAILED" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[registration-log DELETE]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
