import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { decodeSession } from "@/lib/session";

const GM_KEY = "sw:general-managers";

function getSession(req: NextRequest) {
  const token = req.cookies.get("admin_session")?.value;
  if (!token) return null;
  return decodeSession(token);
}

async function getManagers(): Promise<string[]> {
  try {
    if (!process.env.KV_REST_API_URL) return [];
    const data = await kv.get<string[]>(GM_KEY);
    return data ?? [];
  } catch {
    return [];
  }
}

// GET /api/general-managers — 총무 관리자 userId 목록 조회
export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const managers = await getManagers();
  return NextResponse.json({ ok: true, managers });
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

  await kv.set(GM_KEY, managers);
  return NextResponse.json({ ok: true, managers });
}
