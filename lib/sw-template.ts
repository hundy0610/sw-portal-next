import * as XLSX from "xlsx";
import type { SwDbRecord } from "@/types";

// SW 등록 양식 엑셀 컬럼 — admin 엑셀 업로드(SW_COL_MAP)와 동일한 헤더를 사용한다.
export const SW_TEMPLATE_HEADERS = [
  "사용자", "SW대분류", "SW소분류", "버전(쉼표구분)", "상태",
  "법인명", "라이선스유형", "부서", "사용일자", "갱신필요일", "구매일자",
  "계정유형", "갱신주기", "인증키/인증계정", "구매처", "SW사용직군", "결제방식",
  "월비용KRW", "월비용USD",
];

const SAMPLE_ROW: (string | number)[] = [
  "홍길동", "MS Office", "Office 365", "2021,2024", "사용중",
  "대웅제약", "영구", "IT팀", "2024-01-01", "2025-12-31", "2024-01-01",
  "법인", "연", "XXXXX-XXXXX-XXXXX", "MS Korea", "사무직", "법인카드",
  0, 0,
];

const NOTE_LINES = [
  "※ 사용자·SW대분류는 필수 입력",
  "상태: 사용중/재고/갱신필요/만료/신규등록",
  "라이선스유형: 영구/구독(업체)/구독(웹)",
  "버전: 쉼표로 구분 (예: 2021,2024)",
  "날짜: YYYY-MM-DD 형식",
];

// 법인명/부서를 미리 채운 SW 등록 양식 엑셀 파일을 생성해 다운로드한다.
export function downloadSwTemplate(prefill?: { company?: string; department?: string }) {
  const sample = [...SAMPLE_ROW];
  if (prefill?.company) sample[5] = prefill.company; // 법인명 컬럼
  if (prefill?.department) sample[7] = prefill.department; // 부서 컬럼

  const ws = XLSX.utils.aoa_to_sheet([SW_TEMPLATE_HEADERS, sample]);
  ws["!cols"] = SW_TEMPLATE_HEADERS.map(() => ({ wch: 18 }));

  const noteWs = XLSX.utils.aoa_to_sheet(NOTE_LINES.map(n => [n]));
  noteWs["!cols"] = [{ wch: 60 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "SW등록양식");
  XLSX.utils.book_append_sheet(wb, noteWs, "입력안내");
  XLSX.writeFile(wb, "SW자산_등록양식.xlsx");
}

// ─────────────────────────────────────────────────────────────────────────────
// 엑셀 파일 → SW 행 파싱 (admin 업로드 / 팀 실사 업로드 공용)
// ─────────────────────────────────────────────────────────────────────────────

export interface SwExcelRow {
  user: string; swCategory: string; swDetail: string; version: string;
  status: string; company: string; licenseType: string; department: string;
  usageDate: string; renewalDate: string; purchaseDate: string;
  accountType: string; renewalCycle: string; licenseKey: string;
  vendor: string; workType: string; billingType: string;
  monthlyKrw: number; monthlyUsd: number;
}

// 엑셀 헤더 ↔ SwExcelRow 키 매핑 (다양한 표기 허용)
const SW_COL_MAP: { key: string; aliases: string[] }[] = [
  { key: "user",         aliases: ["사용자", "user"] },
  { key: "swCategory",   aliases: ["sw대분류", "sw분류", "swcategory", "대분류"] },
  { key: "swDetail",     aliases: ["sw소분류", "소분류", "swdetail", "에디션", "버전명"] },
  { key: "version",      aliases: ["버전", "version", "ver", "버전(쉼표구분)", "버전(대표버전구성)"] },
  { key: "status",       aliases: ["상태", "status"] },
  { key: "company",      aliases: ["법인명", "법인", "company"] },
  { key: "licenseType",  aliases: ["라이선스유형", "영구/구독", "licensetype", "유형", "라이선스"] },
  { key: "department",   aliases: ["부서", "department", "dept"] },
  { key: "usageDate",    aliases: ["사용일자", "사용날짜", "usagedate", "use_date"] },
  { key: "renewalDate",  aliases: ["갱신필요일", "갱신일", "renewaldate", "renewal_date"] },
  { key: "purchaseDate", aliases: ["구매일자", "구매날짜", "purchasedate", "purchase_date"] },
  { key: "accountType",  aliases: ["계정유형", "accounttype", "계정"] },
  { key: "renewalCycle", aliases: ["갱신주기", "renewalcycle", "주기"] },
  { key: "licenseKey",   aliases: ["인증키/인증계정", "인증키", "인증계정", "licensekey", "key", "license_key"] },
  { key: "vendor",       aliases: ["구매처", "vendor", "공급사"] },
  { key: "workType",     aliases: ["sw사용직군", "직군", "worktype", "work_type"] },
  { key: "billingType",  aliases: ["결제방식", "결재방식", "billingtype", "billing"] },
  { key: "monthlyKrw",   aliases: ["월비용krw", "월비용(krw)", "월비용_krw", "krw", "월금액(krw)"] },
  { key: "monthlyUsd",   aliases: ["월비용usd", "월비용(usd)", "월비용_usd", "usd", "월금액(usd)"] },
];

// 엑셀 날짜 시리얼 → YYYY-MM-DD 문자열
function excelDateToStr(val: string | number): string {
  if (typeof val === "number") {
    return new Date((val - 25569) * 86400 * 1000).toISOString().slice(0, 10);
  }
  return String(val ?? "").trim();
}

// 헤더 행으로부터 컬럼 인덱스 맵 생성
function buildSwColIndex(headers: string[]): Record<string, number> {
  const idx: Record<string, number> = {};
  headers.forEach((h, i) => {
    const norm = h.toLowerCase().replace(/\s+/g, "");
    for (const { key, aliases } of SW_COL_MAP) {
      if (aliases.some(a => a.replace(/\s+/g, "") === norm)) {
        idx[key] = i;
        break;
      }
    }
  });
  return idx;
}

// 엑셀 파일을 읽어 SW 행 배열로 변환한다 ('사용자' 컬럼이 빈 행은 건너뛴다)
export async function parseSwExcelFile(file: File): Promise<SwExcelRow[]> {
  const buf = await file.arrayBuffer();
  const wb  = XLSX.read(buf, { type: "array" });
  const ws  = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" }) as unknown[][];
  if (raw.length < 2) throw new Error("데이터 행이 없습니다 (헤더 + 최소 1행 필요)");

  const headers = (raw[0] as unknown[]).map(h => String(h ?? ""));
  const colIdx  = buildSwColIndex(headers);
  const parsed: SwExcelRow[] = [];

  for (let i = 1; i < raw.length; i++) {
    const r = raw[i] as unknown[];
    const user = String(r[colIdx["user"] ?? -1] ?? "").trim();
    if (!user) continue;

    const get = (key: string) => String(r[colIdx[key] ?? -1] ?? "").trim();
    const getNum = (key: string) => {
      const v = r[colIdx[key] ?? -1];
      return typeof v === "number" ? v : parseFloat(String(v ?? "0")) || 0;
    };

    parsed.push({
      user,
      swCategory:   get("swCategory"),
      swDetail:     get("swDetail"),
      version:      get("version"),
      status:       get("status") || "신규등록",
      company:      get("company"),
      licenseType:  get("licenseType"),
      department:   get("department"),
      usageDate:    excelDateToStr(r[colIdx["usageDate"] ?? -1] as string | number),
      renewalDate:  excelDateToStr(r[colIdx["renewalDate"] ?? -1] as string | number),
      purchaseDate: excelDateToStr(r[colIdx["purchaseDate"] ?? -1] as string | number),
      accountType:  get("accountType"),
      renewalCycle: get("renewalCycle"),
      licenseKey:   get("licenseKey"),
      vendor:       get("vendor"),
      workType:     get("workType"),
      billingType:  get("billingType"),
      monthlyKrw:   getNum("monthlyKrw"),
      monthlyUsd:   getNum("monthlyUsd"),
    });
  }

  if (parsed.length === 0) throw new Error("유효한 데이터 행이 없습니다. '사용자' 컬럼을 확인해 주세요.");
  if (parsed.length > 200) throw new Error("한 번에 최대 200건까지 업로드 가능합니다.");

  return parsed;
}

// ─────────────────────────────────────────────────────────────────────────────
// 검색 결과 → 엑셀 다운로드 (라이선스 현황판 전용)
// ─────────────────────────────────────────────────────────────────────────────

const SW_EXPORT_HEADERS = [
  "상태", "법인", "부서", "이름", "SW대분류", "SW소분류", "버전",
  "구매일", "사용일", "갱신필요일", "갱신주기", "월비용", "연비용", "결재방식", "구매처",
];

function fmtCost(krw: number, usd: number): string {
  const parts: string[] = [];
  if (krw > 0) parts.push(`${krw.toLocaleString()}원`);
  if (usd > 0) parts.push(`$${usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
  return parts.join(" / ");
}

// 검색/필터된 SW 레코드 목록을 엑셀로 다운로드한다.
export function downloadSwRecordsExcel(records: SwDbRecord[], fileName = "SW라이선스_현황.xlsx") {
  const rows = records.map(r => [
    r.status || "",
    r.company || "",
    r.department || "",
    r.user || "",
    r.swCategory || "",
    r.swDetail || "",
    (r.version ?? []).join(", "),
    r.purchaseDate || "",
    r.usageDate || "",
    r.renewalDate || "",
    r.renewalCycle || "",
    fmtCost(r.monthlyKrw, r.monthlyUsd),
    fmtCost(r.annualKrw, r.annualUsd),
    r.billingType || "",
    r.vendor || "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet([SW_EXPORT_HEADERS, ...rows]);
  ws["!cols"] = SW_EXPORT_HEADERS.map(() => ({ wch: 16 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "라이선스현황");
  XLSX.writeFile(wb, fileName);
}
