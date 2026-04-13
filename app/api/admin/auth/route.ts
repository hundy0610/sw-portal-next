import { NextResponse, type NextRequest } from "next/server";
import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { encodeSession, decodeSession, type AdminSession } from "@/lib/session";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const ACCOUNTS_DB_ID = process.env.ACCOUNTS_DB_ID ?? "";

// 슈퍼어드민 환경변수 (Notion DB가 없어도 접근 가능)
const SUPER_ADMIN_ID = process.env.SUPER_ADMIN_ID ?? "admin";
const SUPER_ADMIN_PW = process.env.SUPER_ADMIN_PW ?? "3589";

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

// ── Notion 계정 DB 조회 ──────────────────────────────────────
async function lookupAccount(userId: string, password: string): Promise<AdminSession | null> {
  if (!ACCOUNTS_DB_ID) return null;

  try {
    const res = await notion.databases.query({
      database_id: ACCOUNTS_DB_ID,
      filter: {
        and: [
          { property: "아이디", rich_text: { equals: userId } },
          { property: "활성화", checkbox: { equals: true } },
        ],
      },
    });

    for (const page of res.results) {
      if (page.object !== "page" || !("properties" in page)) continue;
      const p = (page as PageObjectResponse).properties;
      const pw = txt(p, "비밀번호");
      if (pw !== password) continue;

      const role = sel(p, "역할") === "super" ? "super" : "company";
      const mustChangePassword = chk(p, "비번변경필요");

      // 마지막 로그인 시각 업데이트 (비동기, 실패해도 무시)
      notion.pages.update({
        page_id: page.id,
        properties: {
          "마지막로그인": {
            rich_text: [{ text: { content: new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) } }],
          },
        },
      }).catch(() => {});

      return {
        notionPageId: page.id,
        userId,
        name: txt(p, "이름"),
        company: role === "super" ? "" : sel(p, "법인명"),
        role,
        mustChangePassword,
      };
    }
  } catch (e) {
    console.error("[auth] Notion lookup error:", e);
  }

  return null;
}

// ── POST /api/admin/auth — 로그인 ────────────────────────────
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId: string = (body.userId ?? "").trim();
    const password: string = body.password ?? "";

    if (!userId || !password) {
      return NextResponse.json({ error: "아이디/비밀번호를 입력해주세요" }, { status: 400 });
    }

    let session: AdminSession | null = null;

    // 1. ENV 슈퍼어드민 우선 확인
    if (userId === SUPER_ADMIN_ID && password === SUPER_ADMIN_PW) {
      session = {
        notionPageId: "env-super",
        userId: SUPER_ADMIN_ID,
        name: "슈퍼 어드민",
        company: "",
        role: "super",
      };
    }

    // 2. Notion 계정 DB 조회
    if (!session) {
      session = await lookupAccount(userId, password);
    }

    if (!session) {
      return NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다" }, { status: 401 });
    }

    const token = encodeSession(session);
    const response = NextResponse.json({
      success: true,
      role: session.role,
      company: session.company,
      name: session.name,
    });

    response.cookies.set("admin_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7일
      path: "/",
    });

    // 구버전 쿠키 정리
    response.cookies.set("admin_key", "", { httpOnly: true, maxAge: 0, path: "/" });

    return response;
  } catch (e) {
    console.error("[auth POST]", e);
    return NextResponse.json({ error: "로그인 처리 중 오류가 발생했습니다" }, { status: 500 });
  }
}

// ── GET /api/admin/auth — 현재 세션 정보 ────────────────────
export async function GET(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value;

  if (token) {
    const session = decodeSession(token);
    if (session) {
      return NextResponse.json({
        ok: true,
        role: session.role,
        company: session.company,
        name: session.name,
        userId: session.userId,
        mustChangePassword: session.mustChangePassword ?? false,
      });
    }
  }

  // 구버전 admin_key 쿠키 fallback (하위 호환)
  const key = request.cookies.get("admin_key")?.value;
  if (key) {
    const ADMIN_KEY = process.env.ADMIN_SECRET_KEY ?? "3589";
    if (key === ADMIN_KEY) {
      return NextResponse.json({
        ok: true,
        role: "super",
        company: "",
        name: "슈퍼 어드민",
        userId: "admin",
      });
    }
  }

  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

// ── DELETE /api/admin/auth — 로그아웃 ───────────────────────
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set("admin_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  response.cookies.set("admin_key", "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
  });
  return response;
}
