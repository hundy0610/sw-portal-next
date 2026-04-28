import { NextResponse } from "next/server";
import { kvGet, kvSetPermanent } from "@/lib/kv-store";
import { Contract } from "@/types/contract";

const KEY = "contracts:list";

function autoStatus(c: Contract): Contract {
  const today = new Date();
  const end = new Date(c.endDate);
  const start = new Date(c.startDate);
  let status: Contract["status"] = "active";
  if (today < start) status = "pending";
  else if (today > end) status = "expired";
  return { ...c, status };
}

// PUT /api/contracts/[id]
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const existing = await kvGet<Contract[]>(KEY) ?? [];
    const idx = existing.findIndex((c) => c.id === params.id);
    if (idx === -1) {
      return NextResponse.json({ ok: false, error: "계약을 찾을 수 없습니다" }, { status: 404 });
    }
    const updated: Contract = autoStatus({
      ...existing[idx],
      ...body,
      id: params.id,
      updatedAt: new Date().toISOString(),
    });
    existing[idx] = updated;
    await kvSetPermanent(KEY, existing);
    return NextResponse.json({ ok: true, contract: updated });
  } catch (e) {
    console.error("[contracts PUT]", e);
    return NextResponse.json({ ok: false, error: "서버 오류" }, { status: 500 });
  }
}

// DELETE /api/contracts/[id]
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const existing = await kvGet<Contract[]>(KEY) ?? [];
    const filtered = existing.filter((c) => c.id !== params.id);
    if (filtered.length === existing.length) {
      return NextResponse.json({ ok: false, error: "계약을 찾을 수 없습니다" }, { status: 404 });
    }
    await kvSetPermanent(KEY, filtered);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[contracts DELETE]", e);
    return NextResponse.json({ ok: false, error: "서버 오류" }, { status: 500 });
  }
}
