import { NextRequest, NextResponse } from "next/server";
import type { HwRecord } from "@/lib/hw";
import { insertHwRecords, isPostgresEnabled } from "@/lib/repo/hw";
import { kvGet, kvSetPermanent } from "@/lib/kv-store";
import { getSessionFromCookieHeader, resolveCurrentName, companyScope } from "@/lib/session";
import { errorMessage } from "@/lib/api-error";
import type { RegistrationRecord } from "@/app/api/hw/registration-log/route";

export const dynamic = "force-dynamic";

const REGISTRATION_LOG_KEY = "hw-registration-log";

// 엑셀 1행 → HW 레코드
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
  mac?:        string;  // MAC (PC 실사 스캔 등록 시에만 사용)
  email?:      string;  // 이메일 (PC 실사 스캔 등록 시에만 사용)
}

// ISO 날짜 문자열로 정규화 (다양한 형식 지원)
function toIsoDate(val: string | number | undefined): string | null {
  if (!val) return null;
  if (typeof val === "number") {
    const ms = (val - 25569) * 86400 * 1000;
    const d  = new Date(ms);
    return d.toISOString().slice(0, 10);
  }
  const s = String(val).trim();
  const m1 = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m1) return `${m1[1]}-${m1[2].padStart(2,"0")}-${m1[3].padStart(2,"0")}`;
  const m2 = s.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})/);
  if (m2) return `${m2[1]}-${m2[2].padStart(2,"0")}-${m2[3].padStart(2,"0")}`;
  return null;
}

// 엑셀 1행 → HW 레코드(hw 테이블 행). 신규 생성이므로 로컬 uuid 를 id 로 부여하고
// notion_id/notionUrl 은 백업 러너가 Notion 페이지 생성 후 채운다.
function rowToHwRecord(row: ExcelRow, modifiedBy: string, modifiedAt: string): HwRecord {
  return {
    id:            crypto.randomUUID(),
    notionUrl:     "",
    user:          row.user || "",
    assetNo:       row.assetNo || "",
    model:         row.model || "",
    serial:        row.serial || "",
    maker:         row.maker || "",
    cpu:           row.cpu || "",
    ram:           row.ram || "",
    company:       row.company || "",
    dept:          row.dept || "",
    location:      row.location || "",
    status:        "사용중",
    returnDue:     "",
    returnDate:    "",
    purchaseDate:  toIsoDate(row.purchaseDate as unknown as string | number) || "",
    useDate:       toIsoDate(row.useDate as unknown as string | number) || "",
    price:         row.price > 0 ? row.price : 0,
    residualValue: 0,
    note:          "",
    docNo:         "",
    mac:           row.mac || "",
    email:         row.email || "",
    verified:      true,
    duplicated:    false,
    lastModifiedBy: modifiedBy,
    lastModifiedAt: modifiedAt,
    changeLog:     "",
  };
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
    if (!isPostgresEnabled()) {
      return NextResponse.json({ ok: false, error: "데이터 저장소(Postgres)가 설정되지 않았습니다." }, { status: 503 });
    }

    const session = getSessionFromCookieHeader(req.headers.get("cookie"));
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const scope = companyScope(session);
    if (scope && rows.some(r => (r.company || "").trim() !== scope)) {
      return NextResponse.json({ ok: false, error: "본인 법인 데이터만 등록할 수 있습니다." }, { status: 403 });
    }
    const adminName = await resolveCurrentName(session);
    const modifiedBy = `${adminName} (${session.userId})`;
    const modifiedAt = new Date().toISOString();

    // 메인 저장소(맥북 Postgres)에 일괄 insert + dirty → 5분 뒤 Notion 페이지 생성(백업).
    const records = rows.map(row => rowToHwRecord(row, modifiedBy, modifiedAt));
    const ok = await insertHwRecords(records as unknown as Record<string, unknown>[]);
    if (!ok) {
      return NextResponse.json({ ok: false, error: "등록 실패(Postgres). 잠시 후 다시 시도해주세요." }, { status: 502 });
    }
    const success = records.length;

    // 신규 등록 로그 기록 (연단위 분석용) — KV 는 그대로 사용
    try {
      const newLogs: RegistrationRecord[] = rows.map(row => ({
        id: crypto.randomUUID(),
        registeredAt: modifiedAt,
        assetNo: row.assetNo || "",
        model: row.model || "",
        serial: row.serial || "",
        user: row.user || "",
        company: row.company || "",
        dept: row.dept || "",
        maker: row.maker || "",
        price: row.price || 0,
        purchaseDate: toIsoDate(row.purchaseDate as unknown as string | number) || "",
        useDate: toIsoDate(row.useDate as unknown as string | number) || "",
        registeredBy: modifiedBy,
      }));
      const existingLog = (await kvGet<RegistrationRecord[]>(REGISTRATION_LOG_KEY)) ?? [];
      await kvSetPermanent(REGISTRATION_LOG_KEY, [...newLogs, ...existingLog]);
    } catch (e) {
      console.warn("[hw/upload] registration-log patch failed:", e);
    }

    const results = records.map((r, i) => ({ index: i, user: r.user, assetNo: r.assetNo, ok: true }));
    return NextResponse.json({ ok: true, success, failed: 0, results });
  } catch (e) {
    console.error("[API /hw/upload]", e);
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
