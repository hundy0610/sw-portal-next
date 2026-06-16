import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID = process.env.NOTION_DB_SW_UNIFIED!;

export async function POST(req: NextRequest) {
  if (!process.env.NOTION_TOKEN || !DB_ID) {
    return NextResponse.json({ ok: false, error: "환경변수 미설정" }, { status: 503 });
  }

  const { users, usageDate, company } = await req.json() as {
    users?: string[];
    usageDate?: string;
    company?: string;
  };

  const filterConditions: any[] = [];
  if (company) filterConditions.push({ property: "법인명", select: { equals: company } });
  if (usageDate) filterConditions.push({ property: "사용일자", date: { equals: usageDate } });

  const baseFilter = filterConditions.length > 0 ? { and: filterConditions } : undefined;

  let targetPageIds: string[] = [];

  if (users && users.length > 0) {
    for (const userName of users) {
      const userFilter: any = { property: "사용자", title: { equals: userName } };
      const combinedFilter = baseFilter ? { and: [userFilter, ...filterConditions] } : userFilter;
      let cursor: string | undefined;
      do {
        const resp = await notion.databases.query({ database_id: DB_ID, filter: combinedFilter, start_cursor: cursor, page_size: 100 });
        targetPageIds.push(...resp.results.map((p) => p.id));
        cursor = resp.has_more ? (resp.next_cursor ?? undefined) : undefined;
      } while (cursor);
    }
  } else if (baseFilter) {
    let cursor: string | undefined;
    do {
      const resp = await notion.databases.query({ database_id: DB_ID, filter: baseFilter, start_cursor: cursor, page_size: 100 });
      targetPageIds.push(...resp.results.map((p) => p.id));
      cursor = resp.has_more ? (resp.next_cursor ?? undefined) : undefined;
    } while (cursor);
  }

  targetPageIds = [...new Set(targetPageIds)];
  if (targetPageIds.length === 0) return NextResponse.json({ ok: true, archived: 0, message: "삭제 대상 없음" });

  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (let i = 0; i < targetPageIds.length; i++) {
    const pageId = targetPageIds[i];
    try {
      await notion.pages.update({ page_id: pageId, archived: true });
      results.push({ id: pageId, ok: true });
    } catch (e) {
      results.push({ id: pageId, ok: false, error: String(e) });
    }
    if (i < targetPageIds.length - 1) await new Promise(r => setTimeout(r, 300));
  }

  return NextResponse.json({ ok: true, archived: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length, results });
}
