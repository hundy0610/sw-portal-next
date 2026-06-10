import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookieHeader } from "@/lib/session";
import {
  listBugReports,
  createBugReport,
  updateBugReportStatus,
  updateBugReportReply,
  updateBugReportHandler,
  deleteBugReport,
  type BugReport,
} from "@/lib/notion";

function getAdminSession(req: NextRequest) {
  const s = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!s) return null;
  return s;
}

export async function GET(req: NextRequest) {
  const s = getAdminSession(req);
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const reports = await listBugReports();
  return NextResponse.json({ data: reports });
}

export async function POST(req: NextRequest) {
  const s = getAdminSession(req);
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  if (body._action === "delete") {
    await deleteBugReport(body.id);
    return NextResponse.json({ ok: true });
  }

  if (body._action === "status") {
    await updateBugReportStatus(body.id, body.status);
    return NextResponse.json({ ok: true });
  }

  if (body._action === "reply") {
    const text = body.text ?? "";
    const formatted = `[${s.userId}|${s.name}]\n${text}`;
    const newReply = body.currentReply
      ? body.currentReply + "\n---\n" + formatted
      : formatted;
    await updateBugReportReply(body.id, newReply, body.status);
    return NextResponse.json({ ok: true, message: formatted });
  }

  if (body._action === "handler") {
    await updateBugReportHandler(body.id, s.name, s.userId);
    return NextResponse.json({ ok: true, handler: s.name, handlerId: s.userId });
  }

  // create
  const data: Omit<BugReport, "id" | "screenshotUrls" | "reply" | "handler" | "handlerId"> = {
    title:        body.title        ?? "",
    content:      body.content      ?? "",
    page:         body.page         ?? "",
    feature:      body.feature      ?? "",
    type:         body.type         ?? "버그",
    reporterName: s.name            ?? "",
    reporterId:   s.userId          ?? "",
    status:       "접수됨",
    createdAt:    new Date().toISOString(),
  };

  const id = await createBugReport(data, body.fileUploadIds ?? (body.fileUploadId ? [body.fileUploadId] : []));
  return NextResponse.json({ ok: true, id });
}
