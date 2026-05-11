/**
 * .github/scripts/warm-hw.mjs
 *
 * GitHub Actions에서 직접 실행 — Node.js 18+ 내장 fetch 사용, 외부 패키지 없음.
 * Notion HW DB(NT/DT 트래커)를 페이지네이션으로 전부 읽어
 * Upstash Redis REST API에 직접 저장한다.
 *
 * Vercel 서버리스 10초 타임아웃 우회:
 * GitHub Actions는 타임아웃 제한 없이 Notion API를 순차 호출 가능.
 *
 * 환경변수 (GitHub Secrets에 등록 필요):
 *   NOTION_TOKEN              — Notion Integration 토큰
 *   UPSTASH_REDIS_REST_URL    — Upstash Redis REST URL
 *   UPSTASH_REDIS_REST_TOKEN  — Upstash Redis REST Token
 */

const NOTION_TOKEN    = process.env.NOTION_TOKEN;
const UPSTASH_URL     = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN   = process.env.UPSTASH_REDIS_REST_TOKEN;

// lib/hw.ts의 DB_ID와 동일
const HW_DB_ID = "29967f4b-fdac-8086-b468-ef3545b3e471";
const KV_TTL   = 86400; // 24시간 (lib/kv-store.ts KV_TTL과 동일)

// ─── 환경변수 검증 ───────────────────────────────────────────────────────────
if (!NOTION_TOKEN)  { console.error("❌ NOTION_TOKEN 미설정"); process.exit(1); }
if (!UPSTASH_URL)   { console.error("❌ UPSTASH_REDIS_REST_URL 미설정"); process.exit(1); }
if (!UPSTASH_TOKEN) { console.error("❌ UPSTASH_REDIS_REST_TOKEN 미설정"); process.exit(1); }

// ─── Notion 프로퍼티 파서 (lib/hw.ts mapPage와 동일 로직) ─────────────────
const txt = (p, k) => {
  const v = p[k];
  if (!v) return "";
  if (v.type === "title")     return v.title.map(t => t.plain_text).join("");
  if (v.type === "rich_text") return v.rich_text.map(t => t.plain_text).join("");
  return "";
};

const sel = (p, k) => {
  const v = p[k];
  if (!v) return "";
  if (v.type === "select") return v.select?.name || "";
  if (v.type === "status") return v.status?.name || "";
  return "";
};

const dt = (p, k) => {
  const v = p[k];
  if (!v || v.type !== "date") return "";
  return v.date?.start || "";
};

const num = (p, k) => {
  const v = p[k];
  if (!v) return 0;
  if (v.type === "number") return v.number ?? 0;
  if (v.type === "formula" && v.formula.type === "number") return v.formula.number ?? 0;
  return 0;
};

function mapPage(page) {
  const p = page.properties;
  return {
    id:            page.id,
    notionUrl:     page.url,
    user:          txt(p, "사용자"),
    assetNo:       txt(p, "자산번호"),
    model:         txt(p, "모델명"),
    serial:        txt(p, "시리얼 넘버"),
    maker:         sel(p, "제조사"),
    cpu:           txt(p, "CPU"),
    ram:           txt(p, "RAM"),
    company:       sel(p, "법인명"),
    dept:          txt(p, "부서"),
    location:      txt(p, "위치"),
    status:        sel(p, "사용/재고/폐기/기타"),
    returnDue:     dt(p,  "반납예정일"),
    returnDate:    dt(p,  "반납일자"),
    purchaseDate:  dt(p,  "구매일자"),
    useDate:       dt(p,  "사용일자"),
    price:         num(p, "단가"),
    residualValue: num(p, "잔존가치"),
    note:          txt(p, "기타"),
    docNo:         txt(p, "결재문서번호"),
    verified:   p["실사확인"]?.type === "checkbox" ? p["실사확인"].checkbox : false,
    duplicated: p["중복"]?.type     === "checkbox" ? p["중복"].checkbox    : false,
  };
}

// ─── 통계 계산 (lib/hw.ts computeHwStats와 동일 로직) ─────────────────────
const DISPOSAL_STATUSES = [
  "폐기", "폐기확정(리스트화)", "폐기완료", "3층문서고/폐기", "지하창고/폐기",
];

function computeStats(records) {
  const byStatus = {}, byCompany = {}, byMaker = {}, coMap = {};
  let totalValue = 0, verifiedCount = 0;

  for (const r of records) {
    const st = r.status  || "미분류";
    const co = r.company || "미분류";
    const mk = r.maker   || "기타";
    byStatus[st]  = (byStatus[st]  || 0) + 1;
    byCompany[co] = (byCompany[co] || 0) + 1;
    byMaker[mk]   = (byMaker[mk]   || 0) + 1;
    if (!coMap[co]) coMap[co] = { total: 0, active: 0, stock: 0 };
    coMap[co].total++;
    if (r.status === "사용중") coMap[co].active++;
    if (r.status === "재고")   coMap[co].stock++;
    totalValue += r.price || 0;
    if (r.verified) verifiedCount++;
  }

  return {
    total:         records.length,
    byStatus, byCompany, byMaker,
    activeCount:   byStatus["사용중"]       || 0,
    stockCount:    byStatus["재고"]         || 0,
    shipCount:    (byStatus["출고준비중"]   || 0) + (byStatus["출고준비완료"] || 0),
    repairCount:   byStatus["수리"]         || 0,
    rentalCount:   byStatus["렌탈"]         || 0,
    tempCount:     byStatus["임시지급"]      || 0,
    returnCount:   byStatus["반납예정"]      || 0,
    disposalCount: DISPOSAL_STATUSES.reduce((s, k) => s + (byStatus[k] || 0), 0),
    verifiedCount, totalValue,
    companyTable: Object.entries(coMap)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([company, v]) => ({ company, ...v })),
  };
}

// ─── Notion 쿼리 (재시도 포함) ───────────────────────────────────────────────
async function queryNotion(cursor, attempt = 0) {
  const body = { page_size: 100 };
  if (cursor) body.start_cursor = cursor;

  const res = await fetch(`https://api.notion.com/v1/databases/${HW_DB_ID}/query`, {
    method: "POST",
    headers: {
      "Authorization":  `Bearer ${NOTION_TOKEN}`,
      "Notion-Version": "2022-06-28",
      "Content-Type":   "application/json",
    },
    body: JSON.stringify(body),
  });

  // 502/503 일시 오류 → 재시도
  if ((res.status === 502 || res.status === 503) && attempt < 3) {
    const wait = 1000 * (attempt + 1);
    console.warn(`  ⚠️ Notion ${res.status}, ${wait}ms 후 재시도...`);
    await new Promise(r => setTimeout(r, wait));
    return queryNotion(cursor, attempt + 1);
  }

  if (!res.ok) throw new Error(`Notion API ${res.status}: ${await res.text()}`);
  return res.json();
}

// ─── Upstash REST API로 저장 ─────────────────────────────────────────────────
async function pushToUpstash(records, stats) {
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify([
      ["SET", "hw:all",   JSON.stringify(records), "EX", String(KV_TTL)],
      ["SET", "hw:stats", JSON.stringify(stats),   "EX", String(KV_TTL)],
    ]),
  });

  if (!res.ok) throw new Error(`Upstash API ${res.status}: ${await res.text()}`);
  return res.json();
}

// ─── 메인 ────────────────────────────────────────────────────────────────────
async function main() {
  const start = Date.now();
  console.log(`[warm-hw] 시작: ${new Date().toISOString()}`);

  const records = [];
  let cursor;
  let pageNum = 0;

  do {
    const data = await queryNotion(cursor);
    pageNum++;
    for (const page of data.results) {
      if (page.object === "page" && page.properties) {
        records.push(mapPage(page));
      }
    }
    cursor = data.has_more ? data.next_cursor : undefined;
    console.log(`  페이지 ${pageNum}: 누적 ${records.length}건`);
  } while (cursor);

  // lib/hw.ts fetchAllHwRecords와 동일한 정렬 (구매일자 내림차순)
  records.sort((a, b) => (b.purchaseDate || "") > (a.purchaseDate || "") ? 1 : -1);

  const stats = computeStats(records);

  console.log(`[warm-hw] Upstash에 저장 중...`);
  await pushToUpstash(records, stats);

  const elapsed = Date.now() - start;
  console.log(`[warm-hw] 완료: ${records.length}건, ${elapsed}ms (${(elapsed/1000).toFixed(1)}s)`);
}

main().catch(e => {
  console.error("[warm-hw] 오류:", e.message);
  process.exit(1);
});
