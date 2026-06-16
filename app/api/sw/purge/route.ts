import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID = process.env.NOTION_DB_SW_UNIFIED!;

export async function POST(req: NextRequest) {
  if (!process.env.NOTION_TOKEN || !DB_ID) {
    return NextResponse.json({ ok: false, error: "환경변수 미설정" }, { status: 503 });
  }
  const { users, usageDate, company } = await req.json() as { users?: string[]; usageDate?: string; company?: string };
  const filterConditions: any[] = [];
  if (company) filterConditions.push({ property: "법인명", select: { equals: company } });
  if (usageDate) filterConditions.push({ property: "사용일자", date: { equals: usageDate } });
  const baseFilter = filterConditions.length > 0 ? { and: filterConditions } : undefined;
  let ids: string[] = [];
  if (users && users.length > 0) {
    for (const u of users) {
      const f: any = { property: "사용자", title: { equals: u } };
      const cf = baseFilter ? { and: [f, ...filterConditions] } : f;
      let cur: string | undefined;
      do {
        const r = await notion.databases.query({ database_id: DB_ID, filter: cf, start_cursor: cur, page_size: 100 });
        ids.push(...r.results.map(p => p.id));
        cur = r.has_more ? (r.next_cursor ?? undefined) : undefined;
      } while (cur);
    }
  } else if (baseFilter) {
    let cur: string | undefined;
    do {
      const r = await notion.databases.query({ database_id: DB_ID, filter: baseFilter, start_cursor: cur, page_size: 100 });
      ids.push(...r.results.map(p => p.id));
      cur = r.has_more ? (r.next_cursor ?? undefined) : undefined;
    } while (cur);
  }
  ids = [...new Set(ids)];
  if (!ids.length) return NextResponse.json({ ok: true, archived: 0, message: "삭제 대상 없음" });
  const results: { id: string; ok: boolean }[] = [];
  for (let i = 0; i < ids.length; i++) {
    try { await notion.pages.update({ page_id: ids[i], archived: true }); results.push({ id: ids[i], ok: true }); }
    catch { results.push({ id: ids[i], ok: false }); }
    if (i < ids.length - 1) await new Promise(r => setTimeout(r, 300));
  }
  return NextResponse.json({ ok: true, archived: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length });
}
