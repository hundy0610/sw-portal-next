import { NextRequest, NextResponse } from "next/server";
import { updateContract, updateContractStage, deleteContract } from "@/lib/contract-notion";
import type { ContractStage } from "@/types/contract";
import { errorMessage } from "@/lib/api-error";

// PUT /api/contracts/[id]  (multipart/form-data)
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const formData = await req.formData();

    const data: Record<string, unknown> = {};
    const textFields = ["company", "contactName", "contactEmail", "startDate", "endDate", "notes", "stage"];
    for (const f of textFields) {
      const v = formData.get(f);
      if (v !== null) data[f] = v as string;
    }
    if (formData.get("quantity")  !== null) data.quantity  = Number(formData.get("quantity"));
    if (formData.get("unitPrice") !== null) data.unitPrice = Number(formData.get("unitPrice"));

    let pdfBuffer: Buffer | undefined;
    let pdfFileName: string | undefined;
    const pdfFile = formData.get("pdf") as File | null;
    if (pdfFile && pdfFile.size > 0) {
      pdfBuffer   = Buffer.from(await pdfFile.arrayBuffer());
      pdfFileName = pdfFile.name;
    }
    const pdfLink = (formData.get("pdfLink") as string | null) || undefined;

    const contract = await updateContract(params.id, {
      ...(data as Parameters<typeof updateContract>[1]),
      pdfBuffer,
      pdfFileName,
      pdfLink,
    });
    return NextResponse.json({ ok: true, contract });
  } catch (e) {
    console.error("[contracts PUT]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

// PATCH /api/contracts/[id]  — 진행 단계만 빠르게 업데이트 (칸반 드래그앤드롭용)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { stage } = (await req.json()) as { stage: ContractStage };
    if (!stage) return NextResponse.json({ ok: false, error: "stage 필드 필요" }, { status: 400 });
    await updateContractStage(params.id, stage);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[contracts PATCH]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

// DELETE /api/contracts/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await deleteContract(params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[contracts DELETE]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
