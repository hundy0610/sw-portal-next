import { NextRequest, NextResponse } from "next/server";
import { fetchContracts, createContract } from "@/lib/contract-notion";
import { kvDel } from "@/lib/kv-store";
import type { ContractStage } from "@/types/contract";

// DELETE /api/contracts  — KV 캐시 강제 무효화
export async function DELETE() {
  await kvDel("contracts:list");
  return NextResponse.json({ ok: true });
}

// GET /api/contracts
export async function GET() {
  for (const v of ["NOTION_TOKEN", "NOTION_DB_CONTRACTS"]) {
    if (!process.env[v]) return NextResponse.json({ missingEnv: v, error: `환경변수 ${v} 가 설정되지 않았습니다.` }, { status: 503 });
  }
  try {
    const contracts = await fetchContracts();
    return NextResponse.json({ ok: true, contracts });
  } catch (e) {
    console.error("[contracts GET]", e);
    return NextResponse.json({ ok: false, error: "서버 오류" }, { status: 500 });
  }
}

// POST /api/contracts  (multipart/form-data)
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const company      = (formData.get("company")      as string) ?? "";
    const contactName  = (formData.get("contactName")  as string) ?? "";
    const contactEmail = (formData.get("contactEmail") as string) ?? "";
    const startDate    = (formData.get("startDate")    as string) ?? "";
    const endDate      = (formData.get("endDate")      as string) ?? "";
    const quantity     = Number(formData.get("quantity")  ?? 1);
    const unitPrice    = Number(formData.get("unitPrice") ?? 6000);
    const stage        = ((formData.get("stage") as string) || "관리현황 파악") as ContractStage;
    const notes        = (formData.get("notes")        as string) ?? "";

    if (!company || !contactName || !startDate || !endDate) {
      return NextResponse.json({ ok: false, error: "필수 항목 누락" }, { status: 400 });
    }

    let pdfBuffer: Buffer | undefined;
    let pdfFileName: string | undefined;
    const pdfFile = formData.get("pdf") as File | null;
    if (pdfFile && pdfFile.size > 0) {
      pdfBuffer   = Buffer.from(await pdfFile.arrayBuffer());
      pdfFileName = pdfFile.name;
    }
    const pdfLink = (formData.get("pdfLink") as string | null) || undefined;

    const contract = await createContract({
      company, contactName, contactEmail,
      startDate, endDate, quantity, unitPrice, stage, notes,
      pdfBuffer, pdfFileName, pdfLink,
    });

    return NextResponse.json({ ok: true, contract });
  } catch (e) {
    console.error("[contracts POST]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
