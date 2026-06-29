import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { getSessionFromCookieHeader } from "@/lib/session";

export const dynamic = "force-dynamic";
const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID  = process.env.NOTION_DB_SURVEY_DEMAND!;

// ── POST: 설문 응답 제출 (인증 불필요) ───────────────────────────────
export async function POST(req: NextRequest) {
  if (!process.env.NOTION_TOKEN || !DB_ID) {
    return NextResponse.json({ ok: false, error: "설문 DB가 설정되지 않았습니다." }, { status: 503 });
  }

  try {
    const { company, department, name, email, purpose, frequency, note } = await req.json();

    if (!name?.trim())       return NextResponse.json({ ok: false, error: "성함을 입력해 주세요." }, { status: 400 });
    if (!company?.trim())    return NextResponse.json({ ok: false, error: "소속 법인을 입력해 주세요." }, { status: 400 });
    if (!department?.trim()) return NextResponse.json({ ok: false, error: "부서명을 입력해 주세요." }, { status: 400 });
    if (!email?.trim())      return NextResponse.json({ ok: false, error: "이메일 주소를 입력해 주세요." }, { status: 400 });
    if (!purpose?.trim())    return NextResponse.json({ ok: false, error: "사용 목적을 입력해 주세요." }, { status: 400 });
    if (!frequency?.trim())  return NextResponse.json({ ok: false, error: "사용 주기를 입력해 주세요." }, { status: 400 });

    await notion.pages.create({
      parent: { database_id: DB_ID },
      properties: {
        "성함": { title: [{ text: { content: name.trim() } }] },
        "소속법인": { rich_text: [{ text: { content: company.trim() } }] },
        "부서명": { rich_text: [{ text: { content: department.trim() } }] },
        "이메일": { email: email.trim() },
        "사용목적": { rich_text: [{ text: { content: purpose.trim() } }] },
        "사용주기": { rich_text: [{ text: { content: frequency.trim() } }] },
        "특이사항": { rich_text: [{ text: { content: (note ?? "").trim() } }] },
        "제출일시": { date: { start: new Date().toISOString() } },
      } as Parameters<typeof notion.pages.create>[0]["properties"],
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[survey-demand POST]", e);
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}

// ── GET: 설문 응답 목록 조회 (관리자 인증 필요) ──────────────────────
export async function GET(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  if (!process.env.NOTION_TOKEN || !DB_ID) {
    return NextResponse.json({ ok: false, error: "설문 DB가 설정되지 않았습니다." }, { status: 503 });
  }

  try {
    const pages: any[] = [];
    let cursor: string | undefined;

    do {
      const res: any = await notion.databases.query({
        database_id: DB_ID,
        sorts: [{ timestamp: "created_time", direction: "descending" }],
        start_cursor: cursor,
        page_size: 100,
      });
      pages.push(...res.results);
      cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
    } while (cursor);

    const getText = (p: any, key: string) =>
      p?.[key]?.rich_text?.[0]?.plain_text ?? p?.[key]?.title?.[0]?.plain_text ?? "";

    const data = pages.map((p: any) => ({
      id:          p.id,
      name:        getText(p.properties, "성함"),
      company:     getText(p.properties, "소속법인"),
      department:  getText(p.properties, "부서명"),
      email:       p.properties["이메일"]?.email ?? "",
      purpose:     getText(p.properties, "사용목적"),
      frequency:   getText(p.properties, "사용주기"),
      note:        getText(p.properties, "특이사항"),
      submittedAt: p.properties["제출일시"]?.date?.start ?? p.created_time,
      notionUrl:   p.url,
    }));

    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}

// ── DELETE: 응답 삭제 (관리자) ────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const session = getSessionFromCookieHeader(req.headers.get("cookie"));
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ ok: false, error: "id 필수" }, { status: 400 });
    await notion.pages.update({ page_id: id, archived: true });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
