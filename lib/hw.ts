import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

// NT/DT/MOT 트래커 데이터베이스
const DB_ID = "29967f4b-fdac-8086-b468-ef3545b3e471";

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
  if (!v) return "";
  if (v.type === "select") return v.select?.name || "";
  if (v.type === "status") return v.status?.name || "";
  return "";
};

const multiSel = (p: Props, k: string): string[] => {
  const v = p[k];
  if (!v || v.type !== "multi_select") return [];
  return v.multi_select.map(s => s.name);
};

const date = (p: Props, k: string) => {
  const v = p[k];
  if (!v || v.type !== "date") return "";
  return v.date?.start || "";
};

const num = (p: Props, k: string) => {
  const v = p[k];
  if (!v || v.type !== "number") return 0;
  return v.number ?? 0;
};

function mapPage(page: PageObjectResponse) {
  const p = page.properties;
  return {
    id:           page.id,
    notionUrl:    page.url,
    user:         txt(p, "사용자"),
    assetNo:      txt(p, "자산번호"),
    model:        txt(p, "모델명"),
    serial:       txt(p, "시리얼 넘버"),
    maker:        sel(p, "제조사"),
    cpu:          txt(p, "CPU"),
    ram:          txt(p, "RAM"),
    company:      sel(p, "법인명"),
    dept:         txt(p, "부서"),
    location:     txt(p, "위치"),
    status:       sel(p, "사용/재고/폐기/기타"),
    shipStatus:   sel(p, "출고진행상황"),
    returnStatus: sel(p, "반납 진행 상황"),
    returnDue:    date(p, "반납예정일"),
    returnDate:   date(p, "반납일자"),
    returnReason: sel(p, "반납사유"),
    purchaseDate: date(p, "구매일자"),
    useDate:      date(p, "사용일자"),
    price:        num(p, "단가"),
    missing:      multiSel(p, "누락 사항"),
    note:         txt(p, "기타"),
    docNo:        txt(p, "결재문서번호"),
    verified:     p["실사확인"]?.type === "checkbox" ? p["실사확인"].checkbox : false,
    repairStatus: sel(p, "수리진행상황"),
    warranty:     sel(p, "보증"),
    duplicated:   p["중복"]?.type === "checkbox" ? p["중복"].checkbox : false,
  };
}

export type HwRecord = ReturnType<typeof mapPage>;

export async function fetchAllHwRecords(): Promise<HwRecord[]> {
  const records: HwRecord[] = [];
  let cursor: string | undefined;

  do {
    const res = await notion.databases.query({
      database_id: DB_ID,
      sorts: [{ property: "구매일자", direction: "descending" }],
      page_size: 100,
      start_cursor: cursor,
    });

    for (const page of res.results) {
      if (page.object === "page" && "properties" in page) {
        records.push(mapPage(page as PageObjectResponse));
      }
    }

    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return records;
}
