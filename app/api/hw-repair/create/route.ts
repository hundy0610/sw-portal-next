import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/api-error";
import { upsertEntity, isMirrorEnabled } from "@/lib/repo/mirror";
import { HR_ENTITY } from "@/lib/hw-repair";
import type { HwRepairRecord } from "@/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isMirrorEnabled()) {
    return NextResponse.json({ ok: false, error: "데이터 저장소(Postgres)가 설정되지 않았습니다." }, { status: 503 });
  }

  try {
    const body = await req.json() as {
      assetId: string;
      stage?: string;
      company?: string;
      department?: string;
      user?: string;
      vendor?: string;
      receivedAt?: string;
      faultType?: string;
      assigneeId?: string;
      note?: string;
      assetStatus?: string;
      address?: string;
      requesterEmail?: string;
    };

    if (!body.assetId?.trim()) {
      return NextResponse.json({ ok: false, error: "자산번호 필수" }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const record: HwRepairRecord = {
      id,
      assetId: body.assetId.trim(),
      company: body.company || "",
      department: body.department || "",
      user: body.user || "",
      vendor: body.vendor || "",
      stage: body.stage || "수리접수",
      receivedAt: body.receivedAt || "",
      completedAt: "",
      faultType: body.faultType || "",
      receiptUrl: [],
      consentUrl: [],
      taxInvoiceUrl: [],
      approvalUrl: [],
      assignee: "",
      assigneeId: body.assigneeId || "",
      note: body.note || "",
      repairCost: 0,
      assetStatus: body.assetStatus || "",
      address: body.address || "",
      requesterEmail: body.requesterEmail || "",
      isClosed: false,
      lastEditedAt: new Date().toISOString(),
      notionUrl: "",
    };

    const ok = await upsertEntity(HR_ENTITY, id, record);
    if (!ok) return NextResponse.json({ ok: false, error: "저장 실패(Postgres)" }, { status: 500 });

    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("[API /hw-repair/create]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
