import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSetPermanent } from "@/lib/kv-store";
import { decodeSession, resolveCurrentName, resolveCurrentRole } from "@/lib/session";
import { createMailTransporter, buildMonitorRepairEmail } from "@/lib/mail";
import type { GmDetail } from "@/app/api/admin/accounts/route";

function getSession(req: NextRequest) {
  const token = req.cookies.get("admin_session")?.value;
  if (!token) return null;
  return decodeSession(token);
}

const REQUESTS_KEY = "sw:monitor-requests";
const GM_KEY       = "sw:general-managers";
const GM_DETAILS_KEY = "sw:gm-details";

export interface MonitorRequest {
  id: string;
  seatId: string;
  building: string;
  floor: string;
  zone: string;
  type: "repair" | "replace";
  status: "pending" | "in_progress" | "done";
  createdAt: string;
  createdBy: string;
  createdByName: string;
  note?: string;
  updatedAt?: string;
}

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

// 총무관리자에게 이메일 발송
async function notifyGMs(request: MonitorRequest) {
  try {
    if (!process.env.REDIS_URL) return;
    const details = (await kvGet<GmDetail[]>(GM_DETAILS_KEY)) ?? [];
    const emails = details.map(d => d.email).filter(Boolean);
    if (emails.length === 0) return;

    const transporter = createMailTransporter();
    if (!transporter) return;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://swportal.vercel.app";
    const html = buildMonitorRepairEmail({
      building: request.building,
      floor: request.floor,
      zone: request.zone,
      seatId: request.seatId,
      requestType: request.type,
      requestedBy: request.createdByName,
      note: request.note,
      appUrl,
    });

    await transporter.sendMail({
      from: `"SW 포털 자산관리" <${process.env.GMAIL_USER}>`,
      to: emails.join(", "),
      subject: `[자산관리] 모니터 ${request.type === "repair" ? "수리" : "교체"} 요청 — ${request.building} ${request.floor} ${request.zone}`,
      html,
    });
  } catch (e) {
    console.error("[notifyGMs]", e);
  }
}

// GET /api/monitor-requests — 요청 목록 조회
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const requests = await getRequests();
  const managers = await getGeneralManagers();
  const role = await resolveCurrentRole(session);
  const isPrivileged = role === "super" || role === "general" || managers.includes(session.userId);

  const filtered = isPrivileged
    ? requests
    : requests.filter(r => r.createdBy === session.userId);

  filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return NextResponse.json({ ok: true, requests: filtered });
}

// POST /api/monitor-requests — 새 요청 등록
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { seatId, building, floor, zone, type, note } = body;

  if (!seatId || !building || !floor || !zone || !type) {
    return NextResponse.json({ ok: false, error: "필수 항목 누락" }, { status: 400 });
  }

  const requests = await getRequests();
  const newReq: MonitorRequest = {
    id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    seatId,
    building,
    floor,
    zone,
    type,
    status: "pending",
    createdAt: new Date().toISOString(),
    createdBy: session.userId,
    createdByName: await resolveCurrentName(session),
    note,
  };

  requests.push(newReq);
  await saveRequests(requests);

  // 총무관리자에게 이메일 알림 (비동기, 실패해도 요청 등록은 성공)
  notifyGMs(newReq).catch(() => {});

  return NextResponse.json({ ok: true, request: newReq });
}
