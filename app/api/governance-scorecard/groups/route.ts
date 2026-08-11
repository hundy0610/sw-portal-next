import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/api-error";
import { getSessionFromCookieHeader, resolveCurrentRole } from "@/lib/session";
import { getCompanyGroups, saveCompanyGroups, type CompanyGroupMap } from "@/lib/governance-groups";

export const dynamic = "force-dynamic";

async function requireSuper(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session) return { error: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  if ((await resolveCurrentRole(session)) !== "super") {
    return { error: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }) };
  }
  return {};
}

// GET /api/governance-scorecard/groups — 법인→그룹 매핑 조회
export async function GET(req: NextRequest) {
  const gate = await requireSuper(req);
  if (gate.error) return gate.error;
  try {
    return NextResponse.json({ ok: true, groups: await getCompanyGroups() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

// POST /api/governance-scorecard/groups — 전체 교체 저장
export async function POST(req: NextRequest) {
  const gate = await requireSuper(req);
  if (gate.error) return gate.error;
  try {
    const body = (await req.json()) as { groups: CompanyGroupMap };
    if (!body.groups || typeof body.groups !== "object") {
      return NextResponse.json({ ok: false, error: "groups 필수" }, { status: 400 });
    }
    if (!(await saveCompanyGroups(body.groups))) {
      return NextResponse.json({ ok: false, error: "저장에 실패했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, groups: await getCompanyGroups() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
