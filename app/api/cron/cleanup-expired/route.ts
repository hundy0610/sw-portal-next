import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { fetchSwDatabase } from "@/lib/notion";
import { kvDel } from "@/lib/kv-store";
import { memDel } from "@/lib/mem-cache";

export const dynamic = "force-dynamic";
const notion = new Client({ auth: process.env.NOTION_TOKEN });

export async function GET() {
  try {
    const data = await fetchSwDatabase();

    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    // 만료 상태 + 최종수정일이 2주 이상 지난 레코드
    const toDelete = data.filter(r => {
      if (r.status !== "만료") return false;
      if (!r.lastModifiedAt) return false;
      return new Date(r.lastModifiedAt) < twoWeeksAgo;
    });

    let deleted = 0, errors = 0;
    for (const r of toDelete) {
      try {
        await notion.pages.update({ page_id: r.id, archived: true });
        deleted++;
        await new Promise(res => setTimeout(res, 350));
      } catch {
        errors++;
      }
    }

    if (deleted > 0) {
      memDel("sw:all");
      await kvDel("sw:all");
    }

    return NextResponse.json({
      ok: true,
      checked: toDelete.length,
      deleted,
      errors,
      deletedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
