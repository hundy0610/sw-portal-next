import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

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
    summary,
  });
}
