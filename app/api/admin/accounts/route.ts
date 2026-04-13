import { NextResponse, type NextRequest } from "next/server";
import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { decodeSession } from "@/lib/session";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const ACCOUNTS_DB_ID = process.env.ACCOUNTS_DB_ID ?? "";

// ── 권한 확인 ────────────────────────────────────────────────
function requireSuper(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  if (!token) return false;
  const session = decodeSession(token);
  return session?.role === "super";
}

// ── 프로퍼티 파서 ────────────────────────────────────────────
type Props = PageObjectResponse["properties"];

const txt = (p: Props, k: string) => {
  const v = p[k];
  if (!v) return "";
  if (v.type === "title")     return v.title.map(t => t.plain_text).join("");
  if (v.type === "rich_text") return v.rich_text.map(t => t.plain_text).join("");
  return "";
};

const sel = (p: Props, k: string) => {
  const v = p[k];
  if (!v || v.type !== "select") return "";
  return v.select?.name ?? "";
};

const chk = (p: Props, k: string) => {
  const v = p[k];
  if (!v || v.type !== "checkbox") return false;
  return v.checkbox;
};

function mapAccount(page: PageObjectResponse) {
  const p = page.properties;
  return {
    id:       page.id,
    name:     txt(p, "이름"),
    userId:   txt(p, "아이디"),
    password: txt(p, "비밀번호"),
    company:  sel(p, "법인명"),
    role:     sel(p, "역할") === "super" ? "super" : "company",
    active:   chk(p, "활성화"),
  };
}

// ── GET — 계정 목록 (슈퍼어드민만) ──────────────────────────
export async function GET(request: NextRequest) {
  if (!requireSuper(request)) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }
  if (!ACCOUNTS_DB_ID) {
    return NextResponse.json({ ok: true, accounts: [] });
  }

  try {
    const accounts: ReturnType<typeof mapAccount>[] = [];
    let cursor: string | undefined;

    do {
      const res = await notion.databases.query({
        database_id: ACCOUNTS_DB_ID,
        sorts: [{ property: "법인명", direction: "ascending" }],
        page_size: 100,
        start_cursor: cursor,
      });

      for (const page of res.results) {
        if (page.object === "page" && "properties" in page) {
          accounts.push(mapAccount(page as PageObjectResponse));
        }
      }

      cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
    } while (cursor);

    return NextResponse.json({ ok: true, accounts });
  } catch (e) {
    console.error("[accounts GET]", e);
    return NextResponse.json({ ok: false, error: String(e), accounts: [] }, { status: 500 });
  }
}

// ── POST — 계정 생성 ─────────────────────────────────────────
export async function POST(request: NextRequest) {
  if (!requireSuper(request)) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }
  if (!ACCOUNTS_DB_ID) {
    return NextResponse.json({ error: "ACCOUNTS_DB_ID 환경변수가 설정되지 않았습니다" }, { status: 500 });
  }

  try {
    const { name, userId, password, company, role } = await request.json();
    if (!name || !userId || !password) {
      return NextResponse.json({ error: "이름, 아이디, 비밀번호는 필수입니다" }, { status: 400 });
    }

    const page = await notion.pages.create({
      parent: { database_id: ACCOUNTS_DB_ID },
      properties: {
        "이름":    { title:      [{ text: { content: name } }] },
        "아이디":  { rich_text:  [{ text: { content: userId } }] },
        "비밀번호":{ rich_text:  [{ text: { content: password } }] },
        "법인명":  { select:     { name: company || "전체" } },
        "역할":    { select:     { name: role === "super" ? "super" : "company" } },
        "활성화":  { checkbox:   true },
      },
    });

    return NextResponse.json({ ok: true, id: page.id });
  } catch (e) {
    console.error("[accounts POST]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// ── PATCH — 계정 수정 ────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  if (!requireSuper(request)) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  try {
    const { id, name, userId, password, company, role, active } = await request.json();
    if (!id) return NextResponse.json({ error: "id가 필요합니다" }, { status: 400 });

    const props: Record<string, unknown> = {};
    if (name     !== undefined) props["이름"]     = { title:     [{ text: { content: name } }] };
    if (userId   !== undefined) props["아이디"]   = { rich_text: [{ text: { content: userId } }] };
    if (password !== undefined) props["비밀번호"] = { rich_text: [{ text: { content: password } }] };
    if (company  !== undefined) props["법인명"]   = { select:    { name: company || "전체" } };
    if (role     !== undefined) props["역할"]     = { select:    { name: role === "super" ? "super" : "company" } };
    if (active   !== undefined) props["활성화"]   = { checkbox:  active };

    await notion.pages.update({ page_id: id, properties: props as never });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[accounts PATCH]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// ── DELETE — 계정 비활성화 ───────────────────────────────────
export async function DELETE(request: NextRequest) {
  if (!requireSuper(request)) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: "id가 필요합니다" }, { status: 400 });

    // 물리 삭제 대신 비활성화
    await notion.pages.update({
      page_id: id,
      properties: { "활성화": { checkbox: false } },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[accounts DELETE]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
