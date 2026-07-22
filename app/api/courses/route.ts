import { NextRequest, NextResponse } from "next/server";
import { getCourses, saveCourses } from "@/lib/portal-store";
import { getSessionFromCookieHeader, resolveCurrentRole } from "@/lib/session";
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

  if (body._action === "delete") {
    await saveCourses(all.filter(c => c.id !== body.id));
    return NextResponse.json({ ok: true });
  }

  if (body._action === "update") {
    await saveCourses(all.map(c => c.id === body.id ? { ...c, ...body.data } : c));
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
  return NextResponse.json({ ok: true, id: course.id });
}
