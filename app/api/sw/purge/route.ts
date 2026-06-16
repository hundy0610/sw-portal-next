import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID = process.env.NOTION_DB_SW_UNIFIED!;

// POST: 조건에 맞는 페이지원 Claude 레코드를 archive(삭제) 처리
// body: { users: string[], usageDate?: string, company?: string }
export async function POST(req: NextRequest) {
  if (!process.env.NOTION_TOKEN || !DB_ID) {
    return NextResponse.json({ ok: false, error: "환경변수 미설정" }, { status: 503 });
  }

  const { users, usageDate, company } = await req.json() as {
    users?: string[];
    usageDate?: string;
    company?: string;
  };

  // 필터 조건 구성
  const filterConditions: any[] = [];

  if (company) {
    filterConditions.push({ property: "법인명", select: { equals: company } });
  }
  if (usageDate) {
    filterConditions.push({ property: "사용일자", date: { equals: usageDate } });
  }

  const baseFilter = filterConditions.length > 0
    ? { and: filterConditions }
    : undefined;

  // 대상 페이지 수집
  let targetPageIds: string[] = [];

  if (users && users.length > 0) {
    for (const userName of users) {
      const userFilter: any = {
        property: "사용자",
        title: { equals: userName },
      };
      const combinedFilter = baseFilter
        ? { and: [userFilter, ...filterConditions] }
        : userFilter;

      let cursor: string | undefined;
      do {
        const resp = await notion.databases.query({
          database_id: DB_ID,
          filter: combinedFilter,
          start_cursor: cursor,
          page_size: 100,
        });
        targetPageIds.push(...resp.results.map((p) => p.id));
        cursor = resp.has_more ? (resp.next_cursor ?? undefined) : undefined;
      } while (cursor);
    }
  } else if (baseFilter) {
    // users 없이 조건만으로 검색
    let cursor: string | undefined;
    do {
      const resp = await notion.databases.query({
        database_id: DB_ID,
        filter: baseFilter,
        start_cursor: cursor,
        page_size: 100,
      });
      targetPageIds.push(...resp.results.map((p) => p.id));
      cursor = resp.has_more ? (resp.next_cursor ?? undefined) : undefined;
    } while (cursor);
  }

  // 중복 제거
  targetPageIds = [...new Set(targetPageIds)];

  if (targetPageIds.length === 0) {
    return NextResponse.json({ ok: true, archived: 0, message: "삭제 대상 없음" });
  }

  // Archive (삭제) 처리
  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const pageId of targetPageIds) {
    try {
      await notion.pages.update({ page_id: pageId, archived: true });
      results.push({ id: pageId, ok: true });
    } catch (e) {
      results.push({ id: pageId, ok: false, error: String(e) });
    }
    if (targetPageIds.indexOf(pageId) < targetPageIds.length - 1) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  const archived = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;

  return NextResponse.json({ ok: true, archived, failed, results });
}
