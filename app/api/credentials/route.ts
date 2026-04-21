/**
 * 계정 관리 (ID/PW) API — Notion DB 연동
 *
 * 필요한 환경변수:
 *   NOTION_TOKEN          ← 기존 사용 중
 *   NOTION_DB_CREDENTIALS ← ID/PW 노션 DB 페이지 ID
 *
 * 노션 DB 필수 프로퍼티 (대소문자 정확히 일치):
 *   이름   — Title         (계정 소유자 / 회사명)
 *   유형   — Rich Text     (Adobe, AutoDesk, … 그룹핑 기준)
 *   ID     — Rich Text     (계정 아이디)
 *   PW     — Rich Text     (비밀번호)
 *   URL    — URL or Text   (사이트 주소)
 *   비고   — Rich Text     (메모, optional)
 */

import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID  = process.env.NOTION_DB_CREDENTIALS ?? "";

// ── 프로퍼티 파서 헬퍼 ────────────────────────────────────
type Props = PageObjectResponse["properties"];

const txt = (p: Props, k: string): string => {
  const v = p[k];
  if (!v) return "";
  if (v.type === "title")     return v.title.map(t => t.plain_text).join("");
  if (v.type === "rich_text") return v.rich_text.map(t => t.plain_text).join("");
  if (v.type === "url")       return v.url ?? "";
  return "";
};

const sel = (p: Props, k: string): string => {
  const v = p[k];
  if (!v || v.type !== "select") return "";
  return v.select?.name ?? "";
};

// ── 노션 페이지 → SwCredential 매핑 ─────────────────────
export interface SwCredential {
  id:        string;
  swName:    string;   // SW명 (select) — 카드 제목
  name:      string;   // 이름 (title)  — 회사/계정 소유자
  accountId: string;
  password:  string;
  siteUrl:   string;
  memo:      string;
}

function mapPage(page: PageObjectResponse): SwCredential {
  const p = page.properties;
  return {
    id:        page.id,
    swName:    txt(p, "유형")   || sel(p, "유형"),
    name:      txt(p, "이름"),
    accountId: txt(p, "ID"),
    password:  txt(p, "PW"),
    siteUrl:   txt(p, "URL"),
    memo:      txt(p, "비고"),
  };
}

// ── DB 전체 조회 (페이지네이션) ───────────────────────────
async function fetchAll(): Promise<SwCredential[]> {
  if (!DB_ID) return [];
  const results: SwCredential[] = [];
  let cursor: string | undefined;

  do {
    const res = await notion.databases.query({
      database_id: DB_ID,
      sorts: [{ property: "유형", direction: "ascending" }],
      page_size: 100,
      start_cursor: cursor,
    });
    for (const page of res.results) {
      if (page.object === "page" && "properties" in page) {
        results.push(mapPage(page as PageObjectResponse));
      }
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return results;
}

// ── GET: 계정 목록 ────────────────────────────────────────
export async function GET() {
  if (!DB_ID) {
    return NextResponse.json(
      { data: [], error: "NOTION_DB_CREDENTIALS 환경변수가 설정되지 않았습니다." },
      { status: 500 }
    );
  }
  try {
    const data = await fetchAll();
    return NextResponse.json({ data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ data: [], error: message }, { status: 500 });
  }
}

// ── POST: 계정 추가 ───────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!DB_ID) {
    return NextResponse.json({ error: "NOTION_DB_CREDENTIALS 미설정" }, { status: 500 });
  }
  try {
    const { swName, name = "", accountId, password = "", siteUrl = "", memo = "" } = await req.json();
    if (!swName || !accountId) {
      return NextResponse.json({ error: "SW명과 아이디는 필수입니다." }, { status: 400 });
    }

    const page = await notion.pages.create({
      parent: { database_id: DB_ID },
      properties: {
        "이름":  { title:     [{ text: { content: String(name).trim() || String(swName).trim() } }] },
        "유형":  { rich_text: [{ text: { content: String(swName).trim() } }] },
        "ID":    { rich_text: [{ text: { content: String(accountId).trim() } }] },
        "PW":    { rich_text: [{ text: { content: String(password).trim() } }] },
        "URL":   { url: String(siteUrl).trim() || null },
        "비고":  { rich_text: [{ text: { content: String(memo).trim() } }] },
      } as never,
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: page.id, swName, name,
        accountId, password, siteUrl, memo,
      } satisfies SwCredential,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── PUT: 계정 수정 ────────────────────────────────────────
export async function PUT(req: NextRequest) {
  try {
    const { id, swName, name, accountId, password, siteUrl, memo } = await req.json();
    if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

    const props: Record<string, unknown> = {};
    if (name      !== undefined) props["이름"] = { title:     [{ text: { content: String(name).trim() } }] };
    if (swName    !== undefined) props["유형"] = { rich_text: [{ text: { content: String(swName).trim() } }] };
    if (accountId !== undefined) props["ID"]   = { rich_text: [{ text: { content: String(accountId).trim() } }] };
    if (password  !== undefined) props["PW"]   = { rich_text: [{ text: { content: String(password).trim() } }] };
    if (siteUrl   !== undefined) props["URL"]  = { url: String(siteUrl).trim() || null };
    if (memo      !== undefined) props["비고"] = { rich_text: [{ text: { content: String(memo).trim() } }] };

    await notion.pages.update({ page_id: id, properties: props as never });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── DELETE: 계정 삭제 (아카이브) ─────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

    await notion.pages.update({ page_id: id, archived: true });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
