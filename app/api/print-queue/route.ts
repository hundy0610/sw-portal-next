import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSetPermanent } from "@/lib/kv-store";
import { errorMessage } from "@/lib/api-error";

const KV_KEY = "label-print-queue";

export interface PrintQueueItem {
  id: string;
  company: string;
  address: string;
  department: string;
  user: string;
  newAssetId: string;
  type: string;
  note: string;
  addedAt: string;
}

export async function GET() {
  try {
    const items = (await kvGet<PrintQueueItem[]>(KV_KEY)) ?? [];
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const item = (await req.json()) as PrintQueueItem;
    if (!item.id) return NextResponse.json({ ok: false, error: "id 누락" }, { status: 400 });
    const existing = (await kvGet<PrintQueueItem[]>(KV_KEY)) ?? [];
    if (existing.some(i => i.id === item.id)) {
      return NextResponse.json({ ok: true }); // 이미 존재
    }
    const saved = await kvSetPermanent(KV_KEY, [...existing, item]);
    if (!saved) return NextResponse.json({ ok: false, error: "저장에 실패했습니다. 잠시 후 다시 시도해주세요.", code: "PRINT_QUEUE_SAVE_FAILED" }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    const existing = (await kvGet<PrintQueueItem[]>(KV_KEY)) ?? [];
    const saved = await kvSetPermanent(KV_KEY, id ? existing.filter(i => i.id !== id) : []);
    if (!saved) return NextResponse.json({ ok: false, error: "저장에 실패했습니다. 잠시 후 다시 시도해주세요.", code: "PRINT_QUEUE_SAVE_FAILED" }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
