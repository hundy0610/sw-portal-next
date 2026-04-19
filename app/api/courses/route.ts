import { NextRequest, NextResponse } from "next/server";
import { getCourses, saveCourses } from "@/lib/portal-store";
import type { Course } from "@/types/portal";

function authOk(req: NextRequest) {
  const key = req.headers.get("x-manage-key");
  return key && key === process.env.MANAGE_SECRET_KEY;
}

export async function GET(req: NextRequest) {
  const all = req.nextUrl.searchParams.get("all") === "1";
  if (all && !authOk(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const courses = await getCourses(!all);
  return NextResponse.json({ data: courses });
}

export async function POST(req: NextRequest) {
  if (!authOk(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const all = await getCourses(false);

  if (body._action === "delete") {
    const updated = all.filter(c => c.id !== body.id);
    await saveCourses(updated);
    return NextResponse.json({ ok: true });
  }

  if (body._action === "update") {
    const updated = all.map(c => c.id === body.id ? { ...c, ...body.data } : c);
    await saveCourses(updated);
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
