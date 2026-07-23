import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSetPermanent } from "@/lib/kv-store";
import { errorMessage } from "@/lib/api-error";

const KV_KEY = "hw-dispatch-history";
const MAX_RECORDS = 5000;

export interface DispatchRecord {
  id: string;
  dispatchedAt: string;   // ISO timestamp (sort key)
  type: "재고" | "신규";
  assetNo: string;
  model: string;
  serial: string;
  user: string;
  company: string;
  dept: string;
  useDate: string;
}

// GET /api/hw/dispatch-history
export async function GET() {
  try {
    const history = (await kvGet<DispatchRecord[]>(KV_KEY)) ?? [];
    return NextResponse.json({ ok: true, history });
  } catch (e) {
    console.error("[dispatch-history GET]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

// POST /api/hw/dispatch-history — prepend one or more records
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const incoming: DispatchRecord[] = Array.isArray(body) ? body : [body];
    if (incoming.length === 0) {
      return NextResponse.json({ ok: false, error: "데이터 없음" }, { status: 400 });
    }
    const existing = (await kvGet<DispatchRecord[]>(KV_KEY)) ?? [];
    const updated = [...incoming, ...existing].slice(0, MAX_RECORDS);
    const saved = await kvSetPermanent(KV_KEY, updated);
    if (!saved) {
      return NextResponse.json({ ok: false, error: "저장에 실패했습니다. 잠시 후 다시 시도해주세요.", code: "DISPATCH_HISTORY_SAVE_FAILED" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, added: incoming.length });
  } catch (e) {
    console.error("[dispatch-history POST]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

// DELETE /api/hw/dispatch-history?id=xxx  — 단건 삭제
// DELETE /api/hw/dispatch-history          — 전체 삭제
export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    const existing = (await kvGet<DispatchRecord[]>(KV_KEY)) ?? [];
    const saved = await kvSetPermanent(KV_KEY, id ? existing.filter(r => r.id !== id) : []);
    if (!saved) {
      return NextResponse.json({ ok: false, error: "삭제에 실패했습니다. 잠시 후 다시 시도해주세요.", code: "DISPATCH_HISTORY_SAVE_FAILED" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[dispatch-history DELETE]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
