import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/api-error";
import { readEntityOne, upsertEntity } from "@/lib/repo/mirror";
import type { RepairTicket } from "@/types";

export const dynamic = "force-dynamic";

const REPAIR_ENTITY = "repair";

export async function POST(req: NextRequest) {
  try {
    const { id, fields } = await req.json() as {
      id: string;
      fields: { status?: RepairTicket["status"]; assigneeId?: string; actionNote?: string };
    };

    if (!id) return NextResponse.json({ ok: false, error: "id 필수" }, { status: 400 });
    if (!fields || typeof fields !== "object" || Object.keys(fields).length === 0) {
      return NextResponse.json({ ok: false, error: "업데이트할 필드 없음" }, { status: 400 });
    }

    const base = await readEntityOne<RepairTicket>(REPAIR_ENTITY, id);
    if (!base) return NextResponse.json({ ok: false, error: "대상 티켓을 찾을 수 없습니다." }, { status: 404 });

    const next: RepairTicket = { ...base };
    if (fields.status     !== undefined) next.status = fields.status;
    if (fields.assigneeId !== undefined) next.assigneeId = fields.assigneeId;
    if (fields.actionNote !== undefined) next.actionNote = fields.actionNote;

    const ok = await upsertEntity(REPAIR_ENTITY, id, next);
    if (!ok) return NextResponse.json({ ok: false, error: "저장 실패(Postgres)" }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[API /repair-tickets/update]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
