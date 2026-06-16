import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { memDel } from "@/lib/mem-cache";
import { kvDel } from "@/lib/kv-store";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

export async function POST(req: NextRequest) {
  const { ids }: { ids: string[] } = await req.json();
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
  if (success > 0) {
    memDel("sw:all");
    await kvDel("sw:all");
  }

  return NextResponse.json({ ok: true, archived: success, failed: results.filter(r => !r.ok).length, results });
}
