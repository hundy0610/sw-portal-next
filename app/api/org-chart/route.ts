import { NextRequest, NextResponse } from "next/server";
import { fetchOrgUnits, createOrgUnit, updateOrgUnit, archiveOrgUnit, isOrgChartConfigured, type OrgUnit } from "@/lib/org-chart";
import { getSessionFromCookieHeader, resolveCurrentRole, resolveCurrentName } from "@/lib/session";
import { appendAdminAuditLog } from "@/lib/portal-store";
import { errorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

async function getSuperSession(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session || (await resolveCurrentRole(session)) !== "super") return null;
  return session;
}

export async function GET(req: NextRequest) {
  const session = await getSuperSession(req);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  try {
    const data = await fetchOrgUnits();
    return NextResponse.json({ ok: true, data, sample: !isOrgChartConfigured() });
  } catch (e) {
    return NextResponse.json({ ok: false, data: [], error: errorMessage(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSuperSession(req);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!isOrgChartConfigured()) {
    return NextResponse.json({ ok: false, error: "샘플 데이터 모드입니다 — 실제 조직도 Notion DB 연결 후 편집할 수 있습니다." }, { status: 409 });
  }

  try {
    const body = await req.json();
    const adminName = await resolveCurrentName(session);

    if (body._action === "delete") {
      await archiveOrgUnit(body.id);
      await appendAdminAuditLog({ adminId: session.userId, adminName, action: "delete", target: "orgChart", itemTitle: `조직도: ${body.id}`, timestamp: new Date().toISOString() });
      return NextResponse.json({ ok: true });
    }

    if (body._action === "update") {
      await updateOrgUnit(body.id, body.data as Partial<OrgUnit>);
      await appendAdminAuditLog({ adminId: session.userId, adminName, action: "update", target: "orgChart", itemTitle: `조직도: ${body.data?.name ?? body.id}`, timestamp: new Date().toISOString() });
      return NextResponse.json({ ok: true });
    }

    // create
    const id = await createOrgUnit({
      name: body.name ?? "",
      company: body.company ?? "",
      level: body.level ?? "팀",
      parentId: body.parentId ?? null,
      managerEmail: body.managerEmail ?? "",
      managerName: body.managerName ?? "",
      members: body.members ?? [],
    });
    await appendAdminAuditLog({ adminId: session.userId, adminName, action: "create", target: "orgChart", itemTitle: `조직도: ${body.name ?? ""}`, timestamp: new Date().toISOString() });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("[API /org-chart]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
