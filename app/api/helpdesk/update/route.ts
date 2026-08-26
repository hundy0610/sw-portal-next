import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/api-error";
import { readEntityOne, upsertEntity } from "@/lib/repo/mirror";
import type { HelpDeskTicket } from "@/lib/notion";

export const dynamic = "force-dynamic";

const HD_ENTITY = "helpdesk";

export async function POST(req: NextRequest) {
  try {
    const { id, fields } = await req.json() as {
      id: string;
      fields: { status?: string; assigneeId?: string; actionNote?: string; actionCategory?: string[]; actionMethod?: string };
    };

    if (!id) return NextResponse.json({ ok: false, error: "id 필수" }, { status: 400 });
    if (!fields || typeof fields !== "object" || Object.keys(fields).length === 0) {
      return NextResponse.json({ ok: false, error: "업데이트할 필드 없음" }, { status: 400 });
    }

    const base = await readEntityOne<HelpDeskTicket>(HD_ENTITY, id);
    if (!base) return NextResponse.json({ ok: false, error: "대상 문의를 찾을 수 없습니다." }, { status: 404 });

    const next: HelpDeskTicket = { ...base };
    if (fields.status         !== undefined) next.status = fields.status;
    if (fields.assigneeId     !== undefined) next.assigneeId = fields.assigneeId;
    if (fields.actionNote     !== undefined) next.actionNote = fields.actionNote;
    if (fields.actionCategory !== undefined) next.actionCategory = fields.actionCategory;
    if (fields.actionMethod   !== undefined) next.actionMethod = fields.actionMethod;
    next.lastEditedAt = new Date().toISOString();

    // 상태 전이 시각 — 데스크탑 앱(core/repo/helpdesk.ts)과 같은 규칙으로 찍는다.
    // 여기서 빠뜨리면 웹·모바일 관리 화면으로 옮긴 건만 소요 시간이 비어 버린다.
    if (fields.status !== undefined && fields.status !== base.status) {
      if (base.status === "시작 전" && !next.firstRespondedAt) next.firstRespondedAt = next.lastEditedAt;
      // 보류도 처리 종료로 센다. 재개했다 다시 끝내면 마지막 시각으로 덮인다.
      if (next.status === "완료" || next.status === "보류") next.completedAt = next.lastEditedAt;
    }

    const ok = await upsertEntity(HD_ENTITY, id, next);
    if (!ok) return NextResponse.json({ ok: false, error: "저장 실패(Postgres)" }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[API /helpdesk/update]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
