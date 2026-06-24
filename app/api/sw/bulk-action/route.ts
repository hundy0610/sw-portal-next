import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { kvDel } from "@/lib/kv-store";
import { memDel } from "@/lib/mem-cache";
import { getSessionFromCookieHeader } from "@/lib/session";

export const dynamic = "force-dynamic";
const notion = new Client({ auth: process.env.NOTION_TOKEN });

function addOneMonth(dateStr: string): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const { ids, action } = await req.json() as { ids: string[]; action: "renew" | "expire" };

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ ok: false, error: "ids 필수" }, { status: 400 });
    }
    if (!["renew", "expire"].includes(action)) {
      return NextResponse.json({ ok: false, error: "action은 renew 또는 expire" }, { status: 400 });
    }

    let success = 0, failed = 0;

    for (const id of ids) {
      try {
        if (action === "renew") {
          // 현재 갱신일 조회 후 +1개월
          const page = await notion.pages.retrieve({ page_id: id }) as any;
          const currentDate = page.properties["갱신필요일"]?.date?.start ?? "";
          const base = currentDate || new Date().toISOString().slice(0, 10);
          const newDate = addOneMonth(base);

          await notion.pages.update({
            page_id: id,
            properties: {
              "갱신필요일": { date: { start: newDate } },
              "사용/재고/만료/갱신필요/신규등록": { select: { name: "사용중" } },
            } as Parameters<typeof notion.pages.update>[0]["properties"],
          });
        } else {
          // expire: 상태 → 만료
          await notion.pages.update({
            page_id: id,
            properties: {
              "사용/재고/만료/갱신필요/신규등록": { select: { name: "만료" } },
            } as Parameters<typeof notion.pages.update>[0]["properties"],
          });
        }
        success++;
      } catch {
        failed++;
      }
      if (ids.indexOf(id) < ids.length - 1) {
        await new Promise(r => setTimeout(r, 350));
      }
    }

    if (success > 0) {
      memDel("sw:all");
      await kvDel("sw:all");
    }

    return NextResponse.json({ ok: true, success, failed, action });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
