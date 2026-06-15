import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSetPermanent } from "@/lib/kv-store";
import { decodeSession } from "@/lib/session";

// 문의 접수 현황과 담당자 리스트를 공유한다
const ASSIGNEES_KEY = "helpdesk:assignees";

function getSession(req: NextRequest) {
  const token = req.cookies.get("admin_session")?.value;
  if (!token) return null;
  return decodeSession(token);
}

// GET /api/repair-tickets/assignees — 담당자 목록 조회
export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const assignees = (await kvGet<{ id: string; name: string }[]>(ASSIGNEES_KEY)) ?? [];
  return NextResponse.json({ ok: true, assignees });
}

// PUT /api/repair-tickets/assignees — 목록 전체 교체
export async function PUT(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { assignees } = (await req.json()) as { assignees: { id: string; name: string }[] };
  if (!Array.isArray(assignees)) {
    return NextResponse.json({ ok: false, error: "잘못된 형식" }, { status: 400 });
  }

  const invalid = assignees.filter(a => !a.name?.trim());
  if (invalid.length > 0) {
    return NextResponse.json({ ok: false, error: "이름이 비어있는 항목이 있습니다" }, { status: 400 });
  }

  await kvSetPermanent(ASSIGNEES_KEY, assignees);
  return NextResponse.json({ ok: true, assignees });
}
