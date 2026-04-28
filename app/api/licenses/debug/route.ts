import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";

export const dynamic = "force-dynamic";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const LICENSE_TRACKER_PAGE_ID = "29867f4bfdac81efaccccae6742a728b"; // 라이선스 트래커 parent page

const LICENSE_TRACKER_DBS = [
  { id: "29867f4bfdac8155977efa02c6f299dc", name: "MS Office" },
  { id: "29867f4bfdac81a5a684df2f8205b5f6", name: "MS Office 365" },
  { id: "29867f4bfdac8128b8c4fd623a02ec0c", name: "한컴" },
  { id: "29867f4bfdac8165a19fe66af94f3d6e", name: "ezPDF" },
  { id: "29867f4bfdac81e3ab03d278047ebf20", name: "Adobe PDF" },
  { id: "29867f4bfdac81f2bea1fd7fd1ba58f0", name: "Adobe Creative Cloud" },
  { id: "29867f4bfdac8188ba1fea4b14df4454", name: "Adobe Photoshop" },
  { id: "29867f4bfdac818f8d16f36ffb6c9fe7", name: "Adobe Illustrator" },
  { id: "29867f4bfdac818b8981e981128ec333", name: "Adobe Premiere Pro" },
  { id: "29867f4bfdac81779122ccd2196c9908", name: "AUTO CAD" },
  { id: "29867f4bfdac81dcb9ffc637c217f1ab", name: "MAC Office" },
  { id: "29867f4bfdac8168872bce19f14d9c75", name: "MAC 한컴" },
  { id: "29867f4bfdac816ab66dd11a967042cd", name: "기타" },
];

export async function GET() {
  const tokenSet = !!process.env.NOTION_TOKEN;
  const tokenPrefix = process.env.NOTION_TOKEN?.substring(0, 12) || "없음";

  // Test 1: Can the token access the parent page (라이선스 트래커)?
  let parentPageTest: { status: string; title?: string; error?: string } = { status: "not_run" };
  try {
    const page = await notion.pages.retrieve({ page_id: LICENSE_TRACKER_PAGE_ID });
    parentPageTest = { status: "ok", title: "라이선스 트래커 accessible" };
  } catch (e: any) {
    parentPageTest = { status: "error", error: e?.message, };
  }

  // Test 2: Can the token access MS Office DB via databases.retrieve?
  let msOfficePageTest: { status: string; error?: string } = { status: "not_run" };
  try {
    await notion.databases.retrieve({ database_id: LICENSE_TRACKER_DBS[0].id });
    msOfficePageTest = { status: "ok" };
  } catch (e: any) {
    msOfficePageTest = { status: "error", error: e?.message };
  }

  // Test 3: Search for databases
  let searchTest: { status: string; count?: number; titles?: string[]; error?: string } = { status: "not_run" };
  try {
    const searchRes = await notion.search({
      query: "MS Office",
      filter: { value: "database", property: "object" },
      page_size: 5,
    });
    searchTest = {
      status: "ok",
      count: searchRes.results.length,
      titles: searchRes.results.map((r: any) =>
        r.title?.[0]?.plain_text || r.properties?.title?.title?.[0]?.plain_text || r.id
      ),
    };
  } catch (e: any) {
    searchTest = { status: "error", error: e?.message };
  }

  // Test 4: List children of 라이선스 트래커
  let childrenTest: { status: string; count?: number; childIds?: string[]; error?: string } = { status: "not_run" };
  try {
    const children = await notion.blocks.children.list({
      block_id: LICENSE_TRACKER_PAGE_ID,
      page_size: 20,
    });
    childrenTest = {
      status: "ok",
      count: children.results.length,
      childIds: children.results.map((b: any) => `${b.type}:${b.id}`),
    };
  } catch (e: any) {
    childrenTest = { status: "error", error: e?.message };
  }

  // Test 5: Original databases.query tests
  const results = await Promise.allSettled(
    LICENSE_TRACKER_DBS.map(async (db) => {
      const res = await notion.databases.query({
        database_id: db.id,
        page_size: 1,
      });
      return { name: db.name, id: db.id, count: res.results.length };
    })
  );

  const summary = results.map((r, i) => {
    if (r.status === "fulfilled") {
      return { name: LICENSE_TRACKER_DBS[i].name, status: "ok", count: r.value.count };
    } else {
      return {
        name: LICENSE_TRACKER_DBS[i].name,
        status: "error",
        error: r.reason?.message || String(r.reason),
        code: r.reason?.code,
      };
    }
  });

  return NextResponse.json({
    tokenSet,
    tokenPrefix,
    parentPageTest,
    msOfficePageTest,
    searchTest,
    childrenTest,
    summary,
  });
}
