import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSetPermanent } from "@/lib/kv-store";
import { getSessionFromCookieHeader, resolveCurrentRole } from "@/lib/session";
import { buildNotifications } from "@/lib/notifications";

export const dynamic = "force-dynamic";

function readKey(userId: string) {
  return `notification:read:${userId}`;
}

function firstSeenKey(userId: string) {
  return `notification:first-seen:${userId}`;
}

// GET /api/notifications — 슈퍼어드민 전용 인앱 알림 목록 + 읽음 상태
// 알림 종류마다 의미가 다른 날짜(갱신일·반납예정일·접수일 등)를 그대로 비교하면
// 순서가 뒤섞이므로, "이 알림을 처음 발견한 시각" 기준 최신순으로 정렬한다.
export async function GET(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if ((await resolveCurrentRole(session)) !== "super") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  try {
    const items = await buildNotifications(session);
    const activeIds = new Set(items.map(n => n.id));

    // 읽음 기록 정리 (조건 해소된 알림은 제거)
    const readMap = (await kvGet<Record<string, string>>(readKey(session.userId))) ?? {};
    const prunedReadMap: Record<string, string> = {};
    for (const [id, readAt] of Object.entries(readMap)) {
      if (activeIds.has(id)) prunedReadMap[id] = readAt;
    }
    if (Object.keys(prunedReadMap).length !== Object.keys(readMap).length) {
      await kvSetPermanent(readKey(session.userId), prunedReadMap);
    }

    // 최초 발견 시각 갱신 (신규 id는 지금 시각 기록, 사라진 id는 정리)
    const firstSeenMap = (await kvGet<Record<string, string>>(firstSeenKey(session.userId))) ?? {};
    const now = new Date().toISOString();
    const nextFirstSeenMap: Record<string, string> = {};
    let firstSeenChanged = false;
    for (const id of activeIds) {
      if (firstSeenMap[id]) {
        nextFirstSeenMap[id] = firstSeenMap[id];
      } else {
        nextFirstSeenMap[id] = now;
        firstSeenChanged = true;
      }
    }
    if (firstSeenChanged || Object.keys(nextFirstSeenMap).length !== Object.keys(firstSeenMap).length) {
      await kvSetPermanent(firstSeenKey(session.userId), nextFirstSeenMap);
    }

    const notifications = items
      .map(n => ({ ...n, read: !!prunedReadMap[n.id], firstSeenAt: nextFirstSeenMap[n.id] }))
      .sort((a, b) => b.firstSeenAt.localeCompare(a.firstSeenAt));
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
  if ((await resolveCurrentRole(session)) !== "super") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

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
