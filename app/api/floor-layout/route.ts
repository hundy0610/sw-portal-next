/**
 * 도면 레이아웃 서버 저장/로드 — Notion (elements) + Vercel Blob (배경 이미지)
 *
 * 필요한 환경변수:
 *   NOTION_TOKEN              ← 기존 사용 중
 *   NOTION_DB_FLOOR_LAYOUTS   ← Notion DB ID
 *   BLOB_READ_WRITE_TOKEN     ← Vercel Blob 토큰
 *
 * Notion DB 컬럼 (대소문자 정확히 일치):
 *   이름      — Title      (예: "bw-8F")
 *   elements  — Rich Text  (JSON)
 *   bgImage   — Rich Text  (Vercel Blob URL)
 */

import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { put, del } from "@vercel/blob";

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

async function findPage(floorKey: string): Promise<{ id: string; bgUrl: string | null } | null> {
  if (!DB_ID) return null;
  try {
    const res = await notion.databases.query({
      database_id: DB_ID,
      filter: { property: "Title", title: { equals: floorKey } },
      page_size: 1,
    });
    if (!res.results[0]) return null;
    const page = res.results[0] as PageObjectResponse;
    const bgRaw = page.properties.bgImage?.type === "rich_text"
      ? fromRichText(page.properties.bgImage.rich_text)
      : "";
    return {
      id: page.id,
      bgUrl: bgRaw?.startsWith("https://") ? bgRaw : null,
    };
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
    const found = await findPage(`${bldId}-${floorId}`);
    if (!found) return NextResponse.json({ elements: [], bgImage: null });

    const page = await notion.pages.retrieve({ page_id: found.id }) as PageObjectResponse;
    const p = page.properties;

    const elementsStr = p.elements?.type === "rich_text"
      ? fromRichText(p.elements.rich_text) : "";
    const bgUrl = p.bgImage?.type === "rich_text"
      ? fromRichText(p.bgImage.rich_text) : "";

    return NextResponse.json({
      elements: elementsStr ? JSON.parse(elementsStr) : [],
      bgImage:  bgUrl?.startsWith("https://") ? bgUrl : null,
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

    // 기존 페이지 조회 (Blob URL 삭제를 위해)
    const existing = await findPage(floorKey);
    let bgUrl: string | null = existing?.bgUrl ?? null;

    if (bgImage?.startsWith("data:")) {
      // base64 → Vercel Blob 업로드
      const [header, b64] = bgImage.split(",");
      const mime = header.match(/data:([^;]+);/)?.[1] ?? "image/jpeg";
      const ext  = mime.split("/")[1] ?? "jpg";
      const buffer = Buffer.from(b64, "base64");

      // 기존 blob 삭제
      if (bgUrl) {
        try { await del(bgUrl); } catch {}
      }

      const blob = await put(`floor-layouts/${floorKey}.${ext}`, buffer, {
        access: "public",
        contentType: mime,
        addRandomSuffix: true,
      });
      bgUrl = blob.url;

    } else if (bgImage === null) {
      // 배경 제거
      if (bgUrl) {
        try { await del(bgUrl); } catch {}
      }
      bgUrl = null;
    } else if (bgImage?.startsWith("https://")) {
      // 이미 업로드된 URL → 그대로 유지
      bgUrl = bgImage;
    }

    const props = {
      "Title":    { title:     [{ text: { content: floorKey } }] },
      "elements": { rich_text: toChunks(elementsStr) },
      "bgImage":  { rich_text: bgUrl ? [{ text: { content: bgUrl } }] : [{ text: { content: "" } }] },
    } as never;

    if (existing?.id) {
      await notion.pages.update({ page_id: existing.id, properties: props });
    } else {
      await notion.pages.create({ parent: { database_id: DB_ID }, properties: props });
    }

    return NextResponse.json({ ok: true, bgUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
