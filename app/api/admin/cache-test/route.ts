import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { memDel } from "@/lib/mem-cache";
import { kvDel } from "@/lib/kv-store";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID = process.env.NOTION_DB_SW_UNIFIED!;

// POST: Notion에 테스트 레코드 생성 (캐시 무효화 없음)
// DELETE: 테스트 레코드 삭제 + 캐시 정리
export async function POST() {
  const marker = `__cache_test_${Date.now()}`;
  const page = await notion.pages.create({
    parent: { database_id: DB_ID },
    properties: {
      "사용자": { title: [{ text: { content: marker } }] },
      "SW대분류": { select: { name: "__TEST__" } },
    },
  });
  return NextResponse.json({ ok: true, pageId: page.id, marker, createdAt: new Date().toISOString() });
}

export async function DELETE(req: NextRequest) {
  const { pageId } = await req.json();
  if (pageId) {
    await notion.pages.update({ page_id: pageId, archived: true });
  }
  memDel("sw:all");
  await kvDel("sw:all");
  return NextResponse.json({ ok: true, cleaned: true });
}
