import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { getSession } from "@/lib/session";

const REQUESTS_KEY = "sw:monitor-requests";

export interface MonitorRequest {
  id: string;
  seatId: string;
  building: string;
  floor: string;
  zone: string;
  type: "repair" | "replace";
  status: "pending" | "in_progress" | "done";
  createdAt: string;
  createdBy: string;   // userId
  createdByName: string;
  note?: string;
  updatedAt?: string;
}

async function getRequests(): Promise<MonitorRequest[]> {
  try {
    if (!process.env.KV_REST_API_URL) return [];
    const data = await kv.get<MonitorRequest[]>(REQUESTS_KEY);
    return data ?? [];
  } catch {
    return [];
  }
}

async function saveRequests(requests: MonitorRequest[]): Promise<void> {
  if (!process.env.KV_REST_API_URL) return;
  // 영구 저장 (TTL 없음) — 요청 기록은 휘발되면 안 됨
  await kv.set(REQUESTS_KEY, requests);
}

// GET /api/monitor-requests — 요청 목록 조회
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const requests = await getRequests();

  // 총무 관리자 or 슈퍼어드민만 전체 조회 가능
  // 일반 사용자는 자기가 낸 요청만
  const managers = await getGeneralManagers();
  const isPrivileged = session.role === "super" || managers.includes(session.userId);

  const filtered = isPrivileged
    ? requests
    : requests.filter(r => r.createdBy === session.userId);

  // 최신 순 정렬
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
    createdByName: session.name,
    note,
  };

  requests.push(newReq);
  await saveRequests(requests);

  return NextResponse.json({ ok: true, request: newReq });
}

// 내부 헬퍼 (general-managers 조회)
async function getGeneralManagers(): Promise<string[]> {
  try {
    if (!process.env.KV_REST_API_URL) return [];
    const data = await kv.get<string[]>("sw:general-managers");
    return data ?? [];
  } catch {
    return [];
  }
}
