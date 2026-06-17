import { NextRequest, NextResponse } from "next/server";
import {
  checkEventEmployee,
  checkEventAlreadySubmitted,
  createEventSubmission,
} from "@/lib/notion";
import { getEventOpen } from "@/lib/portal-store";

export async function POST(req: NextRequest) {
  try {
    const { name, corporation, department, koreaScore, brazilScore, _checkOnly } = await req.json();

    if (!name || !corporation || !department) {
      return NextResponse.json({ error: "필수 항목이 누락되었습니다." }, { status: 400 });
    }

    const isOpen = await getEventOpen();
    if (!isOpen) {
      return NextResponse.json({ error: "이벤트가 마감되었습니다." }, { status: 403 });
    }

    const exists = await checkEventEmployee(name.trim());
    if (!exists) {
      return NextResponse.json({ error: "등록된 직원 정보와 일치하지 않습니다." }, { status: 403 });
    }

    const alreadySubmitted = await checkEventAlreadySubmitted(name.trim());
    if (alreadySubmitted) {
      return NextResponse.json({ error: "이미 참여하셨습니다." }, { status: 409 });
    }

    // _checkOnly: 검증만 하고 실제 제출은 하지 않음 (1단계 본인확인용)
    if (_checkOnly) {
      return NextResponse.json({ ok: true });
    }

    if (typeof koreaScore !== "number" || typeof brazilScore !== "number") {
      return NextResponse.json({ error: "점수 형식이 올바르지 않습니다." }, { status: 400 });
    }

    await createEventSubmission({
      name: name.trim(),
      corporation,
      department,
      koreaScore,
      brazilScore,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[event/submit]", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
