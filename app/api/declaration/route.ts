import { NextRequest } from "next/server";
import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { errorMessage } from "@/lib/api-error";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

// ─── 프로퍼티 파서 (선언 전용, 경량) ─────────────────────────────────────────
type Props = PageObjectResponse["properties"];

function txt(p: Props, k: string): string {
  const v = p[k]; if (!v) return "";
  if (v.type === "title")     return v.title.map(t => t.plain_text).join("");
  if (v.type === "rich_text") return v.rich_text.map(t => t.plain_text).join("");
  return "";
}
function sel(p: Props, k: string): string {
  const v = p[k];
  return (v?.type === "select") ? (v.select?.name ?? "") : "";
}
function msel(p: Props, k: string): string[] {
  const v = p[k];
  return (v?.type === "multi_select") ? v.multi_select.map(s => s.name) : [];
}
function num(p: Props, k: string): number {
  const v = p[k];
  return (v?.type === "number") ? (v.number ?? 0) : 0;
}
function dt(p: Props, k: string): string {
  const v = p[k];
  return (v?.type === "date") ? (v.date?.start ?? "") : "";
}

// ─── GET /api/declaration?name=...&company=... ────────────────────────────────
// 이름 + 법인명 기준으로 기존 등록 SW 조회
// scope=team인 경우 법인명 + 부서 기준으로 전체 조회
export async function GET(req: NextRequest) {
  try {
    const sp         = new URL(req.url).searchParams;
    const scope       = sp.get("scope")?.trim() ?? "";
    const name        = sp.get("name")?.trim()    ?? "";
    const company     = sp.get("company")?.trim() ?? "";
    const department  = sp.get("department")?.trim() ?? "";

    const dbId = process.env.NOTION_DB_SW_UNIFIED;
    if (!dbId) throw new Error("NOTION_DB_SW_UNIFIED 환경변수가 없습니다.");

    let filter;
    if (scope === "team") {
      if (!company || !department)
        return Response.json({ ok: false, error: "법인명과 부서를 입력해주세요." }, { status: 400 });
      filter = {
        and: [
          { property: "법인명", select: { equals: company } },
          { property: "부서",   rich_text: { contains: department } },
        ],
      };
    } else {
      if (!name || !company)
        return Response.json({ ok: false, error: "이름과 법인명을 입력해주세요." }, { status: 400 });
      filter = {
        and: [
          { property: "법인명", select: { equals: company } },
          { property: "사용자", title:  { contains: name  } },
        ],
      };
    }

    const res = await notion.databases.query({
      database_id: dbId,
      filter,
      page_size: 100,
    });

    const records = res.results
      .filter((p): p is PageObjectResponse => p.object === "page" && "properties" in p)
      .map(page => {
        const p = page.properties;
        return {
          id:           page.id,
          notionUrl:    `https://www.notion.so/${page.id.replace(/-/g, "")}`,
          user:         txt(p, "사용자"),
          swCategory:   sel(p, "SW대분류"),
          swDetail:     txt(p, "SW소분류"),
          version:      msel(p, "version"),
          status:       sel(p, "사용/재고/만료/갱신필요/신규등록"),
          licenseType:  sel(p, "영구 / 구독"),
          workType:     sel(p, "SW사용직군"),
          billingType:  sel(p, "결재방식"),
          accountType:  sel(p, "계정유형"),
          renewalCycle: sel(p, "갱신주기"),
          monthlyKrw:   num(p, "월 비용 (KRW)"),
          monthlyUsd:   num(p, "월 비용 (USD)"),
          licenseKey:   txt(p, "인증키 / 인증계정"),
          renewalDate:  dt(p,  "갱신필요일"),
          usageDate:    dt(p,  "사용일자"),
        };
      });

    return Response.json({ ok: true, records });
  } catch (e) {
    return Response.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

// ─── 신규 등록 레코드 → Notion 페이지 생성 ────────────────────────────────────
interface DeclarationCreateRecord {
  user: string; company: string; department: string;
  swCategory: string; swDetail?: string;
  licenseType: string; workType: string; billingType: string;
  accountType?: string; renewalCycle?: string;
  version?: string[];
  monthlyKrw?: number; monthlyUsd?: number;
  licenseKey?: string;
  // 팀 엑셀 업로드에서만 채워지는 선택 필드 (양식의 추가 컬럼)
  status?: string; vendor?: string;
  usageDate?: string; renewalDate?: string; purchaseDate?: string;
}

async function createDeclarationPage(dbId: string, r: DeclarationCreateRecord) {
  type NotionProps = Parameters<typeof notion.pages.create>[0]["properties"];
  const props: NotionProps = {
    "사용자": { title: [{ text: { content: r.user } }] },
    "법인명": { select: { name: r.company } },
    "부서":   { rich_text: [{ text: { content: r.department } }] },
    "사용/재고/만료/갱신필요/신규등록": { select: { name: r.status || "신규등록" } },
  };

  if (r.swCategory)       props["SW대분류"]          = { select: { name: r.swCategory } };
  if (r.swDetail)         props["SW소분류"]          = { rich_text: [{ text: { content: r.swDetail } }] };
  if (r.licenseType)      props["영구 / 구독"]       = { select: { name: r.licenseType } };
  if (r.workType)         props["SW사용직군"]        = { select: { name: r.workType } };
  if (r.billingType)      props["결재방식"]           = { select: { name: r.billingType } };
  if (r.accountType)      props["계정유형"]           = { select: { name: r.accountType } };
  if (r.renewalCycle)     props["갱신주기"]           = { select: { name: r.renewalCycle } };
  if (r.version?.length)  props["version"]           = { multi_select: r.version.map(v => ({ name: v })) };
  if ((r.monthlyKrw ?? 0) > 0) props["월 비용 (KRW)"] = { number: r.monthlyKrw! };
  if ((r.monthlyUsd ?? 0) > 0) props["월 비용 (USD)"] = { number: r.monthlyUsd! };
  if (r.licenseKey)       props["인증키 / 인증계정"] = { rich_text: [{ text: { content: r.licenseKey } }] };
  if (r.vendor)           props["구매처"]             = { rich_text: [{ text: { content: r.vendor } }] };
  if (r.usageDate)        props["사용일자"]           = { date: { start: r.usageDate } };
  if (r.renewalDate)      props["갱신필요일"]         = { date: { start: r.renewalDate } };
  if (r.purchaseDate)     props["구매일자"]           = { date: { start: r.purchaseDate } };

  return notion.pages.create({ parent: { database_id: dbId }, properties: props });
}

// ─── POST /api/declaration ────────────────────────────────────────────────────
// type:"update"     → 기존 레코드 상태 변경
// type:"create"     → 신규 SW 신고 (Notion에 신규등록 상태로 생성)
// type:"createMany" → 신규 SW 일괄 신고 (개인 플로우, 다건 한번에 등록)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const dbId = process.env.NOTION_DB_SW_UNIFIED;
    if (!dbId) throw new Error("NOTION_DB_SW_UNIFIED 환경변수가 없습니다.");

    // ── 상태 업데이트 ──────────────────────────────────────────────────────────
    if (body.type === "update") {
      const { pageId, status } = body as { pageId: string; status: string };
      await notion.pages.update({
        page_id: pageId,
        properties: {
          "사용/재고/만료/갱신필요/신규등록": { select: { name: status } },
        },
      });
      return Response.json({ ok: true });
    }

    // ── 신규 등록 ──────────────────────────────────────────────────────────────
    if (body.type === "create") {
      const page = await createDeclarationPage(dbId, body.record as DeclarationCreateRecord);
      return Response.json({ ok: true, id: page.id });
    }

    // ── 신규 일괄 등록 ──────────────────────────────────────────────────────────
    if (body.type === "createMany") {
      const records = body.records as DeclarationCreateRecord[];
      if (!Array.isArray(records) || records.length === 0)
        return Response.json({ ok: false, error: "등록할 항목이 없습니다." }, { status: 400 });

      const ids: string[] = [];
      for (let i = 0; i < records.length; i++) {
        const page = await createDeclarationPage(dbId, records[i]);
        ids.push(page.id);
        // Notion API rate limit 방지 (3 req/sec)
        if (i < records.length - 1) await new Promise(res => setTimeout(res, 350));
      }
      return Response.json({ ok: true, ids });
    }

    return Response.json({ ok: false, error: "Invalid type" }, { status: 400 });
  } catch (e) {
    return Response.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
