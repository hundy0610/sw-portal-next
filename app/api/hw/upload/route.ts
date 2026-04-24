import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

// NT/DT/MOT 트래커 데이터베이스
const DB_ID = "29967f4b-fdac-8086-b468-ef3545b3e471";

// 엑셀 1행 → Notion 페이지 프로퍼티 변환
interface ExcelRow {
  assetNo:     string;  // 관리번호
  model:       string;  // 모델명
  serial:      string;  // 시리얼
  maker:       string;  // 제조사
  cpu:         string;  // CPU
  ram:         string;  // 램
  company:     string;  // 법인
  user:        string;  // 사용자
  dept:        string;  // 부서
  location:    string;  // 위치
  purchaseDate:string;  // 구매년도(일자)
  price:       number;  // 구매가격
  useDate:     string;  // 사용일자
}

// ISO 날짜 문자열로 정규화 (다양한 형식 지원)
function toIsoDate(val: string | number | undefined): string | null {
  if (!val) return null;
  // 숫자면 엑셀 시리얼 날짜 → JS Date
  if (typeof val === "number") {
    // Excel serial date (1900 epoch)
    const ms = (val - 25569) * 86400 * 1000;
    const d  = new Date(ms);
    return d.toISOString().slice(0, 10);
  }
  const s = String(val).trim();
  // YYYY-MM-DD or YYYY/MM/DD or YYYYMMDD
  const m1 = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m1) return `${m1[1]}-${m1[2].padStart(2,"0")}-${m1[3].padStart(2,"0")}`;
  // YYYY.MM.DD
  const m2 = s.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})/);
  if (m2) return `${m2[1]}-${m2[2].padStart(2,"0")}-${m2[3].padStart(2,"0")}`;
  return null;
}

async function createHwPage(row: ExcelRow) {
  const purchaseDate = toIsoDate(row.purchaseDate as unknown as string | number);
  const useDate      = toIsoDate(row.useDate      as unknown as string | number);

  return notion.pages.create({
    parent: { database_id: DB_ID },
    properties: {
      // 사용자 (title)
      "사용자": {
        title: [{ text: { content: row.user || "" } }],
      },
      // 자산번호
      "자산번호": {
        rich_text: [{ text: { content: row.assetNo || "" } }],
      },
      // 모델명
      "모델명": {
        rich_text: [{ text: { content: row.model || "" } }],
      },
      // 시리얼 넘버
      "시리얼 넘버": {
        rich_text: [{ text: { content: row.serial || "" } }],
      },
      // 제조사 (select)
      ...(row.maker ? {
        "제조사": { select: { name: row.maker } },
      } : {}),
      // CPU
      "CPU": {
        rich_text: [{ text: { content: row.cpu || "" } }],
      },
      // RAM
      "RAM": {
        rich_text: [{ text: { content: row.ram || "" } }],
      },
      // 법인명 (select)
      ...(row.company ? {
        "법인명": { select: { name: row.company } },
      } : {}),
      // 부서
      "부서": {
        rich_text: [{ text: { content: row.dept || "" } }],
      },
      // 위치
      "위치": {
        rich_text: [{ text: { content: row.location || "" } }],
      },
      // 사용/재고/폐기/기타 → 사용중
      "사용/재고/폐기/기타": {
        select: { name: "사용중" },
      },
      // 실사확인 → 구매 등록 시 실물 확인된 것으로 처리
      "실사확인": {
        checkbox: true,
      },
      // 단가
      ...(row.price > 0 ? {
        "단가": { number: row.price },
      } : {}),
      // 구매일자
      ...(purchaseDate ? {
        "구매일자": { date: { start: purchaseDate } },
      } : {}),
      // 사용일자
      ...(useDate ? {
        "사용일자": { date: { start: useDate } },
      } : {}),
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const { rows }: { rows: ExcelRow[] } = await req.json();

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ ok: false, error: "등록할 데이터가 없습니다." }, { status: 400 });
    }
    if (rows.length > 100) {
      return NextResponse.json({ ok: false, error: "한 번에 최대 100개까지 등록할 수 있습니다." }, { status: 400 });
    }

    const results: { index: number; user: string; assetNo: string; ok: boolean; error?: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        await createHwPage(row);
        results.push({ index: i, user: row.user, assetNo: row.assetNo, ok: true });
      } catch (e) {
        results.push({ index: i, user: row.user, assetNo: row.assetNo, ok: false, error: String(e) });
      }
      // Rate limit 방지 (Notion API: 3 req/sec)
      if (i < rows.length - 1) await new Promise(r => setTimeout(r, 350));
    }

    const success = results.filter(r => r.ok).length;
    const failed  = results.filter(r => !r.ok).length;

    return NextResponse.json({ ok: true, success, failed, results });
  } catch (e) {
    console.error("[API /hw/upload]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
