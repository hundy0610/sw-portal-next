import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookieHeader } from "@/lib/session";
import {
  listWorkTasks,
  createWorkTask,
  updateWorkTaskStatus,
  updateWorkTaskContent,
  updateWorkTaskCollaborators,
  updateWorkTaskShared,
  deleteWorkTask,
  type WorkTask,
} from "@/lib/notion";

function getSuperSession(req: NextRequest) {
  const s = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!s || s.role !== "super") return null;
  return s;
}

export async function GET(req: NextRequest) {
  const s = getSuperSession(req);
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tasks = await listWorkTasks();
  return NextResponse.json({ data: tasks });
}

export async function POST(req: NextRequest) {
  const s = getSuperSession(req);
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  if (body._action === "delete") {
    await deleteWorkTask(body.id);
    return NextResponse.json({ ok: true });
  }

  if (body._action === "status") {
    await updateWorkTaskStatus(body.id, body.status);
    return NextResponse.json({ ok: true });
  }

  if (body._action === "content") {
    await updateWorkTaskContent(body.id, body.title ?? "", body.content ?? "");
    return NextResponse.json({ ok: true });
  }

  if (body._action === "collaborators") {
    await updateWorkTaskCollaborators(body.id, body.collaboratorName ?? "");
    return NextResponse.json({ ok: true });
  }

  if (body._action === "shared") {
    await updateWorkTaskShared(body.id, !!body.shared);
    return NextResponse.json({ ok: true });
  }

  // create
  const data: Omit<WorkTask, "id"> = {
    title:            body.title            ?? "",
    content:          body.content          ?? "",
    collaboratorName: body.collaboratorName ?? "",
    collaboratorId:   body.collaboratorId   ?? "",
    status:           body.status           ?? "할 일",
    createdAt:        new Date().toISOString(),
    parentId:         body.parentId         ?? "",
    shared:           !!body.shared,
  };

  const id = await createWorkTask(data);
  return NextResponse.json({ ok: true, id });
}
