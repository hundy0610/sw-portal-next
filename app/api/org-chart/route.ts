import { NextRequest, NextResponse } from "next/server";
import { fetchOrgUnits, createOrgUnit, updateOrgUnit, archiveOrgUnit, type OrgUnit } from "@/lib/org-chart";
import { getSessionFromCookieHeader, resolveCurrentRole } from "@/lib/session";
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
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return NextResponse.json({ ok: false, data: [], error: errorMessage(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSuperSession(req);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();

    if (body._action === "delete") {
      await archiveOrgUnit(body.id);
      return NextResponse.json({ ok: true });
    }

    if (body._action === "update") {
      await updateOrgUnit(body.id, body.data as Partial<OrgUnit>);
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
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("[API /org-chart]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
