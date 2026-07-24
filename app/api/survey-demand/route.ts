import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookieHeader } from "@/lib/session";
import { readEntity, upsertEntity, deleteEntity, isMirrorEnabled } from "@/lib/repo/mirror";

export const dynamic = "force-dynamic";

const SD_ENTITY = "survey-demand";

export interface SurveyDemandRecord {
  id: string;
  name: string;
  company: string;
  department: string;
  email: string;
  purpose: string[];
  language: string[];
  frequency: string;
  note: string;
  submittedAt: string;
  notionUrl: string;
}

// ── POST: 설문 응답 제출 (인증 불필요) ───────────────────────────────
// 4.0verMACBOOK: 맥북 Postgres 미러(entity "survey-demand")에 직접 기록.
export async function POST(req: NextRequest) {
  if (!isMirrorEnabled() && !process.env.NOTION_TOKEN) {
    return NextResponse.json({ ok: false, error: "설문 저장소가 설정되지 않았습니다." }, { status: 503 });
  }

  try {
    const { company, department, name, email, purpose, language, frequency, note } = await req.json();

    if (!name?.trim())              return NextResponse.json({ ok: false, error: "성함을 입력해 주세요." }, { status: 400 });
    if (!company?.trim())           return NextResponse.json({ ok: false, error: "소속 법인을 입력해 주세요." }, { status: 400 });
    if (!department?.trim())        return NextResponse.json({ ok: false, error: "부서명을 입력해 주세요." }, { status: 400 });
    if (!email?.trim())             return NextResponse.json({ ok: false, error: "이메일 주소를 입력해 주세요." }, { status: 400 });
    if (!Array.isArray(purpose) || purpose.length === 0)
      return NextResponse.json({ ok: false, error: "사용 목적을 하나 이상 선택해 주세요." }, { status: 400 });
    if (!Array.isArray(language) || language.length === 0)
      return NextResponse.json({ ok: false, error: "주요 언어를 하나 이상 선택해 주세요." }, { status: 400 });
    if (!frequency?.trim())         return NextResponse.json({ ok: false, error: "사용 주기를 선택해 주세요." }, { status: 400 });

    const id = crypto.randomUUID();
    const record: SurveyDemandRecord = {
      id,
      name: name.trim(),
      company: company.trim(),
      department: department.trim(),
      email: email.trim(),
      purpose: purpose as string[],
      language: language as string[],
      frequency: frequency.trim(),
      note: (note ?? "").trim(),
      submittedAt: new Date().toISOString(),
      notionUrl: "",
    };
    const ok = await upsertEntity(SD_ENTITY, id, record);
    if (!ok) return NextResponse.json({ ok: false, error: "설문 저장 실패(Postgres)" }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[survey-demand POST]", e);
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}

// ── GET: 설문 응답 목록 조회 (관리자 인증 필요) ──────────────────────
export async function GET(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const rows = (await readEntity<SurveyDemandRecord>(SD_ENTITY)) ?? [];
    const data = [...rows]
      .sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""))
      .map((r) => ({
        id: r.id,
        name: r.name,
        company: r.company,
        department: r.department,
        email: r.email,
        purpose: (r.purpose ?? []).join(", "),
        language: (r.language ?? []).join(", "),
        frequency: r.frequency,
        note: r.note,
        submittedAt: r.submittedAt,
        notionUrl: r.notionUrl,
      }));

    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}

// ── DELETE: 응답 삭제 (관리자) ────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ ok: false, error: "id 필수" }, { status: 400 });
    await deleteEntity(SD_ENTITY, id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
