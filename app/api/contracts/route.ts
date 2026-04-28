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

// GET /api/contracts
export async function GET() {
  try {
    const raw = await kvGet<Contract[]>(KEY);
    const list: Contract[] = (raw ?? []).map(autoStatus);
    return NextResponse.json({ ok: true, contracts: list });
  } catch (e) {
    console.error("[contracts GET]", e);
    return NextResponse.json({ ok: false, error: "서버 오류" }, { status: 500 });
  }
}

// POST /api/contracts
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      company, contactName, contactEmail, contactPhone,
      startDate, endDate, quantity, unitPrice, pdfUrl, pdfName, notes,
    } = body;

    if (!company || !contactName || !startDate || !endDate || !quantity) {
      return NextResponse.json({ ok: false, error: "필수 항목 누락" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const newContract: Contract = {
      id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      company,
      contactName,
      contactEmail: contactEmail ?? "",
      contactPhone: contactPhone ?? "",
      startDate,
      endDate,
      quantity: Number(quantity),
      unitPrice: Number(unitPrice ?? 6000),
      pdfUrl: pdfUrl ?? "",
      pdfName: pdfName ?? "",
      status: "active",
      notes: notes ?? "",
      createdAt: now,
      updatedAt: now,
    };

    const existing = await kvGet<Contract[]>(KEY) ?? [];
    const updated = [...existing, autoStatus(newContract)];
    await kvSetPermanent(KEY, updated);

    return NextResponse.json({ ok: true, contract: autoStatus(newContract) });
  } catch (e) {
    console.error("[contracts POST]", e);
    return NextResponse.json({ ok: false, error: "서버 오류" }, { status: 500 });
  }
}
