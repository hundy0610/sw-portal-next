import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookieHeader } from "@/lib/session";
import {
  listBugReports,
  createBugReport,
  updateBugReportStatus,
  updateBugReportReply,
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
    await updateBugReportReply(body.id, body.reply ?? "", body.status);
    return NextResponse.json({ ok: true });
  }

  // create
  const data: Omit<BugReport, "id" | "screenshotUrls" | "reply"> = {
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
