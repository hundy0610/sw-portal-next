import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { decodeSession } from "@/lib/session";
import { cookies } from "next/headers";

/**
 * POST /api/admin/revalidate
 *
 * 어드민이 "새로고침" 버튼을 누르면 지정된 캐시 태그를 즉시 무효화.
 * 다음 요청 시 Notion에서 최신 데이터를 가져옴.
 *
 * Body: { tags: ["hw-records", "sw-records", "license-records"] }
 *   또는 tags 생략 시 전체 무효화
 */

const ALL_TAGS = ["hw-records", "sw-records", "license-records"];

export async function POST(request: NextRequest) {
  // 세션 확인 (로그인한 어드민만 허용)
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("admin_session")?.value;
  if (!sessionCookie) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = decodeSession(sessionCookie);
  if (!session) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const tags: string[] = body.tags ?? ALL_TAGS;

    // 요청한 태그만 무효화
    const invalidated: string[] = [];
    for (const tag of tags) {
      if (ALL_TAGS.includes(tag)) {
        revalidateTag(tag);
        invalidated.push(tag);
      }
    }

    return NextResponse.json({
      ok: true,
      invalidated,
      message: `${invalidated.length}개 캐시가 초기화되었습니다. 다음 조회 시 최신 데이터를 가져옵니다.`,
    });
  } catch (e: any) {
    console.error("[revalidate]", e?.message);
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
