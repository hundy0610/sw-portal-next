import { NextResponse, type NextRequest } from "next/server";
import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { decodeSession } from "@/lib/session";
import { kvGet, kvSet, kvDel, kvSetPermanent } from "@/lib/kv-store";
import { hashPassword } from "@/lib/crypto";

const ACCOUNTS_CACHE_KEY = "admin:accounts";
const ACCOUNTS_CACHE_TTL = 60;
const GM_KEY = "sw:general-managers";
const GM_DETAILS_KEY = "sw:gm-details";

export interface GmDetail {
  userId: string;
  email: string;
  name: string;
}

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const ACCOUNTS_DB_ID = process.env.ACCOUNTS_DB_ID ?? "";

function requireSuper(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;
  if (!token) return false;
  const session = decodeSession(token);
  return session?.role === "super";
}

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
  const roleRaw = sel(p, "역할");
  const role = roleRaw === "super" ? "super" : roleRaw === "general" ? "general" : "company";
  return {
    id:         page.id,
    name:       txt(p, "이름"),
    userId:     txt(p, "아이디"),
    email:      txt(p, "메일"),
    department: txt(p, "부서명"),
    company:    sel(p, "법인명"),
    role:       role as "super" | "company" | "general",
    active:     chk(p, "활성화"),
  };
}

// Redis GM 리스트를 Notion 계정 목록 기준으로 동기화
async function syncGmLists(accounts: ReturnType<typeof mapAccount>[]) {
  const generals = accounts.filter(a => a.role === "general" && a.active);
  const gmUserIds = generals.map(a => a.userId);
  const gmDetails: GmDetail[] = generals.map(a => ({
    userId: a.userId,
    email:  a.email,
    name:   a.name,
  }));
  await Promise.all([
    kvSetPermanent(GM_KEY, gmUserIds),
    kvSetPermanent(GM_DETAILS_KEY, gmDetails),
  ]);
}

// ── GET — 계정 목록 (슈퍼어드민만) ──────────────────────────
export async function GET(request: NextRequest) {
  if (!requireSuper(request)) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }
  if (!ACCOUNTS_DB_ID) {
    return NextResponse.json({ ok: true, accounts: [] });
  }

  const cached = await kvGet<ReturnType<typeof mapAccount>[]>(ACCOUNTS_CACHE_KEY);
  if (cached) return NextResponse.json({ ok: true, accounts: cached });

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

    await kvSet(ACCOUNTS_CACHE_KEY, accounts, ACCOUNTS_CACHE_TTL);
    return NextResponse.json({ ok: true, accounts });
  } catch (e) {
    console.error("[accounts GET]", e);
    return NextResponse.json({ ok: false, error: String(e), accounts: [] }, { status: 500 });
  }
}

// ── POST — 계정 생성 (비밀번호 없음, mustChangePassword=true) ─
export async function POST(request: NextRequest) {
  if (!requireSuper(request)) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }
  if (!ACCOUNTS_DB_ID) {
    return NextResponse.json({ error: "ACCOUNTS_DB_ID 환경변수가 설정되지 않았습니다" }, { status: 500 });
  }

  try {
    const { name, userId, email, department, company, role } = await request.json();
    if (!name || !userId || !email) {
      return NextResponse.json({ error: "이름, 아이디, 메일 주소는 필수입니다" }, { status: 400 });
    }

    const notionRole = role === "super" ? "super" : role === "general" ? "general" : "company";

    const page = await notion.pages.create({
      parent: { database_id: ACCOUNTS_DB_ID },
      properties: {
        "이름":       { title:     [{ text: { content: name } }] },
        "아이디":     { rich_text: [{ text: { content: userId } }] },
        "비밀번호":   { rich_text: [{ text: { content: "" } }] },
        "메일":       { rich_text: [{ text: { content: email || "" } }] },
        "부서명":     { rich_text: [{ text: { content: department || "" } }] },
        "법인명":     { select:    { name: company || "전체" } },
        "역할":       { select:    { name: notionRole } },
        "활성화":     { checkbox:  true },
        "비번변경필요": { checkbox: true },
      },
    });

    await kvDel(ACCOUNTS_CACHE_KEY);

    // GM 리스트 동기화 (general 역할 추가 시)
    if (notionRole === "general") {
      const existing = (await kvGet<GmDetail[]>(GM_DETAILS_KEY)) ?? [];
      if (!existing.find(g => g.userId === userId)) {
        existing.push({ userId, email: email || "", name });
        const ids = existing.map(g => g.userId);
        await Promise.all([
          kvSetPermanent(GM_KEY, ids),
          kvSetPermanent(GM_DETAILS_KEY, existing),
        ]);
      }
    }

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
    const { id, name, userId, password, email, department, company, role, active } = await request.json();
    if (!id) return NextResponse.json({ error: "id가 필요합니다" }, { status: 400 });

    const props: Record<string, unknown> = {};
    if (name       !== undefined) props["이름"]     = { title:     [{ text: { content: name } }] };
    if (userId     !== undefined) props["아이디"]   = { rich_text: [{ text: { content: userId } }] };
    if (email      !== undefined) props["메일"]     = { rich_text: [{ text: { content: email } }] };
    if (department !== undefined) props["부서명"]   = { rich_text: [{ text: { content: department } }] };
    if (company    !== undefined) props["법인명"]   = { select:    { name: company || "전체" } };
    if (role       !== undefined) {
      const notionRole = role === "super" ? "super" : role === "general" ? "general" : "company";
      props["역할"] = { select: { name: notionRole } };
    }
    if (active     !== undefined) props["활성화"]   = { checkbox: active };
    if (password) {
      props["비밀번호"]   = { rich_text: [{ text: { content: hashPassword(password) } }] };
      props["비번변경필요"] = { checkbox: false };
    }

    await notion.pages.update({ page_id: id, properties: props as never });
    await kvDel(ACCOUNTS_CACHE_KEY);

    // GM 리스트 재동기화 (역할 변경 시)
    if (role !== undefined || active !== undefined) {
      const cached = await kvGet<ReturnType<typeof mapAccount>[]>(ACCOUNTS_CACHE_KEY);
      if (!cached) {
        // 캐시가 비워진 상태이므로 Notion에서 다시 조회 후 동기화
        const res = await notion.databases.query({
          database_id: ACCOUNTS_DB_ID,
          page_size: 100,
        });
        const accounts = res.results
          .filter(p => p.object === "page" && "properties" in p)
          .map(p => mapAccount(p as PageObjectResponse));
        await syncGmLists(accounts);
        await kvSet(ACCOUNTS_CACHE_KEY, accounts, ACCOUNTS_CACHE_TTL);
      } else {
        // 캐시를 업데이트하면서 동기화
        const updated = cached.map(a => {
          if (a.id !== id) return a;
          return {
            ...a,
            ...(name       !== undefined && { name }),
            ...(userId     !== undefined && { userId }),
            ...(email      !== undefined && { email }),
            ...(department !== undefined && { department }),
            ...(company    !== undefined && { company }),
            ...(role       !== undefined && { role: (role === "super" ? "super" : role === "general" ? "general" : "company") as "super" | "company" | "general" }),
            ...(active     !== undefined && { active }),
          };
        });
        await syncGmLists(updated);
      }
    }

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

    await notion.pages.update({
      page_id: id,
      properties: { "활성화": { checkbox: false } },
    });
    await kvDel(ACCOUNTS_CACHE_KEY);

    // GM 리스트에서 제거 (비활성화된 계정)
    const details = (await kvGet<GmDetail[]>(GM_DETAILS_KEY)) ?? [];
    // id 기준으로 제거할 수 없으므로, 캐시에서 userId를 찾아 제거
    // 비활성화 후 Notion 재조회 트리거
    const res = await notion.databases.query({
      database_id: ACCOUNTS_DB_ID,
      page_size: 100,
    });
    const accounts = res.results
      .filter(p => p.object === "page" && "properties" in p)
      .map(p => mapAccount(p as PageObjectResponse));
    await syncGmLists(accounts);
    await kvSet(ACCOUNTS_CACHE_KEY, accounts, ACCOUNTS_CACHE_TTL);

    void details; // suppress unused warning
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[accounts DELETE]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
