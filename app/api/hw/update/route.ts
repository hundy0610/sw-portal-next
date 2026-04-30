import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { kvDel } from "@/lib/kv-store";

export const dynamic = "force-dynamic";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

// HwRecord 필드 → Notion 프로퍼티 매핑
type FieldMap = Record<string, unknown>;

function buildProperties(fields: FieldMap) {
  const props: Record<string, unknown> = {};

  const sel = (name: string, val: string) => {
    props[name] = val ? { select: { name: val } } : { select: null };
  };
  const txt = (name: string, val: string, isTitle = false) => {
    const block = [{ text: { content: val ?? "" } }];
    props[name] = isTitle ? { title: block } : { rich_text: block };
  };
  const dt = (name: string, val: string) => {
    props[name] = val ? { date: { start: val } } : { date: null };
  };

  if (fields.status      !== undefined) sel("사용/재고/폐기/기타",  String(fields.status));
  if (fields.company     !== undefined) sel("법인명",                String(fields.company));
  if (fields.maker       !== undefined) sel("제조사",                String(fields.maker));

  if (fields.user        !== undefined) txt("사용자",    String(fields.user),     true);
  if (fields.dept        !== undefined) txt("부서",      String(fields.dept));
  if (fields.location    !== undefined) txt("위치",      String(fields.location));
  if (fields.note        !== undefined) txt("기타",      String(fields.note));
  if (fields.docNo       !== undefined) txt("결재문서번호", String(fields.docNo));

  if (fields.returnDue   !== undefined) dt("반납예정일", String(fields.returnDue  ?? ""));
  if (fields.returnDate  !== undefined) dt("반납일자",   String(fields.returnDate ?? ""));
  if (fields.useDate     !== undefined) dt("사용일자",   String(fields.useDate    ?? ""));

  if (fields.verified !== undefined) {
    props["실사확인"] = { checkbox: !!fields.verified };
  }

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

    const properties = buildProperties(fields);
    if (Object.keys(properties).length === 0) {
      return NextResponse.json({ ok: false, error: "업데이트할 필드 없음" }, { status: 400 });
    }

    // Notion 페이지 업데이트
    await notion.pages.update({ page_id: id, properties: properties as Parameters<typeof notion.pages.update>[0]["properties"] });

    // KV 캐시 무효화 (다음 조회 시 Notion에서 새로 fetch)
    await kvDel("hw:all", "hw:stats");

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[API /hw/update]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
