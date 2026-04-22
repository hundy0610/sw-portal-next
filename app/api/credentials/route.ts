import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { kvGet, kvSet, kvDel } from "@/lib/kv-store";
import { memGet, memSet, memDel } from "@/lib/mem-cache";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

function getDbId() {
  const id = process.env.NOTION_PAGE_CREDENTIALS;
  if (!id) throw new Error("NOTION_PAGE_CREDENTIALS 환경변수가 설정되지 않았습니다.");
  return id;
}

function mapPage(page: any) {
  const p = page.properties;
  const getText = (prop: any) =>
    prop?.rich_text?.map((t: any) => t.plain_text).join("") ?? "";

  return {
    id:        page.id,
    swName:    p["이름"]?.title?.map((t: any) => t.plain_text).join("") ?? "",
    accountId: getText(p["ID"]),
    password:  getText(p["PW"]),
    siteUrl:   p["URL"]?.url ?? "",
    memo:      getText(p["유형"]),
  };
}

// ── GET: 전체 조회 ────────────────────────────────────────
export async function GET() {
  try {
    // 1. 인메모리 캐시 (0ms)
    const mem = memGet<object[]>("credentials:all");
    if (mem) return NextResponse.json({ data: mem, cached: true });

    // 2. KV 캐시 (1~5ms, KV 미설정 시 null)
    const kv = await kvGet<object[]>("credentials:all");
    if (kv) {
      memSet("credentials:all", kv, 300);
      return NextResponse.json({ data: kv, cached: true });
    }

    // 3. Notion 직접 조회
    const pages: any[] = [];
    let cursor: string | undefined;

    do {
      const res = await notion.databases.query({
        database_id: getDbId(),
        sorts: [{ timestamp: "created_time", direction: "ascending" }],
        page_size: 100,
        start_cursor: cursor,
      });
      pages.push(...res.results);
      cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
    } while (cursor);

    const data = pages.map(mapPage);
    memSet("credentials:all", data, 300);
    await kvSet("credentials:all", data);

    return NextResponse.json({ data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ data: [], error: message }, { status: 500 });
  }
}

// ── POST: 추가 ────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { swName, siteUrl = "", accountId, password = "", memo = "" } = await req.json();
    if (!swName || !accountId) {
      return NextResponse.json({ error: "SW명과 아이디는 필수입니다." }, { status: 400 });
    }

    const page = await notion.pages.create({
      parent: { database_id: getDbId() },
      properties: {
        이름: { title: [{ text: { content: String(swName).trim() } }] },
        ID:   { rich_text: [{ text: { content: String(accountId).trim() } }] },
        PW:   { rich_text: [{ text: { content: String(password).trim() } }] },
        URL:  { url: siteUrl.trim() || null },
        유형: { rich_text: [{ text: { content: String(memo).trim() } }] },
      },
    });

    memDel("credentials:all");
    await kvDel("credentials:all");
    return NextResponse.json({ ok: true, data: mapPage(page) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── PUT: 수정 ─────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  try {
    const { id, swName, siteUrl, accountId, password, memo } = await req.json();
    if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

    const properties: Record<string, any> = {};
    if (swName    !== undefined) properties["이름"] = { title:     [{ text: { content: String(swName).trim() } }] };
    if (accountId !== undefined) properties["ID"]   = { rich_text: [{ text: { content: String(accountId).trim() } }] };
    if (password  !== undefined) properties["PW"]   = { rich_text: [{ text: { content: String(password).trim() } }] };
    if (siteUrl   !== undefined) properties["URL"]  = { url: String(siteUrl).trim() || null };
    if (memo      !== undefined) properties["유형"] = { rich_text: [{ text: { content: String(memo).trim() } }] };

    const page = await notion.pages.update({ page_id: id, properties });
    memDel("credentials:all");
    await kvDel("credentials:all");
    return NextResponse.json({ ok: true, data: mapPage(page) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── DELETE: 삭제 (아카이브) ───────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

    await notion.pages.update({ page_id: id, archived: true });
    memDel("credentials:all");
    await kvDel("credentials:all");
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
