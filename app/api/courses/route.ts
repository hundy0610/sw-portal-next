import { NextRequest, NextResponse } from "next/server";
import { getCourses, saveCourses, appendAuditLog, summarizeChanges } from "@/lib/portal-store";
import { getSessionFromCookieHeader, resolveCurrentName, resolveCurrentRole } from "@/lib/session";
import type { Course } from "@/types/portal";

async function getSuperSession(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session || (await resolveCurrentRole(session)) !== "super") return null;
  return session;
}

export async function GET(req: NextRequest) {
  const all = req.nextUrl.searchParams.get("all") === "1";
  if (all && !(await getSuperSession(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const courses = await getCourses(!all);
  return NextResponse.json({ data: courses });
}

export async function POST(req: NextRequest) {
  const session = await getSuperSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const all = await getCourses(false);
  const adminName = await resolveCurrentName(session);

  if (body._action === "delete") {
    const target = all.find(c => c.id === body.id);
    await saveCourses(all.filter(c => c.id !== body.id));
    await appendAuditLog({
      adminId: session.userId, adminName,
      action: "delete", target: "courses",
      itemTitle: target?.title ?? body.id,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  }

  if (body._action === "update") {
    const target = all.find(c => c.id === body.id);
    await saveCourses(all.map(c => c.id === body.id ? { ...c, ...body.data } : c));
    const detail = summarizeChanges(target, body.data, [
      { key: "title",   label: "제목" },
      { key: "visible", label: "공개 여부", format: v => (v ? "공개" : "숨김") },
      { key: "category", label: "분류" },
    ]);
    await appendAuditLog({
      adminId: session.userId, adminName,
      action: "update", target: "courses",
      itemTitle: body.data?.title ?? target?.title ?? body.id,
      detail,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  }

  // create
  const course: Course = {
    id:           `c_${Date.now()}`,
    title:        body.title        ?? "",
    description:  body.description  ?? "",
    deadline:     body.deadline     ?? "",
    duration:     body.duration     ?? "",
    courseUrl:    body.courseUrl    ?? "",
    category:     body.category     ?? "required",
    thumbnailUrl: body.thumbnailUrl ?? "",
    order:        body.order        ?? all.length,
    visible:      body.visible      ?? true,
    createdAt:    new Date().toISOString(),
  };
  await saveCourses([...all, course]);
  await appendAuditLog({
    adminId: session.userId, adminName,
    action: "create", target: "courses",
    itemTitle: course.title,
    timestamp: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true, id: course.id });
}
