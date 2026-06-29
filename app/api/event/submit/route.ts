import { NextRequest, NextResponse } from "next/server";
import {
  checkEventAlreadySubmitted,
  checkEventEmployee,
  createEventSubmission,
} from "@/lib/notion";
import { getEventConfig, getPreviousParticipants, isEffectivelyOpen } from "@/lib/event-config";

export async function POST(req: NextRequest) {
  try {
    const { name, corporation, department, koreaScore, mexicoScore, _checkOnly } = await req.json();

    if (!name || !corporation || !department) {
      return NextResponse.json({ error: "필수 항목이 누락되었습니다." }, { status: 400 });
    }

    const cfg = await getEventConfig();
    if (!isEffectivelyOpen(cfg)) {
      return NextResponse.json({ error: "이벤트가 마감되었습니다." }, { status: 403 });
    }

    if (cfg.participationMode === "employee_list") {
      if (!(await checkEventEmployee(name.trim()))) {
        return NextResponse.json({ error: "등록된 직원 명단에서 확인되지 않았습니다." }, { status: 403 });
      }
    } else if (cfg.participationMode === "previous") {
      const previous = await getPreviousParticipants();
      if (!previous.includes(name.trim())) {
        return NextResponse.json({ error: "이전 회차 참여자만 참여할 수 있습니다." }, { status: 403 });
      }
    }

    const alreadySubmitted = await checkEventAlreadySubmitted(name.trim(), cfg.roundStartedAt);
    if (alreadySubmitted) {
      return NextResponse.json({ error: "이미 참여하셨습니다." }, { status: 409 });
    }

    // _checkOnly: 검증만 하고 실제 제출은 하지 않음 (1단계 본인확인용)
    if (_checkOnly) {
      return NextResponse.json({ ok: true });
    }

    if (typeof koreaScore !== "number" || typeof mexicoScore !== "number") {
      return NextResponse.json({ error: "점수 형식이 올바르지 않습니다." }, { status: 400 });
    }

    await createEventSubmission({
      name: name.trim(),
      corporation,
      department,
      koreaScore,
      mexicoScore,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[event/submit]", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
