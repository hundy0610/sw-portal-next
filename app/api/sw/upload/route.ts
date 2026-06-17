import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { memDel } from "@/lib/mem-cache";
import { kvDel } from "@/lib/kv-store";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

// SW 통합 데이터베이스 (lib/notion.ts fetchSwDatabase와 동일)
const DB_ID = process.env.NOTION_DB_SW_UNIFIED!;

// 엑셀 1행 → SwDbRecord 컬럼 매핑용 인터페이스
export interface SwUploadRow {
  user:         string;   // 사용자 (title, 필수)
  swCategory:   string;   // SW대분류
  swDetail:     string;   // SW소분류
  version:      string;   // 버전 (쉼표 구분 → multi_select)
  status:       string;   // 상태 (사용중/재고/갱신필요/만료/신규등록)
  company:      string;   // 법인명
  licenseType:  string;   // 영구/구독(업체)/구독(웹)
  department:   string;   // 부서
  usageDate:    string;   // 사용일자 YYYY-MM-DD
  renewalDate:  string;   // 갱신필요일 YYYY-MM-DD
  purchaseDate: string;   // 구매일자 YYYY-MM-DD
  accountType:  string;   // 계정유형
  renewalCycle: string;   // 갱신주기 (연/월)
  licenseKey:   string;   // 인증키/인증계정
  vendor:       string;   // 구매처
  workType:     string;   // SW사용직군
  billingType:  string;   // 결제방식
  monthlyKrw:   number;   // 월비용(KRW)
  monthlyUsd:   number;   // 월비용(USD)
  certificateFileUploadId?: string; // 증서 파일 업로드 ID (선택)
}

// ISO 날짜 정규화 (YYYY-MM-DD / YYYY.MM.DD / Excel serial)
function toIsoDate(val: string | number | undefined): string | null {
  if (!val) return null;
  if (typeof val === "number") {
    const d = new Date((val - 25569) * 86400 * 1000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(val).trim();
  const m1 = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m1) return `${m1[1]}-${m1[2].padStart(2, "0")}-${m1[3].padStart(2, "0")}`;
  const m2 = s.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})/);
  if (m2) return `${m2[1]}-${m2[2].padStart(2, "0")}-${m2[3].padStart(2, "0")}`;
  return null;
}

async function createSwPage(row: SwUploadRow) {
  const usageDate    = toIsoDate(row.usageDate);
  const renewalDate  = toIsoDate(row.renewalDate);
  const purchaseDate = toIsoDate(row.purchaseDate);

  // 버전: 쉼표 구분 문자열 → multi_select 배열
  const versions = row.version
    ? row.version.split(",").map(v => v.trim()).filter(Boolean)
    : [];

  return notion.pages.create({
    parent: { database_id: DB_ID },
    properties: {
      // ── 사용자 (title) ──────────────────────────────
      "사용자": {
        title: [{ text: { content: row.user || "" } }],
      },
      // ── 텍스트 필드 ──────────────────────────────────
      ...(row.swDetail ? {
        "SW소분류": { rich_text: [{ text: { content: row.swDetail } }] },
      } : {}),
      ...(row.department ? {
        "부서": { rich_text: [{ text: { content: row.department } }] },
      } : {}),
      ...(row.licenseKey ? {
        "인증키 / 인증계정": { rich_text: [{ text: { content: row.licenseKey } }] },
      } : {}),
      ...(row.vendor ? {
        "구매처": { rich_text: [{ text: { content: row.vendor } }] },
      } : {}),
      // ── Select 필드 ──────────────────────────────────
      ...(row.swCategory ? {
        "SW대분류": { select: { name: row.swCategory } },
      } : {}),
      ...(row.status ? {
        "사용/재고/만료/갱신필요/신규등록": { select: { name: row.status } },
      } : {
        // 기본값: 신규등록
        "사용/재고/만료/갱신필요/신규등록": { select: { name: "신규등록" } },
      }),
      ...(row.company ? {
        "법인명": { select: { name: row.company } },
      } : {}),
      ...(row.licenseType ? {
        "영구 / 구독": { select: { name: row.licenseType } },
      } : {}),
      ...(row.accountType ? {
        "계정유형": { select: { name: row.accountType } },
      } : {}),
      ...(row.renewalCycle ? {
        "갱신주기": { select: { name: row.renewalCycle } },
      } : {}),
      ...(row.workType ? {
        "SW사용직군": { select: { name: row.workType } },
      } : {}),
      ...(row.billingType ? {
        "결재방식": { select: { name: row.billingType } },
      } : {}),
      // ── Multi-select ─────────────────────────────────
      ...(versions.length > 0 ? {
        "version": { multi_select: versions.map(v => ({ name: v })) },
      } : {}),
      // ── 날짜 필드 ────────────────────────────────────
      ...(usageDate ? {
        "사용일자": { date: { start: usageDate } },
      } : {}),
      ...(renewalDate ? {
        "갱신필요일": { date: { start: renewalDate } },
      } : {}),
      ...(purchaseDate ? {
        "구매일자": { date: { start: purchaseDate } },
      } : {}),
      // ── 숫자 필드 ────────────────────────────────────
      ...(row.monthlyKrw > 0 ? {
        "월 비용 (KRW)": { number: row.monthlyKrw },
      } : {}),
      ...(row.monthlyUsd > 0 ? {
        "월 비용 (USD)": { number: row.monthlyUsd },
      } : {}),
      // 파일과 미디어 (증서) ─────────────────
      ...(row.certificateFileUploadId ? {
        "파일과 미디어": {
          files: [{ type: "file_upload", file_upload: { id: row.certificateFileUploadId } }],
        },
      } : {}),
    },
  });
}

export async function POST(req: NextRequest) {
  if (!process.env.NOTION_TOKEN || !DB_ID) {
    return NextResponse.json({ ok: false, error: "환경변수 NOTION_TOKEN 또는 NOTION_DB_SW_UNIFIED가 설정되지 않았습니다." }, { status: 503 });
  }

  try {
    const { rows }: { rows: SwUploadRow[] } = await req.json();

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ ok: false, error: "등록할 데이터가 없습니다." }, { status: 400 });
    }
    if (rows.length > 200) {
      return NextResponse.json({ ok: false, error: "한 번에 최대 200개까지 등록할 수 있습니다." }, { status: 400 });
    }

    const results: { index: number; user: string; sw: string; ok: boolean; error?: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        await createSwPage(row);
        results.push({ index: i, user: row.user, sw: row.swCategory, ok: true });
      } catch (e) {
        results.push({ index: i, user: row.user, sw: row.swCategory, ok: false, error: String(e) });
      }
      // Notion API rate limit 방지 (3 req/sec)
      if (i < rows.length - 1) await new Promise(r => setTimeout(r, 350));
    }

    const success = results.filter(r => r.ok).length;
    const failed  = results.filter(r => !r.ok).length;

    if (success > 0) {
      memDel("sw:all");
      await kvDel("sw:all");
    }

    return NextResponse.json({ ok: true, success, failed, results });
  } catch (e) {
    console.error("[API /sw/upload]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
