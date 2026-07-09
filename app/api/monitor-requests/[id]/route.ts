import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSetPermanent } from "@/lib/kv-store";
import { decodeSession, resolveCurrentName, resolveCurrentRole } from "@/lib/session";
import { createMailTransporter, buildMonitorCompleteEmail } from "@/lib/mail";
import type { MonitorRequest } from "../route";

function getSession(req: NextRequest) {
  const token = req.cookies.get("admin_session")?.value;
  if (!token) return null;
  return decodeSession(token);
}

const REQUESTS_KEY = "sw:monitor-requests";
const GM_KEY       = "sw:general-managers";

async function getRequests(): Promise<MonitorRequest[]> {
  try {
    if (!process.env.REDIS_URL) return [];
    return (await kvGet<MonitorRequest[]>(REQUESTS_KEY)) ?? [];
  } catch {
    return [];
  }
}

async function saveRequests(requests: MonitorRequest[]): Promise<void> {
  if (!process.env.REDIS_URL) return;
  await kvSetPermanent(REQUESTS_KEY, requests);
}

async function getGeneralManagers(): Promise<string[]> {
  try {
    if (!process.env.REDIS_URL) return [];
    return (await kvGet<string[]>(GM_KEY)) ?? [];
  } catch {
    return [];
  }
}

// 슈퍼어드민에게 완료 이메일 발송
async function notifySuperAdmins(request: MonitorRequest, completedBy: string) {
  try {
    const superEmail = process.env.SUPER_ADMIN_EMAIL;
    if (!superEmail) return;

    const transporter = createMailTransporter();
    if (!transporter) return;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://swportal.vercel.app";
    const html = buildMonitorCompleteEmail({
      building: request.building,
      floor: request.floor,
      zone: request.zone,
      seatId: request.seatId,
      requestType: request.type,
      completedBy,
      appUrl,
    });

    await transporter.sendMail({
      from: `"SW 포털 자산관리" <${process.env.GMAIL_USER}>`,
      to: superEmail,
      subject: `[자산관리] 모니터 ${request.type === "repair" ? "수리" : "교체"} 완료 — ${request.building} ${request.floor} ${request.zone}`,
      html,
    });
  } catch (e) {
    console.error("[notifySuperAdmins]", e);
  }
}

// PATCH /api/monitor-requests/[id] — 상태 변경
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const managers = await getGeneralManagers();
  const role = await resolveCurrentRole(session);
  const isPrivileged = role === "super" || role === "general" || managers.includes(session.userId);
  if (!isPrivileged) {
    return NextResponse.json({ ok: false, error: "권한 없음" }, { status: 403 });
  }

  const body = await req.json();
  const { status } = body as { status: MonitorRequest["status"] };

  if (!["pending", "in_progress", "done"].includes(status)) {
    return NextResponse.json({ ok: false, error: "잘못된 상태값" }, { status: 400 });
  }

  const requests = await getRequests();
  const idx = requests.findIndex(r => r.id === params.id);
  if (idx === -1) {
    return NextResponse.json({ ok: false, error: "요청 없음" }, { status: 404 });
  }

  const prevStatus = requests[idx].status;
  requests[idx] = {
    ...requests[idx],
    status,
    updatedAt: new Date().toISOString(),
  };
  await saveRequests(requests);

  // 완료(done) 로 변경된 경우 슈퍼어드민에게 이메일 (비동기)
  if (status === "done" && prevStatus !== "done") {
    resolveCurrentName(session).then(name => notifySuperAdmins(requests[idx], name)).catch(() => {});
  }

  return NextResponse.json({ ok: true, request: requests[idx] });
}

// DELETE /api/monitor-requests/[id] — 완료된 요청 삭제 (슈퍼어드민만)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession(req);
  if (!session || (await resolveCurrentRole(session)) !== "super") {
    return NextResponse.json({ ok: false, error: "권한 없음" }, { status: 403 });
  }

  const requests = await getRequests();
  const filtered = requests.filter(r => r.id !== params.id);
  await saveRequests(filtered);

  return NextResponse.json({ ok: true });
}
