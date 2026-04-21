/**
 * 도면 레이아웃 서버 저장/로드 — Notion 연동
 *
 * 필요한 환경변수:
 *   NOTION_TOKEN              ← 기존 사용 중
 *   NOTION_DB_FLOOR_LAYOUTS   ← 새로 만들 Notion DB ID
 *
 * Notion DB 컬럼 (대소문자 정확히 일치):
 *   이름      — Title      (예: "bw-8F")
 *   elements  — Rich Text  (JSON)
 *   bgImage   — Rich Text  (base64 압축 이미지)
 */

import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID  = process.env.NOTION_DB_FLOOR_LAYOUTS ?? "";

// Notion rich_text 최대 2000자 제한 → 청크로 분할
const CHUNK = 1800;
function toChunks(text: string) {
  const chunks = [];
  for (let i = 0; i < text.length; i += CHUNK)
    chunks.push({ text: { content: text.slice(i, i + CHUNK) } });
  return chunks.length ? chunks : [{ text: { content: "" } }];
}
function fromRichText(arr: { plain_text: string }[]): string {
  return arr.map(t => t.plain_text).join("");
}

async function findPageId(floorKey: string): Promise<string | null> {
  if (!DB_ID) return null;
  try {
    const res = await notion.databases.query({
      database_id: DB_ID,
      filter: { property: "이름", title: { equals: floorKey } },
      page_size: 1,
    });
    return res.results[0]?.id ?? null;
  } catch { return null; }
}

// ── GET: 도면 로드 ────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bldId   = searchParams.get("bld")   ?? "";
  const floorId = searchParams.get("floor") ?? "";

  if (!DB_ID || !bldId || !floorId)
    return NextResponse.json({ elements: [], bgImage: null });

  try {
    const pageId = await findPageId(`${bldId}-${floorId}`);
    if (!pageId) return NextResponse.json({ elements: [], bgImage: null });

    const page = await notion.pages.retrieve({ page_id: pageId }) as PageObjectResponse;
    const p = page.properties;

    const elementsStr = p.elements?.type === "rich_text"
      ? fromRichText(p.elements.rich_text) : "";
    const bgImageStr  = p.bgImage?.type  === "rich_text"
      ? fromRichText(p.bgImage.rich_text)  : "";

    return NextResponse.json({
      elements: elementsStr ? JSON.parse(elementsStr) : [],
      bgImage:  bgImageStr  || null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ elements: [], bgImage: null, error: message });
  }
}

// ── POST: 도면 저장 ───────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!DB_ID)
    return NextResponse.json({ error: "NOTION_DB_FLOOR_LAYOUTS 미설정" }, { status: 500 });

  try {
    const { bldId, floorId, elements, bgImage } = await req.json();
    const floorKey    = `${bldId}-${floorId}`;
    const elementsStr = JSON.stringify(elements ?? []);

    const props = {
      "이름":     { title:     [{ text: { content: floorKey } }] },
      "elements": { rich_text: toChunks(elementsStr) },
      "bgImage":  { rich_text: bgImage ? toChunks(bgImage) : [{ text: { content: "" } }] },
    } as never;

    const existingId = await findPageId(floorKey);
    if (existingId) {
      await notion.pages.update({ page_id: existingId, properties: props });
    } else {
      await notion.pages.create({ parent: { database_id: DB_ID }, properties: props });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
