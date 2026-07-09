import { NextResponse, type NextRequest } from "next/server";
import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { decodeSession, resolveCurrentRole } from "@/lib/session";
import { kvGet, kvSetPermanent } from "@/lib/kv-store";
import type { Account, GmDetail } from "@/app/api/admin/accounts/route";
import crypto from "crypto";
import { errorMessage } from "@/lib/api-error";

const ACCOUNTS_KEY   = "sw:accounts";
const GM_KEY         = "sw:general-managers";
const GM_DETAILS_KEY = "sw:gm-details";

// ── Notion 프로퍼티 파서 ────────────────────────────────────
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

// POST /api/admin/migrate-accounts
// Notion 계정 DB → Redis 일괄 이전 (슈퍼어드민 전용, 1회성)
export async function POST(request: NextRequest) {
  // 슈퍼어드민 세션 확인
  const token = request.cookies.get("admin_session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const session = decodeSession(token);
  if (!session || (await resolveCurrentRole(session)) !== "super") {
    return NextResponse.json({ error: "슈퍼어드민만 실행할 수 있습니다" }, { status: 403 });
  }

  const NOTION_TOKEN   = process.env.NOTION_TOKEN;
  const ACCOUNTS_DB_ID = process.env.ACCOUNTS_DB_ID;

  if (!NOTION_TOKEN || !ACCOUNTS_DB_ID) {
    return NextResponse.json(
      { error: "NOTION_TOKEN 또는 ACCOUNTS_DB_ID 환경변수가 설정되지 않았습니다" },
      { status: 500 },
    );
  }
  if (!process.env.REDIS_URL) {
    return NextResponse.json({ error: "REDIS_URL 환경변수가 설정되지 않았습니다" }, { status: 500 });
  }

  try {
    const notion = new Client({ auth: NOTION_TOKEN });
    const notionAccounts: Account[] = [];
    let cursor: string | undefined;

    // Notion DB 전체 조회 (페이지네이션)
    do {
      const res = await notion.databases.query({
        database_id: ACCOUNTS_DB_ID,
        page_size: 100,
        start_cursor: cursor,
      });

      for (const page of res.results) {
        if (page.object !== "page" || !("properties" in page)) continue;
        const p = (page as PageObjectResponse).properties;

        const userId = txt(p, "아이디");
        if (!userId) continue; // 아이디 없는 행 스킵

        const roleRaw = sel(p, "역할");
        const role: Account["role"] =
          roleRaw === "super" ? "super" : roleRaw === "general" ? "general" : "company";

        notionAccounts.push({
          id:                 `acc-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
          name:               txt(p, "이름"),
          userId,
          password:           txt(p, "비밀번호"),   // 기존 평문/해시 그대로 유지
          email:              txt(p, "메일") || txt(p, "이메일") || "",
          department:         txt(p, "부서명") || "",
          company:            sel(p, "법인명") || "",
          role,
          active:             chk(p, "활성화"),
          mustChangePassword: chk(p, "비번변경필요"),
          createdAt:          (page as PageObjectResponse).created_time,
        });
      }

      cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
    } while (cursor);

    if (notionAccounts.length === 0) {
      return NextResponse.json({ ok: true, migrated: 0, message: "Notion DB에 계정이 없습니다" });
    }

    // 기존 Redis 계정과 병합 (userId 중복 방지)
    const existing = (await kvGet<Account[]>(ACCOUNTS_KEY)) ?? [];
    const existingIds = new Set(existing.map(a => a.userId));
    const toAdd = notionAccounts.filter(a => !existingIds.has(a.userId));
    const merged = [...existing, ...toAdd];

    await kvSetPermanent(ACCOUNTS_KEY, merged);

    // GM 목록 동기화
    const generals = merged.filter(a => a.role === "general" && a.active);
    const gmDetails: GmDetail[] = generals.map(a => ({ userId: a.userId, email: a.email, name: a.name }));
    await Promise.all([
      kvSetPermanent(GM_KEY, generals.map(a => a.userId)),
      kvSetPermanent(GM_DETAILS_KEY, gmDetails),
    ]);

    return NextResponse.json({
      ok:       true,
      migrated: toAdd.length,
      skipped:  notionAccounts.length - toAdd.length,
      total:    merged.length,
    });
  } catch (e) {
    console.error("[migrate-accounts]", e);
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
