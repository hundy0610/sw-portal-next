import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/api-error";
import { readEntityOne, upsertEntity } from "@/lib/repo/mirror";
import { HR_ENTITY } from "@/lib/hw-repair";
import type { HwRepairRecord } from "@/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { id, fields } = await req.json() as {
      id: string;
      fields: {
        stage?: string;
        vendor?: string;
        company?: string;
        department?: string;
        user?: string;
        receivedAt?: string;
        completedAt?: string;
        faultType?: string;
        assigneeId?: string;
        note?: string;
        repairCost?: number;
        assetStatus?: string;
        address?: string;
        requesterEmail?: string;
        isClosed?: boolean;
      };
    };

    if (!id) return NextResponse.json({ ok: false, error: "id 필수" }, { status: 400 });
    if (!fields || typeof fields !== "object" || Object.keys(fields).length === 0) {
      return NextResponse.json({ ok: false, error: "업데이트할 필드 없음" }, { status: 400 });
    }

    const base = await readEntityOne<HwRepairRecord>(HR_ENTITY, id);
    if (!base) return NextResponse.json({ ok: false, error: "대상 레코드를 찾을 수 없습니다." }, { status: 404 });

    const next: HwRepairRecord = { ...base };
    if (fields.stage          !== undefined) next.stage = fields.stage;
    if (fields.vendor         !== undefined) next.vendor = fields.vendor;
    if (fields.company        !== undefined) next.company = fields.company;
    if (fields.department     !== undefined) next.department = fields.department;
    if (fields.user           !== undefined) next.user = fields.user;
    if (fields.receivedAt     !== undefined) next.receivedAt = fields.receivedAt;
    if (fields.completedAt    !== undefined) next.completedAt = fields.completedAt;
    if (fields.faultType      !== undefined) next.faultType = fields.faultType;
    if (fields.assigneeId     !== undefined) next.assigneeId = fields.assigneeId;
    if (fields.note           !== undefined) next.note = fields.note;
    if (fields.repairCost     !== undefined) next.repairCost = fields.repairCost || 0;
    if (fields.assetStatus    !== undefined) next.assetStatus = fields.assetStatus;
    if (fields.address        !== undefined) next.address = fields.address;
    if (fields.requesterEmail !== undefined) next.requesterEmail = fields.requesterEmail;
    if (fields.isClosed       !== undefined) next.isClosed = fields.isClosed;
    next.lastEditedAt = new Date().toISOString();

    const ok = await upsertEntity(HR_ENTITY, id, next);
    if (!ok) return NextResponse.json({ ok: false, error: "저장 실패(Postgres)" }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[API /hw-repair/update]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
