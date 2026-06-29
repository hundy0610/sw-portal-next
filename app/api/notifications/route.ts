import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSetPermanent } from "@/lib/kv-store";
import { getSessionFromCookieHeader } from "@/lib/session";
import { buildNotifications } from "@/lib/notifications";

export const dynamic = "force-dynamic";

function readKey(userId: string) {
  return `notification:read:${userId}`;
}

// GET /api/notifications — 슈퍼어드민 전용 인앱 알림 목록 + 읽음 상태
export async function GET(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (session.role !== "super") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  try {
    const items = await buildNotifications(session);
    const readMap = (await kvGet<Record<string, string>>(readKey(session.userId))) ?? {};

    // 조건이 해소되어 더 이상 존재하지 않는 알림의 읽음 기록은 정리
    const activeIds = new Set(items.map(n => n.id));
    const prunedMap: Record<string, string> = {};
    for (const [id, readAt] of Object.entries(readMap)) {
      if (activeIds.has(id)) prunedMap[id] = readAt;
    }
    if (Object.keys(prunedMap).length !== Object.keys(readMap).length) {
      await kvSetPermanent(readKey(session.userId), prunedMap);
    }

    const notifications = items.map(n => ({ ...n, read: !!prunedMap[n.id] }));
    const unreadCount = notifications.filter(n => !n.read).length;

    return NextResponse.json({ ok: true, notifications, unreadCount });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "오류가 발생했습니다." }, { status: 500 });
  }
}

// POST /api/notifications — 알림 읽음 처리 ({ ids: string[] } 또는 { all: true })
export async function POST(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (session.role !== "super") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json() as { ids?: string[]; all?: boolean };
    const readMap = (await kvGet<Record<string, string>>(readKey(session.userId))) ?? {};
    const now = new Date().toISOString();

    if (body.all) {
      const items = await buildNotifications(session);
      for (const item of items) readMap[item.id] = now;
    } else if (Array.isArray(body.ids)) {
      for (const id of body.ids) readMap[id] = now;
    }

    await kvSetPermanent(readKey(session.userId), readMap);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "오류가 발생했습니다." }, { status: 500 });
  }
}
