import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSetPermanent } from "@/lib/kv-store";
import { decodeSession } from "@/lib/session";
import type { GmDetail } from "@/app/api/admin/accounts/route";

const GM_KEY         = "sw:general-managers";
const GM_DETAILS_KEY = "sw:gm-details";

function getSession(req: NextRequest) {
  const token = req.cookies.get("admin_session")?.value;
  if (!token) return null;
  return decodeSession(token);
}

async function getManagers(): Promise<string[]> {
  try {
    if (!process.env.REDIS_URL) return [];
    return (await kvGet<string[]>(GM_KEY)) ?? [];
  } catch {
    return [];
  }
}

async function getGmDetails(): Promise<GmDetail[]> {
  try {
    if (!process.env.REDIS_URL) return [];
    return (await kvGet<GmDetail[]>(GM_DETAILS_KEY)) ?? [];
  } catch {
    return [];
  }
}

// GET /api/general-managers — 총무 관리자 userId 목록 + 상세(name, email) 조회
export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const [managers, details] = await Promise.all([getManagers(), getGmDetails()]);
  return NextResponse.json({ ok: true, managers, details });
}

// PUT /api/general-managers — 목록 전체 교체 (슈퍼어드민만)
export async function PUT(req: NextRequest) {
  const session = getSession(req);
  if (!session || session.role !== "super") {
    return NextResponse.json({ ok: false, error: "권한 없음" }, { status: 403 });
  }

  const body = await req.json();
  const { managers } = body as { managers: string[] };

  if (!Array.isArray(managers)) {
    return NextResponse.json({ ok: false, error: "잘못된 형식" }, { status: 400 });
  }

  await kvSetPermanent(GM_KEY, managers);
  return NextResponse.json({ ok: true, managers });
}
