import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { kvDel } from "@/lib/kv-store";
import { memDel } from "@/lib/mem-cache";

export const dynamic = "force-dynamic";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

export async function POST(req: NextRequest) {
  try {
    const { ids } = await req.json() as { ids: string[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ ok: false, error: "삭제할 ID가 없습니다." }, { status: 400 });
    }
    if (ids.length > 100) {
      return NextResponse.json({ ok: false, error: "한 번에 최대 100건까지 삭제할 수 있습니다." }, { status: 400 });
    }

    const results: { id: string; ok: boolean; error?: string }[] = [];

    for (const id of ids) {
      try {
        await notion.pages.update({ page_id: id, archived: true });
        results.push({ id, ok: true });
      } catch (e) {
        results.push({ id, ok: false, error: String(e) });
      }
    }

    const success = results.filter(r => r.ok).length;
    const failed  = results.filter(r => !r.ok).length;

    if (success > 0) {
      memDel("sw:all");
      await kvDel("sw:all");
    }

    return NextResponse.json({ ok: true, success, failed, results });
  } catch (e) {
    console.error("[API /sw/delete]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
