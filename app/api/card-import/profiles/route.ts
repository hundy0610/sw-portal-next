import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookieHeader, resolveCurrentName, resolveCurrentRole } from "@/lib/session";
import { errorMessage } from "@/lib/api-error";
import { listProfiles, saveProfile, deleteProfile, profileId, type ImportProfile } from "@/lib/card-import";

export const dynamic = "force-dynamic";

// 카드명세 컬럼 매핑 프로필은 그룹 전체 재무 데이터 취급 기준이라 슈퍼어드민 전용.
async function requireSuper(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session) return { error: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  if ((await resolveCurrentRole(session)) !== "super") {
    return { error: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

// GET /api/card-import/profiles — 저장된 매핑 프로필 전체
export async function GET(req: NextRequest) {
  const gate = await requireSuper(req);
  if (gate.error) return gate.error;
  try {
    return NextResponse.json({ ok: true, profiles: await listProfiles() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

// POST /api/card-import/profiles — 매핑 프로필 생성/수정
export async function POST(req: NextRequest) {
  const gate = await requireSuper(req);
  if (gate.error) return gate.error;
  try {
    const body = (await req.json()) as Pick<ImportProfile, "company" | "source" | "headerRow" | "mapping">;
    const company = (body.company ?? "").trim();
    const source  = (body.source ?? "").trim();
    if (!company || !source) {
      return NextResponse.json({ ok: false, error: "법인과 소스명은 필수입니다." }, { status: 400 });
    }
    if (body.mapping?.company === undefined || body.mapping?.paidAt === undefined || body.mapping?.amount === undefined) {
      return NextResponse.json({ ok: false, error: "법인·결제일·금액 컬럼은 반드시 매핑해야 합니다." }, { status: 400 });
    }

    const profile: ImportProfile = {
      id: profileId(company, source),
      company,
      source,
      headerRow: Number(body.headerRow) > 0 ? Number(body.headerRow) : 1,
      mapping: body.mapping,
      updatedAt: new Date().toISOString(),
      updatedBy: `${await resolveCurrentName(gate.session!)} (${gate.session!.userId})`,
    };

    if (!(await saveProfile(profile))) {
      return NextResponse.json({ ok: false, error: "매핑 저장에 실패했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, profile });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

// DELETE /api/card-import/profiles?id=... — 매핑 초기화(다음 업로드 시 다시 설정)
export async function DELETE(req: NextRequest) {
  const gate = await requireSuper(req);
  if (gate.error) return gate.error;
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, error: "id 필수" }, { status: 400 });
    if (!(await deleteProfile(id))) {
      return NextResponse.json({ ok: false, error: "삭제에 실패했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
