import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSetPermanent } from "@/lib/kv-store";
import { errorMessage } from "@/lib/api-error";

const KV_KEY = "label-print-history";
const MAX_RECORDS = 200;

interface LabelEntry {
  id: string;
  recipientOrg: string;
  recipientName: string;
  user: string;
  assetNo: string;
  shipType: string;
}

export interface PrintHistoryRecord {
  id: string;
  printedAt: string;   // ISO timestamp (primary sort key)
  senderInfo: string;
  labels: LabelEntry[];
}

// GET /api/label-history
export async function GET() {
  try {
    const history = (await kvGet<PrintHistoryRecord[]>(KV_KEY)) ?? [];
    return NextResponse.json({ ok: true, history });
  } catch (e) {
    console.error("[label-history GET]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

// POST /api/label-history  — prepend new record
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PrintHistoryRecord;
    if (!body.printedAt || !Array.isArray(body.labels)) {
      return NextResponse.json({ ok: false, error: "필수 항목 누락" }, { status: 400 });
    }
    const existing = (await kvGet<PrintHistoryRecord[]>(KV_KEY)) ?? [];
    const updated  = [body, ...existing].slice(0, MAX_RECORDS);
    const saved = await kvSetPermanent(KV_KEY, updated);
    if (!saved) return NextResponse.json({ ok: false, error: "저장에 실패했습니다. 잠시 후 다시 시도해주세요.", code: "LABEL_HISTORY_SAVE_FAILED" }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[label-history POST]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

// DELETE /api/label-history?id=xxx       — 단건 삭제
// DELETE /api/label-history?keepLast=N   — 최근 N건만 남기고 나머지 삭제
// DELETE /api/label-history              — 전체 삭제
export async function DELETE(req: NextRequest) {
  try {
    const params   = new URL(req.url).searchParams;
    const id       = params.get("id");
    const keepLast = params.get("keepLast");

    let saved: boolean;
    if (id) {
      const existing = (await kvGet<PrintHistoryRecord[]>(KV_KEY)) ?? [];
      saved = await kvSetPermanent(KV_KEY, existing.filter(r => r.id !== id));
    } else if (keepLast !== null) {
      const n        = Math.max(0, parseInt(keepLast, 10) || 0);
      const existing = (await kvGet<PrintHistoryRecord[]>(KV_KEY)) ?? [];
      // records are newest-first → keep first N
      saved = await kvSetPermanent(KV_KEY, existing.slice(0, n));
    } else {
      saved = await kvSetPermanent(KV_KEY, []);
    }
    if (!saved) return NextResponse.json({ ok: false, error: "삭제에 실패했습니다. 잠시 후 다시 시도해주세요.", code: "LABEL_HISTORY_SAVE_FAILED" }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[label-history DELETE]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
