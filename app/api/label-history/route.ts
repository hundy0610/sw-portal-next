import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSetPermanent } from "@/lib/kv-store";

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
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
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
    await kvSetPermanent(KV_KEY, updated);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[label-history POST]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// DELETE /api/label-history?id=xxx  — delete one record
// DELETE /api/label-history          — clear all
export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (id) {
      const existing = (await kvGet<PrintHistoryRecord[]>(KV_KEY)) ?? [];
      await kvSetPermanent(KV_KEY, existing.filter(r => r.id !== id));
    } else {
      await kvSetPermanent(KV_KEY, []);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[label-history DELETE]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
