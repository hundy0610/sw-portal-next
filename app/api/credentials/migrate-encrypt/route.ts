import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { kvDel } from "@/lib/kv-store";
import { memDel } from "@/lib/mem-cache";
import { encryptSecret, isEncryptedSecret } from "@/lib/crypto";
import { getSessionFromCookieHeader, resolveCurrentRole } from "@/lib/session";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

function getDbId() {
  const id = process.env.NOTION_PAGE_CREDENTIALS;
  if (!id) throw new Error("NOTION_PAGE_CREDENTIALS 환경변수가 설정되지 않았습니다.");
  return id;
}

// 일회성 마이그레이션 — 기존에 평문으로 저장된 PW 값들을 전부 암호화해 재저장한다.
// 이미 암호화된 값(enc:v1: 접두어)은 건너뛴다. 여러 번 실행해도 안전(idempotent).
export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromCookieHeader(req.headers.get("cookie"));
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if ((await resolveCurrentRole(session)) !== "super") {
      return NextResponse.json({ ok: false, error: "슈퍼어드민만 실행할 수 있습니다." }, { status: 403 });
    }

    const pages: any[] = [];
    let cursor: string | undefined;
    do {
      const res = await notion.databases.query({
        database_id: getDbId(),
        page_size: 100,
        start_cursor: cursor,
      });
      pages.push(...res.results);
      cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
    } while (cursor);

    let migrated = 0, skipped = 0;
    for (const page of pages) {
      const rawPw: string = (page as any).properties?.["PW"]?.rich_text?.map((t: any) => t.plain_text).join("") ?? "";
      if (!rawPw || isEncryptedSecret(rawPw)) { skipped++; continue; }
      await notion.pages.update({
        page_id: page.id,
        properties: { PW: { rich_text: [{ text: { content: encryptSecret(rawPw) } }] } },
      });
      migrated++;
    }

    memDel("credentials:all");
    await kvDel("credentials:all");

    return NextResponse.json({ ok: true, migrated, skipped, total: pages.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
