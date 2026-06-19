import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { kvDel } from "@/lib/kv-store";
import { getSessionFromCookieHeader, resolveCurrentName } from "@/lib/session";
import { errorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

type FieldMap = Record<string, unknown>;

function buildProperties(fields: FieldMap) {
  const props: Record<string, unknown> = {};

  const sel = (name: string, val: string) => {
    props[name] = val ? { select: { name: val } } : { select: null };
  };
  const stat = (name: string, val: string) => {
    props[name] = val ? { status: { name: val } } : { status: null };
  };
  const txt = (name: string, val: string, isTitle = false) => {
    const block = [{ text: { content: val ?? "" } }];
    props[name] = isTitle ? { title: block } : { rich_text: block };
  };
  const dt = (name: string, val: string) => {
    props[name] = val ? { date: { start: val } } : { date: null };
  };

  if (fields.status              !== undefined) sel("사용/재고/만료/갱신필요/신규등록", String(fields.status));
  if (fields.company             !== undefined) sel("법인명",            String(fields.company));
  if (fields.licenseType         !== undefined) sel("영구 / 구독",       String(fields.licenseType));
  if (fields.workType            !== undefined) sel("SW사용직군",        String(fields.workType));
  if (fields.accountType         !== undefined) sel("계정유형",           String(fields.accountType));
  if (fields.renewalCycle        !== undefined) sel("갱신주기",           String(fields.renewalCycle));
  if (fields.shipStatus          !== undefined) stat("출고진행상황",      String(fields.shipStatus));

  if (fields.user                !== undefined) txt("사용자",             String(fields.user), true);
  if (fields.department          !== undefined) txt("부서",               String(fields.department));
  if (fields.licenseKey          !== undefined) txt("인증키 / 인증계정",  String(fields.licenseKey));
  if (fields.vendor              !== undefined) txt("구매처",             String(fields.vendor));
  if (fields.swDetail            !== undefined) txt("SW소분류",          String(fields.swDetail));

  if (fields.billingType         !== undefined) sel("결재방식",           String(fields.billingType));

  if (fields.renewalDate         !== undefined) dt("갱신필요일",          String(fields.renewalDate ?? ""));
  if (fields.usageDate           !== undefined) dt("사용일자",            String(fields.usageDate ?? ""));
  if (fields.returnDate          !== undefined) dt("회수일자",            String(fields.returnDate ?? ""));

  const num = (name: string, val: number) => { props[name] = { number: val > 0 ? val : null }; };
  if (fields.monthlyKrw          !== undefined) num("월 비용 (KRW)",      Number(fields.monthlyKrw ?? 0));
  if (fields.monthlyUsd          !== undefined) num("월 비용 (USD)",      Number(fields.monthlyUsd ?? 0));

  if (fields.lastModifiedBy !== undefined) txt("마지막수정자",   String(fields.lastModifiedBy));
  if (fields.lastModifiedAt !== undefined) txt("마지막수정일시", String(fields.lastModifiedAt));

  return props;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, fields } = body as { id: string; fields: FieldMap };

    if (!id || typeof id !== "string") {
      return NextResponse.json({ ok: false, error: "id 필수" }, { status: 400 });
    }
    if (!fields || typeof fields !== "object") {
      return NextResponse.json({ ok: false, error: "fields 필수" }, { status: 400 });
    }

    const session = getSessionFromCookieHeader(req.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const modifiedBy = `${await resolveCurrentName(session)} (${session.userId})`;
    const fieldsWithModifier: FieldMap = {
      ...fields,
      lastModifiedBy: modifiedBy,
      lastModifiedAt: new Date().toISOString(),
    };

    const properties = buildProperties(fieldsWithModifier);
    if (Object.keys(properties).length === 0) {
      return NextResponse.json({ ok: false, error: "업데이트할 필드 없음" }, { status: 400 });
    }

    await notion.pages.update({
      page_id: id,
      properties: properties as Parameters<typeof notion.pages.update>[0]["properties"],
    });

    await kvDel("sw:all");

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[API /sw/update]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
