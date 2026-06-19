import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { computeHwStats, type HwRecord } from "@/lib/hw";
import { kvGet, kvSetPermanent } from "@/lib/kv-store";
import { getSessionFromCookieHeader, resolveCurrentName } from "@/lib/session";
import { errorMessage } from "@/lib/api-error";

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

// Notion PageObjectResponse → HwRecord 변환 (lib/hw.ts mapPage와 동일 로직)
function pageToHwRecord(page: PageObjectResponse): HwRecord {
  type Props = PageObjectResponse["properties"];
  const p: Props = page.properties;

  const txt = (k: string) => {
    const v = p[k];
    if (!v) return "";
    if (v.type === "title")     return v.title.map((t: { plain_text: string }) => t.plain_text).join("");
    if (v.type === "rich_text") return v.rich_text.map((t: { plain_text: string }) => t.plain_text).join("");
    return "";
  };
  const sel = (k: string) => {
    const v = p[k];
    if (!v) return "";
    if (v.type === "select") return v.select?.name || "";
    if (v.type === "status") return v.status?.name || "";
    return "";
  };
  const dt = (k: string) => {
    const v = p[k];
    if (!v || v.type !== "date") return "";
    return v.date?.start || "";
  };
  const num = (k: string) => {
    const v = p[k];
    if (!v) return 0;
    if (v.type === "number") return v.number ?? 0;
    return 0;
  };

  return {
    id:            page.id,
    notionUrl:     page.url,
    user:          txt("사용자"),
    assetNo:       txt("자산번호"),
    model:         txt("모델명"),
    serial:        txt("시리얼 넘버"),
    maker:         sel("제조사"),
    cpu:           txt("CPU"),
    ram:           txt("RAM"),
    company:       sel("법인명"),
    dept:          txt("부서"),
    location:      txt("위치"),
    status:        sel("사용/재고/폐기/기타"),
    returnDue:     dt("반납예정일"),
    returnDate:    dt("반납일자"),
    purchaseDate:  dt("구매일자"),
    useDate:       dt("사용일자"),
    price:         num("단가"),
    residualValue: num("잔존가치"),
    note:          txt("기타"),
    docNo:         txt("결재문서번호"),
    verified:   p["실사확인"]?.type === "checkbox" ? p["실사확인"].checkbox : false,
    duplicated: p["중복"]?.type     === "checkbox" ? p["중복"].checkbox    : false,
    lastModifiedBy: txt("마지막수정자"),
    lastModifiedAt: txt("마지막수정일시"),
  };
}

async function createHwPage(row: ExcelRow, modifiedBy: string, modifiedAt: string) {
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
      // 마지막수정자/일시 (신규 등록 시점 = 최초 수정으로 기록)
      "마지막수정자": {
        rich_text: [{ text: { content: modifiedBy } }],
      },
      "마지막수정일시": {
        rich_text: [{ text: { content: modifiedAt } }],
      },
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

    const session = getSessionFromCookieHeader(req.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const modifiedBy = `${await resolveCurrentName(session)} (${session.userId})`;
    const modifiedAt = new Date().toISOString();

    const results: { index: number; user: string; assetNo: string; ok: boolean; error?: string; page?: PageObjectResponse }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const page = await createHwPage(row, modifiedBy, modifiedAt) as PageObjectResponse;
        results.push({ index: i, user: row.user, assetNo: row.assetNo, ok: true, page });
      } catch (e) {
        results.push({ index: i, user: row.user, assetNo: row.assetNo, ok: false, error: errorMessage(e) });
      }
      // Rate limit 방지 (Notion API: 3 req/sec)
      if (i < rows.length - 1) await new Promise(r => setTimeout(r, 350));
    }

    const success = results.filter(r => r.ok).length;
    const failed  = results.filter(r => !r.ok).length;

    // KV 캐시에 새 레코드 추가 (삭제하지 않고 append)
    if (success > 0) {
      try {
        const newRecords = results
          .filter(r => r.ok && r.page)
          .map(r => pageToHwRecord(r.page!));

        const existing = await kvGet<HwRecord[]>("hw:all");
        if (existing) {
          // 새 레코드를 앞에 추가 (구매일자 내림차순 — 최신이 앞)
          const merged = [...newRecords, ...existing];
          const stats  = computeHwStats(merged);
          await Promise.all([
            kvSetPermanent("hw:all",   merged),
            kvSetPermanent("hw:stats", stats),
          ]);
        }
        // KV 미스 시 — 다음 warm-hw.yml 실행 때 자연히 반영
      } catch (e) {
        // KV 패치 실패는 치명적이지 않음 (warm-hw.yml 2시간마다 갱신)
        console.warn("[hw/upload] KV patch failed:", e);
      }
    }

    return NextResponse.json({ ok: true, success, failed, results: results.map(({ page: _p, ...r }) => r) });
  } catch (e) {
    console.error("[API /hw/upload]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
